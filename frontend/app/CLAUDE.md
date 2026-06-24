# Frontend — Next.js App Router Intent Node

See root `CLAUDE.md` for system-wide invariants.

## Route tree

```
app/
├── (auth)/login/        — sign-in form + forgot-password inline flow + set-password mode
├── (auth)/signup/       — company + user creation
├── auth/callback/       — Supabase auth redirect handler (exchanges code → session)
└── (dashboard)/
    ├── admin/
    │   ├── page.tsx              — overview dashboard
    │   ├── employees/            — user list, invite, department assignment
    │   ├── departments/          — department CRUD
    │   ├── questions/            — review question CRUD
    │   ├── review-types/         — custom review type config
    │   ├── reports/              — analytics
    │   ├── scoring/              — weight-config UI (quant/qual, manager/peer/self weights)
    │   └── review-cycles/
    │       ├── page.tsx           — cycle list
    │       ├── new/               — create cycle
    │       ├── [id]/
    │       │   ├── page.tsx       — edit cycle
    │       │   ├── assign-reviewers/ — reviewer assignment UI
    │       │   ├── scores/        — all employee scores for cycle
    │       │   ├── quant-scores/  — set department quant scores per cycle (new source for quant component)
    │       │   ├── goals/         — DORMANT: goals per employee (no longer on scoring path; data kept)
    │       │   └── employee/[employeeId]/reviews/ — attributed review detail (admin)
    ├── manager/
    │   ├── page.tsx              — direct-report list
    │   └── reviews/[employeeId]/ — downward review form
    └── employee/
        ├── page.tsx              — dashboard
        ├── scores/               — own final score breakdown (quant + qual)
        ├── received-reviews/     — reviews written about me (anonymity enforced by backend)
        └── reviews/
            ├── self/             — self-review form
            ├── peer/[id]/        — peer review form
            └── manager/[id]/     — upward review form (employee reviews their manager)
```

## Component patterns

**Server components** (default): data-fetching pages that don't need interactivity.
**Client components** (`'use client'`): forms, state, event handlers.

Prefer thin client components: fetch data server-side, pass to a small client leaf for interaction.

## Auth / session

Session is stored in `localStorage` (Supabase default key `supabase.auth.token`).
`lib/auth.ts` reads it directly to bypass the Supabase SDK lock; see comments there.
`lib/auth.ts → getCurrentUser()` caches the user for 60 s with request deduplication.

Role-based redirects after login: ADMIN → `/admin`, MANAGER → `/manager`, EMPLOYEE → `/employee`.
`middleware.ts` enforces protected routes.

## API calls

All backend calls go through `${process.env.NEXT_PUBLIC_API_URL}` (e.g. `http://localhost:4000/api`).
Authenticated calls use `Authorization: Bearer <session.access_token>` from `lib/auth.ts → getSession()`.
Helper: `lib/api.ts → fetchWithAuth(url, options)`.

## Styling

Tailwind CSS with Material Design 3 colour tokens (`on-surface`, `surface-container-low`, `primary`,
`on-primary`, `error`, etc.). Dark mode supported via class strategy.
