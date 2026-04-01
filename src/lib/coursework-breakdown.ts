import {
    formatCourseworkKind,
    type CourseworkAssessment,
    type CourseworkAssessmentKind,
} from "@/lib/coursework";
import {
    getGradeValue,
    type AttendanceStatus,
    type GradingSettings,
} from "@/lib/grading-settings";

export type CourseworkBreakdownAggregation =
    | "weighted_sum"
    | "average_ratio"
    | "best_n"
    | "drop_lowest";

export interface CourseworkBreakdownCategory {
    id: string;
    group_id?: string;
    name: string;
    weight: number;
    included_kinds: CourseworkAssessmentKind[];
    include_attendance: boolean;
    aggregation: CourseworkBreakdownAggregation;
    aggregation_limit: number | null;
    position: number;
}

export interface CourseworkBreakdownGradeRow {
    student_id: string;
    assessment_id: string;
    score: number;
}

export interface AttendanceSummaryByStudent {
    byStudentId: Map<string, number>;
    maxTotal: number;
}

interface ContributionItem {
    earned: number;
    max: number;
    ratio: number;
}

interface StudentCategoryContribution {
    categoryId: string;
    categoryName: string;
    weight: number;
    normalizedScore: number;
    weightedScore: number;
    includedCount: number;
}

export interface StudentCourseworkBreakdownResult {
    totalWeightedScore: number;
    maxWeightedScore: number;
    categories: StudentCategoryContribution[];
}

export const courseworkBreakdownAggregationOptions: Array<{
    value: CourseworkBreakdownAggregation;
    label: string;
}> = [
    { value: "weighted_sum", label: "Weighted Sum" },
    { value: "average_ratio", label: "Average Ratio" },
    { value: "best_n", label: "Best N" },
    { value: "drop_lowest", label: "Drop Lowest" },
];

const validKinds = new Set<CourseworkAssessmentKind>([
    "quiz",
    "assignment",
    "worksheet",
    "midterm",
    "final",
    "practical",
    "participation",
    "other",
]);

function createUuid() {
    if (typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
        const random = Math.floor(Math.random() * 16);
        const value = char === "x" ? random : (random & 0x3) | 0x8;
        return value.toString(16);
    });
}

function toFiniteNumber(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function clampRatio(value: number) {
    if (!Number.isFinite(value)) return 0;
    if (value < 0) return 0;
    if (value > 1) return 1;
    return value;
}

export function formatBreakdownAggregation(
    aggregation: CourseworkBreakdownAggregation,
    limit?: number | null,
) {
    if (aggregation === "best_n") {
        return limit && limit > 0 ? `Best ${limit}` : "Best N";
    }

    if (aggregation === "drop_lowest") {
        return limit && limit > 0
            ? `Drop Lowest ${limit}`
            : "Drop Lowest";
    }

    return (
        courseworkBreakdownAggregationOptions.find(
            (option) => option.value === aggregation,
        )?.label ?? aggregation
    );
}

export function getDefaultCourseworkBreakdownCategories() {
    return normalizeCourseworkBreakdownCategories([
        {
            id: createUuid(),
            name: "Attendance",
            weight: 10,
            included_kinds: [],
            include_attendance: true,
            aggregation: "weighted_sum",
            aggregation_limit: null,
            position: 0,
        },
        {
            id: createUuid(),
            name: "Quizzes",
            weight: 10,
            included_kinds: ["quiz"],
            include_attendance: false,
            aggregation: "average_ratio",
            aggregation_limit: null,
            position: 1,
        },
        {
            id: createUuid(),
            name: "Coursework",
            weight: 20,
            included_kinds: ["assignment", "worksheet", "participation", "other"],
            include_attendance: false,
            aggregation: "weighted_sum",
            aggregation_limit: null,
            position: 2,
        },
        {
            id: createUuid(),
            name: "Midterm",
            weight: 20,
            included_kinds: ["midterm"],
            include_attendance: false,
            aggregation: "weighted_sum",
            aggregation_limit: null,
            position: 3,
        },
        {
            id: createUuid(),
            name: "Practical",
            weight: 10,
            included_kinds: ["practical"],
            include_attendance: false,
            aggregation: "weighted_sum",
            aggregation_limit: null,
            position: 4,
        },
        {
            id: createUuid(),
            name: "Final",
            weight: 30,
            included_kinds: ["final"],
            include_attendance: false,
            aggregation: "weighted_sum",
            aggregation_limit: null,
            position: 5,
        },
    ]);
}

export function normalizeCourseworkBreakdownCategories(
    rows:
        | Array<Partial<CourseworkBreakdownCategory> | Record<string, unknown>>
        | null
        | undefined,
) {
    if (!rows || rows.length === 0) {
        return [] as CourseworkBreakdownCategory[];
    }

    return rows.map((row, index) => {
        const includedKinds = Array.isArray(row.included_kinds)
            ? row.included_kinds.filter(
                  (kind): kind is CourseworkAssessmentKind =>
                      typeof kind === "string" && validKinds.has(kind as CourseworkAssessmentKind),
              )
            : [];
        const aggregation =
            row.aggregation === "average_ratio" ||
            row.aggregation === "best_n" ||
            row.aggregation === "drop_lowest"
                ? row.aggregation
                : "weighted_sum";
        const limitValue = row.aggregation_limit;
        const limit =
            limitValue == null || limitValue === ""
                ? null
                : Math.max(1, Math.round(Number(limitValue)));

        return {
            id:
                typeof row.id === "string" && row.id.length > 0
                    ? row.id
                    : createUuid(),
            group_id:
                typeof row.group_id === "string" && row.group_id.length > 0
                    ? row.group_id
                    : undefined,
            name:
                typeof row.name === "string" && row.name.trim().length > 0
                    ? row.name.trim()
                    : `Category ${index + 1}`,
            weight: Math.max(0, toFiniteNumber(row.weight, 0)),
            included_kinds: includedKinds,
            include_attendance: Boolean(row.include_attendance),
            aggregation,
            aggregation_limit: limit,
            position: Math.max(0, Math.round(toFiniteNumber(row.position, index))),
        } satisfies CourseworkBreakdownCategory;
    });
}

export function getCourseworkBreakdownCategoriesOrDefault(
    rows:
        | Array<Partial<CourseworkBreakdownCategory> | Record<string, unknown>>
        | null
        | undefined,
) {
    const normalized = normalizeCourseworkBreakdownCategories(rows);
    return normalized.length > 0
        ? normalized.sort((a, b) => a.position - b.position)
        : getDefaultCourseworkBreakdownCategories();
}

export function describeCourseworkBreakdownCategory(
    category: CourseworkBreakdownCategory,
) {
    const kinds = category.included_kinds.map((kind) => formatCourseworkKind(kind));
    if (category.include_attendance) {
        kinds.push("Attendance");
    }

    return kinds.length > 0 ? kinds.join(", ") : "No items selected";
}

export function calculateAttendanceSummaryByStudent(args: {
    students: Array<{ id: string; university_id: string }>;
    sessions: Array<{ id: string }>;
    attendanceRows: Array<{
        session_id: string;
        university_id: string;
        status: AttendanceStatus;
    }>;
    gradingSettings: GradingSettings;
}) {
    const { students, sessions, attendanceRows, gradingSettings } = args;
    const statusBySessionStudent = new Map(
        attendanceRows.map((row) => [
            `${row.session_id}:${row.university_id}`,
            row.status,
        ]),
    );

    const byStudentId = new Map<string, number>();
    for (const student of students) {
        const earned = sessions.reduce(
            (sum, session) =>
                sum +
                getGradeValue(
                    statusBySessionStudent.get(
                        `${session.id}:${student.university_id}`,
                    ),
                    gradingSettings,
                ),
            0,
        );
        byStudentId.set(student.id, earned);
    }

    return {
        byStudentId,
        maxTotal: sessions.length * gradingSettings.present_grade,
    } satisfies AttendanceSummaryByStudent;
}

export function calculateStudentCourseworkBreakdown(args: {
    categories: CourseworkBreakdownCategory[];
    assessments: Array<
        Pick<CourseworkAssessment, "id" | "assessment_kind" | "max_score">
    >;
    grades: CourseworkBreakdownGradeRow[];
    studentId: string;
    attendanceEarned?: number;
    attendanceMax?: number;
}) {
    const {
        categories,
        assessments,
        grades,
        studentId,
        attendanceEarned = 0,
        attendanceMax = 0,
    } = args;

    const gradeMap = new Map(
        grades
            .filter((row) => row.student_id === studentId)
            .map((row) => [row.assessment_id, Number(row.score)]),
    );

    const contributions = categories.map((category) => {
        const items: ContributionItem[] = assessments
            .filter((assessment) =>
                category.included_kinds.includes(assessment.assessment_kind),
            )
            .map((assessment) => {
                const max = Math.max(0, Number(assessment.max_score));
                const earned = Math.max(0, gradeMap.get(assessment.id) ?? 0);
                return {
                    earned,
                    max,
                    ratio: max > 0 ? clampRatio(earned / max) : 0,
                } satisfies ContributionItem;
            })
            .filter((item) => item.max > 0);

        if (category.include_attendance && attendanceMax > 0) {
            items.push({
                earned: Math.max(0, attendanceEarned),
                max: Math.max(0, attendanceMax),
                ratio: clampRatio(attendanceEarned / attendanceMax),
            });
        }

        const normalizedScore = calculateNormalizedCategoryScore(category, items);
        return {
            categoryId: category.id,
            categoryName: category.name,
            weight: category.weight,
            normalizedScore,
            weightedScore: normalizedScore * category.weight,
            includedCount: items.length,
        } satisfies StudentCategoryContribution;
    });

    return {
        totalWeightedScore: contributions.reduce(
            (sum, contribution) => sum + contribution.weightedScore,
            0,
        ),
        maxWeightedScore: categories.reduce(
            (sum, category) => sum + category.weight,
            0,
        ),
        categories: contributions,
    } satisfies StudentCourseworkBreakdownResult;
}

function calculateNormalizedCategoryScore(
    category: CourseworkBreakdownCategory,
    items: ContributionItem[],
) {
    if (items.length === 0) {
        return 0;
    }

    if (category.aggregation === "weighted_sum") {
        const totals = items.reduce(
            (sum, item) => ({
                earned: sum.earned + item.earned,
                max: sum.max + item.max,
            }),
            { earned: 0, max: 0 },
        );
        return totals.max > 0 ? clampRatio(totals.earned / totals.max) : 0;
    }

    const ratios = items
        .map((item) => item.ratio)
        .filter((ratio) => Number.isFinite(ratio));
    if (ratios.length === 0) {
        return 0;
    }

    if (category.aggregation === "average_ratio") {
        return clampRatio(
            ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length,
        );
    }

    if (category.aggregation === "best_n") {
        const limit = Math.max(1, category.aggregation_limit ?? 1);
        const selected = [...ratios].sort((a, b) => b - a).slice(0, limit);
        return clampRatio(
            selected.reduce((sum, ratio) => sum + ratio, 0) / selected.length,
        );
    }

    const dropCount = Math.max(1, category.aggregation_limit ?? 1);
    const selected = [...ratios]
        .sort((a, b) => a - b)
        .slice(Math.min(dropCount, Math.max(0, ratios.length - 1)));

    return clampRatio(
        selected.reduce((sum, ratio) => sum + ratio, 0) / selected.length,
    );
}
