import type { Metadata } from "next";
import { IBM_Plex_Mono, Newsreader, Public_Sans } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/AppProviders";
import { Analytics } from "@vercel/analytics/next";

const appBaseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://quorum.app";

const metadataBase = new URL(appBaseUrl);

const publicSans = Public_Sans({
    variable: "--font-public-sans",
    subsets: ["latin"],
    display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
    variable: "--font-ibm-plex-mono",
    subsets: ["latin"],
    display: "swap",
    weight: ["400", "500", "600"],
});

const newsreader = Newsreader({
    variable: "--font-newsreader",
    subsets: ["latin"],
    display: "swap",
});

export const metadata: Metadata = {
    metadataBase,
    title: {
        default: "Quorum | QR Attendance and Grading for Teachers",
        template: "%s | Quorum",
    },
    description:
        "Quorum helps teachers track attendance with QR codes, record grades, and keep student progress organized in one simple workspace.",
    applicationName: "Quorum",
    keywords: [
        "QR attendance",
        "teacher attendance app",
        "student attendance tracker",
        "grading app for teachers",
        "teacher dashboard",
        "attendance and grades",
        "education management",
        "Quorum",
    ],
    alternates: {
        canonical: "/",
    },
    openGraph: {
        type: "website",
        url: "/",
        siteName: "Quorum",
        title: "Quorum | QR Attendance and Grading for Teachers",
        description:
            "Track attendance, save grades, and manage your students in one clear teacher workspace.",
        images: [
            {
                url: "/opengraph-image",
                width: 1200,
                height: 630,
                alt: "Quorum teacher workspace preview",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Quorum | QR Attendance and Grading for Teachers",
        description:
            "Track attendance, save grades, and manage your students in one clear teacher workspace.",
        images: ["/opengraph-image"],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
        },
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            suppressHydrationWarning
        >
            <body
                suppressHydrationWarning
                className={`${publicSans.variable} ${ibmPlexMono.variable} ${newsreader.variable} font-sans antialiased`}
            >
                <Analytics />
                <AppProviders>{children}</AppProviders>
            </body>
        </html>
    );
}
