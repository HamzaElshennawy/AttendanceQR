# Quorum

Quorum is an academic operations app for QR attendance, coursework tracking, and exam delivery.

## Stack

- Next.js App Router (React 19, React Compiler)
- Supabase auth + Postgres
- Stripe subscriptions
- Tailwind + custom UI primitives

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill it in. Every variable is validated
   at startup by `src/lib/env.ts`, so a missing one fails immediately with the
   name rather than deep inside a request.

3. Apply the database migrations — see `supabase/README.md`. **The baseline
   schema is not yet committed**; that file explains how to capture it and why it
   matters.

```bash
npx supabase db push
```

4. Run the app:

```bash
npm run dev
```

## Key roles

- `Owner`: primary group owner with full group control, including deletes and
  team management
- `TA`: shared teaching access — runs sessions, marks attendance, enters grades,
  but cannot delete students, sessions, or coursework
- `Student`: public check-in/exam consumer through server-validated routes

## Billing model

| | Free | Plus | Pro |
|---|---|---|---|
| Monthly | $0 | $5 | $10 |
| Annual | — | $50 (2 months free) | $100 (2 months free) |
| Groups | 1 | 5 | Unlimited |
| Students | 50 | 500 | Unlimited |
| Sessions/month | 10 | 200 | Unlimited |
| Team members | 0 | 5 | Unlimited |
| Spreadsheet import | ❌ | ✅ | ✅ |
| Reporting and exports | ❌ | ✅ | ✅ |
| Team roles | ❌ | ✅ | ✅ |
| Exams | ❌ | ❌ | ✅ |

Subscriptions are owned per professor account through Stripe and mirrored in
`professor_subscriptions`. Quota is always charged to the **group owner**, not
whoever performs the action, so a TA's activity counts against the owner's plan.

Plans are defined in `src/lib/plans.ts`. `resolveEffectivePlan()` is the single
place that decides what a subscriber is entitled to right now, accounting for
lapsed status, the dunning grace window, and pauses.

## Cancellation retention

Cancelling opens a reason-branched flow (`src/lib/retention.ts`) rather than
cancelling outright:

| Reason | Offer |
|---|---|
| Too expensive | Switch to annual, or step down to Plus if already annual |
| Not using it enough | Downgrade to Plus, or pause |
| Term or semester ended | Pause for up to 3 months |
| Missing a feature | Captured into `feedback_entries` for triage |

Every step is recorded in `retention_events` so deflection can be measured per
reason. Offers are limited to one per 12 months.

A paused subscription drops to Free entitlements — Stripe reports a paused
subscription as `active`, so resolving on status alone would grant an indefinite
free plan. Nothing is deleted, and everything returns on resume.

## Important routes

- `/api/attend`: server-validated attendance check-in (public, rate limited)
- `/api/groups/*`: protected instructor mutations with quota enforcement
- `/api/billing/*`: summary, checkout, portal, retention, and the Stripe webhook
- `/api/exams/*`: public exam delivery, gated by attempt access token

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

All four run in CI on every pull request (`.github/workflows/ci.yml`).

## Deployment notes

- Configure Stripe webhook delivery to `POST /api/billing/webhook`, subscribing
  to `checkout.session.completed`, `customer.subscription.*`,
  `invoice.paid`, and `invoice.payment_failed`
- The Stripe API version is pinned in `src/lib/stripe.ts`. Bump it deliberately,
  with the changelog open — response shapes move between versions
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only
- Set `NEXT_PUBLIC_APP_URL` to the real origin, or checkout returns users to the
  wrong host
- Sentry is inert unless `NEXT_PUBLIC_SENTRY_DSN` is set; source maps upload only
  when `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN` are all present

## Known limitations

- **Geolocation is advisory.** Coordinates are supplied by the browser and can be
  spoofed. Treat the geofence as a deterrent, not proof of presence; the device
  identity signals in `src/lib/device-identity.ts` are the primary anti-proxy
  control.
- **Students are not authenticated.** Check-in identifies a student by university
  ID alone, so anyone holding a valid QR token can check in on someone else's
  behalf. Real student accounts would be the fix.
