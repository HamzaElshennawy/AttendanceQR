import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Quorum",
};

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-indigo-50 p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="mx-auto w-12 h-12 bg-zinc-900 rounded-xl mb-4 flex items-center justify-center">
                        <span className="text-white font-bold text-xl">Q</span>
                    </div>
                    <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">
                        Quorum
                    </h1>
                    <p className="text-zinc-500 mt-2">
                        Enterprise identity verification
                    </p>
                </div>
                {children}
            </div>
        </div>
    );
}
