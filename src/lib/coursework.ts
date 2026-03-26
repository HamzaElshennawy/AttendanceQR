export type SessionCategory = "lecture" | "tutorial";

export type CourseworkAssessmentKind =
    | "quiz"
    | "assignment"
    | "worksheet"
    | "midterm"
    | "final"
    | "practical"
    | "participation"
    | "other";

export interface CourseworkAssessmentSession {
    title: string | null;
    category: SessionCategory;
}

export interface CourseworkAssessment {
    id: string;
    group_id: string;
    session_id: string | null;
    title: string;
    assessment_kind: CourseworkAssessmentKind;
    max_score: number;
    category: SessionCategory | null;
    assessment_date: string;
    created_at: string;
    session?: CourseworkAssessmentSession | null;
}

export interface CourseworkGrade {
    id: string;
    assessment_id: string;
    student_id: string;
    score: number;
}

export interface CourseworkAssessmentStats {
    gradedCount: number;
    averageScore: number;
}

export const courseworkKindOptions: {
    value: CourseworkAssessmentKind;
    label: string;
}[] = [
    { value: "quiz", label: "Quiz" },
    { value: "assignment", label: "Assignment" },
    { value: "worksheet", label: "Worksheet" },
    { value: "midterm", label: "Midterm" },
    { value: "final", label: "Final Exam" },
    { value: "practical", label: "Practical" },
    { value: "participation", label: "Participation" },
    { value: "other", label: "Other" },
];

export function formatCourseworkKind(kind: CourseworkAssessmentKind) {
    return (
        courseworkKindOptions.find((option) => option.value === kind)?.label ??
        kind
    );
}

export function getCourseworkKindBadgeClass(kind: CourseworkAssessmentKind) {
    switch (kind) {
        case "quiz":
            return "border-blue-200 bg-blue-50 text-blue-700";
        case "assignment":
            return "border-violet-200 bg-violet-50 text-violet-700";
        case "worksheet":
            return "border-cyan-200 bg-cyan-50 text-cyan-700";
        case "midterm":
            return "border-amber-200 bg-amber-50 text-amber-700";
        case "final":
            return "border-rose-200 bg-rose-50 text-rose-700";
        case "practical":
            return "border-emerald-200 bg-emerald-50 text-emerald-700";
        case "participation":
            return "border-slate-200 bg-slate-50 text-slate-700";
        default:
            return "border-gray-200 bg-gray-50 text-gray-700";
    }
}

export function formatCourseworkScore(score: number | null | undefined) {
    if (score === null || score === undefined || Number.isNaN(score)) {
        return "0";
    }

    const rounded = Math.round(score * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

export function parseNumericScore(value: string | number | null | undefined) {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }

    if (!value) {
        return null;
    }

    const normalized = String(value).trim().replace(",", ".");
    if (!normalized) {
        return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

export function inferMaxScore(values: Array<string | number | null | undefined>) {
    const numericValues = values
        .map((value) => parseNumericScore(value))
        .filter((value): value is number => value !== null);

    if (!numericValues.length) {
        return 10;
    }

    return Math.max(...numericValues);
}
