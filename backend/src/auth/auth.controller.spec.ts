import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, UnauthorizedException } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from '../common/guards/auth.guard';

// ─── Mock AuthService ─────────────────────────────────────────────────────────

const MOCK_TOKEN    = 'mock.jwt.token';
const MOCK_USER     = { id: 'user-1', email: 'admin@company.com', name: 'Admin', role: 'ADMIN', companyId: 'co-1' };
const MOCK_SESSION  = { access_token: MOCK_TOKEN, user: MOCK_USER };

const GENERIC_RESET_MSG = 'If that email exists, a reset link has been sent.';

const mockAuthService = {
  signUp: jest.fn(),
  signIn: jest.fn().mockResolvedValue(MOCK_SESSION),
  signOut: jest.fn().mockResolvedValue({ message: 'Signed out' }),
  verifyToken: jest.fn(),
  requestPasswordReset: jest.fn(),
  forgotPassword: jest.fn().mockResolvedValue({ message: GENERIC_RESET_MSG }),
};

// ─── App bootstrap ────────────────────────────────────────────────────────────

async function createApp(): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [{ provide: AuthService, useValue: mockAuthService }],
  })
    // AuthGuard reads request.user set by TenantContextMiddleware (not wired in tests).
    // Override to inject MOCK_USER so @CurrentUser() resolves correctly.
    .overrideGuard(AuthGuard)
    .useValue({
      // Mirrors what TenantContextMiddleware + AuthGuard do in production:
      // verify the Bearer token, set request.user on success, throw 401 otherwise.
      canActivate: async (ctx: any) => {
        const req = ctx.switchToHttp().getRequest();
        const header: string | undefined = req.headers['authorization'];
        if (!header) throw new UnauthorizedException('User not authenticated');
        const token = header.replace('Bearer ', '');
        const user = await mockAuthService.verifyToken(token); // uses jest mock
        req.user = user;
        return true;
      },
    })
    .compile();

  const app = module.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthController (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Restore default mock implementations after each test
    mockAuthService.signIn.mockResolvedValue(MOCK_SESSION);
    mockAuthService.verifyToken.mockResolvedValue(MOCK_USER);
  });

  // ── POST /api/auth/signin ─────────────────────────────────────────────────

  describe('POST /api/auth/signin', () => {
    it('returns 201 with session on valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/signin')
        .send({ email: 'admin@company.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.access_token).toBe(MOCK_TOKEN);
      expect(mockAuthService.signIn).toHaveBeenCalledWith('admin@company.com', 'password123');
    });

    it('returns 400 when email is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/signin')
        .send({ password: 'password123' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when password is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/signin')
        .send({ email: 'admin@company.com' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when email format is invalid', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/signin')
        .send({ email: 'not-an-email', password: 'password123' });

      expect(res.status).toBe(400);
    });

    it('propagates service errors (e.g. wrong password)', async () => {
      mockAuthService.signIn.mockRejectedValueOnce(new UnauthorizedException('Invalid credentials'));

      const res = await request(app.getHttpServer())
        .post('/api/auth/signin')
        .send({ email: 'admin@company.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/auth/signup ─────────────────────────────────────────────────

  describe('POST /api/auth/signup', () => {
    it('returns 400 when required fields are missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ email: 'test@test.com' }); // missing name, password, companyName

      expect(res.status).toBe(400);
    });

    it('calls authService.signUp with correct args', async () => {
      mockAuthService.signUp.mockResolvedValueOnce(MOCK_SESSION);

      await request(app.getHttpServer())
        .post('/api/auth/signup')
        .send({ email: 'new@co.com', password: 'Pass1234!', name: 'Alice', companyName: 'Acme' });

      expect(mockAuthService.signUp).toHaveBeenCalledWith('new@co.com', 'Pass1234!', 'Alice', 'Acme');
    });
  });

  // ── GET /api/auth/me ──────────────────────────────────────────────────────

  describe('GET /api/auth/me', () => {
    it('returns 401 when Authorization header is missing', async () => {
      const res = await request(app.getHttpServer()).get('/api/auth/me');

      expect(res.status).toBe(401);
    });

    it('returns user data when token is valid', async () => {
      mockAuthService.verifyToken.mockResolvedValueOnce(MOCK_USER);

      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${MOCK_TOKEN}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe(MOCK_USER.email);
    });

    it('propagates 401 when token is invalid', async () => {
      mockAuthService.verifyToken.mockRejectedValueOnce(new UnauthorizedException('Invalid token'));

      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer bad.token.here');

      expect(res.status).toBe(401);
    });
  });

  // ── POST /api/auth/signout ────────────────────────────────────────────────

  describe('POST /api/auth/signout', () => {
    it('returns 201 and calls signOut', async () => {
      const res = await request(app.getHttpServer()).post('/api/auth/signout');

      expect(res.status).toBe(201);
      expect(mockAuthService.signOut).toHaveBeenCalled();
    });
  });

  // ── POST /api/auth/forgot-password ───────────────────────────────────────

  describe('POST /api/auth/forgot-password', () => {
    it('returns 201 with generic message for a registered email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: 'admin@company.com' });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe(GENERIC_RESET_MSG);
      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith('admin@company.com');
    });

    it('returns 201 with same generic message for an unknown email (no enumeration)', async () => {
      // Service always returns the same message regardless of whether user exists
      mockAuthService.forgotPassword.mockResolvedValueOnce({ message: GENERIC_RESET_MSG });

      const res = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody@nowhere.com' });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe(GENERIC_RESET_MSG);
    });

    it('returns 400 when email is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({});

      expect(res.status).toBe(400);
      expect(mockAuthService.forgotPassword).not.toHaveBeenCalled();
    });

    it('returns 400 when email format is invalid', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(mockAuthService.forgotPassword).not.toHaveBeenCalled();
    });

    it('does not require an Authorization header', async () => {
      // Endpoint is public — no auth guard
      const res = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: 'admin@company.com' });
        // Note: no .set('Authorization', ...) header

      expect(res.status).toBe(201);
    });
  });
});
