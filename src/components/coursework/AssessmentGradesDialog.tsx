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
import { Loader2, Upload } from "lucide-react";

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
            setGradeRows([]);
            setDraftScores({});
            setSpreadsheetHeaders([]);
            setSpreadsheetRows([]);
            setStudentIdColumn("");
            setScoreColumn("");
            return;
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

        void loadGrades();
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
    }, [scoreColumn, spreadsheetHeaders, spreadsheetRows, studentIdColumn, students]);

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
                ) || imported.headers[0] || "";
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
            students.map((student) => [student.university_id.trim(), student.id]),
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
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>
                        {assessment?.title || "Manage Grades"}
                    </DialogTitle>
                </DialogHeader>

                {assessment && (
                    <div className="rounded-lg border bg-gray-50 px-4 py-3 text-sm text-gray-600">
                        {gradedCount} of {students.length} students graded · Max{" "}
                        {formatCourseworkScore(assessment.max_score)}
                    </div>
                )}

                <div className="rounded-lg border bg-white p-4 space-y-4">
                    <div>
                        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                            <Upload className="h-4 w-4" />
                            Import Grades From Excel Or CSV
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                            Upload a file, choose the student ID column and the score column, then import into this assessment.
                        </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
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
                    </div>
                    {spreadsheetHeaders.length > 0 && (
                        <div className="flex items-center justify-between rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-600">
                            <span>
                                {spreadsheetRows.length} rows loaded · {matchedImportCount} matched students
                            </span>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={handleImportSheet}
                                disabled={!studentIdColumn || !scoreColumn}
                            >
                                Import Into Table
                            </Button>
                        </div>
                    )}
                </div>

                <div className="max-h-[60vh] overflow-auto rounded-lg border">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-white">
                                <tr className="border-b">
                                    <th className="px-4 py-3 text-left font-medium text-gray-600">
                                        Student
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-600">
                                        University ID
                                    </th>
                                    <th className="px-4 py-3 text-left font-medium text-gray-600">
                                        Score
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map((student) => (
                                    <tr
                                        key={student.id}
                                        className="border-b last:border-b-0"
                                    >
                                        <td className="px-4 py-3 font-medium text-gray-900">
                                            {student.name}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500">
                                            {student.university_id}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Input
                                                value={
                                                    draftScores[student.id] || ""
                                                }
                                                onChange={(event) =>
                                                    setDraftScores((current) => ({
                                                        ...current,
                                                        [student.id]:
                                                            event.target.value,
                                                    }))
                                                }
                                                placeholder="Leave blank if not graded"
                                                inputMode="decimal"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <DialogFooter>
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
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
