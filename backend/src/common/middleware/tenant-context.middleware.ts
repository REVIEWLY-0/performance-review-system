import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../services/prisma.service';

// Extend Express Request to include user info
export interface RequestWithUser extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    companyId: string;
    companyName: string;
  };
}

// In-memory user cache: token → { user, expiresAt }
// Avoids a Supabase + DB round-trip on every authenticated request.
// TTL: 60 seconds — safe balance between performance and consistency.
const USER_CACHE_TTL_MS = 60_000;
const userCache = new Map<string, { user: RequestWithUser['user']; expiresAt: number }>();

// Periodically purge expired entries so the map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of userCache) {
    if (entry.expiresAt <= now) userCache.delete(key);
  }
}, USER_CACHE_TTL_MS * 5);

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private supabase;

  constructor(private prisma: PrismaService) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async use(req: RequestWithUser, res: Response, next: NextFunction) {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        throw new UnauthorizedException('No authorization token provided');
      }

      const token = authHeader.replace('Bearer ', '');

      // Check in-memory cache first — avoids Supabase + DB round-trip on every request
      const cached = userCache.get(token);
      if (cached && cached.expiresAt > Date.now()) {
        req.user = cached.user;
        return next();
      }

      // Verify token with Supabase
      const { data, error } = await this.supabase.auth.getUser(token);

      if (error || !data.user) {
        userCache.delete(token); // evict stale entry on auth failure
        throw new UnauthorizedException('Invalid or expired token');
      }

      // Fetch user from database with company_id and company name
      const dbUser = await this.prisma.user.findUnique({
        where: { id: data.user.id },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          companyId: true,
          company: { select: { name: true } },
        },
      });

      if (!dbUser) {
        throw new UnauthorizedException('User not found in system');
      }

      const user: RequestWithUser['user'] = {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
        companyId: dbUser.companyId,
        companyName: dbUser.company.name,
      };

      // Cache for next requests within TTL window
      userCache.set(token, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });

      // Attach user (with company_id) to request object
      req.user = user;

      next();
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Authentication failed');
    }
  }
}

/** Evict a specific token from the cache (call on logout / profile update). */
export function invalidateUserTokenCache(token: string): void {
  userCache.delete(token);
}
