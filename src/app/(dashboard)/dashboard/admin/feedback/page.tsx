"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2, ShieldCheck } from "lucide-react";

interface AdminFeedbackEntry {
    id: string;
    professor_name: string;
    professor_email: string;
    category: string;
    rating: number | null;
    severity: string | null;
    message: string;
    status: "submitted" | "reviewed" | "planned";
    attachments: {
        name: string;
        path: string;
        url: string;
        type: string;
        size: number;
    }[];
    created_at: string;
}

export default function AdminFeedbackPage() {
    const [feedback, setFeedback] = useState<AdminFeedbackEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [updatingId, setUpdatingId] = useState("");

    useEffect(() => {
        let isActive = true;

        void (async () => {
            const res = await fetch("/api/admin/feedback");
            const data = await res.json();

            if (!isActive) return;

            if (!res.ok) {
                setError(data.error || "Failed to load feedback.");
                setLoading(false);
                return;
            }

            setFeedback(data.feedback || []);
            setError("");
            setLoading(false);
        })();

        return () => {
            isActive = false;
        };
    }, []);

    const handleStatusChange = async (id: string, status: string) => {
        setUpdatingId(id);

        const res = await fetch("/api/admin/feedback", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, status }),
        });

        const data = await res.json();
        if (!res.ok) {
            setError(data.error || "Failed to update status.");
            setUpdatingId("");
            return;
        }

        setFeedback((current) =>
            current.map((entry) =>
                entry.id === id
                    ? {
                          ...entry,
                          status: status as AdminFeedbackEntry["status"],
                      }
                    : entry,
            ),
        );
        setUpdatingId("");
    };

    return (
        <div className="space-y-6">
            <section className="overflow-hidden rounded-[28px] border border-border/70 bg-[linear-gradient(180deg,rgba(251,253,255,0.98),rgba(245,248,252,0.96))] px-6 py-6 shadow-[0_24px_60px_-42px_rgba(22,47,95,0.28)] sm:px-7">
                <Badge className="rounded-full border-primary/20 bg-primary/8 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary hover:bg-primary/8">
                    Admin triage
                </Badge>
                <h1 className="mt-4 font-display text-[2rem] leading-tight text-foreground">
                    Feedback review
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-soft">
                    Review submitted product feedback, scan category and severity quickly, and move items through triage without clutter.
                </p>
            </section>

            <Card className="border-border/70 shadow-[0_24px_60px_-42px_rgba(22,47,95,0.24)]">
                <CardHeader className="border-b border-border/70 bg-background/70">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-100">
                            <ShieldCheck className="h-5 w-5 text-emerald-700" />
                        </div>
                        <CardTitle className="text-lg">
                            All Feedback
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                        </div>
                    ) : error ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                            {error}
                        </div>
                    ) : feedback.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
                            No feedback has been submitted yet.
                        </div>
                    ) : (
                        feedback.map((entry) => (
                            <div
                                key={entry.id}
                                className="rounded-xl border border-gray-300 bg-white p-4 shadow-sm"
                            >
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <Link
                                        href={`/dashboard/admin/feedback/${entry.id}`}
                                        className="block flex-1 rounded-lg transition-colors hover:bg-blue-50/40"
                                    >
                                        <div className="space-y-2">
                                            <div>
                                                <p className="font-medium text-gray-900">
                                                    {entry.professor_name}
                                                </p>
                                                <p className="text-sm text-gray-500">
                                                    {entry.professor_email}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge
                                                    variant="outline"
                                                    className="border-gray-300 bg-gray-50 text-gray-700"
                                                >
                                                    {entry.category}
                                                </Badge>
                                                {entry.rating != null && (
                                                    <Badge
                                                        variant="outline"
                                                        className="border-amber-200 text-amber-700"
                                                    >
                                                        {entry.rating}/5
                                                    </Badge>
                                                )}
                                                {entry.severity && (
                                                    <Badge
                                                        variant="outline"
                                                        className="border-red-200 text-red-700"
                                                    >
                                                        {entry.severity}
                                                    </Badge>
                                                )}
                                                {entry.attachments?.length > 0 && (
                                                    <Badge
                                                        variant="outline"
                                                        className="border-violet-200 text-violet-700"
                                                    >
                                                        {entry.attachments.length} attachment{entry.attachments.length > 1 ? "s" : ""}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="mt-4 whitespace-pre-wrap text-sm text-gray-700">
                                                {entry.message.length > 220
                                                    ? `${entry.message.slice(0, 220)}...`
                                                    : entry.message}
                                            </p>
                                            <p className="mt-3 text-xs text-gray-400">
                                                {new Date(entry.created_at).toLocaleDateString(
                                                    "en-US",
                                                    {
                                                        month: "short",
                                                        day: "numeric",
                                                        year: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    },
                                                )}
                                            </p>
                                        </div>
                                    </Link>

                                    <div className="w-full md:w-48">
                                        <Select
                                            value={entry.status}
                                            onValueChange={(value) =>
                                                handleStatusChange(entry.id, value)
                                            }
                                            disabled={updatingId === entry.id}
                                        >
                                            <SelectTrigger className="border-gray-300 bg-white shadow-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="submitted">
                                                    Submitted
                                                </SelectItem>
                                                <SelectItem value="reviewed">
                                                    Reviewed
                                                </SelectItem>
                                                <SelectItem value="planned">
                                                    Planned
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
