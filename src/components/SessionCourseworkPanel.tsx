"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    courseworkKindOptions,
    formatCourseworkKind,
    formatCourseworkScore,
    getCourseworkKindBadgeClass,
    inferMaxScore,
    parseNumericScore,
    type CourseworkAssessment,
    type CourseworkAssessmentKind,
    type CourseworkAssessmentStats,
    type SessionCategory,
} from "@/lib/coursework";
import { readSpreadsheetFile } from "@/lib/spreadsheet";
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useAppDialog } from "@/components/AppDialogProvider";

interface Student {
    id: string;
    name: string;
    university_id: string;
}

type AssessmentRow = Omit<CourseworkAssessment, "session">;

interface GradeSummaryRow {
    assessment_id: string;
    score: number;
}

interface UploadColumnConfig {
    sourceHeader: string;
    title: string;
    kind: CourseworkAssessmentKind;
    maxScore: string;
}

export function SessionCourseworkPanel({
    groupId,
    sessionId,
    sessionTitle,
    sessionCategory,
    students,
}: {
    groupId: string;
    sessionId: string;
    sessionTitle: string | null;
    sessionCategory: SessionCategory;
    students: Student[];
}) {
    const supabase = createClient();
    const { showAlert } = useAppDialog();
    const [assessments, setAssessments] = useState<CourseworkAssessment[]>([]);
    const [statsByAssessment, setStatsByAssessment] = useState<
        Record<string, CourseworkAssessmentStats>
    >({});
    const [loading, setLoading] = useState(true);
    const [manageOpen, setManageOpen] = useState(false);
    const [selectedAssessment, setSelectedAssessment] =
        useState<CourseworkAssessment | null>(null);

    const [uploadOpen, setUploadOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [spreadsheetHeaders, setSpreadsheetHeaders] = useState<string[]>([]);
    const [spreadsheetRows, setSpreadsheetRows] = useState<string[][]>([]);
    const [studentIdColumn, setStudentIdColumn] = useState("");
    const [columnConfigs, setColumnConfigs] = useState<UploadColumnConfig[]>([]);

    const loadAssessments = useCallback(async () => {
        setLoading(true);

        const { data, error } = await supabase
            .from("coursework_assessments")
            .select(
                "id, group_id, session_id, title, assessment_kind, max_score, category, assessment_date, created_at",
            )
            .eq("group_id", groupId)
            .eq("session_id", sessionId)
            .order("assessment_date", { ascending: false });

        if (error) {
            setAssessments([]);
            setStatsByAssessment({});
            setLoading(false);
            return;
        }

        const normalized = (data || []) as AssessmentRow[];
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
    }, [groupId, sessionId, supabase]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            void loadAssessments();
        }, 0);
        return () => window.clearTimeout(timeout);
    }, [loadAssessments]);

    const totalGradedEntries = useMemo(
        () =>
            Object.values(statsByAssessment).reduce(
                (sum, item) => sum + item.gradedCount,
                0,
            ),
        [statsByAssessment],
    );

    const handleUploadFile = async (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        try {
            const imported = await readSpreadsheetFile(file);
            setSpreadsheetHeaders(imported.headers);
            setSpreadsheetRows(imported.rows);

            const preferredIdHeader =
                imported.headers.find((header) =>
                    /(id|code|الكود)/i.test(header),
                ) || imported.headers[0] || "";
            setStudentIdColumn(preferredIdHeader);

            const suggestedColumns = imported.headers
                .filter((header) => header !== preferredIdHeader)
                .map((header, index) => {
                    const values = imported.rows.map(
                        (row) => row[imported.headers.indexOf(header)],
                    );
                    const numericCount = values.filter(
                        (value) => parseNumericScore(value) !== null,
                    ).length;

                    if (numericCount === 0) {
                        return null;
                    }

                    return {
                        sourceHeader: header,
                        title: header.trim() || `Assessment ${index + 1}`,
                        kind: "quiz" as CourseworkAssessmentKind,
                        maxScore: formatCourseworkScore(inferMaxScore(values)),
                    };
                })
                .filter((item): item is UploadColumnConfig => item !== null);

            setColumnConfigs(suggestedColumns);
        } catch (error) {
            console.error(error);
            await showAlert({
                title: "Failed To Read Spreadsheet",
                description: "The uploaded file could not be read.",
                variant: "error",
            });
        }
    };

    const resetUploadState = () => {
        setSpreadsheetHeaders([]);
        setSpreadsheetRows([]);
        setStudentIdColumn("");
        setColumnConfigs([]);
    };

    const handleImportSpreadsheet = async () => {
        if (!studentIdColumn || !columnConfigs.length) {
            return;
        }

        const studentIdIndex = spreadsheetHeaders.indexOf(studentIdColumn);
        if (studentIdIndex === -1) {
            return;
        }

        setUploading(true);

        const existingByTitle = new Map(
            assessments.map((assessment) => [
                assessment.title.trim().toLowerCase(),
                assessment,
            ]),
        );

        const createdOrMatched = new Map<string, CourseworkAssessment>();

        for (const config of columnConfigs) {
            const normalizedTitle = config.title.trim().toLowerCase();
            const existing = existingByTitle.get(normalizedTitle);

            if (existing) {
                createdOrMatched.set(config.sourceHeader, existing);
                continue;
            }

            const parsedMaxScore = Number(config.maxScore);
            const { data, error } = await supabase
                .from("coursework_assessments")
                .insert({
                    group_id: groupId,
                    session_id: sessionId,
                    title: config.title.trim(),
                    assessment_kind: config.kind,
                    max_score: Number.isFinite(parsedMaxScore)
                        ? parsedMaxScore
                        : 10,
                    category: sessionCategory,
                })
                .select(
                    "id, group_id, session_id, title, assessment_kind, max_score, category, assessment_date, created_at",
                )
                .single();

            if (error || !data) {
                await showAlert({
                    title: "Failed To Create Coursework Item",
                    description:
                        error?.message || "Failed to create coursework item.",
                    variant: "error",
                });
                setUploading(false);
                return;
            }

            const assessment = data as CourseworkAssessment;
            existingByTitle.set(normalizedTitle, assessment);
            createdOrMatched.set(config.sourceHeader, assessment);
        }

        const studentMap = new Map(
            students.map((student) => [student.university_id.trim(), student]),
        );

        const gradeRows = spreadsheetRows.flatMap((row) => {
            const studentIdentifier = row[studentIdIndex]?.trim();
            const student = studentMap.get(studentIdentifier);

            if (!student) {
                return [];
            }

            return columnConfigs
                .map((config) => {
                    const assessment = createdOrMatched.get(config.sourceHeader);
                    const scoreIndex = spreadsheetHeaders.indexOf(
                        config.sourceHeader,
                    );
                    const score = parseNumericScore(row[scoreIndex]);

                    if (!assessment || score === null) {
                        return null;
                    }

                    return {
                        assessment_id: assessment.id,
                        student_id: student.id,
                        score,
                    };
                })
                .filter(
                    (
                        item,
                    ): item is {
                        assessment_id: string;
                        student_id: string;
                        score: number;
                    } => item !== null,
                );
        });

        if (gradeRows.length > 0) {
            const { error } = await supabase
                .from("coursework_grades")
                .upsert(gradeRows, {
                    onConflict: "assessment_id,student_id",
                });

            if (error) {
                await showAlert({
                    title: "Failed To Import Grades",
                    description: error.message,
                    variant: "error",
                });
                setUploading(false);
                return;
            }
        }

        setUploading(false);
        setUploadOpen(false);
        resetUploadState();
        await loadAssessments();
    };

    return (
        <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[24px] border border-border/70 bg-card px-4 py-4 shadow-sm">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Session items</div>
                    <div className="mt-3 text-3xl font-semibold text-foreground">
                        {assessments.length}
                    </div>
                </div>
                <div className="rounded-[24px] border border-border/70 bg-card px-4 py-4 shadow-sm">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Graded entries</div>
                    <div className="mt-3 text-3xl font-semibold text-foreground">
                        {totalGradedEntries}
                    </div>
                </div>
                <div className="rounded-[24px] border border-border/70 bg-card px-4 py-4 shadow-sm">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Session track</div>
                    <div className="mt-3 text-3xl font-semibold text-foreground">
                        {sessionCategory === "lecture" ? "Lecture" : "Tutorial"}
                    </div>
                </div>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-[28px] border border-border/70 bg-card p-5 shadow-sm">
                <div>
                    <h3 className="font-semibold text-foreground">
                        Session grade upload
                    </h3>
                    <p className="text-sm leading-7 text-muted-foreground">
                        Upload Excel or CSV for {sessionTitle || "this session"}. Each selected numeric column becomes a separate coursework item linked to this session.
                    </p>
                </div>
                <Dialog
                    open={uploadOpen}
                    onOpenChange={(open) => {
                        setUploadOpen(open);
                        if (!open) {
                            resetUploadState();
                        }
                    }}
                >
                    <DialogTrigger asChild>
                        <Button>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Sheet
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl border-border/70 bg-background">
                        <DialogHeader>
                            <DialogTitle>Import Session Coursework</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="courseworkSheet">
                                    Excel or CSV file
                                </Label>
                                <Input
                                    id="courseworkSheet"
                                    type="file"
                                    accept=".xlsx,.csv"
                                    onChange={handleUploadFile}
                                />
                            </div>

                            {spreadsheetHeaders.length > 0 && (
                                <>
                                    <div className="space-y-2">
                                        <Label>Student ID column</Label>
                                        <Select
                                            value={studentIdColumn}
                                            onValueChange={setStudentIdColumn}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {spreadsheetHeaders.map((header) => (
                                                    <SelectItem
                                                        key={header}
                                                        value={header}
                                                    >
                                                        {header || "Untitled column"}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="rounded-[24px] border border-border/70 bg-card">
                                        <div className="border-b border-border/70 px-4 py-3 text-sm font-medium text-foreground">
                                            Imported columns
                                        </div>
                                        <div className="max-h-[40vh] overflow-auto rounded-b-[24px]">
                                            <table className="w-full text-sm">
                                                <thead className="sticky top-0 bg-background">
                                                    <tr className="border-b">
                                                        <th className="px-4 py-3 text-left">
                                                            Source Column
                                                        </th>
                                                        <th className="px-4 py-3 text-left">
                                                            Assessment Title
                                                        </th>
                                                        <th className="px-4 py-3 text-left">
                                                            Type
                                                        </th>
                                                        <th className="px-4 py-3 text-left">
                                                            Max Score
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {columnConfigs.map(
                                                        (config, index) => (
                                                            <tr
                                                                key={config.sourceHeader}
                                                                className="border-b last:border-b-0"
                                                            >
                                                                <td className="px-4 py-3 font-medium text-foreground">
                                                                    {config.sourceHeader}
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <Input
                                                                        value={
                                                                            config.title
                                                                        }
                                                                        onChange={(
                                                                            event,
                                                                        ) =>
                                                                            setColumnConfigs(
                                                                                (
                                                                                    current,
                                                                                ) =>
                                                                                    current.map(
                                                                                        (
                                                                                            item,
                                                                                            itemIndex,
                                                                                        ) =>
                                                                                            itemIndex ===
                                                                                            index
                                                                                                ? {
                                                                                                      ...item,
                                                                                                      title: event
                                                                                                          .target
                                                                                                          .value,
                                                                                                  }
                                                                                                : item,
                                                                                    ),
                                                                            )
                                                                        }
                                                                    />
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <Select
                                                                        value={
                                                                            config.kind
                                                                        }
                                                                        onValueChange={(
                                                                            value,
                                                                        ) =>
                                                                            setColumnConfigs(
                                                                                (
                                                                                    current,
                                                                                ) =>
                                                                                    current.map(
                                                                                        (
                                                                                            item,
                                                                                            itemIndex,
                                                                                        ) =>
                                                                                            itemIndex ===
                                                                                            index
                                                                                                ? {
                                                                                                      ...item,
                                                                                                      kind: value as CourseworkAssessmentKind,
                                                                                                  }
                                                                                                : item,
                                                                                    ),
                                                                            )
                                                                        }
                                                                    >
                                                                        <SelectTrigger>
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {courseworkKindOptions.map(
                                                                                (
                                                                                    option,
                                                                                ) => (
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
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <Input
                                                                        value={
                                                                            config.maxScore
                                                                        }
                                                                        onChange={(
                                                                            event,
                                                                        ) =>
                                                                            setColumnConfigs(
                                                                                (
                                                                                    current,
                                                                                ) =>
                                                                                    current.map(
                                                                                        (
                                                                                            item,
                                                                                            itemIndex,
                                                                                        ) =>
                                                                                            itemIndex ===
                                                                                            index
                                                                                                ? {
                                                                                                      ...item,
                                                                                                      maxScore: event
                                                                                                          .target
                                                                                                          .value,
                                                                                                  }
                                                                                                : item,
                                                                                    ),
                                                                            )
                                                                        }
                                                                        inputMode="decimal"
                                                                    />
                                                                </td>
                                                            </tr>
                                                        ),
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setUploadOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="button"
                                onClick={handleImportSpreadsheet}
                                disabled={
                                    uploading ||
                                    !studentIdColumn ||
                                    columnConfigs.length === 0
                                }
                            >
                                {uploading && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Import Grades
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="overflow-hidden rounded-[28px] border border-border/70 bg-card shadow-sm">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : assessments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                        <FileSpreadsheet className="h-10 w-10 text-muted-foreground/50" />
                        <div>
                            <p className="font-medium text-foreground">
                                No session coursework yet
                            </p>
                            <p className="text-sm text-muted-foreground">
                                Upload a grade sheet for this lecture or
                                tutorial, then manage the imported items here.
                            </p>
                        </div>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Assessment</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Max</TableHead>
                                <TableHead>Graded</TableHead>
                                <TableHead>Average</TableHead>
                                <TableHead className="w-32"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {assessments.map((assessment) => {
                                const stats = statsByAssessment[assessment.id] || {
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
                                                ).toLocaleDateString("en-US")}
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
                                        <TableCell className="font-medium">
                                            {formatCourseworkScore(
                                                assessment.max_score,
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {stats.gradedCount}/{students.length}
                                        </TableCell>
                                        <TableCell>
                                            {stats.gradedCount > 0
                                                ? formatCourseworkScore(
                                                      stats.averageScore,
                                                  )
                                                : "—"}
                                        </TableCell>
                                        <TableCell>
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
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </div>

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
