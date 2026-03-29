"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
    calculateAttendanceSummaryByStudent,
    calculateStudentCourseworkBreakdown,
    courseworkBreakdownAggregationOptions,
    describeCourseworkBreakdownCategory,
    formatBreakdownAggregation,
    getCourseworkBreakdownCategoriesOrDefault,
    type CourseworkBreakdownAggregation,
    type CourseworkBreakdownCategory,
    type CourseworkBreakdownGradeRow,
} from "@/lib/coursework-breakdown";
import {
    courseworkKindOptions,
    formatCourseworkKind,
    formatCourseworkScore,
    type CourseworkAssessment,
    type CourseworkAssessmentKind,
    type SessionCategory,
} from "@/lib/coursework";
import {
    defaultGradingSettings,
    normalizeGradingSettings,
    type AttendanceStatus,
} from "@/lib/grading-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
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

function createDraftCategory(position: number): CourseworkBreakdownCategory {
    return {
        id: crypto.randomUUID(),
        name: `Category ${position + 1}`,
        weight: 0,
        included_kinds: [],
        include_attendance: false,
        aggregation: "weighted_sum",
        aggregation_limit: null,
        position,
    };
}

export function CourseworkBreakdownEditor({
    groupId,
    students,
    assessments,
    sessions,
}: {
    groupId: string;
    students: Student[];
    assessments: CourseworkAssessment[];
    sessions: SessionOption[];
}) {
    const supabase = createClient();
    const { showAlert } = useAppDialog();
    const [categories, setCategories] = useState<CourseworkBreakdownCategory[]>([]);
    const [persistedIds, setPersistedIds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(true);
    const [previewGrades, setPreviewGrades] = useState<CourseworkBreakdownGradeRow[]>([]);
    const [attendanceByStudent, setAttendanceByStudent] = useState<Map<string, number>>(
        new Map(),
    );
    const [attendanceMax, setAttendanceMax] = useState(0);
    const [statusMessage, setStatusMessage] = useState("");
    const [statusError, setStatusError] = useState("");

    const loadCategories = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("group_coursework_categories")
            .select(
                "id, group_id, name, weight, included_kinds, include_attendance, aggregation, aggregation_limit, position",
            )
            .eq("group_id", groupId)
            .order("position", { ascending: true });

        if (error) {
            setCategories(getCourseworkBreakdownCategoriesOrDefault(null));
            setPersistedIds([]);
            setStatusError(
                error.message.includes("group_coursework_categories")
                    ? "Coursework breakdown migration is not applied yet. Defaults are loaded locally until the table exists."
                    : error.message,
            );
            setLoading(false);
            return;
        }

        const normalized = getCourseworkBreakdownCategoriesOrDefault(data || []);
        setCategories(normalized);
        setPersistedIds((data || []).map((row) => row.id as string));
        setLoading(false);
    }, [groupId, supabase]);

    const loadPreviewData = useCallback(async () => {
        setPreviewLoading(true);

        const assessmentIds = assessments.map((assessment) => assessment.id);
        const gradePromise = assessmentIds.length
            ? supabase
                  .from("coursework_grades")
                  .select("assessment_id, student_id, score")
                  .in("assessment_id", assessmentIds)
            : Promise.resolve({ data: [], error: null });
        const gradingPromise = supabase
            .from("group_grading_settings")
            .select(
                "present_grade, late_grade, excused_grade, absent_grade, late_after_minutes",
            )
            .eq("group_id", groupId)
            .maybeSingle();
        const attendancePromise = sessions.length
            ? supabase
                  .from("attendance_records")
                  .select("session_id, university_id, status")
                  .in(
                      "session_id",
                      sessions.map((session) => session.id),
                  )
            : Promise.resolve({ data: [], error: null });

        const [gradeRes, gradingRes, attendanceRes] = await Promise.all([
            gradePromise,
            gradingPromise,
            attendancePromise,
        ]);

        setPreviewGrades(((gradeRes.data || []) as CourseworkBreakdownGradeRow[]) || []);

        const gradingSettings = normalizeGradingSettings(
            gradingRes.data || defaultGradingSettings,
        );
        const attendanceSummary = calculateAttendanceSummaryByStudent({
            students,
            sessions,
            attendanceRows: ((attendanceRes.data || []) as Array<{
                session_id: string;
                university_id: string;
                status: AttendanceStatus;
            }>) || [],
            gradingSettings,
        });

        setAttendanceByStudent(attendanceSummary.byStudentId);
        setAttendanceMax(attendanceSummary.maxTotal);
        setPreviewLoading(false);
    }, [assessments, groupId, sessions, students, supabase]);

    useEffect(() => {
        const handle = window.setTimeout(() => {
            void loadCategories();
        }, 0);

        return () => window.clearTimeout(handle);
    }, [loadCategories]);

    useEffect(() => {
        const handle = window.setTimeout(() => {
            void loadPreviewData();
        }, 0);

        return () => window.clearTimeout(handle);
    }, [loadPreviewData]);

    const totalWeight = useMemo(
        () => categories.reduce((sum, category) => sum + Number(category.weight || 0), 0),
        [categories],
    );

    const previewRows = useMemo(() => {
        if (students.length === 0) {
            return [];
        }

        return categories.map((category) => {
            const totals = students.reduce(
                (sum, student) => {
                    const result = calculateStudentCourseworkBreakdown({
                        categories: [category],
                        assessments,
                        grades: previewGrades,
                        studentId: student.id,
                        attendanceEarned: attendanceByStudent.get(student.id) ?? 0,
                        attendanceMax,
                    });
                    const contribution = result.categories[0];
                    return {
                        weighted: sum.weighted + (contribution?.weightedScore ?? 0),
                        normalized:
                            sum.normalized + (contribution?.normalizedScore ?? 0),
                    };
                },
                { weighted: 0, normalized: 0 },
            );

            return {
                id: category.id,
                name: category.name,
                weight: category.weight,
                included: describeCourseworkBreakdownCategory(category),
                aggregation: formatBreakdownAggregation(
                    category.aggregation,
                    category.aggregation_limit,
                ),
                averageWeighted:
                    students.length > 0 ? totals.weighted / students.length : 0,
                averageNormalized:
                    students.length > 0 ? totals.normalized / students.length : 0,
            };
        });
    }, [assessments, attendanceByStudent, attendanceMax, categories, previewGrades, students]);

    const averageWeightedTotal = useMemo(() => {
        if (students.length === 0 || categories.length === 0) {
            return 0;
        }

        return (
            students.reduce((sum, student) => {
                const result = calculateStudentCourseworkBreakdown({
                    categories,
                    assessments,
                    grades: previewGrades,
                    studentId: student.id,
                    attendanceEarned: attendanceByStudent.get(student.id) ?? 0,
                    attendanceMax,
                });
                return sum + result.totalWeightedScore;
            }, 0) / students.length
        );
    }, [assessments, attendanceByStudent, attendanceMax, categories, previewGrades, students]);

    const setCategoryField = <K extends keyof CourseworkBreakdownCategory>(
        id: string,
        field: K,
        value: CourseworkBreakdownCategory[K],
    ) => {
        setCategories((current) =>
            current.map((category) =>
                category.id === id ? { ...category, [field]: value } : category,
            ),
        );
        setStatusMessage("");
        setStatusError("");
    };

    const toggleKind = (id: string, kind: CourseworkAssessmentKind) => {
        setCategories((current) =>
            current.map((category) => {
                if (category.id !== id) {
                    return category;
                }

                const included_kinds = category.included_kinds.includes(kind)
                    ? category.included_kinds.filter((item) => item !== kind)
                    : [...category.included_kinds, kind];

                return { ...category, included_kinds };
            }),
        );
        setStatusMessage("");
        setStatusError("");
    };

    const addCategory = () => {
        setCategories((current) => [...current, createDraftCategory(current.length)]);
        setStatusMessage("");
        setStatusError("");
    };

    const removeCategory = (id: string) => {
        setCategories((current) =>
            current
                .filter((category) => category.id !== id)
                .map((category, index) => ({ ...category, position: index })),
        );
        setStatusMessage("");
        setStatusError("");
    };

    const handleSave = async () => {
        const normalizedRows = categories.map((category, index) => ({
            ...category,
            group_id: groupId,
            name: category.name.trim(),
            weight: Number(category.weight || 0),
            aggregation_limit:
                category.aggregation === "best_n" ||
                category.aggregation === "drop_lowest"
                    ? Math.max(1, Number(category.aggregation_limit || 1))
                    : null,
            position: index,
        }));

        if (normalizedRows.length === 0) {
            setStatusError("Add at least one category before saving.");
            return;
        }

        if (
            normalizedRows.some(
                (category) =>
                    !category.name ||
                    (!category.include_attendance && category.included_kinds.length === 0),
            )
        ) {
            setStatusError(
                "Each category needs a name and at least one included assessment type or attendance.",
            );
            return;
        }

        if (Math.abs(totalWeight - 100) > 0.01) {
            setStatusError("Category weights must add up to exactly 100.");
            return;
        }

        setSaving(true);
        setStatusError("");
        setStatusMessage("");

        const { error: upsertError } = await supabase
            .from("group_coursework_categories")
            .upsert(
                normalizedRows.map((category) => ({
                    ...category,
                    updated_at: new Date().toISOString(),
                })),
                { onConflict: "id" },
            );

        if (upsertError) {
            setSaving(false);
            setStatusError(upsertError.message);
            return;
        }

        const idsToDelete = persistedIds.filter(
            (id) => !normalizedRows.some((category) => category.id === id),
        );

        if (idsToDelete.length > 0) {
            const { error: deleteError } = await supabase
                .from("group_coursework_categories")
                .delete()
                .in("id", idsToDelete);

            if (deleteError) {
                setSaving(false);
                setStatusError(deleteError.message);
                return;
            }
        }

        setPersistedIds(normalizedRows.map((category) => category.id));
        setCategories(normalizedRows);
        setSaving(false);
        setStatusMessage("Coursework breakdown saved.");

        await showAlert({
            title: "Coursework Breakdown Saved",
            description:
                "Weighted categories were saved for this group and will be used in previews and exports.",
        });
    };

    return (
        <div className="rounded-lg border bg-white p-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h3 className="font-semibold text-gray-900">
                        Weighted Coursework Breakdown
                    </h3>
                    <p className="text-sm text-gray-500">
                        Choose how attendance, quizzes, midterms, finals, and grouped coursework categories contribute to the course total.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge
                        variant="outline"
                        className={
                            Math.abs(totalWeight - 100) <= 0.01
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-amber-200 bg-amber-50 text-amber-700"
                        }
                    >
                        Total Weight {formatCourseworkScore(totalWeight)} / 100
                    </Badge>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={addCategory}
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Category
                    </Button>
                    <Button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={saving || loading}
                    >
                        {saving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Save Breakdown
                    </Button>
                </div>
            </div>

            {statusError ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {statusError}
                </div>
            ) : null}
            {statusMessage ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    {statusMessage}
                </div>
            ) : null}

            {loading ? (
                <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                </div>
            ) : (
                <div className="space-y-4">
                    {categories.map((category, index) => (
                        <div
                            key={category.id}
                            className="rounded-lg border border-gray-200 p-4 space-y-4"
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <div className="text-sm font-medium text-gray-900">
                                        Category {index + 1}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        {describeCourseworkBreakdownCategory(category)}
                                    </div>
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => removeCategory(category.id)}
                                    disabled={categories.length === 1}
                                    className="text-gray-400 hover:text-red-600"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="grid gap-4 md:grid-cols-[1.4fr_0.8fr_0.9fr_0.8fr]">
                                <div className="space-y-2">
                                    <Label>Name</Label>
                                    <Input
                                        value={category.name}
                                        onChange={(event) =>
                                            setCategoryField(
                                                category.id,
                                                "name",
                                                event.target.value,
                                            )
                                        }
                                        placeholder="Coursework, Midterm, Final"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Weight</Label>
                                    <Input
                                        value={String(category.weight)}
                                        inputMode="decimal"
                                        onChange={(event) =>
                                            setCategoryField(
                                                category.id,
                                                "weight",
                                                Number(event.target.value || 0),
                                            )
                                        }
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Rule</Label>
                                    <Select
                                        value={category.aggregation}
                                        onValueChange={(value) =>
                                            setCategoryField(
                                                category.id,
                                                "aggregation",
                                                value as CourseworkBreakdownAggregation,
                                            )
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {courseworkBreakdownAggregationOptions.map((option) => (
                                                <SelectItem
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>
                                        {category.aggregation === "best_n"
                                            ? "Best N"
                                            : category.aggregation === "drop_lowest"
                                              ? "Drop Count"
                                              : "Rule Value"}
                                    </Label>
                                    <Input
                                        value={
                                            category.aggregation_limit == null
                                                ? ""
                                                : String(category.aggregation_limit)
                                        }
                                        inputMode="numeric"
                                        disabled={
                                            category.aggregation === "weighted_sum" ||
                                            category.aggregation === "average_ratio"
                                        }
                                        placeholder={
                                            category.aggregation === "best_n" ||
                                            category.aggregation === "drop_lowest"
                                                ? "1"
                                                : "Not needed"
                                        }
                                        onChange={(event) =>
                                            setCategoryField(
                                                category.id,
                                                "aggregation_limit",
                                                event.target.value
                                                    ? Number(event.target.value)
                                                    : null,
                                            )
                                        }
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Included Assessment Types</Label>
                                <div className="flex flex-wrap gap-2">
                                    {courseworkKindOptions.map((option) => {
                                        const selected = category.included_kinds.includes(
                                            option.value,
                                        );
                                        return (
                                            <Button
                                                key={option.value}
                                                type="button"
                                                size="sm"
                                                variant={selected ? "default" : "outline"}
                                                onClick={() =>
                                                    toggleKind(category.id, option.value)
                                                }
                                            >
                                                {formatCourseworkKind(option.value)}
                                            </Button>
                                        );
                                    })}
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant={
                                            category.include_attendance
                                                ? "default"
                                                : "outline"
                                        }
                                        onClick={() =>
                                            setCategoryField(
                                                category.id,
                                                "include_attendance",
                                                !category.include_attendance,
                                            )
                                        }
                                    >
                                        Attendance
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="rounded-lg border border-dashed bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h4 className="font-medium text-gray-900">Live Preview</h4>
                        <p className="text-sm text-gray-500">
                            Average weighted contribution across the current student list using saved grades and attendance data.
                        </p>
                    </div>
                    <Badge variant="outline">
                        Average Weighted Total {formatCourseworkScore(averageWeightedTotal)} / {formatCourseworkScore(totalWeight)}
                    </Badge>
                </div>

                <div className="mt-4 overflow-hidden rounded-lg border bg-white">
                    {previewLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        </div>
                    ) : previewRows.length === 0 ? (
                        <div className="py-8 text-center text-sm text-gray-500">
                            Add students and grades to see weighted contribution previews.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Category</TableHead>
                                    <TableHead>Includes</TableHead>
                                    <TableHead>Rule</TableHead>
                                    <TableHead>Weight</TableHead>
                                    <TableHead>Avg Ratio</TableHead>
                                    <TableHead>Avg Contribution</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {previewRows.map((row) => (
                                    <TableRow key={row.id}>
                                        <TableCell className="font-medium">
                                            {row.name}
                                        </TableCell>
                                        <TableCell className="text-sm text-gray-500">
                                            {row.included}
                                        </TableCell>
                                        <TableCell>{row.aggregation}</TableCell>
                                        <TableCell>
                                            {formatCourseworkScore(row.weight)}
                                        </TableCell>
                                        <TableCell>
                                            {formatCourseworkScore(
                                                row.averageNormalized * 100,
                                            )}%
                                        </TableCell>
                                        <TableCell>
                                            {formatCourseworkScore(row.averageWeighted)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </div>
        </div>
    );
}

