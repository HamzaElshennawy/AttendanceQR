"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CourseworkAssessment } from "@/lib/coursework";
import { formatCourseworkScore, parseNumericScore } from "@/lib/coursework";
import { readSpreadsheetFile } from "@/lib/spreadsheet";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAppDialog } from "@/components/AppDialogProvider";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";

interface Student {
    id: string;
    name: string;
    university_id: string;
}

interface GradeRow {
    id: string;
    student_id: string;
    score: number;
}

interface Props {
    assessment: CourseworkAssessment | null;
    students: Student[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void | Promise<void>;
}

export function AssessmentGradesDialog({
    assessment,
    students,
    open,
    onOpenChange,
    onSaved,
}: Props) {
    const supabase = createClient();
    const { showAlert } = useAppDialog();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [gradeRows, setGradeRows] = useState<GradeRow[]>([]);
    const [draftScores, setDraftScores] = useState<Record<string, string>>({});
    const [spreadsheetHeaders, setSpreadsheetHeaders] = useState<string[]>([]);
    const [spreadsheetRows, setSpreadsheetRows] = useState<string[][]>([]);
    const [studentIdColumn, setStudentIdColumn] = useState("");
    const [scoreColumn, setScoreColumn] = useState("");

    useEffect(() => {
        if (!open || !assessment) {
            const timeout = window.setTimeout(() => {
                setGradeRows([]);
                setDraftScores({});
                setSpreadsheetHeaders([]);
                setSpreadsheetRows([]);
                setStudentIdColumn("");
                setScoreColumn("");
            }, 0);
            return () => window.clearTimeout(timeout);
        }

        const loadGrades = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from("coursework_grades")
                .select("id, student_id, score")
                .eq("assessment_id", assessment.id);

            if (!error) {
                const rows = (data || []) as GradeRow[];
                setGradeRows(rows);
                setDraftScores(
                    rows.reduce<Record<string, string>>((acc, row) => {
                        acc[row.student_id] = formatCourseworkScore(row.score);
                        return acc;
                    }, {}),
                );
            }

            setLoading(false);
        };

        const timeout = window.setTimeout(() => {
            void loadGrades();
        }, 0);
        return () => window.clearTimeout(timeout);
    }, [assessment, open, supabase]);

    const gradedCount = useMemo(
        () =>
            students.filter(
                (student) =>
                    parseNumericScore(draftScores[student.id] || "") !== null,
            ).length,
        [draftScores, students],
    );

    const matchedImportCount = useMemo(() => {
        if (!studentIdColumn || !scoreColumn) {
            return 0;
        }

        const studentIdIndex = spreadsheetHeaders.indexOf(studentIdColumn);
        const scoreIndex = spreadsheetHeaders.indexOf(scoreColumn);
        if (studentIdIndex === -1 || scoreIndex === -1) {
            return 0;
        }

        const studentIds = new Set(
            students.map((student) => student.university_id.trim()),
        );

        return spreadsheetRows.filter((row) => {
            const importedId = row[studentIdIndex]?.trim();
            const importedScore = parseNumericScore(row[scoreIndex]);
            return (
                Boolean(importedId) &&
                studentIds.has(importedId) &&
                importedScore !== null
            );
        }).length;
    }, [
        scoreColumn,
        spreadsheetHeaders,
        spreadsheetRows,
        studentIdColumn,
        students,
    ]);

    const importReady = Boolean(
        spreadsheetHeaders.length > 0 && studentIdColumn && scoreColumn,
    );

    const unmatchedImportCount = useMemo(() => {
        if (!studentIdColumn || !scoreColumn) {
            return 0;
        }

        const studentIdIndex = spreadsheetHeaders.indexOf(studentIdColumn);
        const scoreIndex = spreadsheetHeaders.indexOf(scoreColumn);
        if (studentIdIndex === -1 || scoreIndex === -1) {
            return 0;
        }

        const studentIds = new Set(
            students.map((student) => student.university_id.trim()),
        );

        return spreadsheetRows.filter((row) => {
            const importedId = row[studentIdIndex]?.trim();
            const importedScore = parseNumericScore(row[scoreIndex]);

            return (
                Boolean(importedId) &&
                importedScore !== null &&
                !studentIds.has(importedId)
            );
        }).length;
    }, [
        scoreColumn,
        spreadsheetHeaders,
        spreadsheetRows,
        studentIdColumn,
        students,
    ]);

    const enteredAverage = useMemo(() => {
        const scores = students
            .map((student) => parseNumericScore(draftScores[student.id] || ""))
            .filter((score): score is number => score !== null);

        if (scores.length === 0) {
            return null;
        }

        return scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }, [draftScores, students]);

    const remainingCount = Math.max(students.length - gradedCount, 0);

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

            const suggestedIdColumn =
                imported.headers.find((header) =>
                    /(id|code|الكود)/i.test(header),
                ) ||
                imported.headers[0] ||
                "";
            const suggestedScoreColumn =
                imported.headers.find(
                    (header) =>
                        header !== suggestedIdColumn &&
                        imported.rows.some(
                            (row) =>
                                parseNumericScore(
                                    row[imported.headers.indexOf(header)],
                                ) !== null,
                        ),
                ) || "";

            setStudentIdColumn(suggestedIdColumn);
            setScoreColumn(suggestedScoreColumn);
        } catch (error) {
            console.error(error);
            await showAlert({
                title: "Failed To Read Spreadsheet",
                description: "The uploaded file could not be read.",
                variant: "error",
            });
        }
    };

    const handleImportSheet = () => {
        if (!studentIdColumn || !scoreColumn) {
            return;
        }

        const studentIdIndex = spreadsheetHeaders.indexOf(studentIdColumn);
        const scoreIndex = spreadsheetHeaders.indexOf(scoreColumn);
        if (studentIdIndex === -1 || scoreIndex === -1) {
            return;
        }

        const studentMap = new Map(
            students.map((student) => [
                student.university_id.trim(),
                student.id,
            ]),
        );

        setDraftScores((current) => {
            const next = { ...current };

            for (const row of spreadsheetRows) {
                const importedId = row[studentIdIndex]?.trim();
                const importedScore = parseNumericScore(row[scoreIndex]);
                const studentId = studentMap.get(importedId);

                if (!studentId || importedScore === null) {
                    continue;
                }

                next[studentId] = formatCourseworkScore(importedScore);
            }

            return next;
        });
    };

    const handleSave = async () => {
        if (!assessment) {
            return;
        }

        setSaving(true);

        const existingByStudent = new Map(
            gradeRows.map((row) => [row.student_id, row]),
        );
        const upsertRows = students
            .map((student) => {
                const score = parseNumericScore(draftScores[student.id] || "");
                if (score === null) {
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
                    row,
                ): row is {
                    assessment_id: string;
                    student_id: string;
                    score: number;
                } => row !== null,
            );

        const deleteIds = students
            .map((student) => {
                const existing = existingByStudent.get(student.id);
                if (
                    existing &&
                    parseNumericScore(draftScores[student.id] || "") === null
                ) {
                    return existing.id;
                }

                return null;
            })
            .filter((id): id is string => Boolean(id));

        if (upsertRows.length > 0) {
            const { error } = await supabase
                .from("coursework_grades")
                .upsert(upsertRows, {
                    onConflict: "assessment_id,student_id",
                });

            if (error) {
                await showAlert({
                    title: "Failed To Save Grades",
                    description: error.message,
                    variant: "error",
                });
                setSaving(false);
                return;
            }
        }

        if (deleteIds.length > 0) {
            const { error } = await supabase
                .from("coursework_grades")
                .delete()
                .in("id", deleteIds);

            if (error) {
                await showAlert({
                    title: "Failed To Save Grades",
                    description: error.message,
                    variant: "error",
                });
                setSaving(false);
                return;
            }
        }

        setSaving(false);
        onOpenChange(false);
        await onSaved();
    };

    return (
        <Dialog
            open={open}
            onOpenChange={onOpenChange}
        >
            <DialogContent className="w-[96vw] max-h-[94vh] max-w-[min(1120px,96vw)] overflow-y-auto p-0">
                <div className="overflow-hidden rounded-[1.6rem]">
                    <div className="border-b border-border/60 bg-[linear-gradient(180deg,rgba(251,253,255,0.98),rgba(245,248,252,0.96))] px-6 py-5 sm:px-7">
                        <DialogHeader className="space-y-3 text-left">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="inline-flex rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary">
                                    Grade management
                                </span>
                                {assessment && (
                                    <span className="inline-flex rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                        Max {formatCourseworkScore(assessment.max_score)}
                                    </span>
                                )}
                            </div>
                            <DialogTitle className="text-[1.75rem] leading-tight text-foreground">
                                {assessment?.title || "Manage Grades"}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="mt-5 grid gap-4 md:grid-cols-3">
                            <div className="rounded-[22px] border border-border/70 bg-background/88 px-4 py-4">
                                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                    Students graded
                                </p>
                                <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                                    {gradedCount}
                                </p>
                                <p className="mt-2 text-sm text-soft">
                                    {students.length} students available in this assessment.
                                </p>
                            </div>
                            <div className="rounded-[22px] border border-border/70 bg-background/88 px-4 py-4">
                                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                    Average entered
                                </p>
                                <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                                    {enteredAverage !== null
                                        ? formatCourseworkScore(enteredAverage)
                                        : "—"}
                                </p>
                                <p className="mt-2 text-sm text-soft">
                                    Live average based on the current draft values.
                                </p>
                            </div>
                            <div className="rounded-[22px] border border-border/70 bg-background/88 px-4 py-4">
                                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                    Spreadsheet matches
                                </p>
                                <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                                    {matchedImportCount}
                                </p>
                                <p className="mt-2 text-sm text-soft">
                                    Rows ready to import from the uploaded sheet.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-6 px-6 py-6 sm:px-7 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.82fr)]">
                        <section className="space-y-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                                <div>
                                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                        Grade table
                                    </p>
                                    <h3 className="mt-2 text-xl font-semibold text-foreground">
                                        Enter or review scores
                                    </h3>
                                    <p className="mt-2 text-sm leading-6 text-soft">
                                        Keep the full student roster visible while entering scores manually or after importing them from a spreadsheet.
                                    </p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                        {gradedCount} entered
                                    </span>
                                    <span className="inline-flex rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                        {remainingCount} remaining
                                    </span>
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-[24px] border border-border/70 bg-background/96">
                                {loading ? (
                                    <div className="flex items-center justify-center py-14">
                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    </div>
                                ) : (
                                    <div className="max-h-[58vh] overflow-auto pb-4">
                                        <table className="w-full text-sm">
                                            <thead className="sticky top-0 z-10 bg-background/96 backdrop-blur">
                                                <tr className="border-b border-border/70">
                                                    <th className="px-4 py-3 text-left text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                                        Student
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                                        University ID
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                                                        Score
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {students.map((student) => (
                                                    <tr
                                                        key={student.id}
                                                        className="border-b border-border/60 last:border-b-0"
                                                    >
                                                        <td className="px-4 py-3.5 font-medium text-foreground">
                                                            {student.name}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-muted-foreground">
                                                            {student.university_id}
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <Input
                                                                value={draftScores[student.id] || ""}
                                                                onChange={(event) =>
                                                                    setDraftScores((current) => ({
                                                                        ...current,
                                                                        [student.id]: event.target.value,
                                                                    }))
                                                                }
                                                                placeholder="Leave blank if not graded"
                                                                inputMode="decimal"
                                                                className="max-w-[13rem]"
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </section>

                        <section className="space-y-4">
                            <div className="rounded-[24px] border border-border/70 bg-background/96 p-5">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                        <Upload className="h-4 w-4" />
                                    </span>
                                    <div>
                                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                            Spreadsheet import
                                        </p>
                                        <h3 className="mt-1 text-lg font-semibold text-foreground">
                                            Upload and map grades
                                        </h3>
                                    </div>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-soft">
                                    Upload a sheet, choose the student ID and score columns, then import the matched rows into the grading table.
                                </p>

                                <div className="mt-5 space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="assessmentSheet">Spreadsheet</Label>
                                        <Input
                                            id="assessmentSheet"
                                            type="file"
                                            accept=".xlsx,.csv"
                                            onChange={handleUploadFile}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Student ID column</Label>
                                        <Select
                                            value={studentIdColumn}
                                            onValueChange={setStudentIdColumn}
                                            disabled={spreadsheetHeaders.length === 0}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select column" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {spreadsheetHeaders.map((header, index) => (
                                                    <SelectItem
                                                        key={`${header}-${index}`}
                                                        value={header}
                                                    >
                                                        {header || `Column ${index + 1}`}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Score column</Label>
                                        <Select
                                            value={scoreColumn}
                                            onValueChange={setScoreColumn}
                                            disabled={spreadsheetHeaders.length === 0}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select column" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {spreadsheetHeaders.map((header, index) => (
                                                    <SelectItem
                                                        key={`${header}-${index}-score`}
                                                        value={header}
                                                    >
                                                        {header || `Column ${index + 1}`}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4">
                                        <p className="text-sm font-medium text-foreground">
                                            Import guidance
                                        </p>
                                        <p className="mt-2 text-sm leading-6 text-soft">
                                            Importing fills matching student rows in the grading table. You can still review or edit every score before saving.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-[24px] border border-border/70 bg-background/96 p-5">
                                <div className="flex items-center gap-3">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                                        <FileSpreadsheet className="h-4 w-4" />
                                    </span>
                                    <div>
                                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                            Import status
                                        </p>
                                        <h3 className="mt-1 text-lg font-semibold text-foreground">
                                            Sheet readiness
                                        </h3>
                                    </div>
                                </div>

                                {spreadsheetHeaders.length > 0 ? (
                                    <div className="mt-4 space-y-4">
                                        <div className="grid gap-3 sm:grid-cols-3">
                                            <div className="rounded-2xl border border-border/70 bg-transparent px-4 py-4">
                                                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                    Rows loaded
                                                </p>
                                                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                                                    {spreadsheetRows.length}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-border/70 bg-transparent px-4 py-4">
                                                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                    Ready to import
                                                </p>
                                                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                                                    {matchedImportCount}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-border/70 bg-transparent px-4 py-4">
                                                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                    Ignored rows
                                                </p>
                                                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                                                    {unmatchedImportCount}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="rounded-2xl border border-border/70 bg-transparent px-4 py-4">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="inline-flex rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                    ID: {studentIdColumn || "Not selected"}
                                                </span>
                                                <span className="inline-flex rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                                                    Score: {scoreColumn || "Not selected"}
                                                </span>
                                            </div>
                                            <p className="mt-3 text-sm leading-6 text-soft">
                                                {matchedImportCount > 0
                                                    ? `${matchedImportCount} matched rows contain a valid numeric score and can be placed directly into the grading table.`
                                                    : "Pick the right columns to prepare the matched rows for import."}
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="w-full justify-center"
                                            onClick={handleImportSheet}
                                            disabled={!importReady}
                                        >
                                            Import Into Table
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-transparent px-4 py-5 text-sm text-soft">
                                        Upload a spreadsheet to preview matched rows and import them into the grading table.
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>

                    <DialogFooter className="border-t border-border/60 px-6 py-5 sm:px-7">
                        <div className="flex w-full flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="text-sm text-soft">
                                {gradedCount > 0
                                    ? `${gradedCount} student${gradedCount === 1 ? "" : "s"} currently have a score ready to save.`
                                    : "No grades entered yet. Import or type scores before saving."}
                            </div>
                            <div className="flex items-center justify-end gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => onOpenChange(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving || loading}
                                >
                                    {saving && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    Save Grades
                                </Button>
                            </div>
                        </div>
                    </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
