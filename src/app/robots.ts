import type { MetadataRoute } from "next";

const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://quorum.app";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
        },
        sitemap: `${appBaseUrl}/sitemap.xml`,
        host: appBaseUrl,
    };
}
