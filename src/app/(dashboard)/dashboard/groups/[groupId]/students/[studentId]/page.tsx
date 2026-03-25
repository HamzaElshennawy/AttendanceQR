"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    ArrowLeft,
    AlertTriangle,
    CheckCircle2,
    FilePenLine,
    Loader2,
    ShieldAlert,
    XCircle,
} from "lucide-react";

interface Student {
    id: string;
    name: string;
    university_id: string;
}

interface Session {
    id: string;
    title: string | null;
    started_at: string;
    is_active: boolean;
}

interface AttendanceRecord {
    session_id: string;
    scanned_at: string;
    status: "present" | "excused";
    recorded_via: "qr" | "manual";
    note: string | null;
}

interface Violation {
    id: string;
    session_id: string;
    type: string;
    details: Record<string, unknown>;
    created_at: string;
}

export default function StudentHistoryPage() {
    const params = useParams();
    const router = useRouter();
    const groupId = params.groupId as string;
    const studentId = params.studentId as string;
    const supabase = createClient();

    const [student, setStudent] = useState<Student | null>(null);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [violations, setViolations] = useState<Violation[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        const { data: studentData } = await supabase
            .from("students")
            .select("id, name, university_id")
            .eq("id", studentId)
            .eq("group_id", groupId)
            .single();

        if (!studentData) {
            setStudent(null);
            setLoading(false);
            return;
        }

        const [{ data: sessionsData }, { data: attendanceData }] =
            await Promise.all([
                supabase
                    .from("sessions")
                    .select("id, title, started_at, is_active")
                    .eq("group_id", groupId)
                    .order("started_at", { ascending: false }),
                supabase
                    .from("attendance_records")
                    .select(
                        "session_id, scanned_at, status, recorded_via, note",
                    )
                    .eq("student_id", studentId),
            ]);

        const sessionIds = (sessionsData || []).map((session) => session.id);
        const violationsQuery = supabase
            .from("violations")
            .select("id, session_id, type, details, created_at")
            .eq("university_id", studentData.university_id);

        const { data: violationsData } =
            sessionIds.length > 0
                ? await violationsQuery.in("session_id", sessionIds)
                : { data: [] as Violation[] };

        setStudent(studentData);
        setSessions(sessionsData || []);
        setAttendance(attendanceData || []);
        setViolations(violationsData || []);
        setLoading(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId, studentId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!student) {
        return (
            <div className="text-center py-20 text-gray-500">
                Student not found
            </div>
        );
    }

    const attendanceBySession = new Map(
        attendance.map((record) => [record.session_id, record]),
    );
    const endedSessions = sessions.filter((session) => !session.is_active);
    const presentCount = attendance.filter(
        (record) => record.status === "present",
    ).length;
    const excusedCount = attendance.filter(
        (record) => record.status === "excused",
    ).length;
    const totalSessions = endedSessions.length;
    const attendanceRate =
        totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

    let recentAbsenceStreak = 0;
    for (const session of endedSessions) {
        const record = attendanceBySession.get(session.id);
        if (record?.status === "present" || record?.status === "excused") {
            break;
        }
        recentAbsenceStreak += 1;
    }

    const riskFlags = [
        attendanceRate < 75
            ? `Attendance rate is ${attendanceRate}%`
            : null,
        recentAbsenceStreak >= 2
            ? `${recentAbsenceStreak} consecutive absences`
            : null,
        violations.length >= 2
            ? `${violations.length} recorded violations`
            : null,
        attendance.some((record) => record.recorded_via === "manual")
            ? "Manual overrides or excuses recorded"
            : null,
    ].filter(Boolean) as string[];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/dashboard/groups/${groupId}`)}
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900">
                        {student.name}
                    </h1>
                    <p className="text-sm text-gray-500">
                        {student.university_id}
                    </p>
                </div>
                {riskFlags.length > 0 ? (
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                        At Risk
                    </Badge>
                ) : (
                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                        Stable
                    </Badge>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg border bg-white p-4">
                    <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
                        <CheckCircle2 className="h-4 w-4" />
                        Present
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        {presentCount}
                    </p>
                </div>
                <div className="rounded-lg border bg-white p-4">
                    <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
                        <FilePenLine className="h-4 w-4" />
                        Excused
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        {excusedCount}
                    </p>
                </div>
                <div className="rounded-lg border bg-white p-4">
                    <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
                        <XCircle className="h-4 w-4" />
                        Attendance Rate
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        {attendanceRate}%
                    </p>
                </div>
                <div className="rounded-lg border bg-white p-4">
                    <div className="mb-1 flex items-center gap-2 text-sm text-gray-500">
                        <ShieldAlert className="h-4 w-4" />
                        Violations
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        {violations.length}
                    </p>
                </div>
            </div>

            <div className="rounded-lg border bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <h2 className="font-semibold text-gray-900">Risk Flags</h2>
                </div>
                {riskFlags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                        {riskFlags.map((flag) => (
                            <Badge
                                key={flag}
                                variant="outline"
                                className="border-amber-200 text-amber-700"
                            >
                                {flag}
                            </Badge>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-500">
                        No immediate attendance risk indicators.
                    </p>
                )}
            </div>

            <div className="border rounded-lg overflow-hidden bg-white">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Session</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead>Notes</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sessions.map((session) => {
                            const record = attendanceBySession.get(session.id);
                            return (
                                <TableRow key={session.id}>
                                    <TableCell className="font-medium">
                                        {session.title || "Untitled Session"}
                                    </TableCell>
                                    <TableCell className="text-sm text-gray-500">
                                        {new Date(
                                            session.started_at,
                                        ).toLocaleDateString("en-US", {
                                            weekday: "short",
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                        })}
                                    </TableCell>
                                    <TableCell>
                                        {!record ? (
                                            <Badge
                                                variant="secondary"
                                                className="text-gray-500"
                                            >
                                                Absent
                                            </Badge>
                                        ) : record.status === "excused" ? (
                                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                                                Excused
                                            </Badge>
                                        ) : (
                                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                                Present
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {record ? (
                                            <Badge
                                                variant="outline"
                                                className={
                                                    record.recorded_via ===
                                                    "manual"
                                                        ? "border-blue-200 text-blue-700"
                                                        : ""
                                                }
                                            >
                                                {record.recorded_via === "manual"
                                                    ? "Manual"
                                                    : "QR"}
                                            </Badge>
                                        ) : (
                                            "—"
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-gray-500">
                                        {record?.note || "—"}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
