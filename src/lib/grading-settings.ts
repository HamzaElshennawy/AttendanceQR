export type AttendanceStatus = "present" | "late" | "excused";

export interface GradingSettings {
    present_grade: number;
    late_grade: number;
    excused_grade: number;
    absent_grade: number;
    late_after_minutes: number | null;
}

export const defaultGradingSettings: GradingSettings = {
    present_grade: 1,
    late_grade: 0.5,
    excused_grade: 0,
    absent_grade: 0,
    late_after_minutes: null,
};

export function normalizeGradingSettings(
    value?:
        | Partial<GradingSettings>
        | Record<string, unknown>
        | null,
): GradingSettings {
    const lateAfterValue = value?.late_after_minutes;

    return {
        present_grade: toNumber(value?.present_grade, defaultGradingSettings.present_grade),
        late_grade: toNumber(value?.late_grade, defaultGradingSettings.late_grade),
        excused_grade: toNumber(value?.excused_grade, defaultGradingSettings.excused_grade),
        absent_grade: toNumber(value?.absent_grade, defaultGradingSettings.absent_grade),
        late_after_minutes:
            lateAfterValue == null || lateAfterValue === ""
                ? null
                : Math.max(0, Math.round(Number(lateAfterValue))),
    };
}

export function getGradeValue(
    status: AttendanceStatus | null | undefined,
    settings: GradingSettings,
) {
    if (status === "present") return settings.present_grade;
    if (status === "late") return settings.late_grade;
    if (status === "excused") return settings.excused_grade;
    return settings.absent_grade;
}

export function formatGrade(value: number) {
    return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/, "");
}

export function getAverageGrade(total: number, count: number) {
    if (!count) return 0;
    return Number((total / count).toFixed(2));
}

export function shouldAutoMarkLate(
    startedAt: string,
    lateAfterMinutes: number | null,
    scannedAt = new Date(),
) {
    if (lateAfterMinutes == null) return false;

    const sessionStart = new Date(startedAt);
    const lateThreshold = sessionStart.getTime() + lateAfterMinutes * 60 * 1000;

    return scannedAt.getTime() >= lateThreshold;
}

function toNumber(value: unknown, fallback: number) {
    if (value == null || value === "") return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
