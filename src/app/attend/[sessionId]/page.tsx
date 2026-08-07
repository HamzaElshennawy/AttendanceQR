"use client";

import { Suspense, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    CheckCircle2,
    Clock3,
    Loader2,
    MapPin,
    QrCode,
    ShieldCheck,
    XCircle,
} from "lucide-react";
import { getDeviceIdentity } from "@/lib/device-identity";

type Status =
    | "idle"
    | "loading"
    | "success"
    | "error"
    | "already"
    | "getting_location";

function AttendForm() {
    const params = useParams();
    const searchParams = useSearchParams();
    const sessionId = params.sessionId as string;
    const token = searchParams.get("token") || "";

    const [universityId, setUniversityId] = useState("");
    const [status, setStatus] = useState<Status>("idle");
    const [message, setMessage] = useState("");
    const [studentName, setStudentName] = useState("");
    const [locationStatus, setLocationStatus] = useState("");

    const getLocation = (): Promise<{
        latitude: number;
        longitude: number;
    } | null> => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                    });
                },
                () => resolve(null),
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
            );
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!universityId.trim()) return;

        setStatus("loading");

        // Get both persistent device UUID and FingerprintJS visitorId
        const identity = await getDeviceIdentity();

        let latitude: number | null = null;
        let longitude: number | null = null;
        setStatus("getting_location");
        setLocationStatus("Checking for location if this session requires it...");
        const location = await getLocation();
        if (location) {
            latitude = location.latitude;
            longitude = location.longitude;
        }
        setStatus("loading");

        try {
            const res = await fetch("/api/attend", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    session_id: sessionId,
                    university_id: universityId.trim(),
                    token,
                    latitude,
                    longitude,
                    fingerprint: identity.fingerprint,
                    device_id: identity.deviceId,
                }),
            });

            const data = await res.json();

            if (res.ok) {
                setStatus("success");
                setStudentName(data.student_name);
                setMessage(data.message);
            } else {
                setStatus(data.already_checked_in ? "already" : "error");
                setMessage(data.error);
            }
        } catch {
            setStatus("error");
            setMessage("Network error. Please try again.");
        }
    };

    // Success State
    if (status === "success") {
        return (
            <div className="min-h-screen bg-[linear-gradient(180deg,rgba(249,251,255,0.98),rgba(243,247,252,0.98))] flex items-center justify-center p-4">
                <Card className="w-full max-w-sm text-center border-border/70 shadow-[0_30px_70px_-38px_rgba(22,47,95,0.35)]">
                    <CardContent className="pt-8 pb-8">
                        <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="h-10 w-10 text-green-600" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-1">
                            You&apos;re checked in!
                        </h2>
                        <p className="text-gray-600 mb-1">{studentName}</p>
                        <p className="text-sm text-gray-400">
                            You can close this page now.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Already Checked In State
    if (status === "already") {
        return (
            <div className="min-h-screen bg-[linear-gradient(180deg,rgba(249,251,255,0.98),rgba(243,247,252,0.98))] flex items-center justify-center p-4">
                <Card className="w-full max-w-sm text-center border-border/70 shadow-[0_30px_70px_-38px_rgba(22,47,95,0.35)]">
                    <CardContent className="pt-8 pb-8">
                        <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="h-10 w-10 text-blue-600" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-1">
                            Already checked in
                        </h2>
                        <p className="text-gray-600">{message}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[linear-gradient(180deg,rgba(249,251,255,0.98),rgba(243,247,252,0.98))] flex items-center justify-center p-4">
            <Card className="w-full max-w-sm border-border/70 shadow-[0_30px_70px_-38px_rgba(22,47,95,0.35)]">
                <CardHeader className="pb-4 text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <QrCode className="h-7 w-7" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary/80">
                            Student check-in
                        </p>
                        <CardTitle className="text-xl text-foreground">
                            Confirm your attendance
                        </CardTitle>
                        <p className="text-sm text-soft">
                            Enter your university ID to check in for this live session.
                        </p>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="mb-4 grid gap-3">
                        <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-left">
                            <div className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                <ShieldCheck className="h-4 w-4 text-primary" />
                                Check-in status
                            </div>
                            <p className="mt-2 text-sm text-soft">
                                Use the same university ID registered in your group. Your check-in will be validated for this session only.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-primary/15 bg-primary/6 px-4 py-3 text-left">
                            <div className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-primary">
                                <MapPin className="h-4 w-4" />
                                Location-aware validation
                            </div>
                            <p className="mt-2 text-sm text-soft">
                                If this session uses location validation, your browser may ask for location access during check-in.
                            </p>
                        </div>
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        className="space-y-4"
                    >
                        <div className="space-y-2">
                            <Label htmlFor="universityId">University ID</Label>
                            <Input
                                id="universityId"
                                type="text"
                                placeholder="e.g., 20210451"
                                value={universityId}
                                onChange={(e) =>
                                    setUniversityId(e.target.value)
                                }
                                required
                                autoFocus
                                className="text-center text-lg tracking-[0.18em]"
                            />
                        </div>

                        {status === "error" && (
                            <div className="flex items-start gap-2 rounded-xl bg-red-50 px-3 py-3 text-sm text-red-600">
                                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                <span>{message}</span>
                            </div>
                        )}

                        {status === "getting_location" && (
                            <div className="flex items-start gap-2 rounded-xl bg-background px-3 py-3 text-sm text-soft">
                                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                <span>{locationStatus}</span>
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full"
                            disabled={
                                status === "loading" ||
                                status === "getting_location"
                            }
                            size="lg"
                        >
                            {status === "getting_location" ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {locationStatus}
                                </>
                            ) : status === "loading" ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Checking in...
                                </>
                            ) : (
                                "Check In"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}

export default function AttendPage() {
    return (
            <Suspense
                fallback={
                    <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(180deg,rgba(249,251,255,0.98),rgba(243,247,252,0.98))]">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                }
        >
            <AttendForm />
        </Suspense>
    );
}
