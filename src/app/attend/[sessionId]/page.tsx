"use client";

import { Suspense, useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, QrCode, Loader2, MapPin } from "lucide-react";

type Status =
    | "idle"
    | "loading"
    | "success"
    | "error"
    | "already"
    | "getting_location";

// Simple browser fingerprint generator
function generateFingerprint(): string {
    const components = [
        navigator.userAgent,
        navigator.language,
        screen.width + "x" + screen.height,
        screen.colorDepth,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        navigator.hardwareConcurrency || "",
        (navigator as unknown as { deviceMemory?: number }).deviceMemory || "",
    ];

    // Simple hash function
    const str = components.join("|");
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}

function AttendForm() {
    const params = useParams();
    const searchParams = useSearchParams();
    const sessionId = params.sessionId as string;
    const token = searchParams.get("token") || "";

    const [universityId, setUniversityId] = useState("");
    const [status, setStatus] = useState<Status>("idle");
    const [message, setMessage] = useState("");
    const [studentName, setStudentName] = useState("");
    const [sessionHasLocation, setSessionHasLocation] = useState(false);
    const [locationStatus, setLocationStatus] = useState("");

    // Check if session requires location
    useEffect(() => {
        const checkSession = async () => {
            try {
                const res = await fetch(`/api/sessions/${sessionId}/info`);
                const data = await res.json();
                if (data.has_location) {
                    setSessionHasLocation(true);
                }
            } catch {
                // Silently fail — location check is optional
            }
        };
        checkSession();
    }, [sessionId]);

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

        // Generate fingerprint
        const fingerprint = generateFingerprint();

        // Get location if session requires it
        let latitude: number | null = null;
        let longitude: number | null = null;

        if (sessionHasLocation) {
            setStatus("getting_location");
            setLocationStatus("Getting your location...");
            const location = await getLocation();
            if (location) {
                latitude = location.latitude;
                longitude = location.longitude;
            }
            setStatus("loading");
        }

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
                    fingerprint,
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
            <div className="min-h-screen bg-linear-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-sm text-center shadow-lg border-0">
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
            <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-sm text-center shadow-lg border-0">
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
        <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-sm shadow-lg border-0">
                <CardHeader className="text-center pb-4">
                    <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                        <QrCode className="h-7 w-7 text-blue-600" />
                    </div>
                    <CardTitle className="text-xl">
                        Attendance<span className="text-blue-600">QR</span>
                    </CardTitle>
                    <p className="text-sm text-gray-500">
                        Enter your university ID to check in
                    </p>
                </CardHeader>
                <CardContent>
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
                                className="text-center text-lg tracking-wider"
                            />
                        </div>

                        {sessionHasLocation && (
                            <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-md">
                                <MapPin className="h-3 w-3 shrink-0" />
                                <span>
                                    This session requires location access
                                </span>
                            </div>
                        )}

                        {status === "error" && (
                            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
                                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                <span>{message}</span>
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
                <div className="min-h-screen flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            }
        >
            <AttendForm />
        </Suspense>
    );
}
