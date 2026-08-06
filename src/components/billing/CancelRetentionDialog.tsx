"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import type { RetentionOffer, RetentionReason } from "@/lib/retention";

const REASON_OPTIONS: { value: RetentionReason; label: string; hint: string }[] = [
    {
        value: "too_expensive",
        label: "It costs too much",
        hint: "The price doesn't work for my budget",
    },
    {
        value: "not_using",
        label: "I'm not using it enough",
        hint: "It's more than I need right now",
    },
    {
        value: "term_ended",
        label: "My term or semester ended",
        hint: "I'm not teaching at the moment",
    },
    {
        value: "missing_feature",
        label: "It's missing something I need",
        hint: "There's a feature I was counting on",
    },
    { value: "other", label: "Something else", hint: "" },
];

type Step = "reason" | "offer" | "done";

export function CancelRetentionDialog({
    open,
    onOpenChange,
    onCompleted,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCompleted: () => void;
}) {
    const [step, setStep] = useState<Step>("reason");
    const [reason, setReason] = useState<RetentionReason | null>(null);
    const [offer, setOffer] = useState<RetentionOffer | null>(null);
    const [message, setMessage] = useState("");
    const [pending, setPending] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState("");

    const reset = () => {
        setStep("reason");
        setReason(null);
        setOffer(null);
        setMessage("");
        setError("");
        setResult("");
        setPending(false);
    };

    const handleOpenChange = (next: boolean) => {
        if (!next) {
            reset();
        }
        onOpenChange(next);
    };

    const post = async (body: Record<string, unknown>) => {
        const response = await fetch("/api/billing/retention", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        return { ok: response.ok, payload: await response.json() };
    };

    const chooseReason = async (value: RetentionReason) => {
        setReason(value);
        setPending(true);
        setError("");

        const { ok, payload } = await post({ action: "offer", reason: value });
        setPending(false);

        if (!ok) {
            setError(payload.error || "Something went wrong. Please try again.");
            return;
        }

        setOffer(payload.offer as RetentionOffer);
        setStep("offer");
    };

    const acceptOffer = async () => {
        if (!reason) return;

        setPending(true);
        setError("");

        const { ok, payload } = await post({
            action: "accept",
            reason,
            message: message.trim() || undefined,
        });
        setPending(false);

        if (!ok) {
            setError(payload.error || "Could not apply that change.");
            return;
        }

        setResult(payload.message || "Done.");
        setStep("done");
        onCompleted();
    };

    const declineOffer = async () => {
        if (!reason) return;

        setPending(true);
        setError("");

        const { ok, payload } = await post({
            action: "decline",
            reason,
            message: message.trim() || undefined,
        });
        setPending(false);

        if (!ok) {
            setError(payload.error || "Could not cancel your plan.");
            return;
        }

        setResult(payload.message || "Your plan has been cancelled.");
        setStep("done");
        onCompleted();
    };

    const isFeedbackOffer = offer?.kind === "feedback";
    const hasRealOffer = offer && offer.kind !== "none";

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-lg">
                {step === "reason" && (
                    <>
                        <DialogHeader>
                            <DialogTitle>Before you go</DialogTitle>
                            <DialogDescription>
                                What&apos;s prompting the cancellation? We may be
                                able to sort it out.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid gap-2 py-2">
                            {REASON_OPTIONS.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    disabled={pending}
                                    onClick={() => chooseReason(option.value)}
                                    className="flex flex-col items-start rounded-lg border border-border px-4 py-3 text-left transition-colors hover:border-foreground/30 hover:bg-muted/50 disabled:opacity-50"
                                >
                                    <span className="text-sm font-medium">
                                        {option.label}
                                    </span>
                                    {option.hint && (
                                        <span className="text-xs text-muted-foreground">
                                            {option.hint}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {pending && (
                            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                One moment…
                            </p>
                        )}
                    </>
                )}

                {step === "offer" && offer && (
                    <>
                        <DialogHeader>
                            <DialogTitle>{offer.headline}</DialogTitle>
                            <DialogDescription>{offer.body}</DialogDescription>
                        </DialogHeader>

                        {isFeedbackOffer && (
                            <textarea
                                value={message}
                                onChange={(event) => setMessage(event.target.value)}
                                rows={4}
                                placeholder="What were you hoping Quorum would do?"
                                className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                            />
                        )}

                        <DialogFooter className="gap-2 sm:justify-between">
                            <Button
                                variant="ghost"
                                onClick={declineOffer}
                                disabled={pending}
                            >
                                No thanks, cancel my plan
                            </Button>
                            {hasRealOffer && (
                                <Button onClick={acceptOffer} disabled={pending}>
                                    {pending && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    {offer.acceptLabel}
                                </Button>
                            )}
                        </DialogFooter>
                    </>
                )}

                {step === "done" && (
                    <>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                All set
                            </DialogTitle>
                            <DialogDescription>{result}</DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button onClick={() => handleOpenChange(false)}>
                                Close
                            </Button>
                        </DialogFooter>
                    </>
                )}

                {error && (
                    <p className="flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        {error}
                    </p>
                )}
            </DialogContent>
        </Dialog>
    );
}
