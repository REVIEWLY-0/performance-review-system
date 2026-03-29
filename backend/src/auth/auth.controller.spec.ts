import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, UnauthorizedException } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

// ─── Mock AuthService ─────────────────────────────────────────────────────────

const MOCK_TOKEN    = 'mock.jwt.token';
const MOCK_USER     = { id: 'user-1', email: 'admin@company.com', name: 'Admin', role: 'ADMIN', companyId: 'co-1' };
const MOCK_SESSION  = { access_token: MOCK_TOKEN, user: MOCK_USER };

const mockAuthService = {
  signUp: jest.fn(),
  signIn: jest.fn().mockResolvedValue(MOCK_SESSION),
  signOut: jest.fn().mockResolvedValue({ message: 'Signed out' }),
  verifyToken: jest.fn(),
  requestPasswordReset: jest.fn(),
};

// ─── App bootstrap ────────────────────────────────────────────────────────────

async function createApp(): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [AuthController],
    providers: [{ provide: AuthService, useValue: mockAuthService }],
  }).compile();

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
});
