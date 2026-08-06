import Stripe from "stripe";
import { appBaseUrl, stripeEnv, stripePriceEnv } from "@/lib/env";
import type { BillingInterval, PaidPlanTier } from "@/lib/plans";

let stripeClient: Stripe | null = null;

/**
 * Pinned deliberately.
 *
 * Without an explicit version the SDK silently adopts whatever its build
 * default is, so a routine `npm update` can change response shapes underneath
 * working code. Two changes this codebase actually depends on:
 *
 *   - 2025-03-31.basil removed the singular `coupon` / `promotion_code`
 *     parameters in favour of a `discounts` array.
 *   - The same release moved `current_period_start` / `current_period_end` off
 *     the subscription and onto its items, which is where the webhook reads
 *     them from.
 *
 * Matches the default of the installed stripe@22.x. Bump it deliberately, with
 * the changelog open.
 */
// Declared as a const so it infers the literal type, which the SDK's
// `apiVersion` option validates against its known-versions union — a typo or an
// unsupported version fails at compile time rather than at runtime.
const STRIPE_API_VERSION = "2026-04-22.dahlia";

export function getStripeClient() {
    if (!stripeClient) {
        stripeClient = new Stripe(stripeEnv().secretKey, {
            apiVersion: STRIPE_API_VERSION,
        });
    }

    return stripeClient;
}

export function getStripeWebhookSecret() {
    return stripeEnv().webhookSecret;
}

/** Price ID for a given plan and billing interval. */
export function getStripePriceId(
    plan: PaidPlanTier,
    interval: BillingInterval,
): string {
    const prices = stripePriceEnv();

    if (plan === "plus") {
        return interval === "year" ? prices.plusAnnual : prices.plusMonthly;
    }

    return interval === "year" ? prices.proAnnual : prices.proMonthly;
}

export interface ResolvedPrice {
    tier: PaidPlanTier;
    interval: BillingInterval;
}

/**
 * Reverse lookup: Stripe price ID -> plan and interval.
 *
 * Returns null rather than falling back to Free. The previous implementation
 * compared against two env vars and defaulted anything unrecognised to "free",
 * which means introducing annual prices would have silently downgraded every
 * annual subscriber. Callers must handle null by alerting, not by guessing.
 */
export function resolvePriceId(priceId: string | null): ResolvedPrice | null {
    if (!priceId) {
        return null;
    }

    const prices = stripePriceEnv();

    switch (priceId) {
        case prices.plusMonthly:
            return { tier: "plus", interval: "month" };
        case prices.plusAnnual:
            return { tier: "plus", interval: "year" };
        case prices.proMonthly:
            return { tier: "pro", interval: "month" };
        case prices.proAnnual:
            return { tier: "pro", interval: "year" };
        default:
            return null;
    }
}

/**
 * The subscription an invoice belongs to, or null for a one-off invoice.
 *
 * Basil moved this from `invoice.subscription` to
 * `invoice.parent.subscription_details.subscription`. Both shapes are read so
 * the handler survives an API version bump in either direction. Typed loosely
 * on purpose — the point is to tolerate a shape the SDK types may not describe.
 */
export function subscriptionIdFromInvoice(invoice: unknown): string | null {
    if (!invoice || typeof invoice !== "object") {
        return null;
    }

    const record = invoice as {
        parent?: {
            subscription_details?: { subscription?: string | { id?: string } };
        };
        subscription?: string | { id?: string };
    };

    const candidates = [
        record.parent?.subscription_details?.subscription,
        record.subscription,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate) {
            return candidate;
        }

        if (candidate && typeof candidate === "object" && candidate.id) {
            return candidate.id;
        }
    }

    return null;
}

export function getAppBaseUrl() {
    return appBaseUrl();
}
