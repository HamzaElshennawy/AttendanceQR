import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { Fingerprint, MapPin } from "lucide-react";
import { QuorumIcon } from "@/components/QuorumLogo";

export default async function LandingPage() {
    const supabase = await createClient();
    const {
        data: { session },
    } = await supabase.auth.getSession();

    const isLoggedIn = !!session;

    return (
        <div className="min-h-screen bg-[#fafafa] text-zinc-900 font-sans selection:bg-zinc-200">
            {/* Navigation */}
            <nav className="border-b border-zinc-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
                    <Link
                        href="/"
                        className="flex items-center gap-2"
                    >
                        <div className="bg-zinc-900 p-1.5 rounded-md">
                            <QuorumIcon className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-lg font-semibold tracking-tight text-zinc-900">
                            Quorum
                        </span>
                    </Link>
                    <div className="flex items-center gap-4 text-sm font-medium">
                        {isLoggedIn ? (
                            <Link href="/dashboard">
                                <Button
                                    variant="default"
                                    className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-full px-6"
                                >
                                    Go to Dashboard
                                </Button>
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href="/login"
                                    className="text-zinc-600 hover:text-zinc-900 transition-colors"
                                >
                                    Sign In
                                </Link>
                                <Link href="/register">
                                    <Button
                                        variant="default"
                                        className="bg-zinc-900 text-white hover:bg-zinc-800 rounded-full px-6"
                                    >
                                        Start Free
                                    </Button>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <main className="max-w-5xl mx-auto px-6 pt-32 pb-24 text-center">
                <div className="inline-block mb-6 px-3 py-1 text-xs font-semibold tracking-wider text-zinc-500 uppercase bg-zinc-100 rounded-full border border-zinc-200">
                    Enterprise Grade Attendance
                </div>
                <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-zinc-900 mb-8 leading-tight">
                    Precision tracking. <br className="hidden md:block" />
                    Zero friction.
                </h1>
                <p className="text-lg md:text-xl text-zinc-600 max-w-2xl mx-auto mb-12 leading-relaxed">
                    A secure, location-aware attendance system designed for
                    higher education and modern enterprises. Eliminate physical
                    rosters and completely eradicate check-in fraud.
                </p>

                {isLoggedIn ? (
                    <Link href="/dashboard">
                        <Button
                            size="lg"
                            className="bg-zinc-900 text-white hover:bg-zinc-800 text-base h-12 px-8 rounded-full"
                        >
                            Enter Dashboard
                        </Button>
                    </Link>
                ) : (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link href="/register">
                            <Button
                                size="lg"
                                className="bg-zinc-900 text-white hover:bg-zinc-800 text-base h-12 px-8 rounded-full shadow-sm"
                            >
                                Deploy System
                            </Button>
                        </Link>
                        <Link href="/login">
                            <Button
                                size="lg"
                                variant="outline"
                                className="border-zinc-300 text-zinc-700 hover:bg-zinc-50 text-base h-12 px-8 rounded-full"
                            >
                                Sign In to Account
                            </Button>
                        </Link>
                    </div>
                )}
            </main>

            {/* Security Features */}
            <section className="bg-white border-y border-zinc-200 py-24">
                <div className="max-w-5xl mx-auto px-6">
                    <div className="mb-16 text-center">
                        <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
                            Engineered for absolute integrity
                        </h2>
                        <p className="text-zinc-500 mt-4 text-lg">
                            Advanced verification protocols completely prevent
                            proxy attendance.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-12">
                        {[
                            {
                                icon: QuorumIcon,
                                title: "Dynamic QR Code Rotation",
                                desc: "Check-in QR Codes refresh continuously. Capturing and sharing screenshots is rendered fundamentally useless.",
                            },
                            {
                                icon: MapPin,
                                title: "Geofenced Validation",
                                desc: "Strict location boundaries require attendees to be physically present in the designated venue to successfully authenticate.",
                            },
                            {
                                icon: Fingerprint,
                                title: "Device Fingerprinting",
                                desc: "Algorithmic hardware detection prevents identical physical devices from authenticating multiple profiles.",
                            },
                        ].map((feature, i) => (
                            <div
                                key={i}
                                className="flex flex-col items-center text-center"
                            >
                                <div className="h-12 w-12 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-6">
                                    <feature.icon className="h-5 w-5 text-zinc-900" />
                                </div>
                                <h3 className="text-xl font-semibold text-zinc-900 mb-3 tracking-tight">
                                    {feature.title}
                                </h3>
                                <p className="text-zinc-600 leading-relaxed text-sm">
                                    {feature.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Platform Features */}
            <section className="py-24 bg-[#fafafa]">
                <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center gap-16">
                    <div className="flex-1 space-y-8">
                        <h2 className="text-3xl font-bold tracking-tight text-zinc-900">
                            Seamless infrastructure integration
                        </h2>
                        <p className="text-zinc-600 text-md leading-relaxed">
                            Designed to adapt to your existing administrative
                            workflows. Import rosters directly from standardized
                            comma-separated files and export verified attendance
                            records that slot immediately into modern Learning
                            Management Systems.
                        </p>
                        <ul className="space-y-4">
                            {[
                                "Universal Spreadsheet parser for intelligent roster mapping",
                                "Robust administrative dashboard and real-time session monitoring",
                                "Advanced data highlighting for violation auditing",
                            ].map((item, i) => (
                                <li
                                    key={i}
                                    className="flex items-center gap-3"
                                >
                                    <div className="mt-1 shrink-0 h-1.5 w-1.5 rounded-full bg-zinc-900" />
                                    <span className="text-zinc-700 text-md">
                                        {item}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="flex-1 w-full bg-zinc-100 rounded-3xl border border-zinc-200 aspect-square flex items-center justify-center p-8 shadow-inner shadow-zinc-200/50">
                        <div className="w-full max-w-sm space-y-4">
                            {[...Array(3)].map((_, i) => (
                                <div
                                    key={i}
                                    className="h-16 w-full bg-white rounded-xl border border-zinc-200 shadow-sm flex items-center px-4 gap-4"
                                >
                                    <div className="h-8 w-8 rounded-full bg-zinc-100" />
                                    <div className="space-y-2 flex-1">
                                        <div className="h-2 w-1/3 bg-zinc-200 rounded-full" />
                                        <div className="h-2 w-1/4 bg-zinc-100 rounded-full" />
                                    </div>
                                    <div className="h-2 w-8 bg-green-200 rounded-full" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white border-t border-zinc-200 py-12">
                <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="bg-zinc-900 p-1 rounded-sm">
                            <QuorumIcon className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-semibold text-zinc-900 tracking-tight">
                            Quorum
                        </span>
                    </div>
                    <p className="text-sm text-zinc-500">
                        &copy; {new Date().getFullYear()} Attendance Systems
                        infrastructure. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}
