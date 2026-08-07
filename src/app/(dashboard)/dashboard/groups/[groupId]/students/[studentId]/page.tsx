"use client";

import { useCallback, useEffect, useState } from "react";
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
    BookOpenCheck,
    CalendarClock,
    CheckCircle2,
    ChevronRight,
    Clock,
    FilePenLine,
    GraduationCap,
    Loader2,
    ShieldAlert,
    Sparkles,
    TrendingUp,
    XCircle,
} from "lucide-react";
import {
    formatCourseworkKind,
    formatCourseworkScore,
    getCourseworkKindBadgeClass,
    type CourseworkAssessmentKind,
    type SessionCategory,
} from "@/lib/coursework";
import {
    calculateStudentCourseworkBreakdown,
    getCourseworkBreakdownCategoriesOrDefault,
    type CourseworkBreakdownCategory,
} from "@/lib/coursework-breakdown";

interface Student {
    id: string;
    name: string;
    university_id: string;
}

interface GroupSummary {
    id: string;
    name: string;
}

interface Session {
    id: string;
    title: string | null;
    category: "lecture" | "tutorial";
    started_at: string;
    is_active: boolean;
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
    session_id: string;
    scanned_at: string;
    status: "present" | "excused" | "late";
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

interface CourseworkAssessmentSummary {
    id: string;
    title: string;
    assessment_kind: CourseworkAssessmentKind;
    max_score: number;
    category: SessionCategory | null;
    assessment_date: string;
}

interface CourseworkGradeRow {
    score: number;
    assessment: CourseworkAssessmentSummary | null;
}

interface RawCourseworkGradeRow {
    score: number;
    assessment: CourseworkAssessmentSummary | CourseworkAssessmentSummary[] | null;
}

export default function StudentHistoryPage() {
    const params = useParams();
    const router = useRouter();
    const groupId = params.groupId as string;
    const studentId = params.studentId as string;
    const supabase = createClient();

    const [student, setStudent] = useState<Student | null>(null);
    const [group, setGroup] = useState<GroupSummary | null>(null);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [violations, setViolations] = useState<Violation[]>([]);
    const [courseworkGrades, setCourseworkGrades] = useState<CourseworkGradeRow[]>(
        [],
    );
    const [gradingSettings, setGradingSettings] =
        useState<GradingSettings>(defaultGradingSettings);
    const [breakdownCategories, setBreakdownCategories] = useState<
        CourseworkBreakdownCategory[]
    >([]);
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

        const [
            { data: groupData },
            { data: sessionsData },
            { data: attendanceData },
            { data: gradingSettingsData },
            { data: courseworkData },
            { data: breakdownData },
        ] =
            await Promise.all([
                supabase
                    .from("groups")
                    .select("id, name")
                    .eq("id", groupId)
                    .maybeSingle(),
                supabase
                    .from("sessions")
                    .select("id, title, category, started_at, is_active")
                    .eq("group_id", groupId)
                    .order("started_at", { ascending: false }),
                supabase
                    .from("attendance_records")
                    .select(
                        "session_id, scanned_at, status, recorded_via, note",
                    )
                    .eq("student_id", studentId),
                supabase
                    .from("group_grading_settings")
                    .select(
                        "present_grade, late_grade, excused_grade, absent_grade, late_after_minutes",
                    )
                    .eq("group_id", groupId)
                    .maybeSingle(),
                supabase
                    .from("coursework_grades")
                    .select(
                        "score, assessment:coursework_assessments(id, title, assessment_kind, max_score, category, assessment_date)",
                    )
                    .eq("student_id", studentId),
                supabase
                    .from("group_coursework_categories")
                    .select(
                        "id, group_id, name, weight, included_kinds, include_attendance, aggregation, aggregation_limit, position",
                    )
                    .eq("group_id", groupId)
                    .order("position", { ascending: true }),
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
        setGroup(groupData || null);
        setSessions(sessionsData || []);
        setAttendance(attendanceData || []);
        setGradingSettings(normalizeGradingSettings(gradingSettingsData));
        setViolations(violationsData || []);
        setCourseworkGrades(
            ((courseworkData || []) as RawCourseworkGradeRow[])
                .map((row) => ({
                    ...row,
                    assessment: Array.isArray(row.assessment)
                        ? (row.assessment[0] ?? null)
                        : row.assessment,
                }))
                .filter((row) => row.assessment),
        );
        setBreakdownCategories(
            getCourseworkBreakdownCategoriesOrDefault(breakdownData || null),
        );
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
    const lateCount = attendance.filter(
        (record) => record.status === "late",
    ).length;
    const excusedCount = attendance.filter(
        (record) => record.status === "excused",
    ).length;
    const totalSessions = endedSessions.length;
    const attendedSessions = presentCount + lateCount + excusedCount;
    const absentCount = Math.max(totalSessions - attendedSessions, 0);
    const attendanceRate =
        totalSessions > 0 ? Math.round((attendedSessions / totalSessions) * 100) : 0;
    const overallGradeTotal = endedSessions.reduce((sum, session) => {
        const record = attendanceBySession.get(session.id);
        return (
            sum +
            getGradeValue(
                record?.status as AttendanceStatus | undefined,
                gradingSettings,
            )
        );
    }, 0);
    const lectureSessions = endedSessions.filter(
        (session) => session.category === "lecture",
    );
    const tutorialSessions = endedSessions.filter(
        (session) => session.category === "tutorial",
    );
    const lectureGradeTotal = lectureSessions.reduce((sum, session) => {
        const record = attendanceBySession.get(session.id);
        return (
            sum +
            getGradeValue(
                record?.status as AttendanceStatus | undefined,
                gradingSettings,
            )
        );
    }, 0);
    const tutorialGradeTotal = tutorialSessions.reduce((sum, session) => {
        const record = attendanceBySession.get(session.id);
        return (
            sum +
            getGradeValue(
                record?.status as AttendanceStatus | undefined,
                gradingSettings,
            )
        );
    }, 0);
    const overallGradeAverage = getAverageGrade(overallGradeTotal, totalSessions);
    const courseworkTotal = courseworkGrades.reduce(
        (sum, row) => sum + row.score,
        0,
    );
    const courseworkMaxTotal = courseworkGrades.reduce(
        (sum, row) => sum + (row.assessment?.max_score || 0),
        0,
    );
    const lectureGradeAverage = getAverageGrade(
        lectureGradeTotal,
        lectureSessions.length,
    );
    const tutorialGradeAverage = getAverageGrade(
        tutorialGradeTotal,
        tutorialSessions.length,
    );
    const weightedCoursework = calculateStudentCourseworkBreakdown({
        categories: breakdownCategories,
        assessments: courseworkGrades
            .filter((row) => row.assessment)
            .map((row) => ({
                id: row.assessment?.id || "",
                assessment_kind: row.assessment?.assessment_kind || "other",
                max_score: row.assessment?.max_score || 0,
            }))
            .filter((assessment) => assessment.id),
        grades: courseworkGrades
            .filter((row) => row.assessment)
            .map((row) => ({
                student_id: student.id,
                assessment_id: row.assessment?.id || "",
                score: row.score,
            }))
            .filter((row) => row.assessment_id),
        studentId: student.id,
        attendanceEarned: overallGradeTotal,
        attendanceMax: totalSessions * gradingSettings.present_grade,
    });

    let recentAbsenceStreak = 0;
    for (const session of endedSessions) {
        const record = attendanceBySession.get(session.id);
        if (
            record?.status === "present" ||
            record?.status === "excused" ||
            record?.status === "late"
        ) {
            break;
        }
        recentAbsenceStreak += 1;
    }

    const riskFlags = [
        totalSessions > 0 && overallGradeAverage > gradingSettings.present_grade
            ? `Average grade is ${formatGrade(overallGradeAverage)}`
            : null,
        lectureSessions.length > 0 &&
        lectureGradeAverage > gradingSettings.present_grade
            ? `Lecture grade average is ${formatGrade(lectureGradeAverage)}`
            : null,
        tutorialSessions.length > 0 &&
        tutorialGradeAverage > gradingSettings.present_grade
            ? `Tutorial grade average is ${formatGrade(tutorialGradeAverage)}`
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
    const profileStatus =
        riskFlags.length > 0
            ? {
                  label: "Needs attention",
                  className:
                      "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-50",
              }
            : {
                  label: "On track",
                  className:
                      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
              };
    const performanceCards = [
        {
            label: "Attendance coverage",
            value: `${attendanceRate}%`,
            detail:
                totalSessions > 0
                    ? `${attendedSessions} recorded out of ${totalSessions} completed sessions`
                    : "No completed sessions yet",
            icon: CalendarClock,
        },
        {
            label: "Overall attendance grade",
            value: formatGrade(overallGradeAverage),
            detail: "Combined lecture and tutorial attendance standing",
            icon: TrendingUp,
        },
        {
            label: "Weighted coursework",
            value: `${formatCourseworkScore(weightedCoursework.totalWeightedScore)} / ${formatCourseworkScore(weightedCoursework.maxWeightedScore)}`,
            detail: `Raw coursework ${formatCourseworkScore(courseworkTotal)} / ${formatCourseworkScore(courseworkMaxTotal)}`,
            icon: GraduationCap,
        },
        {
            label: "Recorded violations",
            value: `${violations.length}`,
            detail:
                violations.length > 0
                    ? "Review anomaly and misconduct records"
                    : "No violation records for this student",
            icon: ShieldAlert,
        },
    ];
    const attendanceBreakdown = [
        {
            label: "Present",
            value: presentCount,
            className: "border-emerald-200 bg-emerald-50/80 text-emerald-700",
            icon: CheckCircle2,
        },
        {
            label: "Late",
            value: lateCount,
            className: "border-amber-200 bg-amber-50/80 text-amber-700",
            icon: Clock,
        },
        {
            label: "Excused",
            value: excusedCount,
            className: "border-sky-200 bg-sky-50/80 text-sky-700",
            icon: FilePenLine,
        },
        {
            label: "Absent",
            value: absentCount,
            className: "border-slate-200 bg-slate-50 text-slate-700",
            icon: XCircle,
        },
    ];

    return (
        <div className="space-y-6">
            <div className="space-y-3">
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
                    <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                    <button
                        type="button"
                        onClick={() => router.push(`/dashboard/groups/${groupId}`)}
                        className="transition-colors hover:text-primary"
                    >
                        {group?.name || "Group"}
                    </button>
                    <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                    <span className="text-foreground">{student.name}</span>
                </nav>

                <div>
                <Button
                    variant="ghost"
                    className="h-10 gap-2 rounded-full px-4 text-[0.76rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                    onClick={() => router.push(`/dashboard/groups/${groupId}`)}
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to group hub
                </Button>
                </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,2.15fr)_minmax(320px,0.85fr)]">
                <section className="overflow-hidden rounded-[28px] border border-border/70 bg-[linear-gradient(180deg,rgba(251,253,255,0.98),rgba(245,248,252,0.96))] shadow-[0_24px_60px_-42px_rgba(22,47,95,0.36)]">
                    <div className="border-b border-border/60 px-6 py-5 sm:px-8">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <Badge className="rounded-full border-primary/20 bg-primary/8 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary hover:bg-primary/8">
                                            Student detail
                                        </Badge>
                                        <Badge
                                            variant="outline"
                                            className={profileStatus.className}
                                        >
                                            {profileStatus.label}
                                        </Badge>
                                    </div>
                                    <div>
                                        <h1 className="font-display text-3xl text-foreground sm:text-[2.15rem]">
                                            {student.name}
                                        </h1>
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            University ID {student.university_id}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid w-full gap-3 sm:w-auto sm:min-w-[240px]">
                                <div className="rounded-2xl border border-primary/12 bg-primary/5 px-4 py-3">
                                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary/80">
                                        Attendance standing
                                    </p>
                                    <p className="mt-2 text-2xl font-semibold text-foreground">
                                        {attendanceRate}%
                                    </p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                        {attendedSessions} of {totalSessions} completed
                                        sessions recorded
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                        Current profile signal
                                    </p>
                                    <p className="mt-2 text-sm text-foreground">
                                        {riskFlags.length > 0
                                            ? "Patterns in attendance or violations need a closer review."
                                            : "Attendance and coursework are tracking normally right now."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 sm:px-8">
                        {performanceCards.map((card) => {
                            const Icon = card.icon;
                            return (
                                <div
                                    key={card.label}
                                    className="min-h-[176px] rounded-[24px] border border-border/70 bg-background/88 px-5 py-5"
                                >
                                    <div className="flex h-full flex-col">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                                <Icon className="h-4 w-4" />
                                            </span>
                                            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                                {card.label}
                                            </p>
                                        </div>
                                        <p className="mt-5 text-[1.85rem] font-semibold tracking-tight text-foreground">
                                            {card.value}
                                        </p>
                                        <p className="mt-auto max-w-[28rem] pt-3 text-sm leading-6 text-muted-foreground">
                                            {card.detail}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                <section className="rounded-[28px] border border-border/70 bg-background/96 p-6 shadow-[0_24px_60px_-42px_rgba(22,47,95,0.28)]">
                    <div className="flex items-center gap-2">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                            <Sparkles className="h-4 w-4" />
                        </span>
                        <div>
                            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-amber-700">
                                Student signal
                            </p>
                            <h2 className="text-xl font-semibold text-foreground">
                                Risk review
                            </h2>
                        </div>
                    </div>

                    {riskFlags.length > 0 ? (
                        <div className="mt-5 space-y-3">
                            {riskFlags.map((flag) => (
                                <div
                                    key={flag}
                                    className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3"
                                >
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-700" />
                                        <p className="text-sm leading-6 text-amber-900">
                                            {flag}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/80 px-4 py-4">
                            <div className="flex items-start gap-3">
                                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700" />
                                <div>
                                    <p className="text-sm font-medium text-emerald-900">
                                        No immediate risk indicators
                                    </p>
                                    <p className="mt-1 text-sm leading-6 text-emerald-800/90">
                                        Attendance, coursework, and violation records do
                                        not show urgent intervention signals right now.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                        {attendanceBreakdown.map((item) => {
                            const Icon = item.icon;
                            return (
                                <div
                                    key={item.label}
                                    className={`rounded-2xl border px-4 py-4 ${item.className}`}
                                >
                                    <div className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.18em]">
                                        <Icon className="h-4 w-4" />
                                        {item.label}
                                    </div>
                                    <p className="mt-3 text-2xl font-semibold">
                                        {item.value}
                                    </p>
                                </div>
                            );
                        })}
                    </div>

                    <div className="mt-6 rounded-2xl border border-border/70 bg-muted/30 px-4 py-4">
                        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Grade split
                        </p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div>
                                <p className="text-sm text-muted-foreground">
                                    Lecture average
                                </p>
                                <p className="text-xl font-semibold text-foreground">
                                    {formatGrade(lectureGradeAverage)}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">
                                    Tutorial average
                                </p>
                                <p className="text-xl font-semibold text-foreground">
                                    {formatGrade(tutorialGradeAverage)}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            <div className="space-y-6">
                <section className="rounded-[28px] border border-border/70 bg-background/96 p-6 shadow-[0_24px_60px_-42px_rgba(22,47,95,0.24)]">
                    <div className="mb-5 flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Attendance history
                            </p>
                            <h2 className="mt-2 font-display text-2xl text-foreground">
                                Session record
                            </h2>
                            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                                Review attendance status, grading impact, and whether
                                the record came from QR check-in or a manual adjustment.
                            </p>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-[22px] border border-border/70 bg-background">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Session</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Grade</TableHead>
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
                                    <TableCell>
                                        <Badge
                                            variant="outline"
                                            className={
                                                sessionCategoryCopy[
                                                    session.category
                                                ].badgeClass
                                            }
                                        >
                                            {
                                                sessionCategoryCopy[
                                                    session.category
                                                ].label
                                            }
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
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
                                                variant="outline"
                                                className="border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-50"
                                            >
                                                Absent
                                            </Badge>
                                        ) : record.status === "late" ? (
                                            <Badge className="border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                                                Late
                                            </Badge>
                                        ) : record.status === "excused" ? (
                                            <Badge className="border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-50">
                                                Excused
                                            </Badge>
                                        ) : (
                                            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                                                Present
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
                                                        ? "border-primary/25 bg-primary/5 text-primary"
                                                        : "border-border text-muted-foreground"
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
                                    <TableCell className="text-sm text-muted-foreground">
                                        {record?.note || "—"}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>

                </section>

                <section className="rounded-[28px] border border-border/70 bg-background/96 p-6 shadow-[0_24px_60px_-42px_rgba(22,47,95,0.24)]">
                    <div>
                        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Coursework standing
                        </p>
                        <h2 className="mt-2 font-display text-2xl text-foreground">
                            Assessment performance
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            Keep the weighted total visible while reviewing each
                            assessment score in context.
                        </p>
                    </div>

                    <div className="mt-5 rounded-[24px] border border-primary/12 bg-primary/5 px-5 py-5">
                        <div className="flex items-start gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                <BookOpenCheck className="h-4 w-4" />
                            </span>
                            <div>
                                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-primary/80">
                                    Weighted coursework total
                                </p>
                                <p className="mt-2 text-2xl font-semibold text-foreground">
                                    {formatCourseworkScore(
                                        weightedCoursework.totalWeightedScore,
                                    )}{" "}
                                    <span className="text-base font-medium text-muted-foreground">
                                        /{" "}
                                        {formatCourseworkScore(
                                            weightedCoursework.maxWeightedScore,
                                        )}
                                    </span>
                                </p>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Raw coursework {formatCourseworkScore(courseworkTotal)} /{" "}
                                    {formatCourseworkScore(courseworkMaxTotal)}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="mt-5 overflow-hidden rounded-[22px] border border-border/70 bg-background">
                        <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Coursework</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Track</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Score</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {courseworkGrades.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={5}
                                    className="py-10 text-center text-muted-foreground"
                                >
                                    No coursework grades yet.
                                </TableCell>
                            </TableRow>
                        ) : (
                            courseworkGrades.map((row, index) => (
                                <TableRow key={`${row.assessment?.id}-${index}`}>
                                    <TableCell className="font-medium">
                                        {row.assessment?.title}
                                    </TableCell>
                                    <TableCell>
                                        {row.assessment && (
                                            <Badge
                                                variant="outline"
                                                className={getCourseworkKindBadgeClass(
                                                    row.assessment
                                                        .assessment_kind,
                                                )}
                                            >
                                                {formatCourseworkKind(
                                                    row.assessment
                                                        .assessment_kind,
                                                )}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        {row.assessment?.category
                                            ? row.assessment.category ===
                                              "lecture"
                                                ? "Lecture"
                                                : "Tutorial"
                                            : "General"}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {row.assessment
                                            ? new Date(
                                                  row.assessment.assessment_date,
                                              ).toLocaleDateString("en-US")
                                            : "—"}
                                    </TableCell>
                                    <TableCell className="font-medium text-foreground">
                                        {formatCourseworkScore(row.score)}
                                        {row.assessment &&
                                            ` / ${formatCourseworkScore(row.assessment.max_score)}`}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                        </Table>
                    </div>
                </section>
            </div>
        </div>
    );
}

