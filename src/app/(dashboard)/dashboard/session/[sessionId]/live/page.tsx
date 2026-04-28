"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    ChevronRight,
    CheckCircle2,
    Clock,
    QrCode,
    RefreshCw,
    TimerReset,
    Users,
    XCircle,
} from "lucide-react";

export default function LiveSessionPage() {
    const params = useParams();
    const router = useRouter();
    const sessionId = params.sessionId as string;
    const supabase = createClient();

    const [token, setToken] = useState<string | null>(null);
    const [attendanceCount, setAttendanceCount] = useState(0);
    const [totalStudents, setTotalStudents] = useState(0);
    const [expiresAt, setExpiresAt] = useState<Date | null>(null);
    const [timeLeft, setTimeLeft] = useState("");
    const [sessionEnded, setSessionEnded] = useState(false);
    const [sessionTitle, setSessionTitle] = useState("");
    const [groupName, setGroupName] = useState("");
    const [sessionCategory, setSessionCategory] = useState<
        "lecture" | "tutorial"
    >("lecture");
    const [groupId, setGroupId] = useState("");
    const [qrRotating, setQrRotating] = useState(true);
    const [rotationInterval, setRotationInterval] = useState(15);
    const [rotationCountdown, setRotationCountdown] = useState(15);
    const [qrFullscreenOpen, setQrFullscreenOpen] = useState(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const rotationTimerRef = useRef<NodeJS.Timeout | null>(null);

    const appUrl = typeof window !== "undefined" ? window.location.origin : "";
    const attendancePercent =
        totalStudents > 0
            ? Math.round((attendanceCount / totalStudents) * 100)
            : 0;

    const fetchSessionInfo = useCallback(async () => {
        const { data } = await supabase
            .from("sessions")
            .select("*, groups(name)")
            .eq("id", sessionId)
            .single();
        if (data) {
            setSessionTitle(data.title || data.groups?.name || "Session");
            setGroupName(data.groups?.name || "Group");
            setSessionCategory(
                data.category === "tutorial" ? "tutorial" : "lecture",
            );
            setGroupId(data.group_id);
            setQrRotating(data.qr_rotating !== false);
            const interval = data.rotation_interval_seconds || 15;
            setRotationInterval(interval);
            setRotationCountdown(interval);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId]);

    const rotateToken = useCallback(async () => {
        try {
            const res = await fetch(`/api/sessions/${sessionId}/token`, {
                method: "POST",
            });
            const data = await res.json();

            if (data.expired || !data.is_active) {
                setSessionEnded(true);
                if (intervalRef.current) clearInterval(intervalRef.current);
                return;
            }

            setToken(data.token);
            setAttendanceCount(data.attendance_count);
            setTotalStudents(data.total_students);
            setExpiresAt(new Date(data.expires_at));
        } catch {
            // Silent retry on next interval
        }
    }, [sessionId]);

    useEffect(() => {
        fetchSessionInfo();
        rotateToken();
    }, [fetchSessionInfo, rotateToken]);

    useEffect(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (rotationTimerRef.current) clearInterval(rotationTimerRef.current);

        if (qrRotating) {
            const intervalMs = rotationInterval * 1000;

            intervalRef.current = setInterval(() => {
                rotateToken();
                setRotationCountdown(rotationInterval);
            }, intervalMs);

            rotationTimerRef.current = setInterval(() => {
                setRotationCountdown((prev) => (prev > 0 ? prev - 1 : 0));
            }, 1000);
        } else {
            // Static QR: poll less frequently to refresh token expiry and attendance counts
            intervalRef.current = setInterval(() => {
                rotateToken();
            }, 30_000);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (rotationTimerRef.current)
                clearInterval(rotationTimerRef.current);
        };
    }, [qrRotating, rotationInterval, rotateToken]);

    useEffect(() => {
        const updateTimer = () => {
            if (!expiresAt) return;
            const now = new Date();
            const diff = expiresAt.getTime() - now.getTime();

            if (diff <= 0) {
                setTimeLeft("00:00");
                setSessionEnded(true);
                return;
            }

            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            setTimeLeft(
                `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`,
            );
        };

        updateTimer();
        timerRef.current = setInterval(updateTimer, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [expiresAt]);

    useEffect(() => {
        if (!qrFullscreenOpen) {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setQrFullscreenOpen(false);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [qrFullscreenOpen]);

    const handleEndSession = async () => {
        await fetch(`/api/sessions/${sessionId}/end`, {
            method: "POST",
        });
        setSessionEnded(true);
        if (intervalRef.current) clearInterval(intervalRef.current);
    };

    const qrUrl = token ? `${appUrl}/attend/${sessionId}?token=${token}` : "";

    if (sessionEnded) {
        return (
            <div className="min-h-screen bg-background px-6 py-10 text-foreground">
                <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl flex-col items-center justify-center rounded-[2rem] border border-border/70 bg-card px-8 py-16 text-center shadow-[0_28px_60px_-30px_rgb(15_23_42_/_0.18)]">
                    <div className="mb-6 rounded-full bg-destructive/10 p-5">
                        <XCircle className="h-16 w-16 text-destructive" />
                    </div>
                    <Badge variant="destructive">
                        Session closed
                    </Badge>
                    <h1 className="mt-5 text-4xl text-foreground">
                        Attendance session ended
                    </h1>
                    <p className="mt-4 max-w-xl text-base text-soft">
                        {attendanceCount} students checked in before the session
                        closed. You can return to the group workspace to review
                        records and continue managing attendance.
                    </p>
                    <Button
                        variant="outline"
                        className="mt-8"
                        onClick={() => router.push(`/dashboard/groups/${groupId}`)}
                    >
                        Back to Group
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background px-5 py-6 text-foreground md:px-8 md:py-8">
            <div className="mx-auto flex max-w-7xl flex-col gap-6">
                <nav
                    aria-label="Breadcrumb"
                    className="flex flex-wrap items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
                >
                    <button
                        type="button"
                        onClick={() => router.push("/dashboard")}
                        className="transition-colors hover:text-primary"
                    >
                        Dashboard
                    </button>
                    {groupId && (
                        <>
                            <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                            <button
                                type="button"
                                onClick={() => router.push(`/dashboard/groups/${groupId}`)}
                                className="transition-colors hover:text-primary"
                            >
                                {groupName || "Group"}
                            </button>
                        </>
                    )}
                    <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                    <span className="text-foreground">
                        {sessionTitle || "Live session"}
                    </span>
                </nav>

                <div className="flex flex-col gap-4 rounded-[2rem] border border-border/70 bg-card p-5 shadow-[0_20px_50px_-30px_rgb(15_23_42_/_0.16)] md:flex-row md:items-start md:justify-between md:p-6">
                    <div className="flex items-start gap-3">
                        <Button
                            variant="outline"
                            size="icon"
                            className="shrink-0"
                            onClick={() =>
                                router.push(`/dashboard/groups/${groupId}`)
                            }
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="success">
                                    Live now
                                </Badge>
                                <Badge
                                    variant="outline"
                                    className={
                                        sessionCategory === "tutorial"
                                            ? "border-amber-300/45 bg-amber-50 text-amber-800"
                                            : "border-sky-300/45 bg-sky-50 text-sky-800"
                                    }
                                >
                                    {sessionCategory === "tutorial"
                                        ? "Tutorial"
                                        : "Lecture"}
                                </Badge>
                            </div>
                            <div>
                                <h1 className="text-3xl leading-tight text-foreground md:text-4xl">
                                    {sessionTitle}
                                </h1>
                                <p className="mt-2 max-w-2xl text-sm text-soft md:text-base">
                                    Active attendance session. Keep the QR code
                                    visible, monitor participation, and close the
                                    session when check-in is complete.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 md:min-w-[28rem]">
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                            <div className="flex items-center gap-2 text-subtle">
                                <Users className="h-4 w-4" />
                                <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">
                                    Attendance
                                </span>
                            </div>
                            <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
                                {attendanceCount}
                            </div>
                            <p className="mt-2 text-sm text-soft">
                                of {totalStudents || 0} students checked in
                            </p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                            <div className="flex items-center gap-2 text-subtle">
                                <TimerReset className="h-4 w-4" />
                                <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">
                                    Session timer
                                </span>
                            </div>
                            <div className="mt-3 font-mono text-3xl font-semibold tracking-[-0.04em] text-foreground">
                                {timeLeft || "--:--"}
                            </div>
                            <p className="mt-2 text-sm text-soft">
                                Time remaining before this token expires
                            </p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                            <div className="flex items-center gap-2 text-subtle">
                                <RefreshCw className="h-4 w-4" />
                                <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">
                                    QR refresh
                                </span>
                            </div>
                            <div className="mt-3 font-mono text-3xl font-semibold tracking-[-0.04em] text-foreground">
                                {qrRotating ? `${rotationCountdown}s` : "Static"}
                            </div>
                            <p className="mt-2 text-sm text-soft">
                                {qrRotating
                                    ? `Rotates every ${rotationInterval}s`
                                    : "Rotation disabled for this session"}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(20rem,28rem)_minmax(0,1fr)]">
                    <div className="rounded-[2rem] border border-border/70 bg-card p-5 text-foreground shadow-[0_28px_60px_-30px_rgb(15_23_42_/_0.18)] md:p-6">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <Badge variant="outline" className="border-primary/15 bg-primary/8 text-primary">
                                    Student check-in
                                </Badge>
                                <h2 className="mt-4 text-2xl text-foreground">
                                    QR access point
                                </h2>
                                <p className="mt-2 text-sm text-soft">
                                    Students scan this code to open the mobile
                                    check-in flow for this live session.
                                </p>
                            </div>
                            <div className="hidden rounded-2xl bg-primary/8 p-3 text-primary md:block">
                                <QrCode className="h-6 w-6" />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-center rounded-[1.75rem] border border-border/70 bg-background/85 p-6">
                            {token ? (
                                <QRCodeSVG
                                    value={qrUrl}
                                    size={320}
                                    level="M"
                                    includeMargin={false}
                                />
                            ) : (
                                <div className="flex h-[320px] w-[320px] items-center justify-center rounded-[1.5rem] bg-secondary text-subtle">
                                    <QrCode className="h-16 w-16 animate-pulse" />
                                </div>
                            )}
                        </div>

                        <div className="mt-5 space-y-4">
                            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                                <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                                    <p className="text-sm font-medium text-foreground">
                                        Projection mode
                                    </p>
                                    <p className="mt-1 text-sm text-soft">
                                        Switch to a larger QR-only view when you
                                        want students to scan from across the room.
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    className="h-full min-h-14"
                                    onClick={() => setQrFullscreenOpen(true)}
                                >
                                    <QrCode className="mr-2 h-4 w-4" />
                                    Show QR Full Screen
                                </Button>
                            </div>

                            <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-sm font-medium text-foreground">
                                        Check-in progress
                                    </span>
                                    <span className="text-sm font-semibold text-primary">
                                        {attendancePercent}%
                                    </span>
                                </div>
                                <div className="mt-3 h-2 rounded-full bg-secondary">
                                    <div
                                        className="h-2 rounded-full bg-primary transition-all"
                                        style={{ width: `${attendancePercent}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-6">
                        <div className="rounded-[2rem] border border-border/70 bg-card p-5 shadow-[0_20px_50px_-30px_rgb(15_23_42_/_0.14)] md:p-6">
                            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <Badge
                                        variant="outline"
                                        className="border-primary/15 bg-primary/8 text-primary"
                                    >
                                        Live controls
                                    </Badge>
                                    <h2 className="mt-4 text-2xl text-foreground">
                                        Session command center
                                    </h2>
                                    <p className="mt-2 max-w-2xl text-sm text-soft">
                                        Use the timing and QR status below to
                                        supervise check-in with confidence.
                                    </p>
                                </div>
                                <Button
                                    variant="destructive"
                                    size="lg"
                                    onClick={handleEndSession}
                                    className="min-w-40"
                                >
                                    End Session
                                </Button>
                            </div>

                            <div className="mt-6 grid gap-4 md:grid-cols-2">
                                <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                                    <div className="flex items-center gap-2 text-subtle">
                                        <Clock className="h-4 w-4" />
                                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">
                                            Current token
                                        </span>
                                    </div>
                                    <p className="mt-3 text-sm text-soft">
                                        {qrRotating
                                            ? "The QR token rotates automatically to reduce reuse and stale check-ins."
                                            : "The QR token remains fixed for this session configuration."}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                                    <div className="flex items-center gap-2 text-subtle">
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">
                                            Student readiness
                                        </span>
                                    </div>
                                    <p className="mt-3 text-sm text-soft">
                                        Share the QR clearly. Students will be
                                        directed to the existing mobile check-in
                                        flow for this session.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[2rem] border border-border/70 bg-card p-5 shadow-[0_20px_50px_-30px_rgb(15_23_42_/_0.14)] md:p-6">
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-semibold text-foreground">
                                        Attendance snapshot
                                    </h3>
                                    <p className="mt-1 text-sm text-soft">
                                        This live view currently exposes totals
                                        and timing. Detailed roster management
                                        stays in the session and group flows.
                                    </p>
                                </div>
                                <Badge
                                    variant="outline"
                                    className="border-border/70 bg-background/80 text-foreground"
                                >
                                    Supported now
                                </Badge>
                            </div>

                            <div className="mt-5 grid gap-4 md:grid-cols-3">
                                <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                                        Checked in
                                    </p>
                                    <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
                                        {attendanceCount}
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                                        Remaining
                                    </p>
                                    <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
                                        {Math.max(totalStudents - attendanceCount, 0)}
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                                        Total roster
                                    </p>
                                    <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
                                        {totalStudents}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {qrFullscreenOpen && (
                <div className="fixed inset-0 z-50 bg-[radial-gradient(circle_at_top,rgba(205,223,255,0.55),transparent_30%),linear-gradient(180deg,rgba(247,250,255,0.98),rgba(240,245,252,0.98))] px-6 py-8">
                    <div className="mx-auto flex h-full w-full max-w-6xl flex-col">
                        <div className="mb-6 flex w-full items-center justify-between gap-4">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                                    Projection mode
                                </p>
                                <h2 className="mt-1 text-2xl text-foreground">
                                    {sessionTitle}
                                </h2>
                                <p className="mt-2 text-sm text-soft">
                                    Minimal QR view for classroom display. Press
                                    <span className="mx-1 rounded-md border border-border/70 bg-background px-2 py-0.5 font-mono text-xs text-foreground">
                                        Esc
                                    </span>
                                    to close.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <Badge variant="success">Live now</Badge>
                                <Badge variant="outline">
                                    {qrRotating
                                        ? `Refresh ${rotationCountdown}s`
                                        : "Static QR"}
                                </Badge>
                                <Badge variant="secondary">
                                    {attendanceCount} / {totalStudents} checked in
                                </Badge>
                                <Button
                                    variant="outline"
                                    onClick={() => setQrFullscreenOpen(false)}
                                >
                                    Close full screen
                                </Button>
                            </div>
                        </div>

                        <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
                            <div className="flex min-h-0 items-center justify-center rounded-[2.25rem] border border-border/70 bg-card p-8 shadow-[0_24px_60px_-32px_rgb(15_23_42_/_0.18)]">
                                {token ? (
                                    <div className="rounded-[2rem] border border-border/70 bg-white p-6 shadow-[0_20px_50px_-34px_rgb(15_23_42_/_0.16)]">
                                        <QRCodeSVG
                                            value={qrUrl}
                                            size={640}
                                            level="M"
                                            includeMargin={false}
                                        />
                                    </div>
                                ) : (
                                    <div className="flex h-[420px] w-[420px] items-center justify-center rounded-[1.75rem] bg-secondary text-subtle">
                                        <QrCode className="h-20 w-20 animate-pulse" />
                                    </div>
                                )}
                            </div>
                            <div className="grid gap-4 self-start">
                                <div className="rounded-[24px] border border-border/70 bg-card/94 p-5 shadow-sm">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                                        Display notes
                                    </p>
                                    <p className="mt-3 text-sm leading-6 text-soft">
                                        Keep this screen visible until students
                                        finish scanning. Attendance totals update
                                        live while the QR remains available.
                                    </p>
                                </div>
                                <div className="rounded-[24px] border border-border/70 bg-card/94 p-5 shadow-sm">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                                        Live progress
                                    </p>
                                    <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
                                        {attendancePercent}%
                                    </div>
                                    <div className="mt-3 h-2 rounded-full bg-secondary">
                                        <div
                                            className="h-2 rounded-full bg-primary transition-all"
                                            style={{ width: `${attendancePercent}%` }}
                                        />
                                    </div>
                                </div>
                                <div className="rounded-[24px] border border-border/70 bg-card/94 p-5 shadow-sm">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                                        Session timer
                                    </p>
                                    <div className="mt-3 font-mono text-3xl font-semibold tracking-[-0.04em] text-foreground">
                                        {timeLeft || "--:--"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
