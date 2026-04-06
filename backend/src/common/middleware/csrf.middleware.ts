import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

// Methods that mutate state — these require origin validation
const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Routes that are intentionally public (no auth, no CSRF risk)
const PUBLIC_PATH_PREFIXES = [
  '/api/auth/signin',
  '/api/auth/signup',
  '/api/health',
  '/api/notifications/unsubscribe',
];

function resolvedAllowedOrigins(): string[] {
  return process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
      ];
}

/**
 * CSRF defense-in-depth middleware.
 *
 * Primary protection is already provided by Bearer token authentication —
 * browsers cannot forge the Authorization header cross-origin. This middleware
 * adds a second layer by validating the Origin header on all state-mutating
 * requests in production.
 *
 * Rules:
 *  - Safe methods (GET/HEAD/OPTIONS) are always allowed.
 *  - Public endpoints (signin, signup, health) are skipped.
 *  - In development (NODE_ENV !== 'production'): skipped entirely so that
 *    curl, Postman, and E2E test runners work without friction.
 *  - In production: the Origin header must match one of the allowed origins
 *    from CORS_ORIGIN. Requests without an Origin header but with a valid
 *    Authorization header are allowed through (server-to-server calls).
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Only validate in production — dev/test environments use curl/Postman freely
    if (process.env.NODE_ENV !== 'production') {
      return next();
    }

    // Safe HTTP methods cannot mutate state
    if (!MUTATION_METHODS.has(req.method)) {
      return next();
    }

    // Public paths don't require auth, so CSRF doesn't apply
    const path = req.path;
    if (PUBLIC_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return next();
    }

    const origin = req.get('origin');
    const referer = req.get('referer');
    const requestedWith = req.get('x-requested-with');

    // Server-to-server: no browser Origin header but has Authorization — allow
    if (!origin && !referer && req.get('authorization')) {
      return next();
    }

    // Check X-Requested-With as an additional signal
    const hasXhrHeader = requestedWith === 'XMLHttpRequest';

    // Validate Origin against whitelist
    const allowedOrigins = resolvedAllowedOrigins();
    const requestOrigin = origin || referer || '';
    const originAllowed = allowedOrigins.some((allowed) =>
      requestOrigin.startsWith(allowed),
    );

    if (!originAllowed) {
      throw new ForbiddenException(
        'CSRF check failed: request origin not permitted',
      );
    }

    next();
  }
}
