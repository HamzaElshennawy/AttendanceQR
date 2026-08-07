/**
 * Types and pure helpers for the group detail screen.
 *
 * Extracted from the page component, which is a single 4,000-line client file.
 * These pieces have no hooks and no state, so lifting them out is safe and
 * makes the import normalisation testable on its own — it is the part with
 * actual branching logic.
 */

import type { AttendanceStatus } from "@/lib/grading-settings";

export interface Group {
    id: string;
    name: string;
    professor_id: string;
}

export interface Student {
    id: string;
    university_id: string;
    name: string;
}

export interface TeamMember {
    professor_id: string;
    name: string;
    email: string;
    role: "owner" | "ta";
}

/** Only the fields this screen reads from /api/billing/summary. */
export interface GroupBillingSummary {
    features: {
        team_members: boolean;
    };
    plan: {
        label: string;
    };
}

export interface Session {
    id: string;
    title: string | null;
    category: "lecture" | "tutorial";
    duration_minutes: number;
    is_active: boolean;
    started_at: string;
    expires_at: string;
    attendance_count: number;
    latitude: number | null;
    longitude: number | null;
    radius_meters: number | null;
}

export interface WeeklySession {
    id: string;
    group_id: string;
    title: string;
    category: "lecture" | "tutorial";
    day_of_week: number;
    start_time: string;
    duration_minutes: number;
    qr_rotating: boolean;
    rotation_interval_seconds: number;
    require_location: boolean;
    radius_meters: number;
    is_enabled: boolean;
}

export interface GroupAttendanceRecord {
    session_id: string;
    student_id: string | null;
    university_id: string;
    status: AttendanceStatus;
}

export interface CsvColumnOption {
    value: string;
    label: string;
    index: number;
}

export interface AttendanceImportSessionDraft {
    id: string;
    title: string;
    category: "lecture" | "tutorial";
    sessionDate: string;
    column: string;
}

export type ImportedAttendanceStatus = "present" | "late" | "excused";

/**
 * Interprets whatever an instructor happened to type in a spreadsheet cell.
 *
 * Returns null for both "absent" and unrecognised values — absence is the
 * absence of a record, so neither creates one.
 */
export function normalizeImportedAttendanceStatus(
    value: string | undefined,
): ImportedAttendanceStatus | null {
    const normalized = value?.trim().toLowerCase();

    if (!normalized) {
        return null;
    }

    if (
        ["present", "p", "attended", "yes", "y", "1", "true"].includes(normalized)
    ) {
        return "present";
    }

    if (["late", "l"].includes(normalized)) {
        return "late";
    }

    if (["excused", "excuse", "e"].includes(normalized)) {
        return "excused";
    }

    return null;
}

export const sessionCategoryCopy = {
    lecture: {
        label: "Lecture",
        badgeClass: "border-sky-200 bg-sky-50 text-sky-700",
    },
    tutorial: {
        label: "Tutorial",
        badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
    },
} as const;

export const weekdayOptions = [
    { value: "0", label: "Sunday" },
    { value: "1", label: "Monday" },
    { value: "2", label: "Tuesday" },
    { value: "3", label: "Wednesday" },
    { value: "4", label: "Thursday" },
    { value: "5", label: "Friday" },
    { value: "6", label: "Saturday" },
] as const;

export function getWeekdayLabel(day: number) {
    return (
        weekdayOptions.find((option) => Number(option.value) === day)?.label ||
        "Weekly"
    );
}

export function formatTemplateTime(time: string) {
    const [hourValue, minuteValue] = time.split(":");
    const date = new Date();
    date.setHours(Number(hourValue || 0), Number(minuteValue || 0), 0, 0);

    return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
    });
}
