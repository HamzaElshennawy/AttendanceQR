"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    courseworkKindOptions,
    formatCourseworkKind,
    formatCourseworkScore,
    getCourseworkKindBadgeClass,
    type CourseworkAssessment,
    type CourseworkAssessmentKind,
    type CourseworkAssessmentStats,
    type SessionCategory,
} from "@/lib/coursework";
import {
    defaultGradingSettings,
    formatGrade,
    normalizeGradingSettings,
    type AttendanceStatus,
} from "@/lib/grading-settings";
import {
    calculateAttendanceSummaryByStudent,
    calculateStudentCourseworkBreakdown,
    getCourseworkBreakdownCategoriesOrDefault,
    type CourseworkBreakdownGradeRow,
} from "@/lib/coursework-breakdown";
import { AssessmentGradesDialog } from "@/components/coursework/AssessmentGradesDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Download, FileSpreadsheet, Loader2, Plus, Trash2 } from "lucide-react";
import { useAppDialog } from "@/components/AppDialogProvider";

interface Student {
    id: string;
    name: string;
    university_id: string;
}

interface SessionOption {
    id: string;
    title: string | null;
    category: SessionCategory;
    started_at: string;
}

interface AssessmentRow extends Omit<CourseworkAssessment, "session"> {
    session:
        | {
              title: string | null;
              category: SessionCategory;
          }
        | {
              title: string | null;
              category: SessionCategory;
          }[]
        | null;
}

interface GradeSummaryRow {
    assessment_id: string;
    score: number;
}

interface BillingSummary {
    features: {
        advanced_exports: boolean;
    };
    plan: {
        label: string;
    };
}

function normalizeAssessment(assessment: AssessmentRow): CourseworkAssessment {
    return {
        ...assessment,
        session: Array.isArray(assessment.session)
            ? (assessment.session[0] ?? null)
            : assessment.session,
    };
}

export function CourseworkGroupPanel({
    groupId,
    students,
    sessions,
}: {
    groupId: string;
    students: Student[];
    sessions: SessionOption[];
}) {
    const supabase = createClient();
    const { showAlert, showConfirm } = useAppDialog();
    const [assessments, setAssessments] = useState<CourseworkAssessment[]>([]);
    const [statsByAssessment, setStatsByAssessment] = useState<
        Record<string, CourseworkAssessmentStats>
    >({});
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [manageOpen, setManageOpen] = useState(false);
    const [downloadOpen, setDownloadOpen] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [selectedAssessment, setSelectedAssessment] =
        useState<CourseworkAssessment | null>(null);
    const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);

    const [title, setTitle] = useState("");
    const [kind, setKind] = useState<CourseworkAssessmentKind>("quiz");
    const [maxScore, setMaxScore] = useState("10");
    const [category, setCategory] = useState<SessionCategory | "none">("none");
    const [sessionId, setSessionId] = useState<string>("none");

    const loadAssessments = useCallback(async () => {
        setLoading(true);

        const { data, error } = await supabase
            .from("coursework_assessments")
            .select(
                "id, group_id, session_id, title, assessment_kind, max_score, category, assessment_date, created_at, session:sessions(title, category)",
            )
            .eq("group_id", groupId)
            .order("assessment_date", { ascending: false });

        if (error) {
            setAssessments([]);
            setStatsByAssessment({});
            setLoading(false);
            return;
        }

        const normalized = ((data || []) as AssessmentRow[]).map(
            normalizeAssessment,
        );
        setAssessments(normalized);

        if (!normalized.length) {
            setStatsByAssessment({});
            setLoading(false);
            return;
        }

        const { data: gradeRows } = await supabase
            .from("coursework_grades")
            .select("assessment_id, score")
            .in(
                "assessment_id",
                normalized.map((assessment) => assessment.id),
            );

        const grouped = ((gradeRows || []) as GradeSummaryRow[]).reduce<
            Record<string, CourseworkAssessmentStats>
        >((acc, row) => {
            const current = acc[row.assessment_id] || {
                gradedCount: 0,
                averageScore: 0,
            };

            const total =
                current.averageScore * current.gradedCount + row.score;
            current.gradedCount += 1;
            current.averageScore = total / current.gradedCount;
            acc[row.assessment_id] = current;
            return acc;
        }, {});

        setStatsByAssessment(grouped);
        setLoading(false);
    }, [groupId, supabase]);

    useEffect(() => {
        void loadAssessments();
    }, [loadAssessments]);

    useEffect(() => {
        const loadBilling = async () => {
            const response = await fetch("/api/billing/summary");
            if (!response.ok) {
                setBillingSummary(null);
                return;
            }

            setBillingSummary((await response.json()) as BillingSummary);
        };

        void loadBilling();
    }, []);

    const totalGradedEntries = useMemo(
        () =>
            Object.values(statsByAssessment).reduce(
                (sum, item) => sum + item.gradedCount,
                0,
            ),
        [statsByAssessment],
    );

    const handleCreateAssessment = async (event: React.FormEvent) => {
        event.preventDefault();
        setCreating(true);

        const parsedMaxScore = Number(maxScore);
        if (!title.trim() || !Number.isFinite(parsedMaxScore)) {
            setCreating(false);
            return;
        }

        const { error } = await supabase.from("coursework_assessments").insert({
            group_id: groupId,
            session_id: sessionId === "none" ? null : sessionId,
            title: title.trim(),
            assessment_kind: kind,
            max_score: parsedMaxScore,
            category: category === "none" ? null : category,
        });

        setCreating(false);

        if (error) {
            await showAlert({
                title: "Failed To Create Coursework Item",
                description: error.message,
                variant: "error",
            });
            return;
        }

        setTitle("");
        setKind("quiz");
        setMaxScore("10");
        setCategory("none");
        setSessionId("none");
        setCreateOpen(false);
        await loadAssessments();
    };

    const handleDeleteAssessment = async (
        assessment: CourseworkAssessment,
        event: React.MouseEvent,
    ) => {
        event.stopPropagation();
        const confirmed = await showConfirm({
            title: "Delete Assessment",
            description: `Delete "${assessment.title}" and all of its grades?`,
            confirmLabel: "Delete Assessment",
            variant: "error",
        });
        if (!confirmed) {
            return;
        }

        const { error } = await supabase
            .from("coursework_assessments")
            .delete()
            .eq("id", assessment.id);

        if (error) {
            await showAlert({
                title: "Failed To Delete Assessment",
                description: error.message,
                variant: "error",
            });
            return;
        }

        await loadAssessments();
    };

    const handleDownloadCourseworkExcel = async (
        includeAttendance: boolean,
    ) => {
        if (!billingSummary?.features.advanced_exports) {
            await showAlert({
                title: "Upgrade Required",
                description: `Coursework exports are available on Plus and Pro plans. Current plan: ${billingSummary?.plan.label || "Free"}.`,
                variant: "warning",
            });
            return;
        }

        if (!students.length || (!assessments.length && !includeAttendance)) {
            await showAlert({
                title: "Nothing To Export",
                description: includeAttendance
                    ? "Add students before exporting the coursework sheet."
                    : "Add coursework items and students before exporting the coursework sheet.",
                variant: "warning",
            });
            return;
        }

        setDownloading(true);

        const orderedAssessments = [...assessments].sort(
            (a, b) =>
                new Date(a.assessment_date).getTime() -
                new Date(b.assessment_date).getTime(),
        );

        let gradeRows: CourseworkBreakdownGradeRow[] = [];

        if (orderedAssessments.length) {
            const { data, error } = await supabase
                .from("coursework_grades")
                .select("assessment_id, student_id, score")
                .in(
                    "assessment_id",
                    orderedAssessments.map((assessment) => assessment.id),
                );

            if (error) {
                await showAlert({
                    title: "Failed To Export Coursework",
                    description: error.message,
                    variant: "error",
                });
                setDownloading(false);
                return;
            }

            gradeRows = (data || []) as CourseworkBreakdownGradeRow[];
        }

        const { data: breakdownRows } = await supabase
            .from("group_coursework_categories")
            .select(
                "id, group_id, name, weight, included_kinds, include_attendance, aggregation, aggregation_limit, position",
            )
            .eq("group_id", groupId)
            .order("position", { ascending: true });
        const breakdownCategories = getCourseworkBreakdownCategoriesOrDefault(
            breakdownRows || null,
        );

        let attendanceByStudentId = new Map<string, number>();
        let attendanceMaxTotal = 0;
        const needsAttendanceData =
            includeAttendance ||
            breakdownCategories.some((category) => category.include_attendance);

        if (needsAttendanceData) {
            const { data: gradingSettingsRow } = await supabase
                .from("group_grading_settings")
                .select(
                    "present_grade, late_grade, excused_grade, absent_grade, late_after_minutes",
                )
                .eq("group_id", groupId)
                .maybeSingle();

            const gradingSettings = normalizeGradingSettings(
                gradingSettingsRow || defaultGradingSettings,
            );
            const orderedSessions = [...sessions].sort(
                (a, b) =>
                    new Date(a.started_at).getTime() -
                    new Date(b.started_at).getTime(),
            );

            if (orderedSessions.length) {
                const { data: attendanceRows, error: attendanceError } =
                    await supabase
                        .from("attendance_records")
                        .select("session_id, university_id, status")
                        .in(
                            "session_id",
                            orderedSessions.map((session) => session.id),
                        );

                if (attendanceError) {
                    await showAlert({
                        title: "Failed To Export Coursework",
                        description:
                            "Attendance data could not be loaded for the export.",
                        variant: "error",
                    });
                    setDownloading(false);
                    return;
                }

                const attendanceSummary = calculateAttendanceSummaryByStudent({
                    students,
                    sessions: orderedSessions,
                    attendanceRows:
                        ((attendanceRows || []) as Array<{
                            session_id: string;
                            university_id: string;
                            status: AttendanceStatus;
                        }>) || [],
                    gradingSettings,
                });

                attendanceByStudentId = attendanceSummary.byStudentId;
                attendanceMaxTotal = attendanceSummary.maxTotal;
            }
        }

        const ExcelJS = (await import("exceljs")).default;
        const { saveAs } = (await import("file-saver")).default;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Coursework");

        worksheet.columns = [
            { header: "Name", key: "name", width: 32 },
            { header: "University ID", key: "university_id", width: 18 },
            ...orderedAssessments.map((assessment) => ({
                header: `${assessment.title}\n${formatCourseworkKind(
                    assessment.assessment_kind,
                )}\n${formatCourseworkScore(assessment.max_score)}`,
                key: assessment.id,
                width: 18,
            })),
            ...(includeAttendance
                ? [
                      {
                          header: `Attendance\nRaw\n${formatGrade(attendanceMaxTotal)}`,
                          key: "attendance_total",
                          width: 18,
                      },
                  ]
                : []),
            ...breakdownCategories.map((category) => ({
                header: `${category.name}\nWeighted\n${formatCourseworkScore(category.weight)}`,
                key: `breakdown_${category.id}`,
                width: 18,
            })),
            { header: "Raw Total", key: "total", width: 14 },
            { header: "Raw Max Total", key: "max_total", width: 16 },
            { header: "Raw Percentage", key: "percentage", width: 16 },
            { header: "Weighted Total", key: "weighted_total", width: 16 },
            { header: "Weighted Max", key: "weighted_max", width: 16 },
            {
                header: "Weighted Percentage",
                key: "weighted_percentage",
                width: 18,
            },
        ];

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = {
            vertical: "middle",
            horizontal: "center",
            wrapText: true,
        };
        worksheet.getRow(1).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFEFF6FF" },
        };

        const gradesByKey = new Map(
            gradeRows.map((row) => [
                `${row.student_id}:${row.assessment_id}`,
                row.score,
            ]),
        );
        const courseworkMaxTotal = orderedAssessments.reduce(
            (sum, assessment) => sum + Number(assessment.max_score),
            0,
        );
        const rawMaxTotal =
            courseworkMaxTotal + (includeAttendance ? attendanceMaxTotal : 0);

        students.forEach((student) => {
            const rowData: Record<string, string | number> = {
                name: student.name,
                university_id: student.university_id,
            };

            let total = 0;
            orderedAssessments.forEach((assessment) => {
                const score =
                    gradesByKey.get(`${student.id}:${assessment.id}`) ?? "";
                rowData[assessment.id] = score;
                if (typeof score === "number") {
                    total += score;
                }
            });

            if (includeAttendance) {
                const attendanceTotal =
                    attendanceByStudentId.get(student.id) ?? 0;
                rowData.attendance_total = formatGrade(attendanceTotal);
                total += attendanceTotal;
            }

            const breakdownResult = calculateStudentCourseworkBreakdown({
                categories: breakdownCategories,
                assessments: orderedAssessments,
                grades: gradeRows,
                studentId: student.id,
                attendanceEarned: attendanceByStudentId.get(student.id) ?? 0,
                attendanceMax: attendanceMaxTotal,
            });

            breakdownResult.categories.forEach((contribution) => {
                rowData[`breakdown_${contribution.categoryId}`] =
                    formatCourseworkScore(contribution.weightedScore);
            });

            rowData.total = total;
            rowData.max_total = rawMaxTotal;
            rowData.percentage =
                rawMaxTotal > 0
                    ? `${formatCourseworkScore((total / rawMaxTotal) * 100)}%`
                    : "0%";
            rowData.weighted_total = formatCourseworkScore(
                breakdownResult.totalWeightedScore,
            );
            rowData.weighted_max = formatCourseworkScore(
                breakdownResult.maxWeightedScore,
            );
            rowData.weighted_percentage =
                breakdownResult.maxWeightedScore > 0
                    ? `${formatCourseworkScore((breakdownResult.totalWeightedScore / breakdownResult.maxWeightedScore) * 100)}%`
                    : "0%";

            worksheet.addRow(rowData);
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        saveAs(
            blob,
            `coursework_${new Date().toISOString().split("T")[0]}.xlsx`,
        );
        setDownloading(false);
        setDownloadOpen(false);
    };

    return (
        <div className="space-y-6">
            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.9fr)]">
                <div className="overflow-hidden rounded-[28px] border border-border/70 bg-[linear-gradient(180deg,rgba(251,253,255,0.98),rgba(245,248,252,0.96))] shadow-[0_24px_60px_-42px_rgba(22,47,95,0.28)]">
                    <div className="border-b border-border/60 px-6 py-5 sm:px-7">
                        <Badge className="rounded-full border-primary/20 bg-primary/8 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary hover:bg-primary/8">
                            Coursework & grading
                        </Badge>
                        <h3 className="mt-4 font-display text-[2rem] leading-tight text-foreground">
                            Assessment operations
                        </h3>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-soft">
                            Create quizzes, assignments, midterms, and finals,
                            keep grading linked to the right track, and move
                            into the detailed breakdown when you need weighting
                            control.
                        </p>
                    </div>

                    <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 sm:px-7 xl:grid-cols-3">
                        <div className="min-h-[160px] rounded-[24px] border border-border/70 bg-background/90 px-5 py-5">
                            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Coursework items
                            </p>
                            <p className="mt-5 text-[1.9rem] font-semibold tracking-tight text-foreground">
                                {assessments.length}
                            </p>
                            <p className="mt-3 text-sm leading-6 text-soft">
                                Total graded components currently configured for
                                this group.
                            </p>
                        </div>
                        <div className="min-h-[160px] rounded-[24px] border border-border/70 bg-background/90 px-5 py-5">
                            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Graded entries
                            </p>
                            <p className="mt-5 text-[1.9rem] font-semibold tracking-tight text-foreground">
                                {totalGradedEntries}
                            </p>
                            <p className="mt-3 text-sm leading-6 text-soft">
                                Saved grade records across all coursework items.
                            </p>
                        </div>
                        <div className="min-h-[160px] rounded-[24px] border border-border/70 bg-background/90 px-5 py-5">
                            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Students in scope
                            </p>
                            <p className="mt-5 text-[1.9rem] font-semibold tracking-tight text-foreground">
                                {students.length}
                            </p>
                            <p className="mt-3 text-sm leading-6 text-soft">
                                Students available for grade entry and exports.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-[28px] border border-border/70 bg-background/96 p-6 shadow-[0_24px_60px_-42px_rgba(22,47,95,0.24)]">
                    <Badge
                        variant="warning"
                        className="rounded-full px-3 py-1 text-[0.68rem] tracking-[0.18em]"
                    >
                        Quick actions
                    </Badge>
                    <h3 className="mt-4 text-xl font-semibold text-foreground">
                        Keep grading moving
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-soft">
                        Create new assessments, export the current sheet, or
                        move into the grading breakdown view for weighting
                        rules.
                    </p>

                    <div className="mt-5 rounded-2xl border border-border/70 bg-transparent px-4 py-4">
                        <p className="text-sm font-medium text-foreground">
                            Best for
                        </p>
                        <p className="mt-2 text-sm leading-6 text-soft">
                            Running mixed coursework models where attendance,
                            quizzes, assignments, and exams need to stay clearly
                            separated.
                        </p>
                    </div>

                    <div className="mt-5 flex flex-col gap-3">
                        <Button
                            asChild
                            variant="outline"
                            className="w-full justify-start"
                        >
                            <Link
                                href={`/dashboard/groups/${groupId}/coursework/breakdown`}
                            >
                                Grading Breakdown
                            </Link>
                        </Button>
                        <Dialog
                            open={downloadOpen}
                            onOpenChange={setDownloadOpen}
                        >
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-full justify-start"
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    Download Coursework
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Export Coursework</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-3 py-4">
                                    <p className="text-sm text-soft">
                                        Do you want to include cumulative
                                        attendance grades in the exported
                                        coursework sheet?
                                    </p>
                                    <div className="rounded-2xl border border-border/70 bg-background/80 p-3 text-sm text-soft">
                                        If included, attendance will be added as
                                        a separate column and counted in the
                                        total, max total, and percentage.
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setDownloadOpen(false)}
                                        disabled={downloading}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                            void handleDownloadCourseworkExcel(
                                                false,
                                            )
                                        }
                                        disabled={downloading}
                                    >
                                        {downloading && (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        )}
                                        Without Attendance
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={() =>
                                            void handleDownloadCourseworkExcel(
                                                true,
                                            )
                                        }
                                        disabled={downloading}
                                    >
                                        {downloading && (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        )}
                                        Include Attendance
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <Dialog
                            open={createOpen}
                            onOpenChange={setCreateOpen}
                        >
                            <DialogTrigger asChild>
                                <Button className="w-full justify-start">
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Assessment
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <form onSubmit={handleCreateAssessment}>
                                    <DialogHeader>
                                        <DialogTitle>
                                            Create Coursework Item
                                        </DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="courseworkTitle">
                                                Title
                                            </Label>
                                            <Input
                                                id="courseworkTitle"
                                                value={title}
                                                onChange={(event) =>
                                                    setTitle(event.target.value)
                                                }
                                                placeholder="Quiz 1, Midterm, Final Exam"
                                                required
                                            />
                                        </div>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label>Type</Label>
                                                <Select
                                                    value={kind}
                                                    onValueChange={(value) =>
                                                        setKind(
                                                            value as CourseworkAssessmentKind,
                                                        )
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {courseworkKindOptions.map(
                                                            (option) => (
                                                                <SelectItem
                                                                    key={
                                                                        option.value
                                                                    }
                                                                    value={
                                                                        option.value
                                                                    }
                                                                >
                                                                    {
                                                                        option.label
                                                                    }
                                                                </SelectItem>
                                                            ),
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="maxScore">
                                                    Max Score
                                                </Label>
                                                <Input
                                                    id="maxScore"
                                                    value={maxScore}
                                                    onChange={(event) =>
                                                        setMaxScore(
                                                            event.target.value,
                                                        )
                                                    }
                                                    inputMode="decimal"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label>Track</Label>
                                                <Select
                                                    value={category}
                                                    onValueChange={(value) =>
                                                        setCategory(
                                                            value as
                                                                | SessionCategory
                                                                | "none",
                                                        )
                                                    }
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">
                                                            General
                                                        </SelectItem>
                                                        <SelectItem value="lecture">
                                                            Lecture
                                                        </SelectItem>
                                                        <SelectItem value="tutorial">
                                                            Tutorial
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Linked Session</Label>
                                                <Select
                                                    value={sessionId}
                                                    onValueChange={setSessionId}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">
                                                            Not linked to a
                                                            session
                                                        </SelectItem>
                                                        {sessions.map(
                                                            (session) => (
                                                                <SelectItem
                                                                    key={
                                                                        session.id
                                                                    }
                                                                    value={
                                                                        session.id
                                                                    }
                                                                >
                                                                    {(session.title ||
                                                                        "Untitled Session") +
                                                                        " · " +
                                                                        new Date(
                                                                            session.started_at,
                                                                        ).toLocaleDateString(
                                                                            "en-US",
                                                                        )}
                                                                </SelectItem>
                                                            ),
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setCreateOpen(false)}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={creating}
                                        >
                                            {creating && (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            )}
                                            Create
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </section>

            <section className="overflow-hidden rounded-[28px] border border-border/70 bg-background/96 shadow-[0_24px_60px_-42px_rgba(22,47,95,0.24)]">
                <div className="border-b border-border/60 px-6 py-5">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Assessment register
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-foreground">
                        Coursework list
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-soft">
                        Review grading coverage, max score, linked session
                        context, and move into management for each item.
                    </p>
                </div>

                <div className="overflow-hidden pb-0">
                    {loading ? (
                        <div className="flex items-center justify-center py-14">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : assessments.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
                            <div className="rounded-full bg-primary/8 p-4 text-primary">
                                <FileSpreadsheet className="h-8 w-8" />
                            </div>
                            <div>
                                <p className="font-medium text-foreground">
                                    No coursework yet
                                </p>
                                <p className="mt-2 text-sm text-soft">
                                    Create the first quiz, assignment, midterm,
                                    or final exam for this group.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Assessment</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Track</TableHead>
                                    <TableHead>Linked To</TableHead>
                                    <TableHead>Max</TableHead>
                                    <TableHead>Graded</TableHead>
                                    <TableHead>Average</TableHead>
                                    <TableHead className="w-48">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {assessments.map((assessment) => {
                                    const stats = statsByAssessment[
                                        assessment.id
                                    ] || {
                                        gradedCount: 0,
                                        averageScore: 0,
                                    };

                                    return (
                                        <TableRow key={assessment.id}>
                                            <TableCell>
                                                <div className="font-medium text-foreground">
                                                    {assessment.title}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {new Date(
                                                        assessment.assessment_date,
                                                    ).toLocaleDateString(
                                                        "en-US",
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={getCourseworkKindBadgeClass(
                                                        assessment.assessment_kind,
                                                    )}
                                                >
                                                    {formatCourseworkKind(
                                                        assessment.assessment_kind,
                                                    )}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {assessment.category ? (
                                                    <Badge variant="outline">
                                                        {assessment.category ===
                                                        "lecture"
                                                            ? "Lecture"
                                                            : "Tutorial"}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-sm text-soft">
                                                        General
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {assessment.session
                                                    ? assessment.session
                                                          .title ||
                                                      "Untitled Session"
                                                    : "Standalone"}
                                            </TableCell>
                                            <TableCell className="font-medium text-foreground">
                                                {formatCourseworkScore(
                                                    assessment.max_score,
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium text-foreground">
                                                {stats.gradedCount}/
                                                {students.length}
                                            </TableCell>
                                            <TableCell className="font-medium text-foreground">
                                                {stats.gradedCount > 0
                                                    ? formatCourseworkScore(
                                                          stats.averageScore,
                                                      )
                                                    : "—"}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSelectedAssessment(
                                                                assessment,
                                                            );
                                                            setManageOpen(true);
                                                        }}
                                                    >
                                                        Manage
                                                    </Button>
                                                    {assessment.assessment_kind ===
                                                        "quiz" ||
                                                    assessment.assessment_kind ===
                                                        "midterm" ||
                                                    assessment.assessment_kind ===
                                                        "final" ? (
                                                        <Button
                                                            asChild
                                                            variant="outline"
                                                            size="sm"
                                                        >
                                                            <Link
                                                                href={`/dashboard/groups/${groupId}/coursework/${assessment.id}/exam`}
                                                            >
                                                                Exam Setup
                                                            </Link>
                                                        </Button>
                                                    ) : null}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                                        onClick={(event) =>
                                                            handleDeleteAssessment(
                                                                assessment,
                                                                event,
                                                            )
                                                        }
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </section>

            <AssessmentGradesDialog
                assessment={selectedAssessment}
                students={students}
                open={manageOpen}
                onOpenChange={setManageOpen}
                onSaved={loadAssessments}
            />
        </div>
    );
}
