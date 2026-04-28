import Stripe from "stripe";

let stripeClient: Stripe | null = null;

export function getStripeClient() {
    const secretKey = process.env.STRIPE_SECRET_KEY;

    if (!secretKey) {
        throw new Error("Missing STRIPE_SECRET_KEY");
    }

    if (!stripeClient) {
        stripeClient = new Stripe(secretKey);
    }

    return stripeClient;
}

export function getStripePriceId(plan: "plus" | "pro") {
    const priceId =
        plan === "plus"
            ? process.env.STRIPE_PLUS_PRICE_ID
            : process.env.STRIPE_PRO_PRICE_ID;

    if (!priceId) {
        throw new Error(
            `Missing ${plan === "plus" ? "STRIPE_PLUS_PRICE_ID" : "STRIPE_PRO_PRICE_ID"}`,
        );
    }

    return priceId;
}

export function getAppBaseUrl() {
    return (
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_SITE_URL ||
        "http://localhost:3000"
    );
}
