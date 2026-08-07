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
| Free trial | — | 14 days | 14 days |
| Monthly | $0 | $5 | $10 |
| Annual | — | $50 (2 months free) | $100 (2 months free) |
| Groups | 1 | 5 | Unlimited |
| Students | 50 | 500 | Unlimited |
| Sessions/month | 10 | 200 | Unlimited |
| Team members | 0 | 5 | Unlimited |
| Spreadsheet import | ❌ | ✅ | ✅ |
| Team roles | ❌ | ✅ | ✅ |
| Exams | ❌ | ❌ | ✅ |

Subscriptions are owned per professor account through Stripe and mirrored in
`professor_subscriptions`. Quota is always charged to the **group owner**, not
whoever performs the action, so a TA's activity counts against the owner's plan.

Plans are defined in `src/lib/plans.ts`. `resolveEffectivePlan()` is the single
place that decides what a subscriber is entitled to right now, accounting for
lapsed status, the dunning grace window, and pauses.

**Every feature in `EntitlementFeature` must be enforced on the server.** A flag
that gates nothing is a promise the product does not keep: `rich_reporting` was
advertised on the pricing page while gating nothing anywhere, and
`advanced_exports` was checked only in the browser, over a workbook built
client-side from rows the user had already loaded. Both were removed rather than
wired up — coursework exports are now available on every plan. Add a flag when
there is a server boundary to enforce it at, not before.

## Free trial

A first paid subscription starts with a `TRIAL_PERIOD_DAYS` (14 day) Stripe
trial, attached in `/api/billing/checkout`. Trialling subscribers hold the full
entitlements of the tier they picked — `trialing` is an active status, so no
separate entitlement path is needed.

Eligibility is decided server-side by `canStartTrial()` and never from the
request body. Two independent guards, because either alone leaks a free
fortnight:

- `has_used_trial` — sticky, set by the webhook when a trial actually starts, so
  an abandoned checkout does not burn the offer and a lapsed trialler cannot
  claim a second one
- `stripe_subscription_id` — catches a returning customer who subscribed and
  cancelled without ever trialling

Checkout collects a card up front, so the trial converts to a paid subscription
automatically. If the card is removed or expires mid-trial, the subscription is
cancelled rather than charged silently or left free indefinitely.

`resolveTrialState()` reports the trial for display and requires both a
`trialing` status *and* an unexpired end date — Stripe reports the
trial-to-paid transition in a separate event, so a row can briefly claim
`trialing` past its end date, and counting down from that would show negative
days remaining.

Cancelling during a trial sets `cancel_at_period_end`; the trial end *is* the
period end, so access runs out the window and nothing is ever charged.

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

## Exam integrity

The exam surface is public — a student is identified by university ID plus an
attempt access token, never by a logged-in session — so the server treats the
browser as untrusted:

- **Results are gated server-side.** When `show_results_immediately` is off, per
  answer `is_correct` / `awarded_points` are stripped (`redactAnswerGrading`)
  and the submit response withholds the score. The client's own check decides
  what is *drawn*, not what is *sent*.
- **The answer key never leaves the server.** `buildAttemptPresentation`
  whitelists the fields a question is presented with, so `answer_text` and
  `is_correct` cannot ride along on a question object.
- **A missing device ID counts as a mismatch**, not as a skipped check. The
  browser always sends one, so a request without it is not a browser behaving
  normally — it is the device lock being opted out of.
- **Proctoring events are whitelisted.** A client may report only what a browser
  observes (`tab_hidden`, `window_blur`, …). `started`, `submitted`,
  `timed_out`, and `duplicate_session_detected` are server-authored, and the
  client payload is not stored verbatim.

## Important routes

- `/api/attend`: server-validated attendance check-in (public, rate limited)
- `/api/groups/*`: protected instructor mutations with quota enforcement
- `/api/billing/*`: summary, checkout, portal, retention, and the Stripe webhook
- `/api/exams/*`: public exam delivery, gated by attempt access token

## Database migrations

Apply everything in `supabase/migrations/` **before** deploying the code that
reads it. Each file is additive and re-runnable, so re-applying is safe.

The failure mode when you skip one is not obvious: `getOrCreateSubscriptionRecord`
upserts a full row on first use, so a column the code writes but the database
lacks turns `/api/billing/summary` into a 500 and every Stripe webhook into a
retry loop. Two of these matter in order:

| Migration | Why it must run first |
|---|---|
| `20260807000000_free_trial` | Adds `trial_started_at`, `trial_ends_at`, `has_used_trial`, which the checkout route and webhook both write |
| `20260807000100_backfill_missing_profile_rows` | Creates `professors` / `professor_subscriptions` rows for accounts registered before the `handle_new_user` trigger shipped — without it those users get a 406 on the dashboard and a 500 from billing |

Applying them with the Supabase CLI:

```bash
supabase db push
```

Or paste a file into the SQL editor for a project not managed by the CLI.

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
  to `checkout.session.completed`, `customer.subscription.*` (which includes
  `customer.subscription.trial_will_end`), `invoice.paid`, and
  `invoice.payment_failed`
- Create the four prices in Stripe as **recurring** prices — `trial_period_days`
  is rejected on a one-off price — and set the monthly ones to bill monthly and
  the annual ones yearly, matching `src/lib/plans.ts`
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
