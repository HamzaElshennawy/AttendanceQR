# Quorum

Quorum is an academic operations app for QR attendance, coursework tracking, and exam delivery.

## Stack

- Next.js App Router
- Supabase auth + Postgres
- Stripe subscriptions
- Tailwind + custom UI primitives

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_APP_URL=http://localhost:3000

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PLUS_PRICE_ID=
STRIPE_PRO_PRICE_ID=
```

3. Apply the Supabase schema/migrations in `supabase/`.

4. Run the app:

```bash
npm run dev
```

## Key roles

- `Owner`: primary group owner with full group control
- `TA`: shared teaching access without ownership
- `Student`: public check-in/exam consumer through server-validated routes

## Billing model

- `Free`: small pilot plan
- `Plus`: collaboration, richer reporting, advanced exports
- `Pro`: exams and full premium controls

Subscriptions are owned per professor account through Stripe and mirrored in `professor_subscriptions`.

## Important routes

- `/api/attend`: server-validated attendance check-in
- `/api/groups/*`: protected instructor mutations with quota enforcement
- `/api/billing/*`: billing summary, checkout, portal, and Stripe webhook

## Quality checks

```bash
npm run lint
npm run test
```

## Deployment notes

- Configure Stripe webhook delivery to `POST /api/billing/webhook`
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only
- Apply `supabase/migration_v14.sql` before enabling billing in production
