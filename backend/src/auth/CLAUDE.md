# Auth — Intent Node

Supabase Auth provides JWT tokens. The backend holds the service-role key and is the only
party that calls `supabase.auth.admin.*`. The frontend uses the anon key via the JS SDK.

## Two password-reset flows

### 1. Authenticated user (settings page)
- Endpoint: `POST /api/auth/request-password-reset` (requires `AuthGuard`)
- Backend calls `supabase.auth.admin.generateLink({ type: 'recovery', email })`
- Sends recovery link via `notificationsService.sendPasswordResetEmail(userId, link)`
- Frontend: `lib/auth.ts → requestPasswordReset()`

### 2. Unauthenticated forgot-password (login page)
- Endpoint: `POST /api/auth/forgot-password` (no guard, throttled 5/15 min)
- Backend finds user by email; if not found, returns **same generic message** (no enumeration)
- Same link generation + email flow as above
- Frontend: link on login page → inline form → `lib/auth.ts → forgotPassword(email)`

**Anti-enumeration rule**: the forgot-password response is always
`{ message: 'If that email exists, a reset link has been sent.' }` regardless of whether the
user was found. Never return 404 or distinguish between found/not-found.

## Recovery link callback

Recovery links redirect to Supabase's auth callback, which then redirects to
`{SITE_URL}/auth/callback`. The `auth/callback/page.tsx` page exchanges the code for a
session and redirects to `/login?mode=set-password`. The login page detects `mode=set-password`
and shows the password-update form (calls `supabase.auth.updateUser({ password })`).

For dev: Supabase Dashboard → Auth → URL Configuration must have `http://localhost:3000`
as Site URL and `http://localhost:3000/**` in allowed redirect URLs.

## Token verification

Every authenticated request passes through `TenantContextMiddleware`:
1. Reads `Authorization: Bearer <token>` header
2. Calls `supabase.auth.getUser(token)` to verify
3. Loads `User` from Prisma (with `companyId`)
4. Attaches to `request.user` and `request.companyId`

`AuthGuard` depends on this — it reads `request.user` populated by the middleware.

## Anti-patterns

- Never expose the service-role key to the frontend.
- Never skip `companyId` when loading user data post-token-verify.
- Never return `404` on forgot-password (email enumeration risk).
- Never call `supabase.auth.getUser()` twice per request (middleware already does it).
