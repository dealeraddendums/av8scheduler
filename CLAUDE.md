# AV8 Scheduler — agent notes

Source of truth for current phase, architecture, and infra facts:
**`N4368V_FlightLog_BuildSpec.md`** — read first when resuming, update its
status tables as work lands.

## Layout

- `apps/web/` — Vite + React web app (deployed to Vercel; push-to-main auto-deploys)
- `apps/ios/` — Expo SDK 56 iOS app (see `apps/ios/AGENTS.md` for Expo notes)
- `packages/api/` — shared types + plain fetch functions for `make-server-82b8c834`
- `packages/ui/` — shared UI primitives
- `supabase/functions/make-server-82b8c834/` — Hono Edge Function (single file: `index.ts`)
- `supabase/migrations/` — SQL migrations

## Commands

Web build: `npx pnpm --filter @av8/web build`
Web dev: `npx pnpm --filter @av8/web dev`
iOS doctor: `npx pnpm --filter @av8/ios exec expo doctor`

Edge Function deploy (manual — not part of git push):
```
npx supabase functions deploy make-server-82b8c834 --project-ref gigaittsnznvzppfqqer
```

Edge Function logs: Supabase dashboard → Functions → `make-server-82b8c834` → Logs.

## Gotchas

- **`pilot_id` mismatch.** `/users` returns IDs prefixed `user:user1` (PUT
  rewrites `id` to the full KV key on edit). The `flights` table stores
  raw `user1`. Strip the prefix at consumer boundaries before comparing.
- **Edge Function error serialization.** Many `catch` blocks in
  `supabase/functions/make-server-82b8c834/index.ts` do
  `c.json({ error: \`...: ${err}\` }, 500)` — that interpolates Supabase
  error objects as `"[object Object]"`. When you touch a route, fix it
  to return `err.message ?? String(err)` and `console.error(err)` first.
- **Edge Function deploys do not ship via `git push`.** Only the web app
  auto-deploys. Always run the `supabase functions deploy` command after
  editing `index.ts` or `kv_store.ts`.

## Workflow — division of labor

Allan's preference: **Claude Code (CC) executes everything possible.**
Cowork/desktop sessions may edit code and commit locally, but all
credentialed or shipping operations belong to CC:

- `git push` (triggers web deploy via Actions)
- Edge Function deploys (`supabase functions deploy …`)
- EAS builds/submits (`eas build`, `eas submit`, credentials, 2FA)
- Supabase dashboard SQL, verification of Actions runs

When a Cowork session finishes code work, it hands Allan a short CC
prompt to paste, rather than raw command blocks. CC should verify
outcomes (Actions green, function deployed, build submitted) before
reporting done.

## Conventions

- Anon JWT is intentionally embedded in `packages/api/index.ts` — it's
  the public anon role key and ships to clients by design. The service
  role key is only inside the Edge Function (server-side).
- Web `apiPost` already extracts `{ error: string }` from non-2xx responses
  and throws an `Error` with that message — clients can rely on
  `err.message` being the server-provided string.
