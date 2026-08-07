"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
    defaultGradingSettings,
    formatGrade,
    getAverageGrade,
    getGradeValue,
    normalizeGradingSettings,
    type AttendanceStatus,
    type GradingSettings,
} from "@/lib/grading-settings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
    Download,
    Clock,
    Users,
    Loader2,
    CheckCircle2,
    AlertTriangle,
    MapPin,
    Smartphone,
    Pencil,
    Check,
    X,
    FilePenLine,
    ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { SessionCourseworkPanel } from "@/components/SessionCourseworkPanel";
import { useAppDialog } from "@/components/AppDialogProvider";

interface SessionDetail {
    id: string;
    title: string | null;
    category: "lecture" | "tutorial";
    duration_minutes: number;
    is_active: boolean;
    started_at: string;
    expires_at: string;
    group_id: string;
    latitude: number | null;
    longitude: number | null;
    radius_meters: number | null;
}

const sessionCategoryCopy = {
    lecture: {
        label: "Lecture",
        badgeClass: "border-sky-200 bg-sky-50 text-sky-700",
    },
    tutorial: {
        label: "Tutorial",
        badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
    },
} as const;

interface AttendanceRecord {
    id: string;
    university_id: string;
    scanned_at: string;
    status: "present" | "excused" | "late";
    recorded_via: "qr" | "manual";
    note: string | null;
    student: {
        name: string;
        university_id: string;
    };
}

interface AttendanceRecordRow {
    id: string;
    university_id: string;
    scanned_at: string;
    status: "present" | "excused" | "late";
    recorded_via: "qr" | "manual";
    note: string | null;
    student:
        | {
              name: string;
              university_id: string;
          }
        | {
              name: string;
              university_id: string;
          }[];
}

interface Student {
    id: string;
    name: string;
    university_id: string;
}

interface Violation {
    id: string;
    university_id: string;
    student_name: string;
    type: string;
    details: Record<string, unknown>;
    created_at: string;
}

export default function SessionDetailPage() {
    const params = useParams();
    const router = useRouter();
    const groupId = params.groupId as string;
    const sessionId = params.sessionId as string;
    const supabase = createClient();
    const { showAlert } = useAppDialog();

    const [session, setSession] = useState<SessionDetail | null>(null);
    const [groupName, setGroupName] = useState("");
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [violations, setViolations] = useState<Violation[]>([]);
    const [gradingSettings, setGradingSettings] =
        useState<GradingSettings>(defaultGradingSettings);
    const [loading, setLoading] = useState(true);
    const [overrideOpen, setOverrideOpen] = useState(false);
    const [overrideStudent, setOverrideStudent] = useState<Student | null>(null);
    const [overrideStatus, setOverrideStatus] = useState<
        "present" | "excused" | "late"
    >("present");
    const [overrideNote, setOverrideNote] = useState("");
    const [savingOverride, setSavingOverride] = useState(false);

    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [isUpdatingTitle, setIsUpdatingTitle] = useState(false);

    const handleUpdateTitle = async () => {
        if (!editTitle.trim() || editTitle.trim() === session?.title) {
            setIsEditingTitle(false);
            return;
        }

        setIsUpdatingTitle(true);
        try {
            const { error } = await supabase
                .from("sessions")
                .update({ title: editTitle.trim() })
                .eq("id", sessionId);

            if (error) throw error;

            setSession((prev) =>
                prev ? { ...prev, title: editTitle.trim() } : prev,
            );
            setIsEditingTitle(false);
        } catch (err) {
            console.error("Failed to update title:", err);
        } finally {
            setIsUpdatingTitle(false);
        }
    };

    const fetchData = useCallback(async () => {
        const [
            sessionRes,
            groupRes,
            attendanceRes,
            studentsRes,
            gradingSettingsRes,
            violationsRes,
        ] =
            await Promise.all([
                supabase
                    .from("sessions")
                    .select("*")
                    .eq("id", sessionId)
                    .single(),
                supabase
                    .from("groups")
                    .select("name")
                    .eq("id", groupId)
                    .maybeSingle(),
                supabase
                    .from("attendance_records")
                    .select(
                        "id, university_id, scanned_at, status, recorded_via, note, student:students(name, university_id)",
                    )
                    .eq("session_id", sessionId)
                    .order("scanned_at"),
                supabase
                    .from("students")
                    .select("*")
                    .eq("group_id", groupId)
                    .order("name"),
                supabase
                    .from("group_grading_settings")
                    .select(
                        "present_grade, late_grade, excused_grade, absent_grade, late_after_minutes",
                    )
                    .eq("group_id", groupId)
                    .maybeSingle(),
                supabase
                    .from("violations")
                    .select("*")
                    .eq("session_id", sessionId)
                    .order("created_at", { ascending: false }),
            ]);

        const normalizedAttendance = ((attendanceRes.data || []) as AttendanceRecordRow[]).map(
            (record) => ({
                ...record,
                student: Array.isArray(record.student)
                    ? record.student[0]
                    : record.student,
            }),
        );

        setSession(sessionRes.data);
        setGroupName(groupRes.data?.name || "Group");
        setAttendance(normalizedAttendance);
        setAllStudents(studentsRes.data || []);
        setGradingSettings(normalizeGradingSettings(gradingSettingsRes.data));
        setViolations(violationsRes.data || []);
        setLoading(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId, groupId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const openOverrideDialog = (
        student: Student,
        record?: AttendanceRecord | undefined,
    ) => {
        setOverrideStudent(student);
        setOverrideStatus(record?.status || "present");
        setOverrideNote(record?.note || "");
        setOverrideOpen(true);
    };

    const handleSaveOverride = async () => {
        if (!overrideStudent) return;

        setSavingOverride(true);
        try {
            const res = await fetch(
                `/api/sessions/${sessionId}/attendance-override`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        studentId: overrideStudent.id,
                        status: overrideStatus,
                        note: overrideNote,
                    }),
                },
            );

            const data = await res.json();
            if (!res.ok) {
                await showAlert({
                    title: "Failed To Save Override",
                    description: data.error || "Failed to save override.",
                    variant: "error",
                });
                return;
            }

            setOverrideOpen(false);
            setOverrideStudent(null);
            setOverrideNote("");
            fetchData();
        } finally {
            setSavingOverride(false);
        }
    };

    const handleDownloadExcel = async () => {
        if (!allStudents.length) return;

        // Dynamic import to avoid SSR issues
        const ExcelJS = (await import("exceljs")).default;
        const { saveAs } = (await import("file-saver")).default;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Attendance");

        // Define columns
        worksheet.columns = [
            { header: "Name", key: "name", width: 30 },
            { header: "University ID", key: "id", width: 20 },
            { header: "Attended", key: "attended", width: 15 },
            { header: "Status / Violation", key: "status", width: 40 },
        ];

        // Style headers
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE0E0E0" },
        };

        allStudents.forEach((student) => {
            const attendanceRecord = attendance.find(
                (record) => record.university_id === student.university_id,
            );
            const gradeValue = formatGrade(
                getGradeValue(
                    attendanceRecord?.status as AttendanceStatus | undefined,
                    gradingSettings,
                ),
            );
            let statusText = attendanceRecord
                ? attendanceRecord.status === "excused"
                    ? "Excused"
                    : attendanceRecord.status === "late"
                      ? "Late"
                      : "Present"
                : "Absent";
            let rowColor: string | null = null;

            // Check for violations matching this student
            const studentViolations = violations.filter(
                (v) =>
                    v.university_id === student.university_id ||
                    ((v.type === "duplicate_device" || v.type === "duplicate_device_soft") &&
                        v.details.original_student_id ===
                            student.university_id),
            );

            if (studentViolations.length > 0) {
                const outOfRange = studentViolations.find(
                    (v) => v.type === "out_of_range",
                );
                const attemptedHardDuplicate = studentViolations.find(
                    (v) =>
                        v.type === "duplicate_device" &&
                        v.university_id === student.university_id,
                );
                const originalHardDuplicate = studentViolations.find(
                    (v) =>
                        v.type === "duplicate_device" &&
                        v.details.original_student_id === student.university_id,
                );
                const attemptedSoftDuplicate = studentViolations.find(
                    (v) =>
                        v.type === "duplicate_device_soft" &&
                        v.university_id === student.university_id,
                );
                const originalSoftDuplicate = studentViolations.find(
                    (v) =>
                        v.type === "duplicate_device_soft" &&
                        v.details.original_student_id === student.university_id,
                );

                if (attemptedHardDuplicate) {
                    statusText = `⛔ Same device UUID as: ${attemptedHardDuplicate.details.original_student_name} (${attemptedHardDuplicate.details.original_student_id}) — UUID: ${attemptedHardDuplicate.details.device_id}`;
                    rowColor = "FFFFCCCC"; // Light Red — hard block
                } else if (originalHardDuplicate) {
                    statusText = `⛔ Device UUID shared with: ${originalHardDuplicate.student_name} (${originalHardDuplicate.university_id}) — UUID: ${originalHardDuplicate.details.device_id}`;
                    rowColor = "FFFFCCCC"; // Light Red — hard block
                } else if (attemptedSoftDuplicate) {
                    statusText = `⚠️ Same device fingerprint as: ${attemptedSoftDuplicate.details.original_student_name} (${attemptedSoftDuplicate.details.original_student_id}) — Fingerprint: ${attemptedSoftDuplicate.details.fingerprint}`;
                    rowColor = "FFFFFFCC"; // Light Yellow — soft warning
                } else if (originalSoftDuplicate) {
                    statusText = `⚠️ Same device fingerprint as: ${originalSoftDuplicate.student_name} (${originalSoftDuplicate.university_id}) — Fingerprint: ${originalSoftDuplicate.details.fingerprint}`;
                    rowColor = "FFFFFFCC"; // Light Yellow — soft warning
                } else if (outOfRange) {
                    statusText = `Out of range (${outOfRange.details.distance_meters}m)`;
                    rowColor = "FFFFCCCC"; // Light Red
                }
            }

            const row = worksheet.addRow({
                name: student.name,
                id: student.university_id,
                attended: gradeValue,
                status: statusText,
            });

            // Apply color if violation exists
            if (rowColor) {
                row.eachCell((cell) => {
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: rowColor as string },
                    };
                });
            }
        });

        // Generate and save file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        saveAs(
            blob,
            `attendance_${session?.title || sessionId}_${new Date().toISOString().split("T")[0]}.xlsx`,
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!session) {
        return (
            <div className="text-center py-20 text-gray-500">
                Session not found
            </div>
        );
    }

    const lateCount = attendance.filter(
        (record) => record.status === "late",
    ).length;
    const excusedCount = attendance.filter(
        (record) => record.status === "excused",
    ).length;
    const presentCount = attendance.filter(
        (record) => record.status === "present",
    ).length;
    const attendanceByUniversityId = new Map(
        attendance.map((record) => [record.university_id, record]),
    );
    const absentStudents = allStudents.filter(
        (student) => !attendanceByUniversityId.has(student.university_id),
    );
    const manualRecords = attendance.filter(
        (record) => record.recorded_via === "manual",
    );
    const attendanceRate =
        allStudents.length > 0
            ? Math.round((attendance.length / allStudents.length) * 100)
            : 0;
    const totalGradePoints = allStudents.reduce((sum, student) => {
        const record = attendance.find(
            (attendanceRecord) =>
                attendanceRecord.university_id === student.university_id,
        );

        return (
            sum +
            getGradeValue(
                record?.status as AttendanceStatus | undefined,
                gradingSettings,
            )
        );
    }, 0);
    const averageGrade = getAverageGrade(totalGradePoints, allStudents.length);

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    <button type="button" onClick={() => router.push("/dashboard")} className="transition-colors hover:text-primary">Dashboard</button>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <button type="button" onClick={() => router.push(`/dashboard/groups/${groupId}`)} className="transition-colors hover:text-primary">{groupName || "Group"}</button>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <span className="text-primary">{session.title || "Session"}</span>
                </div>

                <Button variant="ghost" className="w-fit px-0 text-muted-foreground hover:text-foreground" onClick={() => router.push(`/dashboard/groups/${groupId}`)}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to group hub
                </Button>
            </div>

            <section className="overflow-hidden rounded-[30px] border border-border/70 bg-[linear-gradient(180deg,rgba(251,253,255,0.98),rgba(245,248,252,0.96))] shadow-[0_24px_60px_-42px_rgba(22,47,95,0.3)]">
                <div className="grid gap-6 border-b border-border/70 px-6 py-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="bg-primary/6 text-primary">Session record</Badge>
                            {session.is_active ? (
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Live</Badge>
                            ) : (
                                <Badge variant="secondary">Ended</Badge>
                            )}
                            <Badge variant="outline" className={sessionCategoryCopy[session.category].badgeClass}>
                                {sessionCategoryCopy[session.category].label}
                            </Badge>
                            {session.latitude ? (
                                <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                                    <MapPin className="mr-1 h-3 w-3" />
                                    Location validated
                                </Badge>
                            ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            {isEditingTitle ? (
                                <div className="flex flex-wrap items-center gap-2">
                                    <Input
                                        value={editTitle}
                                        onChange={(e) => setEditTitle(e.target.value)}
                                        className="h-10 w-[280px] bg-background text-xl font-semibold"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleUpdateTitle();
                                            if (e.key === "Escape") setIsEditingTitle(false);
                                        }}
                                        disabled={isUpdatingTitle}
                                    />
                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700" onClick={handleUpdateTitle} disabled={isUpdatingTitle}>
                                        {isUpdatingTitle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setIsEditingTitle(false)} disabled={isUpdatingTitle}>
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <>
                                    <h1 className="font-display text-4xl text-foreground">{session.title || "Untitled Session"}</h1>
                                    <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground transition-colors hover:text-foreground" onClick={() => { setEditTitle(session.title || ""); setIsEditingTitle(true); }}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                </>
                            )}
                        </div>

                        <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                            Review attendance status, session-linked coursework, and any integrity issues without leaving the session workspace.
                        </p>
                    </div>

                    <div className="rounded-[24px] border border-border/70 bg-background/90 px-5 py-5 shadow-sm">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Session timing</div>
                        <div className="mt-3 space-y-3 text-sm text-muted-foreground">
                            <div>
                                <div className="font-medium text-foreground">
                                    {new Date(session.started_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                                </div>
                                <div className="mt-1">
                                    {new Date(session.started_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                            </div>
                            <div className="rounded-[20px] border border-border/60 bg-card px-4 py-3">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Duration</div>
                                <div className="mt-2 text-2xl font-semibold text-foreground">{session.duration_minutes} min</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={`grid gap-4 px-6 py-6 lg:px-8 ${violations.length > 0 ? "md:grid-cols-3 xl:grid-cols-6" : "md:grid-cols-2 xl:grid-cols-5"}`}>
                    <div className="rounded-[24px] border border-border/70 bg-background/96 px-4 py-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4" />Grade total</div><p className="mt-3 text-3xl font-semibold text-foreground">{formatGrade(totalGradePoints)}</p></div>
                    <div className="rounded-[24px] border border-border/70 bg-background/96 px-4 py-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4" />Grade average</div><p className="mt-3 text-3xl font-semibold text-foreground">{formatGrade(averageGrade)}</p></div>
                    <div className="rounded-[24px] border border-border/70 bg-background/96 px-4 py-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" />Late</div><p className="mt-3 text-3xl font-semibold text-foreground">{lateCount}</p></div>
                    <div className="rounded-[24px] border border-border/70 bg-background/96 px-4 py-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><FilePenLine className="h-4 w-4" />Excused</div><p className="mt-3 text-3xl font-semibold text-foreground">{excusedCount}</p></div>
                    <div className="rounded-[24px] border border-border/70 bg-background/96 px-4 py-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Download className="h-4 w-4" />Export</div><Button onClick={handleDownloadExcel} variant="outline" className="mt-3 w-full"><Download className="mr-2 h-4 w-4" />Download Excel</Button></div>
                    {violations.length > 0 && (<div className="rounded-[24px] border border-red-200 bg-red-50/90 px-4 py-4"><div className="flex items-center gap-2 text-sm text-red-700"><AlertTriangle className="h-4 w-4" />Violations</div><p className="mt-3 text-3xl font-semibold text-red-700">{violations.length}</p></div>)}
                </div>
            </section>

            <Tabs defaultValue="review" className="space-y-5">
                <TabsList>
                    <TabsTrigger value="review">Review</TabsTrigger>
                    <TabsTrigger value="attendance">Attendance</TabsTrigger>
                    <TabsTrigger value="coursework">Coursework</TabsTrigger>
                    {violations.length > 0 && (
                        <TabsTrigger value="violations" className="text-red-700">
                            Violations ({violations.length})
                        </TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="review">
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
                        <div className="rounded-[28px] border border-border/70 bg-background/96 p-5 shadow-[0_24px_60px_-42px_rgba(22,47,95,0.22)]">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">
                                        Post-session review
                                    </Badge>
                                    <h2 className="mt-3 text-xl font-semibold tracking-[-0.02em] text-foreground">
                                        Attendance outcome
                                    </h2>
                                    <p className="mt-1 text-sm text-soft">
                                        Review absences, manual changes, and flagged check-ins before exporting.
                                    </p>
                                </div>
                                <Button onClick={handleDownloadExcel} variant="outline">
                                    <Download className="mr-2 h-4 w-4" />
                                    Export
                                </Button>
                            </div>

                            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="rounded-2xl border border-border/70 bg-card p-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                                        Attendance
                                    </p>
                                    <p className="mt-3 text-3xl font-semibold text-foreground">
                                        {attendanceRate}%
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-border/70 bg-card p-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                                        Present
                                    </p>
                                    <p className="mt-3 text-3xl font-semibold text-foreground">
                                        {presentCount}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-border/70 bg-card p-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                                        Absent
                                    </p>
                                    <p className="mt-3 text-3xl font-semibold text-foreground">
                                        {absentStudents.length}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-border/70 bg-card p-4">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                                        Manual
                                    </p>
                                    <p className="mt-3 text-3xl font-semibold text-foreground">
                                        {manualRecords.length}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-5 rounded-2xl border border-border/70 bg-card p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <p className="text-sm font-medium text-foreground">
                                        Check-in progress
                                    </p>
                                    <span className="text-sm font-semibold text-primary">
                                        {attendance.length} / {allStudents.length}
                                    </span>
                                </div>
                                <div className="mt-3 h-2 rounded-full bg-secondary">
                                    <div
                                        className="h-2 rounded-full bg-primary"
                                        style={{ width: `${attendanceRate}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-5">
                            <div className="rounded-[28px] border border-border/70 bg-background/96 p-5 shadow-[0_24px_60px_-42px_rgba(22,47,95,0.22)]">
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                                        Absent students
                                    </h3>
                                    <Badge variant="secondary">
                                        {absentStudents.length}
                                    </Badge>
                                </div>
                                <div className="mt-4 max-h-72 space-y-2 overflow-auto">
                                    {absentStudents.length > 0 ? (
                                        absentStudents.map((student) => (
                                            <div key={student.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3">
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-foreground">
                                                        {student.name}
                                                    </p>
                                                    <p className="text-xs text-soft">
                                                        {student.university_id}
                                                    </p>
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() =>
                                                        openOverrideDialog(student)
                                                    }
                                                >
                                                    Override
                                                </Button>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="rounded-2xl border border-dashed border-border/70 bg-card p-4 text-sm text-soft">
                                            No absent students in this session.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="rounded-[28px] border border-border/70 bg-background/96 p-5 shadow-[0_24px_60px_-42px_rgba(22,47,95,0.22)]">
                                <div className="flex items-center justify-between gap-3">
                                    <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                                        Items to verify
                                    </h3>
                                    <Badge variant={violations.length > 0 ? "destructive" : "secondary"}>
                                        {violations.length}
                                    </Badge>
                                </div>
                                <div className="mt-4 space-y-2 text-sm text-soft">
                                    <p>
                                        Manual overrides: {manualRecords.length}
                                    </p>
                                    <p>
                                        Late check-ins: {lateCount}
                                    </p>
                                    <p>
                                        Excused check-ins: {excusedCount}
                                    </p>
                                    <p>
                                        Integrity flags: {violations.length}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* Attendance Tab */}
                <TabsContent value="attendance">
                    <div className="overflow-hidden rounded-[28px] border border-border/70 bg-background/96 shadow-[0_24px_60px_-42px_rgba(22,47,95,0.22)]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">#</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>University ID</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Grade</TableHead>
                                    <TableHead>Source</TableHead>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Notes</TableHead>
                                    <TableHead className="w-28"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {allStudents.map((student, index) => {
                                    const record = attendance.find(
                                        (a) =>
                                            a.university_id ===
                                            student.university_id,
                                    );
                                    return (
                                        <TableRow key={student.id}>
                                            <TableCell className="text-muted-foreground">
                                                {index + 1}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {student.name}
                                            </TableCell>
                                            <TableCell>
                                                {student.university_id}
                                            </TableCell>
                                            <TableCell>
                                                {record ? (
                                                    record.status ===
                                                    "excused" ? (
                                                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                                                            Excused
                                                        </Badge>
                                                    ) : record.status ===
                                                      "late" ? (
                                                        <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                                                            Late
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                                            Present
                                                        </Badge>
                                                    )
                                                ) : (
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-muted-foreground"
                                                    >
                                                        Absent
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium text-foreground">
                                                {formatGrade(
                                                    getGradeValue(
                                                        record?.status as
                                                            | AttendanceStatus
                                                            | undefined,
                                                        gradingSettings,
                                                    ),
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {record ? (
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            record.recorded_via ===
                                                            "manual"
                                                                ? "border-primary/20 bg-primary/5 text-primary"
                                                                : ""
                                                        }
                                                    >
                                                        {record.recorded_via ===
                                                        "manual"
                                                            ? "Manual"
                                                            : "QR"}
                                                    </Badge>
                                                ) : (
                                                    "—"
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {record
                                                    ? new Date(
                                                          record.scanned_at,
                                                      ).toLocaleTimeString(
                                                          "en-US",
                                                          {
                                                              hour: "2-digit",
                                                              minute: "2-digit",
                                                          },
                                                      )
                                                    : "—"}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {record?.note || "—"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {!record ||
                                                record.recorded_via ===
                                                    "manual" ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="min-w-24"
                                                        onClick={() =>
                                                            openOverrideDialog(
                                                                student,
                                                                record,
                                                            )
                                                        }
                                                    >
                                                        {record
                                                            ? "Update"
                                                            : "Override"}
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs font-medium text-muted-foreground">
                                                        QR locked
                                                    </span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                <TabsContent value="coursework">
                    <SessionCourseworkPanel
                        groupId={groupId}
                        sessionId={sessionId}
                        sessionTitle={session.title}
                        sessionCategory={session.category}
                        students={allStudents}
                    />
                </TabsContent>

                {/* Violations Tab */}
                {violations.length > 0 && (
                    <TabsContent value="violations">
                        <div className="overflow-hidden rounded-[28px] border border-border/70 bg-background/96 shadow-[0_24px_60px_-42px_rgba(22,47,95,0.22)]">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Student</TableHead>
                                        <TableHead>University ID</TableHead>
                                        <TableHead>Details</TableHead>
                                        <TableHead>Time</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {violations.map((v) => (
                                        <TableRow key={v.id}>
                                            <TableCell>
                                                {v.type === "out_of_range" ? (
                                                    <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                                                        <MapPin className="h-3 w-3 mr-1" />
                                                        Out of Range
                                                    </Badge>
                                                ) : v.type === "duplicate_device" ? (
                                                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                                                        <Smartphone className="h-3 w-3 mr-1" />
                                                        Duplicate Device
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                                                        <Smartphone className="h-3 w-3 mr-1" />
                                                        Similar Device
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {v.student_name}
                                            </TableCell>
                                            <TableCell>
                                                {v.university_id}
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-500 max-w-[350px]">
                                                {v.type === "out_of_range"
                                                    ? `${v.details.distance_meters as number}m away (limit: ${v.details.radius_meters as number}m)`
                                                    : v.type === "duplicate_device"
                                                      ? `⛔ Blocked — same device UUID as ${(v.details.original_student_name as string) || "Unknown"} (${v.details.original_student_id as string}). UUID: ${v.details.device_id as string}`
                                                      : `⚠️ Allowed — same device fingerprint as ${(v.details.original_student_name as string) || "Unknown"} (${v.details.original_student_id as string}). Fingerprint: ${v.details.fingerprint as string}`}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {new Date(
                                                    v.created_at,
                                                ).toLocaleTimeString("en-US", {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                )}
            </Tabs>

            <Dialog
                open={overrideOpen}
                onOpenChange={setOverrideOpen}
            >
                <DialogContent className="border-border/70 bg-background">
                    <DialogHeader>
                        <DialogTitle>Attendance override</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-5 py-2">
                        <div className="rounded-[22px] border border-border/70 bg-card px-4 py-4">
                            <p className="font-medium text-foreground">
                                {overrideStudent?.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {overrideStudent?.university_id}
                            </p>
                        </div>
                        <div className="space-y-3">
                            <p className="text-sm font-medium text-foreground">
                                Status
                            </p>
                            <div className="grid gap-2 sm:grid-cols-3">
                                <Button
                                    type="button"
                                    variant={
                                        overrideStatus === "present"
                                            ? "default"
                                            : "outline"
                                    }
                                    className="justify-center"
                                    onClick={() => setOverrideStatus("present")}
                                >
                                    Present
                                </Button>
                                <Button
                                    type="button"
                                    variant={
                                        overrideStatus === "late"
                                            ? "default"
                                            : "outline"
                                    }
                                    className="justify-center"
                                    onClick={() => setOverrideStatus("late")}
                                >
                                    Late
                                </Button>
                                <Button
                                    type="button"
                                    variant={
                                        overrideStatus === "excused"
                                            ? "default"
                                            : "outline"
                                    }
                                    className="justify-center"
                                    onClick={() => setOverrideStatus("excused")}
                                >
                                    Excused
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label
                                htmlFor="overrideNote"
                                className="text-sm font-medium text-foreground"
                            >
                                Note
                            </label>
                            <textarea
                                id="overrideNote"
                                value={overrideNote}
                                onChange={(e) =>
                                    setOverrideNote(e.target.value)
                                }
                                placeholder="Optional reason or explanation"
                                rows={4}
                                className="flex min-h-[112px] w-full rounded-2xl border border-input bg-background px-3 py-3 text-sm shadow-xs outline-none focus-visible:border-primary/40 focus-visible:ring-4 focus-visible:ring-primary/10"
                            />
                            <p className="text-xs text-muted-foreground">
                                Late attendance currently counts as {formatGrade(gradingSettings.late_grade)} for this group.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOverrideOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSaveOverride}
                            disabled={savingOverride}
                        >
                            {savingOverride && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Save override
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
