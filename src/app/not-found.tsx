import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
    return (
        <div className="flex min-h-[60vh] items-center justify-center px-6">
            <div className="w-full max-w-md space-y-4 text-center">
                <p className="font-mono text-sm text-muted-foreground">404</p>

                <h1 className="text-xl font-semibold">
                    We couldn&apos;t find that page
                </h1>

                <p className="text-sm text-muted-foreground">
                    The link may be out of date, or the group or session may have
                    been removed.
                </p>

                <div className="flex justify-center gap-3 pt-2">
                    <Button asChild>
                        <Link href="/dashboard">Back to dashboard</Link>
                    </Button>
                    <Button variant="outline" asChild>
                        <Link href="/">Home</Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
