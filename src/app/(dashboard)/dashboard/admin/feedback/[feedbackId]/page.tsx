"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface FeedbackAttachment {
    name: string;
    path: string;
    url: string;
    type: string;
    size: number;
}

interface AdminFeedbackDetail {
    id: string;
    professor_name: string;
    professor_email: string;
    category: string;
    rating: number | null;
    severity: string | null;
    message: string;
    status: string;
    attachments: FeedbackAttachment[];
    created_at: string;
}

export default function AdminFeedbackDetailPage() {
    const params = useParams();
    const feedbackId = params.feedbackId as string;
    const [feedback, setFeedback] = useState<AdminFeedbackDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let isActive = true;

        void (async () => {
            const res = await fetch(`/api/admin/feedback/${feedbackId}`);
            const data = await res.json();

            if (!isActive) return;

            if (!res.ok) {
                setError(data.error || "Failed to load feedback.");
                setLoading(false);
                return;
            }

            setFeedback(data.feedback);
            setLoading(false);
        })();

        return () => {
            isActive = false;
        };
    }, [feedbackId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (error || !feedback) {
        return (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error || "Feedback not found."}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <section className="flex flex-col gap-4 rounded-[28px] border border-border/70 bg-[linear-gradient(180deg,rgba(251,253,255,0.98),rgba(245,248,252,0.96))] px-6 py-6 shadow-[0_24px_60px_-42px_rgba(22,47,95,0.28)] sm:flex-row sm:items-start sm:justify-between sm:px-7">
                <div>
                    <Badge className="rounded-full border-primary/20 bg-primary/8 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary hover:bg-primary/8">
                        Feedback detail
                    </Badge>
                    <h1 className="mt-4 font-display text-[2rem] leading-tight text-foreground">
                        Feedback Detail
                    </h1>
                    <p className="mt-3 text-sm leading-6 text-soft">
                        Full submission details and attachments.
                    </p>
                </div>
                <Link
                    href="/dashboard/admin/feedback"
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    Back to Admin Feedback
                </Link>
            </section>

            <Card className="border-border/70 shadow-[0_24px_60px_-42px_rgba(22,47,95,0.24)]">
                <CardHeader className="border-b border-border/70 bg-background/70">
                    <CardTitle className="text-lg">
                        {feedback.professor_name}
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                        {feedback.professor_email}
                    </p>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                    <div className="flex flex-wrap gap-2">
                        <Badge
                            variant="outline"
                            className="border-gray-300 bg-gray-50 text-gray-700"
                        >
                            {feedback.category}
                        </Badge>
                        {feedback.rating != null && (
                            <Badge
                                variant="outline"
                                className="border-amber-200 text-amber-700"
                            >
                                {feedback.rating}/5
                            </Badge>
                        )}
                        {feedback.severity && (
                            <Badge
                                variant="outline"
                                className="border-red-200 text-red-700"
                            >
                                {feedback.severity}
                            </Badge>
                        )}
                        <Badge
                            variant="outline"
                            className="border-blue-200 bg-blue-50 text-blue-700"
                        >
                            {feedback.status}
                        </Badge>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <h2 className="mb-2 text-sm font-semibold text-gray-900">
                            Message
                        </h2>
                        <p className="whitespace-pre-wrap text-sm text-gray-700">
                            {feedback.message}
                        </p>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                        <h2 className="mb-3 text-sm font-semibold text-gray-900">
                            Attachments
                        </h2>
                        {feedback.attachments?.length ? (
                            <div className="space-y-3">
                                {feedback.attachments.map((attachment) => (
                                    <a
                                        key={attachment.path}
                                        href={attachment.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-700 hover:bg-gray-100"
                                    >
                                        <div className="font-medium">
                                            {attachment.name}
                                        </div>
                                        <div className="mt-1 text-xs text-gray-500">
                                            {attachment.type || "File"} • {(attachment.size / (1024 * 1024)).toFixed(2)} MB
                                        </div>
                                    </a>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">
                                No attachments were included.
                            </p>
                        )}
                    </div>

                    <p className="text-xs text-gray-400">
                        Submitted {new Date(feedback.created_at).toLocaleDateString(
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
                </CardContent>
            </Card>
        </div>
    );
}
