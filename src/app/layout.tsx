import type { Metadata } from "next";
import { IBM_Plex_Mono, Newsreader, Public_Sans } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/AppProviders";

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
    title: "Quorum — Enterprise Attendance Infrastructure",
    description:
        "Take attendance in seconds with rotating QR codes. Students scan, check in, and you download the report. No apps needed.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body
                className={`${publicSans.variable} ${ibmPlexMono.variable} ${newsreader.variable} font-sans antialiased`}
            >
                <AppProviders>{children}</AppProviders>
            </body>
        </html>
    );
}
