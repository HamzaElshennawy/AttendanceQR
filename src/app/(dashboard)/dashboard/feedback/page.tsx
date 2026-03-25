"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    CheckCircle2,
    Loader2,
    MessageSquarePlus,
    Trash2,
    UploadCloud,
} from "lucide-react";

interface FeedbackEntry {
    id: string;
    category: string;
    rating: number | null;
    severity: string | null;
    message: string;
    status: string;
    attachments: FeedbackAttachment[];
    created_at: string;
}

interface FeedbackAttachment {
    name: string;
    path: string;
    url: string;
    type: string;
    size: number;
}

function sanitizeFileName(name: string) {
    const extensionIndex = name.lastIndexOf(".");
    const hasExtension = extensionIndex > 0;
    const baseName = hasExtension ? name.slice(0, extensionIndex) : name;
    const extension = hasExtension ? name.slice(extensionIndex).toLowerCase() : "";

    const safeBase = baseName
        .normalize("NFKD")
        .replace(/[^\x00-\x7F]/g, "")
        .replace(/[^a-zA-Z0-9-_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();

    return `${safeBase || "attachment"}${extension}`;
}

const categoryCopy = {
    general: {
        label: "Message",
        placeholder:
            "Share your overall feedback about the system, what feels strong, and what could be better.",
    },
    usability: {
        label: "What felt confusing or slow?",
        placeholder:
            "Describe the flow, page, or action that felt unclear, slow, or harder than expected.",
    },
    bug: {
        label: "What went wrong?",
        placeholder:
            "Describe the issue, what you expected to happen, and any steps that help reproduce it.",
    },
    feature: {
        label: "What should be added?",
        placeholder:
            "Describe the feature you want, why it matters, and how it would help your workflow.",
    },
} as const;

export default function FeedbackPage() {
    const supabase = createClient();
    const [category, setCategory] = useState("general");
    const [rating, setRating] = useState("4");
    const [severity, setSeverity] = useState("medium");
    const [message, setMessage] = useState("");
    const [files, setFiles] = useState<File[]>([]);
    const [isDragActive, setIsDragActive] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");
    const [history, setHistory] = useState<FeedbackEntry[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(true);

    const fetchHistory = useCallback(async () => {
        const { data } = await supabase
            .from("feedback_entries")
            .select("*")
            .order("created_at", { ascending: false });

        setHistory(data || []);
        setLoadingHistory(false);
    }, [supabase]);

    useEffect(() => {
        let isActive = true;

        void (async () => {
            const { data } = await supabase
                .from("feedback_entries")
                .select("*")
                .order("created_at", { ascending: false });

            if (!isActive) return;

            setHistory(data || []);
            setLoadingHistory(false);
        })();

        return () => {
            isActive = false;
        };
    }, [supabase]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setSuccess("");
        setError("");

        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            setError("You must be signed in to send feedback.");
            setSubmitting(false);
            return;
        }

        const attachments: FeedbackAttachment[] = [];

        for (const file of files) {
            const safeName = sanitizeFileName(file.name);
            const filePath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
            const { error: uploadError } = await supabase.storage
                .from("feedback-attachments")
                .upload(filePath, file, {
                    upsert: false,
                });

            if (uploadError) {
                setError(uploadError.message);
                setSubmitting(false);
                return;
            }

            const { data: publicUrlData } = supabase.storage
                .from("feedback-attachments")
                .getPublicUrl(filePath);

            attachments.push({
                name: file.name,
                path: filePath,
                url: publicUrlData.publicUrl,
                type: file.type,
                size: file.size,
            });
        }

        const { error: insertError } = await supabase
            .from("feedback_entries")
            .insert({
                professor_id: user.id,
                category,
                rating:
                    category === "general" || category === "usability"
                        ? Number(rating)
                        : null,
                severity: category === "bug" ? severity : null,
                message: message.trim(),
                attachments,
            });

        if (insertError) {
            setError(insertError.message);
            setSubmitting(false);
            return;
        }

        setMessage("");
        setCategory("general");
        setRating("4");
        setSeverity("medium");
        setFiles([]);
        setSuccess("Thanks. Your feedback was submitted.");
        setSubmitting(false);
        fetchHistory();
    };

    const inputCopy = categoryCopy[category as keyof typeof categoryCopy];
    const usesRating = category === "general" || category === "usability";
    const usesSeverity = category === "bug";
    const attachmentCountLabel =
        files.length === 1 ? "1 file selected" : `${files.length} files selected`;

    const appendFiles = (incomingFiles: File[]) => {
        setFiles((current) => {
            const next = [...current];
            for (const file of incomingFiles) {
                const exists = next.some(
                    (existing) =>
                        existing.name === file.name &&
                        existing.size === file.size &&
                        existing.lastModified === file.lastModified,
                );
                if (!exists) {
                    next.push(file);
                }
            }
            return next.slice(0, 5);
        });
    };

    const handleRemoveFile = (fileToRemove: File) => {
        setFiles((current) =>
            current.filter(
                (file) =>
                    !(
                        file.name === fileToRemove.name &&
                        file.size === fileToRemove.size &&
                        file.lastModified === fileToRemove.lastModified
                    ),
            ),
        );
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Feedback</h1>
                <p className="text-gray-500 mt-1">
                    Share what is working, what is confusing, or what should be
                    improved next.
                </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <Card className="border-gray-300 shadow-sm">
                    <CardHeader className="border-b border-gray-200 bg-gray-50/80">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-200 bg-blue-100">
                                <MessageSquarePlus className="h-5 w-5 text-blue-700" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">
                                    Send Feedback
                                </CardTitle>
                                <p className="mt-1 text-sm text-gray-600">
                                    Share clear product feedback, bug reports,
                                    or feature ideas.
                                </p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <form
                            onSubmit={handleSubmit}
                            className="space-y-4"
                        >
                            <div className="grid gap-4 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label className="text-gray-700">Category</Label>
                                    <Select
                                        value={category}
                                        onValueChange={setCategory}
                                    >
                                        <SelectTrigger className="border-gray-300 bg-white shadow-sm">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="general">
                                                General
                                            </SelectItem>
                                            <SelectItem value="bug">
                                                Bug Report
                                            </SelectItem>
                                            <SelectItem value="feature">
                                                Feature Request
                                            </SelectItem>
                                            <SelectItem value="usability">
                                                Usability
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {usesRating && (
                                    <div className="space-y-2">
                                        <Label className="text-gray-700">Rating</Label>
                                        <Select
                                            value={rating}
                                            onValueChange={setRating}
                                        >
                                            <SelectTrigger className="border-gray-300 bg-white shadow-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="5">
                                                    5 - Excellent
                                                </SelectItem>
                                                <SelectItem value="4">
                                                    4 - Good
                                                </SelectItem>
                                                <SelectItem value="3">
                                                    3 - Okay
                                                </SelectItem>
                                                <SelectItem value="2">
                                                    2 - Frustrating
                                                </SelectItem>
                                                <SelectItem value="1">
                                                    1 - Poor
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                {usesSeverity && (
                                    <div className="space-y-2">
                                        <Label className="text-gray-700">Severity</Label>
                                        <Select
                                            value={severity}
                                            onValueChange={setSeverity}
                                        >
                                            <SelectTrigger className="border-gray-300 bg-white shadow-sm">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="low">
                                                    Low
                                                </SelectItem>
                                                <SelectItem value="medium">
                                                    Medium
                                                </SelectItem>
                                                <SelectItem value="high">
                                                    High
                                                </SelectItem>
                                                <SelectItem value="critical">
                                                    Critical
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4">
                                <Label
                                    htmlFor="feedbackMessage"
                                    className="text-gray-700"
                                >
                                    {inputCopy.label}
                                </Label>
                                <textarea
                                    id="feedbackMessage"
                                    value={message}
                                    onChange={(e) =>
                                        setMessage(e.target.value)
                                    }
                                    placeholder={inputCopy.placeholder}
                                    rows={7}
                                    className="flex min-h-[160px] w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-800 shadow-sm outline-none placeholder:text-gray-400 focus-visible:border-blue-400 focus-visible:ring-4 focus-visible:ring-blue-100"
                                    required
                                />
                            </div>

                            <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
                                <div>
                                    <Label
                                        htmlFor="feedbackAttachments"
                                        className="text-gray-700"
                                    >
                                        Attachments
                                    </Label>
                                    <p className="mt-1 text-xs text-gray-500">
                                        Add screenshots, recordings, or
                                        reference files. Up to 5 files.
                                    </p>
                                </div>
                                <div
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setIsDragActive(true);
                                    }}
                                    onDragLeave={(e) => {
                                        e.preventDefault();
                                        setIsDragActive(false);
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setIsDragActive(false);
                                        appendFiles(
                                            Array.from(
                                                e.dataTransfer.files || [],
                                            ),
                                        );
                                    }}
                                    className={`rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
                                        isDragActive
                                            ? "border-blue-400 bg-blue-50"
                                            : "border-gray-300 bg-gray-50"
                                    }`}
                                >
                                    <UploadCloud className="mx-auto mb-3 h-8 w-8 text-gray-500" />
                                    <p className="text-sm font-medium text-gray-700">
                                        Drag and drop files here
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500">
                                        Or choose files manually. Up to 5 files.
                                    </p>
                                    <input
                                        id="feedbackAttachments"
                                        type="file"
                                        accept="image/*,video/*,.pdf"
                                        multiple
                                        onChange={(e) =>
                                            appendFiles(
                                                Array.from(
                                                    e.target.files || [],
                                                ),
                                            )
                                        }
                                        className="mt-4 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-200 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-300"
                                    />
                                </div>
                                {files.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-xs font-medium text-gray-600">
                                            {attachmentCountLabel}
                                        </p>
                                        <div className="space-y-2">
                                            {files.map((file) => (
                                                <div
                                                    key={`${file.name}-${file.size}`}
                                                    className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                                                >
                                                    <div>
                                                        <div className="font-medium">
                                                            {file.name}
                                                        </div>
                                                        <div className="text-xs text-gray-500">
                                                            {(file.size / (1024 * 1024)).toFixed(2)} MB
                                                        </div>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            handleRemoveFile(
                                                                file,
                                                            )
                                                        }
                                                        className="rounded-md border border-gray-300 bg-white p-1.5 text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                                        aria-label={`Remove ${file.name}`}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                    {error}
                                </div>
                            )}

                            {success && (
                                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                                    {success}
                                </div>
                            )}

                            <div className="flex justify-end">
                                <Button
                                    type="submit"
                                    disabled={submitting || !message.trim()}
                                >
                                    {submitting && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Send Feedback
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card className="border-gray-300 shadow-sm">
                    <CardHeader className="border-b border-gray-200 bg-gray-50/80">
                        <CardTitle className="text-lg">
                            Your Recent Feedback
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-6">
                        {loadingHistory ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                            </div>
                        ) : history.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center">
                                <p className="text-sm text-gray-600">
                                    No feedback submitted yet.
                                </p>
                            </div>
                        ) : (
                            history.map((entry) => (
                                <div
                                    key={entry.id}
                                    className="rounded-xl border border-gray-300 bg-white p-4 shadow-sm"
                                >
                                    <div className="flex flex-wrap items-center gap-2 mb-2">
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
                                        <Badge
                                            variant="outline"
                                            className="border-blue-200 bg-blue-50 text-blue-700"
                                        >
                                            {entry.status}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                        {entry.message}
                                    </p>
                                    {entry.attachments?.length > 0 && (
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {entry.attachments.map((attachment) => (
                                                <a
                                                    key={attachment.path}
                                                    href={attachment.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                                                >
                                                    {attachment.name}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                    <p className="text-xs text-gray-400 mt-3">
                                        {new Date(
                                            entry.created_at,
                                        ).toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </p>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
