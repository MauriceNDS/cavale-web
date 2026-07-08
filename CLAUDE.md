# Cavale Web — Claude Code Project Guide

Frontend for **Cavale**, the ultra-trail training companion. Companion repo to
`cavale-api` (Spring Boot backend); both are submodules of the `cavale` meta
repo.

## Working agreement

**Claude writes all the code.** The owner reviews and asks questions — answer
teacher-style on demand. Keep commits conventional; **never** add AI/Claude
attribution. Two-step submodule flow: push this repo first, then bump the
pointer in the meta repo.

## Stack

- **React 19 + TypeScript + Vite** (SPA — no SSR)
- **Tailwind CSS 4** (via `@tailwindcss/vite`; theme tokens in `src/index.css`)
- **TanStack Router** (code-based routes in `src/router.tsx`)
- **TanStack Query** for all server state — no manual fetch in components
- **Zod** for form/API payload validation

## Conventions

- **Feature-first layout**: `src/features/<feature>/` holds that feature's
  pages, components, api calls (`api.ts`) — mirrors the backend's packaging.
- `src/lib/` = shared utilities (typed `api` client with RFC 9457
  `ProblemDetail` handling in `src/lib/api.ts` — always throw `ApiError`).
- Server state via TanStack Query hooks; local state via `useState` — no
  global state library until genuinely needed.
- Mobile-first responsive; the app must be fully usable on a phone (live gym
  tracking happens mid-workout).
- Accessibility: labels on inputs, `role="alert"` for errors, keyboard-safe.

## Commands

```bash
npm run dev          # dev server on :5173, proxies /api → :8080
npm run build        # typecheck + production build
npm run lint         # eslint
```

Backend must be running for API calls: `cd ../api && docker compose up -d &&
./mvnw spring-boot:run`.

## Status

Early: app shell, router, register flow wired to `POST /api/auth/register`.
Next: login + JWT session handling, then calendar & plan views (see
`../api/docs/ROADMAP.md`).
