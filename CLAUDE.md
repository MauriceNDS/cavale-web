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

## Design system — "Massif" (chosen 2026-07-08)

Alpine mineral identity: pine green on stone/moss neutrals, copper for
strength work, clay for shock/errors. Serif display headings (Source Serif 4,
self-hosted via @fontsource — `font-display` utility), system sans body.
All tokens live in `src/index.css` under `@theme` — never hardcode hex in
components.

- **Dark mode**: class-based (`.dark` on `<html>`), managed by
  `src/lib/theme.ts` (light/dark/system, persisted, follows OS in system
  mode). Every component styles BOTH modes via `dark:` variants.
- **Token roles** (light → dark): page `moss-50→moss-900`, card
  `moss-25→moss-850`, field `moss-100→moss-800`, border `moss-200→moss-750`,
  muted text `moss-500→moss-400`, text `ink→linen`, accent
  `pine-600/700→pine-350/300`, accent-soft `pine-100→pine-900`.
- **Semantic colors**: copper = gym/strength; clay = shock weeks & errors;
  pine doubles as success. Week types get themed badges (see the design
  artifact for reference mockups).
- **Layout**: signed-in shell = sidebar (desktop ≥ md) + bottom tab bar
  (mobile, thumb-first); signed-out = slim public header. Cards:
  `rounded-xl border` on card bg — no heavy shadows.
- Shared form primitives in `src/components/form.tsx` (AuthCard, Field,
  ErrorAlert, SubmitButton) — extend these, don't duplicate input styling.

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
