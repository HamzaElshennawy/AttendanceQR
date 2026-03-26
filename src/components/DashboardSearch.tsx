"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface SearchResultItem {
    id: string;
    type: "group" | "student" | "session" | "coursework";
    title: string;
    subtitle: string;
    href: string;
}

const resultTypeLabel: Record<SearchResultItem["type"], string> = {
    group: "Group",
    student: "Student",
    session: "Session",
    coursework: "Coursework",
};

export function DashboardSearch() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SearchResultItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setOpen(true);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    useEffect(() => {
        if (!open || query.trim().length < 2) {
            setResults([]);
            setLoading(false);
            return;
        }

        const controller = new AbortController();
        const timeout = setTimeout(async () => {
            setLoading(true);
            try {
                const response = await fetch(
                    `/api/search?q=${encodeURIComponent(query.trim())}`,
                    { signal: controller.signal },
                );
                const data = await response.json();
                setResults(data.results || []);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 200);

        return () => {
            controller.abort();
            clearTimeout(timeout);
        };
    }, [open, query]);

    const helperText = useMemo(() => {
        if (query.trim().length < 2) {
            return "Type at least 2 characters to search groups, students, sessions, and coursework.";
        }

        if (loading) {
            return "Searching...";
        }

        if (results.length === 0) {
            return "No matching results.";
        }

        return `${results.length} results found.`;
    }, [loading, query, results.length]);

    return (
        <>
            <Button
                variant="outline"
                className="w-full justify-between text-gray-500 lg:w-80"
                onClick={() => setOpen(true)}
            >
                <span className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    Search Quorum
                </span>
                <span className="text-xs text-gray-400">Ctrl/Cmd K</span>
            </Button>

            <Dialog
                open={open}
                onOpenChange={setOpen}
            >
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Search</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <Input
                            autoFocus
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Search groups, students, sessions, coursework..."
                        />
                        <p className="text-sm text-gray-500">{helperText}</p>
                        <div className="max-h-[55vh] overflow-auto rounded-lg border">
                            {results.length > 0 ? (
                                <div className="divide-y">
                                    {results.map((result) => (
                                        <button
                                            key={`${result.type}-${result.id}`}
                                            type="button"
                                            className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left hover:bg-gray-50"
                                            onClick={() => {
                                                setOpen(false);
                                                router.push(result.href);
                                            }}
                                        >
                                            <div>
                                                <div className="font-medium text-gray-900">
                                                    {result.title}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {result.subtitle}
                                                </div>
                                            </div>
                                            <span className="rounded-full border px-2 py-1 text-xs text-gray-500">
                                                {resultTypeLabel[result.type]}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="px-4 py-8 text-center text-sm text-gray-500">
                                    {helperText}
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
