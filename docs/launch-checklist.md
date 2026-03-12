# GospelPad Web Launch Checklist

## Environment

- `NEXT_PUBLIC_SUPABASE_URL` is set correctly
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is set correctly
- `NEXT_PUBLIC_APP_URL` matches the deployed base URL
- `NEXT_PUBLIC_APP_URL` has no trailing slash
- latest Supabase migrations have been applied

## Supabase Auth

- Site URL matches the deployed web domain
- Redirect URLs include `/auth/callback` for local, preview, and production
- Password reset redirect flow routes through `/auth/callback?next=/auth/reset-password`
- Redirects only target internal app paths

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
- `fetch_scripture` is the only edge function used by the current web V1 routes
- no web V1 route depends on storage buckets or upload flows

## Deferred Items To Keep Out Of Launch Scope

- Advanced rich-text parity
- Audio transcription parity
- Complex attachments
- Group notes/comments until RLS is tightened
- Web push notifications
