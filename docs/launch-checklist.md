# GospelPad Web Launch Checklist

## Environment

- `NEXT_PUBLIC_SUPABASE_URL` is set correctly
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set correctly
- `NEXT_PUBLIC_APP_URL` matches the canonical deployed base URL
- `NEXT_PUBLIC_APP_URL` has no trailing slash
- `NEXT_PUBLIC_STORAGE_BUCKET_RECORDINGS` is set if production uses a bucket name other than `recordings`
- latest Supabase migrations have been applied

## Supabase Auth

- Site URL matches the canonical deployed web domain
- Redirect URLs include `/auth/callback` for local, preview, and production
- Password reset redirect flow routes through `/auth/callback?next=/auth/reset-password`
- Redirects only target internal app paths
- If the apex domain redirects to `www` or another canonical host, Supabase Auth is configured for that canonical host too

## Core V1 Route Checks

- `/auth/sign-in`
- `/auth/sign-up`
- `/auth/forgot-password`
- `/notes`
- `/notes/new`
- `/groups`
- `/profile`
- `/settings`

## Device QA

- Phone browser: nav, forms, buttons, and note/group detail pages are usable
- Tablet: cards/forms avoid awkward overflow and spacing
- Desktop: shell sidebar, main content width, and keyboard navigation behave correctly

## Accessibility

- Keyboard focus is clearly visible
- Forms have visible labels
- Loading/error states are understandable
- Contrast preference works

## Production Build

- `npm run build` succeeds
- deployed environment has the same env values used during verification
- production callback URL matches Supabase Auth settings

## Backend Safety

- `groups` policies are no longer globally open
- `profiles` writes are limited to the signed-in user
- `fetch_scripture` and `transcribe_audio` are deployed
- `transcribe_audio` requires authenticated callers
- the `recordings` bucket exists and current storage policies match the deployed app
- dictation and shared-note audio playback both work against production storage policies

## Deferred Items To Keep Out Of Launch Scope

- Advanced rich-text parity
- Complex non-audio attachments
- deeper group permissions and `group_note_comments` until their older policies are tightened
- Web push notifications
