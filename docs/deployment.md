# GospelPad Web Deployment

## Recommended target

Deploy the standalone web app to Vercel for V1.

Why:
- the app is a standard Next.js App Router project
- no custom Node server is required
- middleware-based route protection works normally
- auth callback handling does not need platform-specific customization

## Required environment variables

Set these in every deployed environment:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=https://your-web-domain.com
```

Rules:
- `NEXT_PUBLIC_APP_URL` must match the exact public origin for that environment
- do not include a trailing slash
- use a distinct value for local, preview, and production

Examples:
- local: `http://localhost:3000`
- preview: `https://gospelpad-web-git-branch-owner.vercel.app`
- production: use the canonical deployed host, for example `https://www.gospelpad.com`

## Supabase Auth configuration

In Supabase Auth settings:

1. Set `Site URL` to the production web origin.
2. Add redirect URLs for every environment that can receive auth callbacks:
   - `http://localhost:3000/auth/callback`
   - preview callback URL if applicable
   - production callback URL for the canonical host, such as `https://www.gospelpad.com/auth/callback`

Password recovery should route through:

```text
/auth/callback?next=/auth/reset-password
```

This app already generates those callback URLs from `NEXT_PUBLIC_APP_URL`.
In the browser, callback and invite-link generation now also follows the current `window.location.origin`, which helps when production canonicalizes to `www` or another host.

## Production verification

Run before launch:

```bash
npm install
npm run build
```

Apply the latest Supabase migrations before pointing production traffic at the web app:

```bash
supabase db push
supabase functions deploy fetch_scripture
supabase functions deploy transcribe_audio
```

Then verify:
- sign up
- sign in
- sign out
- password reset email
- password reset callback
- protected route redirect from `/notes`
- authenticated redirect away from `/auth/sign-in`
- dictation upload/transcription/save
- audio clip playback on owned and shared notes
- notes, groups, profile, and settings load correctly

## Current production assumptions

- Supabase anon key is safe to expose in the browser as intended by Supabase
- `fetch_scripture` and `transcribe_audio` are both deployed and healthy
- the `recordings` bucket exists and matches current storage policies
- the web app is deployed as a separate frontend and does not share runtime code with `mobile/`
- `next` redirect parameters are limited to internal paths only

## Current non-infra blockers outside this app

- any production domain used here must also be registered in Supabase Auth before launch
