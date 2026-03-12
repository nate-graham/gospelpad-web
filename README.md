# GospelPad Web

Standalone Next.js web app for GospelPad.

## Required env vars

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`NEXT_PUBLIC_APP_URL` should be the exact public base URL for the deployed web app, with no trailing slash.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm run start
```

## Auth and Supabase setup

- This app is intentionally separate from the existing `mobile/` Expo app.
- It uses the same Supabase backend with browser-safe public env vars only.
- Auth callback handling targets `/auth/callback`.
- Password reset emails should redirect through `/auth/callback?next=/auth/reset-password`.
- Supabase Auth must be configured with:
  - Site URL: your production web origin
  - Redirect URLs:
    - `http://localhost:3000/auth/callback`
    - your preview URL callback if you use previews
    - your production callback URL, for example `https://app.gospelpad.com/auth/callback`

## Deployment

The simplest production-ready target for this app is Vercel:
- it matches Next.js best
- it requires no custom server for this V1 app
- middleware/auth callback behavior works cleanly with standard Next deployment

You can deploy elsewhere as long as the app serves `next start` correctly and the same env/auth callback assumptions are preserved.

Detailed deployment notes: [`docs/deployment.md`](./docs/deployment.md)
Launch checklist: [`docs/launch-checklist.md`](./docs/launch-checklist.md)
