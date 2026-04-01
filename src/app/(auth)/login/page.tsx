"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }

        router.push("/dashboard");
        router.refresh();
    };

    return (
        <Card className="border-0 bg-transparent shadow-none">
            <form onSubmit={handleLogin}>
                <CardContent className="space-y-4 pt-6">
                    <div className="space-y-2">
                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-primary/80">
                            Sign in
                        </p>
                        <h1 className="text-2xl font-semibold text-foreground">
                            Continue to your workspace
                        </h1>
                        <p className="text-sm leading-6 text-soft">
                            Use your Quorum account to access groups, sessions,
                            coursework, and administrative tools.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="professor@university.edu"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="pb-1"></div>
                    {error && (
                        <p className="rounded-xl border border-destructive/15 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                            {error}
                        </p>
                    )}
                </CardContent>
                <CardFooter className="flex flex-col gap-3 border-t border-border/60 pt-5">
                    <Button
                        type="submit"
                        className="w-full"
                        disabled={loading}
                    >
                        {loading && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Sign In
                    </Button>
                    <p className="text-sm text-soft">
                        Don&apos;t have an account?{" "}
                        <Link
                            href="/register"
                            className="font-medium text-primary transition-colors hover:text-primary/80"
                        >
                            Sign Up
                        </Link>
                    </p>
                </CardFooter>
            </form>
        </Card>
    );
}
