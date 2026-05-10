"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
    defaultGradingSettings,
    formatGrade,
    getGradeValue,
    normalizeGradingSettings,
    type AttendanceStatus,
    type GradingSettings,
} from "@/lib/grading-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
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
import {
    ArrowLeft,
    ChevronRight,
    Plus,
    Download,
    Upload,
    Trash2,
    Play,
    Clock,
    Users,
    Loader2,
    CheckCircle2,
    XCircle,
    Pencil,
    MapPin,
    RefreshCw,
    Mail,
    ShieldCheck,
    UserRoundCheck,
} from "lucide-react";
import { CourseworkGroupPanel } from "@/components/CourseworkGroupPanel";
import { readSpreadsheetFile } from "@/lib/spreadsheet";
import { useAppDialog } from "@/components/AppDialogProvider";
import { GroupOnboardingTutorial } from "@/components/GroupOnboardingTutorial";

interface Group {
    id: string;
    name: string;
    professor_id: string;
}

interface Student {
    id: string;
    university_id: string;
    name: string;
}

interface TeamMember {
    professor_id: string;
    name: string;
    email: string;
    role: "owner" | "ta";
}

interface BillingSummary {
    features: {
        team_members: boolean;
        advanced_exports: boolean;
    };
    plan: {
        label: string;
    };
}

interface Session {
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

interface CsvColumnOption {
    value: string;
    label: string;
    index: number;
}

interface AttendanceImportSessionDraft {
    id: string;
    title: string;
    category: "lecture" | "tutorial";
    sessionDate: string;
    column: string;
}

type ImportedAttendanceStatus = "present" | "late" | "excused";

function normalizeImportedAttendanceStatus(
    value: string | undefined,
): ImportedAttendanceStatus | null {
    const normalized = value?.trim().toLowerCase();

    if (!normalized) {
        return null;
    }

    if (
        ["present", "p", "attended", "yes", "y", "1", "true"].includes(
            normalized,
        )
    ) {
        return "present";
    }

    if (["late", "l"].includes(normalized)) {
        return "late";
    }

    if (["excused", "excuse", "e"].includes(normalized)) {
        return "excused";
    }

    if (["absent", "a", "0", "false", "no", "n"].includes(normalized)) {
        return null;
    }

    return null;
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

export default function GroupDetailPage() {
    const params = useParams();
    const router = useRouter();
    const groupId = params.groupId as string;
    const supabase = createClient();
    const { showAlert, showConfirm } = useAppDialog();

    const [group, setGroup] = useState<Group | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activeTab, setActiveTab] = useState<
        "sessions" | "coursework" | "students" | "team"
    >("sessions");
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState("");
    const [team, setTeam] = useState<TeamMember[]>([]);
    const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(null);
    const [gradingSettings, setGradingSettings] =
        useState<GradingSettings>(defaultGradingSettings);
    const [studentSearch, setStudentSearch] = useState("");

    // Rename group
    const [renameOpen, setRenameOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [renaming, setRenaming] = useState(false);

    // Add student dialog
    const [addStudentOpen, setAddStudentOpen] = useState(false);
    const [studentName, setStudentName] = useState("");
    const [studentId, setStudentId] = useState("");
    const [addingStudent, setAddingStudent] = useState(false);

    // Edit student dialog
    const [editStudentOpen, setEditStudentOpen] = useState(false);
    const [editStudent, setEditStudent] = useState<Student | null>(null);
    const [editStudentName, setEditStudentName] = useState("");
    const [editStudentId, setEditStudentId] = useState("");
    const [editingStudent, setEditingStudent] = useState(false);

    // Team management
    const [teamOpen, setTeamOpen] = useState(false);
    const [memberEmail, setMemberEmail] = useState("");
    const [memberRole, setMemberRole] = useState<"owner" | "ta">("ta");
    const [addingMember, setAddingMember] = useState(false);

    // CSV upload dialog
    const [csvOpen, setCsvOpen] = useState(false);
    const [csvData, setCsvData] = useState<string[][]>([]);
    const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
    const [nameColumn, setNameColumn] = useState("");
    const [idColumn, setIdColumn] = useState("");
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState<{
        success: number;
        skipped: number;
    } | null>(null);
    const [attendanceImportOpen, setAttendanceImportOpen] = useState(false);
    const [attendanceHeaders, setAttendanceHeaders] = useState<string[]>([]);
    const [attendanceRows, setAttendanceRows] = useState<string[][]>([]);
    const [attendanceIdColumn, setAttendanceIdColumn] = useState("");
    const [attendanceImportSessions, setAttendanceImportSessions] = useState<
        AttendanceImportSessionDraft[]
    >([]);
    const [attendanceImporting, setAttendanceImporting] = useState(false);

    const csvColumnOptions: CsvColumnOption[] = csvHeaders.map((header, index) => ({
        value: `column_${index}`,
        label: header || `Column ${index + 1}`,
        index,
    }));

    const getColumnIndex = (value: string) =>
        csvColumnOptions.find((option) => option.value === value)?.index ?? -1;
    const attendanceColumnOptions: CsvColumnOption[] = attendanceHeaders.map(
        (header, index) => ({
            value: `attendance_column_${index}`,
            label: header || `Column ${index + 1}`,
            index,
        }),
    );
    const getAttendanceColumnIndex = (value: string) =>
        attendanceColumnOptions.find((option) => option.value === value)
            ?.index ?? -1;
    const getAttendanceDefaultSessionColumn = (idColumnValue = attendanceIdColumn) =>
        attendanceColumnOptions.find((option) => option.value !== idColumnValue)
            ?.value ?? "";

    // Start session dialog
    const [sessionOpen, setSessionOpen] = useState(false);
    const [sessionTitle, setSessionTitle] = useState("");
    const [sessionDuration, setSessionDuration] = useState("15");
    const [startingSession, setStartingSession] = useState(false);
    const [enableLocation, setEnableLocation] = useState(false);
    const [sessionLat, setSessionLat] = useState<number | null>(null);
    const [sessionLng, setSessionLng] = useState<number | null>(null);
    const [sessionRadius, setSessionRadius] = useState("100");
    const [gettingLocation, setGettingLocation] = useState(false);
    const [qrRotating, setQrRotating] = useState(true);
    const [rotationInterval, setRotationInterval] = useState("15");
    const [exportOpen, setExportOpen] = useState(false);

    const fetchGroup = useCallback(async () => {
        const { data } = await supabase
            .from("groups")
            .select("*")
            .eq("id", groupId)
            .single();
        setGroup(data);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId]);

    const fetchCurrentUser = useCallback(async () => {
        const {
            data: { user },
        } = await supabase.auth.getUser();
        setCurrentUserId(user?.id || "");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchStudents = useCallback(async () => {
        const { data } = await supabase
            .from("students")
            .select("*")
            .eq("group_id", groupId)
            .order("name");
        setStudents(data || []);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId]);

    const fetchSessions = useCallback(async () => {
        const { data: sessionsData } = await supabase
            .from("sessions")
            .select("*")
            .eq("group_id", groupId)
            .order("started_at", { ascending: false });

        if (sessionsData) {
            const sessionsWithCounts = await Promise.all(
                sessionsData.map(async (session) => {
                    const { count } = await supabase
                        .from("attendance_records")
                        .select("*", { count: "exact", head: true })
                        .eq("session_id", session.id);

                    const isExpired = new Date(session.expires_at) < new Date();
                    if (session.is_active && isExpired) {
                        await supabase
                            .from("sessions")
                            .update({ is_active: false })
                            .eq("id", session.id);
                        session.is_active = false;
                    }

                    return { ...session, attendance_count: count || 0 };
                }),
            );
            setSessions(sessionsWithCounts);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId]);

    const fetchGradingSettings = useCallback(async () => {
        const { data } = await supabase
            .from("group_grading_settings")
            .select(
                "present_grade, late_grade, excused_grade, absent_grade, late_after_minutes",
            )
            .eq("group_id", groupId)
            .maybeSingle();

        setGradingSettings(normalizeGradingSettings(data));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId]);

    const fetchTeam = useCallback(async () => {
        const res = await fetch(`/api/groups/${groupId}/members`);
        if (!res.ok) {
            setTeam([]);
            return;
        }

        const data = await res.json();
        const members = (data.team || []) as TeamMember[];

        setTeam(
            members.sort((a, b) => {
                if (a.role === "owner" && b.role !== "owner") return -1;
                if (a.role !== "owner" && b.role === "owner") return 1;
                return a.name.localeCompare(b.name);
            }),
        );
    }, [groupId]);

    const fetchBillingSummary = useCallback(async () => {
        const res = await fetch("/api/billing/summary");
        if (!res.ok) {
            setBillingSummary(null);
            return;
        }

        const data = await res.json();
        setBillingSummary(data as BillingSummary);
    }, []);

    useEffect(() => {
        Promise.all([
            fetchCurrentUser(),
            fetchGroup(),
            fetchStudents(),
            fetchSessions(),
            fetchTeam(),
            fetchGradingSettings(),
            fetchBillingSummary(),
        ]).then(() => setLoading(false));
    }, [
        fetchBillingSummary,
        fetchCurrentUser,
        fetchGroup,
        fetchStudents,
        fetchSessions,
        fetchTeam,
        fetchGradingSettings,
    ]);

    // Rename group
    const handleRenameGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        setRenaming(true);
        const response = await fetch(`/api/groups/${groupId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newGroupName }),
        });
        if (!response.ok) {
            const data = await response.json();
            await showAlert({
                title: "Failed To Rename Group",
                description: data.error || "Failed to rename group.",
                variant: "error",
            });
            setRenaming(false);
            return;
        }
        setRenaming(false);
        setRenameOpen(false);
        fetchGroup();
    };

    // Add student
    const handleAddStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddingStudent(true);
        const response = await fetch(`/api/groups/${groupId}/students`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: studentName,
                university_id: studentId,
            }),
        });
        const data = await response.json();
        if (!response.ok) {
            if (data.code === "23505")
                await showAlert({
                    title: "Student Already Exists",
                    description:
                        "A student with this ID already exists in this group.",
                    variant: "warning",
                });
            else if (data.code === "PLAN_LIMIT_REACHED")
                await showAlert({
                    title: "Plan Limit Reached",
                    description: data.error,
                    variant: "warning",
                });
            else
                await showAlert({
                    title: "Failed To Add Student",
                    description: data.error || "Failed to add student.",
                    variant: "error",
                });
        } else {
            setStudentName("");
            setStudentId("");
            setAddStudentOpen(false);
            fetchStudents();
        }
        setAddingStudent(false);
    };

    const handleDeleteStudent = async (id: string) => {
        const confirmed = await showConfirm({
            title: "Remove Student",
            description: "This student will be removed from the group.",
            confirmLabel: "Remove Student",
        });
        if (!confirmed) return;
        const response = await fetch(`/api/groups/${groupId}/students/${id}`, {
            method: "DELETE",
        });
        if (!response.ok) {
            const data = await response.json();
            await showAlert({
                title: "Failed To Remove Student",
                description: data.error || "Failed to remove student.",
                variant: "error",
            });
            return;
        }
        fetchStudents();
    };

    const handleEditStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editStudent) return;
        setEditingStudent(true);
        const response = await fetch(
            `/api/groups/${groupId}/students/${editStudent.id}`,
            {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editStudentName,
                    university_id: editStudentId,
                }),
            },
        );
        if (!response.ok) {
            const data = await response.json();
            await showAlert({
                title: "Failed To Edit Student",
                description: data.error || "Failed to edit student.",
                variant: "error",
            });
            setEditingStudent(false);
            return;
        }
        setEditingStudent(false);
        setEditStudentOpen(false);
        fetchStudents();
    };

    const handleAddMember = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddingMember(true);

        try {
            const res = await fetch(`/api/groups/${groupId}/members`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email: memberEmail,
                    role: memberRole,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                await showAlert({
                    title: "Failed To Add Team Member",
                    description: data.error || "Failed to add team member.",
                    variant: "error",
                });
                return;
            }

            setMemberEmail("");
            setMemberRole("ta");
            setTeamOpen(false);
            fetchTeam();
        } finally {
            setAddingMember(false);
        }
    };

    const handleRemoveMember = async (professorId: string) => {
        const confirmed = await showConfirm({
            title: "Remove Member",
            description: "This member will lose access to the group.",
            confirmLabel: "Remove Member",
        });
        if (!confirmed) return;

        const res = await fetch(`/api/groups/${groupId}/members`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ professorId }),
        });

        const data = await res.json();
        if (!res.ok) {
            await showAlert({
                title: "Failed To Remove Member",
                description: data.error || "Failed to remove member.",
                variant: "error",
            });
            return;
        }

        fetchTeam();
    };

    // Delete session
    const handleDeleteSession = async (
        sessionId: string,
        e: React.MouseEvent,
    ) => {
        e.stopPropagation();
        const confirmed = await showConfirm({
            title: "Delete Session",
            description:
                "This will permanently delete the session and all of its attendance records.",
            confirmLabel: "Delete Session",
            variant: "error",
        });
        if (!confirmed) return;
        const response = await fetch(
            `/api/groups/${groupId}/sessions/${sessionId}`,
            {
                method: "DELETE",
            },
        );
        if (!response.ok) {
            const data = await response.json();
            await showAlert({
                title: "Failed To Delete Session",
                description: data.error || "Failed to delete session.",
                variant: "error",
            });
            return;
        }
        fetchSessions();
    };

    // CSV handling
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const data = await readSpreadsheetFile(file);
        if (data.headers.length > 0) {
            setCsvHeaders(data.headers);
            setCsvData(data.rows);
            setNameColumn("");
            setIdColumn("");
            setImportResult(null);
        }
    };

    const handleImportCsv = async () => {
        if (!nameColumn || !idColumn) return;
        setImporting(true);
        const nameIndex = getColumnIndex(nameColumn);
        const idIndex = getColumnIndex(idColumn);
        const studentsToInsert = csvData
            .filter((row) => row[nameIndex]?.trim() && row[idIndex]?.trim())
            .map((row) => ({
                name: row[nameIndex].trim(),
                university_id: row[idIndex].trim(),
            }));
        const response = await fetch(`/api/groups/${groupId}/students/import`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ students: studentsToInsert }),
        });
        const data = await response.json();
        if (!response.ok) {
            await showAlert({
                title:
                    data.code === "PLAN_LIMIT_REACHED"
                        ? "Plan Limit Reached"
                        : "Failed To Import Students",
                description: data.error || "Failed to import students.",
                variant:
                    data.code === "PLAN_LIMIT_REACHED" ? "warning" : "error",
            });
            setImporting(false);
            return;
        }
        setImportResult({ success: data.success || 0, skipped: data.skipped || 0 });
        setImporting(false);
        fetchStudents();
    };

    const handleCloseCsv = () => {
        setCsvOpen(false);
        setCsvData([]);
        setCsvHeaders([]);
        setNameColumn("");
        setIdColumn("");
        setImportResult(null);
    };

    const handleAttendanceFileUpload = async (
        e: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const data = await readSpreadsheetFile(file);
        if (data.headers.length > 0) {
            const idHeaderIndex = data.headers.findIndex((header) =>
                /(id|code|الكود)/i.test(header),
            );
            const nextIdColumn =
                idHeaderIndex >= 0 ? `attendance_column_${idHeaderIndex}` : "";
            const defaultSessionColumn =
                data.headers.findIndex((_, index) => index !== idHeaderIndex) >= 0
                    ? `attendance_column_${data.headers.findIndex((_, index) => index !== idHeaderIndex)}`
                    : "";

            setAttendanceHeaders(data.headers);
            setAttendanceRows(data.rows);
            setAttendanceIdColumn(nextIdColumn);
            setAttendanceImportSessions(
                defaultSessionColumn
                    ? [
                          {
                              id: crypto.randomUUID(),
                              title: "",
                              category: "lecture",
                              sessionDate: "",
                              column: defaultSessionColumn,
                          },
                      ]
                    : [],
            );
        }
    };

    const resetAttendanceImport = () => {
        setAttendanceImportOpen(false);
        setAttendanceHeaders([]);
        setAttendanceRows([]);
        setAttendanceIdColumn("");
        setAttendanceImportSessions([]);
        setAttendanceImporting(false);
    };

    const addAttendanceImportSession = () => {
        setAttendanceImportSessions((current) => [
            ...current,
            {
                id: crypto.randomUUID(),
                title: "",
                category: "lecture",
                sessionDate: "",
                column: getAttendanceDefaultSessionColumn(),
            },
        ]);
    };

    const updateAttendanceImportSession = (
        sessionId: string,
        updates: Partial<AttendanceImportSessionDraft>,
    ) => {
        setAttendanceImportSessions((current) =>
            current.map((session) =>
                session.id === sessionId ? { ...session, ...updates } : session,
            ),
        );
    };

    const removeAttendanceImportSession = (sessionId: string) => {
        setAttendanceImportSessions((current) =>
            current.filter((session) => session.id !== sessionId),
        );
    };

    const handleImportPastAttendance = async () => {
        if (!attendanceIdColumn || attendanceImportSessions.length === 0) {
            return;
        }

        const idIndex = getAttendanceColumnIndex(attendanceIdColumn);
        if (idIndex < 0) {
            return;
        }

        const studentByUniversityId = new Map(
            students.map((student) => [student.university_id.trim(), student]),
        );

        const payloadSessions = attendanceImportSessions
            .map((session) => {
                const columnIndex = getAttendanceColumnIndex(session.column);
                if (columnIndex < 0 || !session.sessionDate) {
                    return null;
                }

                const entries = attendanceRows
                    .map((row) => {
                        const universityId = row[idIndex]?.trim();
                        const student = universityId
                            ? studentByUniversityId.get(universityId)
                            : undefined;

                        if (!student) {
                            return null;
                        }

                        const status = normalizeImportedAttendanceStatus(
                            row[columnIndex],
                        );

                        if (!status) {
                            return null;
                        }

                        return {
                            studentId: student.id,
                            status,
                        };
                    })
                    .filter(
                        (
                            entry,
                        ): entry is {
                            studentId: string;
                            status: ImportedAttendanceStatus;
                        } => entry !== null,
                    );

                if (entries.length === 0) {
                    return null;
                }

                return {
                    title: session.title.trim(),
                    category: session.category,
                    sessionDate: session.sessionDate,
                    entries,
                };
            })
            .filter(
                (
                    session,
                ): session is {
                    title: string;
                    category: "lecture" | "tutorial";
                    sessionDate: string;
                    entries: {
                        studentId: string;
                        status: ImportedAttendanceStatus;
                    }[];
                } => session !== null,
            );

        if (payloadSessions.length === 0) {
            await showAlert({
                title: "No Valid Attendance Found",
                description:
                    "No valid session mappings with matching students and supported attendance values were found in the uploaded file.",
                variant: "warning",
            });
            return;
        }

        setAttendanceImporting(true);

        const response = await fetch(`/api/groups/${groupId}/attendance-import`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                sessions: payloadSessions,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            await showAlert({
                title: "Failed To Import Attendance",
                description: data.error || "Failed to import attendance.",
                variant: "error",
            });
            setAttendanceImporting(false);
            return;
        }

        await showAlert({
            title: "Attendance Imported",
            description: `${data.importedCount} attendance records were imported across ${data.sessionCount} historical sessions.`,
        });

        setAttendanceImporting(false);
        resetAttendanceImport();
        await fetchSessions();
    };

    // Location
    const handleGetLocation = () => {
        setGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setSessionLat(pos.coords.latitude);
                setSessionLng(pos.coords.longitude);
                setGettingLocation(false);
            },
            () => {
                void showAlert({
                    title: "Location Unavailable",
                    description:
                        "Could not get your location. Please enable location access.",
                    variant: "warning",
                });
                setGettingLocation(false);
            },
            { enableHighAccuracy: true },
        );
    };

    // Session handling
    const handleStartSession = async (e: React.FormEvent) => {
        e.preventDefault();
        setStartingSession(true);
        const durationMinutes = parseInt(sessionDuration);
        const expiresAt = new Date(
            Date.now() + durationMinutes * 60 * 1000,
        ).toISOString();

        const sessionData: Record<string, unknown> = {
            group_id: groupId,
            title: sessionTitle || null,
            category: currentRole === "ta" ? "tutorial" : "lecture",
            duration_minutes: durationMinutes,
            is_active: true,
            expires_at: expiresAt,
        };

        if (enableLocation && sessionLat && sessionLng) {
            sessionData.latitude = sessionLat;
            sessionData.longitude = sessionLng;
            sessionData.radius_meters = parseInt(sessionRadius);
        }

        sessionData.qr_rotating = qrRotating;
        sessionData.rotation_interval_seconds = parseInt(rotationInterval);

        const response = await fetch(`/api/groups/${groupId}/sessions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(sessionData),
        });
        const data = await response.json();

        if (response.ok && data.session) {
            router.push(`/dashboard/session/${data.session.id}/live`);
        } else if (!response.ok) {
            await showAlert({
                title:
                    data.code === "PLAN_LIMIT_REACHED"
                        ? "Plan Limit Reached"
                        : "Failed To Start Session",
                description: data.error || "Failed to start session.",
                variant:
                    data.code === "PLAN_LIMIT_REACHED" ? "warning" : "error",
            });
        }
        setStartingSession(false);
    };

    const handleDownloadCumulativeExcel = async () => {
        if (!students.length || !sessions.length) return;

        const orderedSessions = [...sessions].sort(
            (a, b) =>
                new Date(a.started_at).getTime() -
                new Date(b.started_at).getTime(),
        );

        const { data: attendanceRows, error } = await supabase
            .from("attendance_records")
            .select("session_id, university_id, status")
            .in(
                "session_id",
                orderedSessions.map((session) => session.id),
            );

        if (error) {
            await showAlert({
                title: "Failed To Export Attendance",
                description: "Failed to load cumulative attendance.",
                variant: "error",
            });
            return;
        }

        const attendanceByKey = new Map(
            (attendanceRows || []).map((row) => [
                `${row.session_id}:${row.university_id}`,
                row.status as "present" | "excused" | "late",
            ]),
        );

        const ExcelJS = (await import("exceljs")).default;
        const { saveAs } = (await import("file-saver")).default;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Cumulative Attendance");
        worksheet.columns = [
            { header: "Name", key: "name", width: 30 },
            { header: "University ID", key: "university_id", width: 18 },
            ...orderedSessions.map((session) => ({
                header: `${session.title || "Session"}\n${new Date(
                    session.started_at,
                ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                })}\n${sessionCategoryCopy[session.category].label}`,
                key: session.id,
                width: 16,
            })),
            { header: "Present Total", key: "present_total", width: 14 },
            { header: "Late Total", key: "late_total", width: 12 },
            { header: "Excused Total", key: "excused_total", width: 14 },
            { header: "Lecture Grade", key: "lecture_grade_total", width: 16 },
            {
                header: "Tutorial Grade",
                key: "tutorial_grade_total",
                width: 16,
            },
            { header: "Grade Total", key: "grade_total", width: 14 },
        ];

        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = {
            wrapText: true,
            vertical: "middle",
            horizontal: "center",
        };
        worksheet.getRow(1).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE5E7EB" },
        };

        for (const student of students) {
            let presentTotal = 0;
            let lateTotal = 0;
            let excusedTotal = 0;
            let gradeTotal = 0;
            let lectureGradeTotal = 0;
            let tutorialGradeTotal = 0;

            const sessionCells = orderedSessions.reduce<Record<string, string>>(
                (acc, session) => {
                    const status = attendanceByKey.get(
                        `${session.id}:${student.university_id}`,
                    ) as AttendanceStatus | undefined;
                    const gradeValue = getGradeValue(status, gradingSettings);

                    if (status === "present") {
                        presentTotal += 1;
                    } else if (status === "late") {
                        lateTotal += 1;
                    } else if (status === "excused") {
                        excusedTotal += 1;
                    }

                    gradeTotal += gradeValue;
                    if (session.category === "lecture") {
                        lectureGradeTotal += gradeValue;
                    } else {
                        tutorialGradeTotal += gradeValue;
                    }

                    acc[session.id] = formatGrade(gradeValue);

                    return acc;
                },
                {},
            );

            const row = worksheet.addRow({
                name: student.name,
                university_id: student.university_id,
                ...sessionCells,
                present_total: presentTotal,
                late_total: lateTotal,
                excused_total: excusedTotal,
                lecture_grade_total: formatGrade(lectureGradeTotal),
                tutorial_grade_total: formatGrade(tutorialGradeTotal),
                grade_total: formatGrade(gradeTotal),
            });

            row.getCell("present_total").fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFDCFCE7" },
            };
            row.getCell("late_total").fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFFEDD5" },
            };
            row.getCell("excused_total").fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFEF3C7" },
            };
            row.getCell("lecture_grade_total").fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFE0F2FE" },
            };
            row.getCell("tutorial_grade_total").fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFEF3C7" },
            };
            row.getCell("grade_total").fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFE5E7EB" },
            };

            orderedSessions.forEach((session) => {
                const sessionCell = row.getCell(session.id);
                const status = attendanceByKey.get(
                    `${session.id}:${student.university_id}`,
                ) as AttendanceStatus | undefined;

                sessionCell.alignment = { horizontal: "center" };

                if (status === "present") {
                    sessionCell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FFDCFCE7" },
                    };
                    return;
                }

                if (status === "late") {
                    sessionCell.note = {
                        texts: [
                            {
                                text: `Late attendance (${formatGrade(gradingSettings.late_grade)} grade)`,
                                font: { bold: true },
                            },
                        ],
                    };
                    sessionCell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FFFFEDD5" },
                    };
                    sessionCell.font = {
                        bold: true,
                        color: { argb: "FF9A3412" },
                    };
                    return;
                }

                if (status === "excused") {
                    sessionCell.note = {
                        texts: [
                            {
                                text: `Excused session (${formatGrade(gradingSettings.excused_grade)} grade)`,
                                font: { bold: true },
                            },
                        ],
                    };
                    sessionCell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: "FFFEF3C7" },
                    };
                    sessionCell.font = {
                        bold: true,
                        color: { argb: "FF92400E" },
                    };
                    return;
                }

                sessionCell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "FFFEE2E2" },
                };
                sessionCell.font = {
                    color: { argb: "FF991B1B" },
                };
                sessionCell.note = {
                    texts: [
                        {
                            text: `Absent (${formatGrade(gradingSettings.absent_grade)} grade)`,
                            font: { bold: true },
                        },
                    ],
                };
            });
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        saveAs(
            blob,
            `${group?.name || "group"}_cumulative_attendance_${
                new Date().toISOString().split("T")[0]
            }.xlsx`,
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!group) {
        return (
            <div className="text-center py-20 text-gray-500">
                Group not found
            </div>
        );
    }

    const currentRole =
        team.find((member) => member.professor_id === currentUserId)?.role ||
        (group.professor_id === currentUserId ? "owner" : "ta");
    const isOwner = currentRole === "owner";
    const filteredStudents = students.filter((student) => {
        const query = studentSearch.trim().toLowerCase();
        if (!query) return true;

        return (
            student.name.toLowerCase().includes(query) ||
            student.university_id.toLowerCase().includes(query)
        );
    });
    const liveSessions = sessions.filter((session) => session.is_active).length;

    return (
        <div className="space-y-6">
            <nav
                aria-label="Breadcrumb"
                className="flex flex-wrap items-center justify-between gap-3"
            >
                <div className="flex flex-wrap items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    <button
                        type="button"
                        onClick={() => router.push("/dashboard")}
                        className="transition-colors hover:text-primary"
                    >
                        Dashboard
                    </button>
                    <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                    <span className="text-foreground">{group.name}</span>
                </div>
                <GroupOnboardingTutorial
                    groupId={groupId}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                />
            </nav>

            <section className="space-y-5" data-onboarding="group-overview">
                <div className="flex items-start gap-3">
                    <Button
                        variant="outline"
                        size="icon"
                        className="mt-1 shrink-0"
                        onClick={() => router.push("/dashboard")}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex-1 space-y-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge
                                        variant={isOwner ? "success" : "warning"}
                                    >
                                        {isOwner ? "Owner" : "TA"}
                                    </Badge>
                                    {liveSessions > 0 && (
                                        <Badge variant="default">
                                            {liveSessions} live{" "}
                                            {liveSessions === 1
                                                ? "session"
                                                : "sessions"}
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h1 className="text-[2rem] leading-tight text-foreground">
                                        {group.name}
                                    </h1>
                                    {isOwner && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => {
                                                setNewGroupName(group.name);
                                                setRenameOpen(true);
                                            }}
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                                <p className="max-w-3xl text-sm text-soft">
                                    Central workspace for attendance sessions,
                                    student roster management, coursework, and
                                    team collaboration.
                                </p>
                            </div>
                            <div className="rounded-2xl border border-border/70 bg-background/85 px-4 py-3 text-sm text-soft">
                                {students.length} students · {sessions.length}{" "}
                                sessions · {team.length} team members
                            </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <Card className="py-0">
                                <CardContent className="p-5">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                                        Students
                                    </p>
                                    <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
                                        {students.length}
                                    </div>
                                    <p className="mt-2 text-sm text-soft">
                                        Enrolled and ready for attendance
                                        tracking.
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className="py-0">
                                <CardContent className="p-5">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                                        Sessions
                                    </p>
                                    <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
                                        {sessions.length}
                                    </div>
                                    <p className="mt-2 text-sm text-soft">
                                        Active and historical attendance sessions.
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className="py-0">
                                <CardContent className="p-5">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                                        Live now
                                    </p>
                                    <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
                                        {liveSessions}
                                    </div>
                                    <p className="mt-2 text-sm text-soft">
                                        Sessions currently open for student check-in.
                                    </p>
                                </CardContent>
                            </Card>
                            <Card className="py-0">
                                <CardContent className="p-5">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                                        Team access
                                    </p>
                                    <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">
                                        {team.length}
                                    </div>
                                    <p className="mt-2 text-sm text-soft">
                                        Owners and TAs supporting this group.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </section>

            {/* Rename Dialog */}
            <Dialog
                open={renameOpen}
                onOpenChange={setRenameOpen}
            >
                <DialogContent>
                    <form onSubmit={handleRenameGroup}>
                        <DialogHeader>
                            <DialogTitle>Rename Group</DialogTitle>
                        </DialogHeader>
                        <div className="py-4">
                            <Label htmlFor="newName">Group Name</Label>
                            <Input
                                id="newName"
                                value={newGroupName}
                                onChange={(e) =>
                                    setNewGroupName(e.target.value)
                                }
                                className="mt-2"
                                required
                            />
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setRenameOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={renaming}
                            >
                                {renaming && (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                Save
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Tabs
                value={activeTab}
                onValueChange={(value) =>
                    setActiveTab(
                        value as "sessions" | "coursework" | "students" | "team",
                    )
                }
                className="space-y-6"
            >
                <TabsList
                    data-onboarding="group-tabs"
                    className="w-full justify-start rounded-2xl border border-border/70 bg-background/80 p-1"
                >
                    <TabsTrigger value="sessions">
                        Sessions
                    </TabsTrigger>
                    <TabsTrigger value="coursework">
                        Coursework
                    </TabsTrigger>
                    <TabsTrigger value="students">
                        Students
                    </TabsTrigger>
                    <TabsTrigger value="team">
                        Team
                    </TabsTrigger>
                </TabsList>

                {/* Sessions Tab */}
                <TabsContent
                    value="sessions"
                    className="space-y-4"
                >
                    <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-transparent p-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                                Sessions
                            </h2>
                            <p className="text-sm text-soft">
                                Start live attendance, import historical records,
                                or review previous sessions.
                            </p>
                        </div>
                        <div
                            className="flex justify-end gap-2"
                            data-onboarding="sessions-actions"
                        >
                        <Dialog
                            open={attendanceImportOpen}
                            onOpenChange={(open) => {
                                if (!open) resetAttendanceImport();
                                else setAttendanceImportOpen(true);
                            }}
                        >
                            <DialogTrigger asChild>
                                <Button variant="outline">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Import Past Attendance
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>
                                        Import Historical Attendance
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="attendanceImportFile">
                                                Excel Or CSV File
                                            </Label>
                                            <Input
                                                id="attendanceImportFile"
                                                type="file"
                                                accept=".csv,.xlsx"
                                                onChange={
                                                    handleAttendanceFileUpload
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Student ID Column</Label>
                                            <Select
                                                value={attendanceIdColumn}
                                                onValueChange={
                                                    setAttendanceIdColumn
                                                }
                                                disabled={
                                                    attendanceHeaders.length === 0
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select column..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {attendanceColumnOptions.map(
                                                        (option) => (
                                                            <SelectItem
                                                                key={
                                                                    option.value
                                                                }
                                                                value={
                                                                    option.value
                                                                }
                                                            >
                                                                {option.label}
                                                            </SelectItem>
                                                        ),
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {attendanceHeaders.length > 0 && (
                                        <>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <Label className="block">
                                                        Session List
                                                    </Label>
                                                    <p className="text-sm text-gray-500">
                                                        Add one item for each
                                                        attendance column in the
                                                        uploaded file.
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    onClick={
                                                        addAttendanceImportSession
                                                    }
                                                    disabled={
                                                        !attendanceIdColumn ||
                                                        attendanceColumnOptions.filter(
                                                            (option) =>
                                                                option.value !==
                                                                attendanceIdColumn,
                                                        ).length === 0
                                                    }
                                                >
                                                    <Plus className="mr-2 h-4 w-4" />
                                                    Add Session
                                                </Button>
                                            </div>

                                            <div className="space-y-3">
                                                {attendanceImportSessions.map(
                                                    (session, index) => (
                                                        <div
                                                            key={session.id}
                                                            className="space-y-4 rounded-lg border p-4"
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <h4 className="font-medium">
                                                                    Session{' '}
                                                                    {index + 1}
                                                                </h4>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() =>
                                                                        removeAttendanceImportSession(
                                                                            session.id,
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        attendanceImportSessions.length <=
                                                                        1
                                                                    }
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                            <div className="grid gap-4 md:grid-cols-2">
                                                                <div className="space-y-2">
                                                                    <Label>
                                                                        Session
                                                                        Name
                                                                    </Label>
                                                                    <Input
                                                                        value={
                                                                            session.title
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            updateAttendanceImportSession(
                                                                                session.id,
                                                                                {
                                                                                    title: e
                                                                                        .target
                                                                                        .value,
                                                                                },
                                                                            )
                                                                        }
                                                                        placeholder="Lecture 3 or Section 2"
                                                                    />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <Label>
                                                                        Session
                                                                        Date
                                                                    </Label>
                                                                    <Input
                                                                        type="datetime-local"
                                                                        value={
                                                                            session.sessionDate
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            updateAttendanceImportSession(
                                                                                session.id,
                                                                                {
                                                                                    sessionDate:
                                                                                        e
                                                                                            .target
                                                                                            .value,
                                                                                },
                                                                            )
                                                                        }
                                                                    />
                                                                </div>
                                                            </div>
                                                            <div className="grid gap-4 md:grid-cols-2">
                                                                <div className="space-y-2">
                                                                    <Label>
                                                                        Session
                                                                        Column
                                                                    </Label>
                                                                    <Select
                                                                        value={
                                                                            session.column
                                                                        }
                                                                        onValueChange={(
                                                                            value,
                                                                        ) =>
                                                                            updateAttendanceImportSession(
                                                                                session.id,
                                                                                {
                                                                                    column: value,
                                                                                },
                                                                            )
                                                                        }
                                                                    >
                                                                        <SelectTrigger>
                                                                            <SelectValue placeholder="Select column..." />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {attendanceColumnOptions
                                                                                .filter(
                                                                                    (
                                                                                        option,
                                                                                    ) =>
                                                                                        option.value !==
                                                                                        attendanceIdColumn,
                                                                                )
                                                                                .map(
                                                                                    (
                                                                                        option,
                                                                                    ) => (
                                                                                        <SelectItem
                                                                                            key={`${session.id}-${option.value}`}
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
                                                                    <Label>
                                                                        Session
                                                                        Type
                                                                    </Label>
                                                                    <Select
                                                                        value={
                                                                            session.category
                                                                        }
                                                                        onValueChange={(
                                                                            value,
                                                                        ) =>
                                                                            updateAttendanceImportSession(
                                                                                session.id,
                                                                                {
                                                                                    category:
                                                                                        value as
                                                                                            | 'lecture'
                                                                                            | 'tutorial',
                                                                                },
                                                                            )
                                                                        }
                                                                    >
                                                                        <SelectTrigger>
                                                                            <SelectValue />
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            <SelectItem value="lecture">
                                                                                Lecture
                                                                            </SelectItem>
                                                                            <SelectItem value="tutorial">
                                                                                Tutorial
                                                                            </SelectItem>
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ),
                                                )}
                                            </div>

                                            <div>
                                                <Label className="mb-2 block">
                                                    Preview (first 5 rows)
                                                </Label>
                                                <div className="border rounded-lg overflow-hidden">
                                                    <Table>
                                                        <TableHeader>
                                                            <TableRow>
                                                                <TableHead>
                                                                    Student ID
                                                                </TableHead>
                                                                {attendanceImportSessions.map(
                                                                    (
                                                                        session,
                                                                        index,
                                                                    ) => (
                                                                        <TableHead
                                                                            key={
                                                                                session.id
                                                                            }
                                                                        >
                                                                            {session.title.trim() ||
                                                                                `Session ${index + 1}`}
                                                                        </TableHead>
                                                                    ),
                                                                )}
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {attendanceRows
                                                                .slice(0, 5)
                                                                .map(
                                                                    (
                                                                        row,
                                                                        index,
                                                                    ) => (
                                                                        <TableRow
                                                                            key={
                                                                                index
                                                                            }
                                                                        >
                                                                            <TableCell>
                                                                                {attendanceIdColumn
                                                                                    ? row[
                                                                                          getAttendanceColumnIndex(
                                                                                              attendanceIdColumn,
                                                                                          )
                                                                                      ]
                                                                                    : '—'}
                                                                            </TableCell>
                                                                            {attendanceImportSessions.map(
                                                                                (
                                                                                    session,
                                                                                ) => (
                                                                                    <TableCell
                                                                                        key={`${session.id}-${index}`}
                                                                                    >
                                                                                        {session.column
                                                                                            ? row[
                                                                                                  getAttendanceColumnIndex(
                                                                                                      session.column,
                                                                                                  )
                                                                                              ] ||
                                                                                              '—'
                                                                                            : '—'}
                                                                                    </TableCell>
                                                                                ),
                                                                            )}
                                                                        </TableRow>
                                                                    ),
                                                                )}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                                <p className="mt-2 text-sm text-gray-500">
                                                    Each selected session column
                                                    should contain values such as
                                                    present, late, excused, 1,
                                                    yes, or true. Unknown
                                                    students and unsupported
                                                    values will be skipped.
                                                </p>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={resetAttendanceImport}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={handleImportPastAttendance}
                                        disabled={
                                            attendanceImporting ||
                                            !attendanceIdColumn ||
                                            attendanceImportSessions.length ===
                                                0 ||
                                            attendanceRows.length === 0
                                        }
                                    >
                                        {attendanceImporting && (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        )}
                                        Import Attendance
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <Dialog
                            open={exportOpen}
                            onOpenChange={setExportOpen}
                        >
                            <DialogTrigger asChild>
                                <Button
                                    variant="outline"
                                    disabled={
                                        !students.length || !sessions.length
                                    }
                                >
                                    <Download className="mr-2 h-4 w-4" />
                                    Download Cumulative Attendance
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>
                                        Export Attendance Grades
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                                        <p className="font-medium text-gray-900">
                                            Current grading policy
                                        </p>
                                        <div className="mt-3 grid grid-cols-2 gap-3">
                                            <div>
                                                Present:{" "}
                                                {formatGrade(
                                                    gradingSettings.present_grade,
                                                )}
                                            </div>
                                            <div>
                                                Late:{" "}
                                                {formatGrade(
                                                    gradingSettings.late_grade,
                                                )}
                                            </div>
                                            <div>
                                                Excused:{" "}
                                                {formatGrade(
                                                    gradingSettings.excused_grade,
                                                )}
                                            </div>
                                            <div>
                                                Absent:{" "}
                                                {formatGrade(
                                                    gradingSettings.absent_grade,
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        The export uses the grading rules from
                                        Settings for this group. Late and
                                        excused sessions are still visually
                                        marked in the sheet.
                                    </p>
                                </div>
                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setExportOpen(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={async () => {
                                            await handleDownloadCumulativeExcel();
                                            setExportOpen(false);
                                        }}
                                    >
                                        Export Excel
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                        <Dialog
                            open={sessionOpen}
                            onOpenChange={(open) => {
                                setSessionOpen(open);
                                if (!open) {
                                    setEnableLocation(false);
                                    setSessionLat(null);
                                    setSessionLng(null);
                                }
                            }}
                        >
                            <DialogTrigger asChild>
                                <Button>
                                    <Play className="mr-2 h-4 w-4" />
                                    Start Session
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <form onSubmit={handleStartSession}>
                                    <DialogHeader>
                                        <DialogTitle>
                                            Start New Session
                                        </DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
                                            {/*This session will be created as a{" "}*/}
                                            <span className="font-semibold">
                                                {currentRole === "ta"
                                                    ? "Tutorial"
                                                    : "Lecture"}
                                            </span>{" "}
                                            {/*because you are signed in as{" "}*/}
                                            {/*<span className="font-semibold">
                                                {isOwner ? "the owner" : "a TA"}
                                            </span>*/}
                                            {/*.*/}
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="sessionTitle">
                                                Title (optional)
                                            </Label>
                                            <Input
                                                id="sessionTitle"
                                                placeholder="e.g., Lecture 5"
                                                value={sessionTitle}
                                                onChange={(e) =>
                                                    setSessionTitle(
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="duration">
                                                Duration
                                            </Label>
                                            <Select
                                                value={sessionDuration}
                                                onValueChange={
                                                    setSessionDuration
                                                }
                                            >
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="5">
                                                        5 minutes
                                                    </SelectItem>
                                                    <SelectItem value="10">
                                                        10 minutes
                                                    </SelectItem>
                                                    <SelectItem value="15">
                                                        15 minutes
                                                    </SelectItem>
                                                    <SelectItem value="20">
                                                        20 minutes
                                                    </SelectItem>
                                                    <SelectItem value="30">
                                                        30 minutes
                                                    </SelectItem>
                                                    <SelectItem value="45">
                                                        45 minutes
                                                    </SelectItem>
                                                    <SelectItem value="60">
                                                        1 hour
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* QR Rotation Toggle */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label className="flex items-center gap-2">
                                                    <RefreshCw className="h-4 w-4" />
                                                    Rotating QR Code
                                                </Label>
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={
                                                        qrRotating
                                                            ? "true"
                                                            : "false"
                                                    }
                                                    aria-label="Rotating QR Code"
                                                    onClick={() =>
                                                        setQrRotating(
                                                            !qrRotating,
                                                        )
                                                    }
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                        qrRotating
                                                            ? "bg-blue-600"
                                                            : "bg-gray-200"
                                                    }`}
                                                >
                                                    <span
                                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                            qrRotating
                                                                ? "translate-x-6"
                                                                : "translate-x-1"
                                                        }`}
                                                    />
                                                </button>
                                            </div>
                                            {qrRotating && (
                                                <div className="p-3 bg-gray-50 rounded-lg">
                                                    <Label className="text-xs">
                                                        Rotation Interval
                                                    </Label>
                                                    <Select
                                                        value={rotationInterval}
                                                        onValueChange={
                                                            setRotationInterval
                                                        }
                                                    >
                                                        <SelectTrigger className="h-8 text-sm mt-1">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="5">
                                                                5 seconds
                                                            </SelectItem>
                                                            <SelectItem value="10">
                                                                10 seconds
                                                            </SelectItem>
                                                            <SelectItem value="15">
                                                                15 seconds
                                                            </SelectItem>
                                                            <SelectItem value="20">
                                                                20 seconds
                                                            </SelectItem>
                                                            <SelectItem value="30">
                                                                30 seconds
                                                            </SelectItem>
                                                            <SelectItem value="60">
                                                                60 seconds
                                                            </SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            )}
                                        </div>

                                        {/* Location Toggle */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label className="flex items-center gap-2">
                                                    <MapPin className="h-4 w-4" />
                                                    Require Location
                                                </Label>
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={
                                                        enableLocation
                                                            ? "true"
                                                            : "false"
                                                    }
                                                    aria-label="Require Location"
                                                    onClick={() =>
                                                        setEnableLocation(
                                                            !enableLocation,
                                                        )
                                                    }
                                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                        enableLocation
                                                            ? "bg-blue-600"
                                                            : "bg-gray-200"
                                                    }`}
                                                >
                                                    <span
                                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                            enableLocation
                                                                ? "translate-x-6"
                                                                : "translate-x-1"
                                                        }`}
                                                    />
                                                </button>
                                            </div>

                                            {enableLocation && (
                                                <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={
                                                            handleGetLocation
                                                        }
                                                        disabled={
                                                            gettingLocation
                                                        }
                                                        className="w-full"
                                                    >
                                                        {gettingLocation ? (
                                                            <>
                                                                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                                                Getting
                                                                location...
                                                            </>
                                                        ) : sessionLat ? (
                                                            <>
                                                                <CheckCircle2 className="mr-2 h-3 w-3 text-green-600" />
                                                                Location set
                                                            </>
                                                        ) : (
                                                            <>
                                                                <MapPin className="mr-2 h-3 w-3" />
                                                                Use My Current
                                                                Location
                                                            </>
                                                        )}
                                                    </Button>
                                                    {sessionLat && (
                                                        <p className="text-xs text-gray-500 text-center">
                                                            {sessionLat.toFixed(
                                                                5,
                                                            )}
                                                            ,{" "}
                                                            {sessionLng?.toFixed(
                                                                5,
                                                            )}
                                                        </p>
                                                    )}
                                                    <div className="space-y-1">
                                                        <Label className="text-xs">
                                                            Allowed Radius
                                                        </Label>
                                                        <Select
                                                            value={
                                                                sessionRadius
                                                            }
                                                            onValueChange={
                                                                setSessionRadius
                                                            }
                                                        >
                                                            <SelectTrigger className="h-8 text-sm">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="50">
                                                                    50 meters
                                                                </SelectItem>
                                                                <SelectItem value="100">
                                                                    100 meters
                                                                </SelectItem>
                                                                <SelectItem value="200">
                                                                    200 meters
                                                                </SelectItem>
                                                                <SelectItem value="500">
                                                                    500 meters
                                                                </SelectItem>
                                                                <SelectItem value="1000">
                                                                    1 km
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                setSessionOpen(false)
                                            }
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={
                                                startingSession ||
                                                (enableLocation && !sessionLat)
                                            }
                                        >
                                            {startingSession && (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            )}
                                            Start Session
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                        </div>
                    </div>

                    {sessions.length === 0 ? (
                        <Card
                            className="border-dashed border-primary/20 bg-gradient-to-br from-background via-background to-primary/6"
                            data-onboarding="sessions-history"
                        >
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <Clock className="mb-4 h-12 w-12 text-primary/45" />
                                <p className="text-sm text-soft">
                                    No sessions yet. Start one to take
                                    attendance.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div
                            className="space-y-3"
                            data-onboarding="sessions-history"
                        >
                            {sessions.map((session) => (
                                <Card
                                    key={session.id}
                                    className="group cursor-pointer transition-transform duration-200 hover:-translate-y-0.5"
                                    onClick={() =>
                                        session.is_active
                                            ? router.push(
                                                  `/dashboard/session/${session.id}/live`,
                                              )
                                            : router.push(
                                                  `/dashboard/groups/${groupId}/sessions/${session.id}`,
                                              )
                                    }
                                >
                                    <CardContent className="flex items-center justify-between py-4">
                                        <div className="flex items-center gap-4">
                                            <div
                                                className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                                                    session.is_active
                                                        ? "bg-[var(--status-success-soft)]"
                                                        : "bg-secondary"
                                                }`}
                                            >
                                                {session.is_active ? (
                                                    <Play className="h-5 w-5 text-[color:var(--status-success)]" />
                                                ) : (
                                                    <Clock className="h-5 w-5 text-subtle" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-foreground">
                                                        {session.title ||
                                                            "Untitled Session"}
                                                    </p>
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
                                                    {session.latitude && (
                                                        <MapPin className="h-3.5 w-3.5 text-primary" />
                                                    )}
                                                </div>
                                                <p className="text-sm text-soft">
                                                    {new Date(
                                                        session.started_at,
                                                    ).toLocaleDateString(
                                                        "en-US",
                                                        {
                                                            weekday: "short",
                                                            month: "short",
                                                            day: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        },
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className="text-sm font-medium text-foreground">
                                                    {session.attendance_count} /{" "}
                                                    {students.length}
                                                </p>
                                                <p className="text-xs text-subtle">
                                                    attended
                                                </p>
                                            </div>
                                            {session.is_active ? (
                                                <Badge variant="success">
                                                    Live
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">
                                                    Ended
                                                </Badge>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                                                onClick={(e) =>
                                                    handleDeleteSession(
                                                        session.id,
                                                        e,
                                                    )
                                                }
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                {/* Students Tab */}
                <TabsContent value="coursework" className="space-y-5">
                    <div data-onboarding="coursework-panel">
                        <CourseworkGroupPanel
                            groupId={groupId}
                            students={students}
                            sessions={sessions}
                        />
                    </div>
                </TabsContent>

                <TabsContent
                    value="students"
                    className="space-y-5"
                >
                    <div className="space-y-5 rounded-[28px] border border-border/70 bg-transparent p-5 sm:p-6">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="space-y-3">
                                    <Badge
                                        variant="outline"
                                        className="w-fit border-primary/20 bg-primary/5 text-primary"
                                    >
                                        Student workspace
                                    </Badge>
                                    <div className="space-y-1.5">
                                        <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                                            Students
                                        </h2>
                                        <p className="max-w-2xl text-sm leading-6 text-soft">
                                            Search, import, edit, and review
                                            individual student history from one
                                            place.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary">
                                        {students.length} enrolled
                                    </Badge>
                                    <Badge variant="outline">
                                        {filteredStudents.length} visible
                                    </Badge>
                                </div>
                            </div>
                            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                                <div className="space-y-2">
                                    <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-subtle">
                                        Find a student
                                    </Label>
                                    <Input
                                        value={studentSearch}
                                        onChange={(e) =>
                                            setStudentSearch(e.target.value)
                                        }
                                        placeholder="Search students by name or ID"
                                    />
                                </div>
                                <div
                                    className="flex flex-wrap justify-start gap-2 lg:justify-end"
                                    data-onboarding="students-actions"
                                >
                        {/* CSV Upload */}
                        <Dialog
                            open={csvOpen}
                            onOpenChange={(open) => {
                                if (!open) handleCloseCsv();
                                else setCsvOpen(true);
                            }}
                        >
                            <DialogTrigger asChild>
                                <Button variant="outline">
                                    <Upload className="mr-2 h-4 w-4" />
                                    Import CSV
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>
                                        Import Students From Excel Or CSV
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div>
                                        <Label htmlFor="csvFile">
                                            Upload Excel Or CSV File
                                        </Label>
                                        <Input
                                            id="csvFile"
                                            type="file"
                                            accept=".csv,.xlsx"
                                            onChange={handleFileUpload}
                                            className="mt-2"
                                        />
                                    </div>
                                    {csvHeaders.length > 0 && (
                                        <>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>
                                                        Student Name Column
                                                    </Label>
                                                    <Select
                                                        value={nameColumn}
                                                        onValueChange={
                                                            setNameColumn
                                                        }
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select column..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {csvColumnOptions.map(
                                                                (option) => (
                                                                    <SelectItem
                                                                        key={option.value}
                                                                        value={option.value}
                                                                    >
                                                                        {option.label}
                                                                    </SelectItem>
                                                                ),
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>
                                                        Student ID Column
                                                    </Label>
                                                    <Select
                                                        value={idColumn}
                                                        onValueChange={
                                                            setIdColumn
                                                        }
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select column..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {csvColumnOptions.map(
                                                                (option) => (
                                                                    <SelectItem
                                                                        key={option.value}
                                                                        value={option.value}
                                                                    >
                                                                        {option.label}
                                                                    </SelectItem>
                                                                ),
                                                            )}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            {nameColumn && idColumn && (
                                                <div>
                                                    <Label className="mb-2 block">
                                                        Preview (first 5 rows)
                                                    </Label>
                                                    <div className="border rounded-lg overflow-hidden">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead>
                                                                        Name
                                                                    </TableHead>
                                                                    <TableHead>
                                                                        University
                                                                        ID
                                                                    </TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {csvData
                                                                    .slice(0, 5)
                                                                    .map(
                                                                        (
                                                                            row,
                                                                            i,
                                                                        ) => (
                                                                            <TableRow
                                                                                key={
                                                                                    i
                                                                                }
                                                                            >
                                                                                <TableCell>
                                                                                    {
                                                                                        row[
                                                                                            getColumnIndex(
                                                                                                nameColumn,
                                                                                            )
                                                                                        ]
                                                                                    }
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    {
                                                                                        row[
                                                                                            getColumnIndex(
                                                                                                idColumn,
                                                                                            )
                                                                                        ]
                                                                                    }
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        ),
                                                                    )}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                    <p className="text-sm text-gray-500 mt-2">
                                                        {csvData.length}{" "}
                                                        students found
                                                    </p>
                                                </div>
                                            )}
                                            {importResult && (
                                                <div className="bg-blue-50 p-3 rounded-lg">
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                        <span>
                                                            {
                                                                importResult.success
                                                            }{" "}
                                                            imported
                                                        </span>
                                                    </div>
                                                    {importResult.skipped >
                                                        0 && (
                                                        <div className="flex items-center gap-2 text-sm mt-1">
                                                            <XCircle className="h-4 w-4 text-amber-600" />
                                                            <span>
                                                                {
                                                                    importResult.skipped
                                                                }{" "}
                                                                skipped
                                                                (duplicates)
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                                <DialogFooter>
                                    <Button
                                        variant="outline"
                                        onClick={handleCloseCsv}
                                    >
                                        {importResult ? "Done" : "Cancel"}
                                    </Button>
                                    {nameColumn &&
                                        idColumn &&
                                        !importResult && (
                                            <Button
                                                onClick={handleImportCsv}
                                                disabled={importing}
                                            >
                                                {importing && (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                )}
                                                Import {csvData.length} Students
                                            </Button>
                                        )}
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        {/* Add Single Student */}
                        <Dialog
                            open={addStudentOpen}
                            onOpenChange={setAddStudentOpen}
                        >
                            <DialogTrigger asChild>
                                <Button>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Student
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <form onSubmit={handleAddStudent}>
                                    <DialogHeader>
                                        <DialogTitle>Add Student</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="sName">
                                                Student Name
                                            </Label>
                                            <Input
                                                id="sName"
                                                placeholder="Ahmed Hassan"
                                                value={studentName}
                                                onChange={(e) =>
                                                    setStudentName(
                                                        e.target.value,
                                                    )
                                                }
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="sId">
                                                University ID
                                            </Label>
                                            <Input
                                                id="sId"
                                                placeholder="20210451"
                                                value={studentId}
                                                onChange={(e) =>
                                                    setStudentId(e.target.value)
                                                }
                                                required
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                setAddStudentOpen(false)
                                            }
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={addingStudent}
                                        >
                                            {addingStudent && (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            )}
                                            Add Student
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>

                        {/* Edit Student Dialog */}
                        <Dialog
                            open={editStudentOpen}
                            onOpenChange={setEditStudentOpen}
                        >
                            <DialogContent>
                                <form onSubmit={handleEditStudent}>
                                    <DialogHeader>
                                        <DialogTitle>Edit Student</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="editName">
                                                Student Name
                                            </Label>
                                            <Input
                                                id="editName"
                                                value={editStudentName}
                                                onChange={(e) =>
                                                    setEditStudentName(
                                                        e.target.value,
                                                    )
                                                }
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="editId">
                                                University ID
                                            </Label>
                                            <Input
                                                id="editId"
                                                value={editStudentId}
                                                onChange={(e) =>
                                                    setEditStudentId(
                                                        e.target.value,
                                                    )
                                                }
                                                required
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                setEditStudentOpen(false)
                                            }
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={editingStudent}
                                        >
                                            {editingStudent && (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            )}
                                            Save
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                                </div>
                            </div>
                    </div>

                    {students.length === 0 ? (
                        <Card className="border-dashed border-primary/20 bg-gradient-to-br from-background via-background to-primary/6">
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <Users className="mb-4 h-12 w-12 text-primary/45" />
                                <p className="text-sm text-soft">
                                    No students yet. Add students manually or
                                    import from CSV.
                                </p>
                            </CardContent>
                        </Card>
                    ) : filteredStudents.length === 0 ? (
                        <Card className="border-dashed border-border/70">
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <Users className="mb-4 h-12 w-12 text-subtle" />
                                <p className="text-sm text-soft">
                                    No students match your search.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <Card className="overflow-hidden border-border/70 bg-background/96 shadow-[0_22px_56px_-44px_rgba(22,47,95,0.18)]">
                            <div className="flex flex-col gap-2 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm font-medium text-foreground">
                                        Student register
                                    </p>
                                    <p className="text-sm text-soft">
                                        Open a student to review attendance and
                                        coursework history.
                                    </p>
                                </div>
                                <Badge variant="outline" className="w-fit">
                                    {filteredStudents.length} records
                                </Badge>
                            </div>
                            <div className="overflow-hidden rounded-b-[28px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>University ID</TableHead>
                                            <TableHead className="w-24 text-right">
                                                Action
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredStudents.map((student) => (
                                            <TableRow
                                                key={student.id}
                                                className="cursor-pointer"
                                                onClick={() =>
                                                    router.push(
                                                        `/dashboard/groups/${groupId}/students/${student.id}`,
                                                    )
                                                }
                                            >
                                                <TableCell className="font-medium">
                                                    {student.name}
                                                </TableCell>
                                                <TableCell>
                                                    {student.university_id}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                setEditStudent(
                                                                    student,
                                                                );
                                                                setEditStudentName(
                                                                    student.name,
                                                                );
                                                                setEditStudentId(
                                                                    student.university_id,
                                                                );
                                                                setEditStudentOpen(
                                                                    true,
                                                                );
                                                            }}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                handleDeleteStudent(
                                                                    student.id,
                                                                );
                                                            }}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent
                    value="team"
                    className="space-y-5"
                >
                    <Card className="border-border/70 bg-background/80">
                        <CardContent className="space-y-5 p-5 sm:p-6">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="space-y-3">
                                    <Badge
                                        variant="outline"
                                        className="w-fit border-primary/20 bg-primary/5 text-primary"
                                    >
                                        Team workspace
                                    </Badge>
                                    <div className="space-y-1.5">
                                        <h2 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                                            Team access
                                        </h2>
                                        <p className="max-w-2xl text-sm leading-6 text-soft">
                                            Invite teaching assistants or
                                            shared owners and keep permissions
                                            easy to review at a glance.
                                        </p>
                                    </div>
                                </div>
                                <Badge variant="secondary" className="w-fit">
                                    {team.length} members
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,24rem)]">
                        <Card className="border-border/70 bg-background/90">
                            <CardContent className="space-y-5 p-5 sm:p-6">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                                            Team access
                                        </h3>
                                        <p className="mt-1 text-sm text-soft">
                                            Invite teaching assistants or shared
                                            owners and keep permissions easy to
                                            review at a glance.
                                        </p>
                                    </div>
                                    <Badge variant="outline">
                                        {team.length} members
                                    </Badge>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <div className="rounded-2xl border border-border/70 bg-transparent p-4">
                                        <div className="mb-3 flex items-center gap-2 text-primary">
                                            <ShieldCheck className="h-4 w-4" />
                                            <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">
                                                Shared owner
                                            </span>
                                        </div>
                                        <p className="text-sm text-soft">
                                            Full control over members, sessions,
                                            students, and grading workflows.
                                        </p>
                                    </div>
                                    <div className="rounded-2xl border border-border/70 bg-transparent p-4">
                                        <div className="mb-3 flex items-center gap-2 text-primary">
                                            <UserRoundCheck className="h-4 w-4" />
                                            <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">
                                                TA access
                                            </span>
                                        </div>
                                        <p className="text-sm text-soft">
                                            Manage students, sessions, and
                                            attendance support without changing
                                            ownership.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {team.map((member) => (
                                        <div
                                            key={member.professor_id}
                                            className="flex items-center justify-between gap-4 rounded-[24px] border border-border/70 bg-background/70 p-4"
                                        >
                                            <div className="flex min-w-0 items-center gap-3">
                                                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                                                    <span className="text-sm font-semibold uppercase">
                                                        {member.name
                                                            ?.charAt(0)
                                                            ?.toUpperCase() ||
                                                            "M"}
                                                    </span>
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate font-medium text-foreground">
                                                        {member.name}
                                                    </p>
                                                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-soft">
                                                        <Mail className="h-3.5 w-3.5" />
                                                        <span className="truncate">
                                                            {member.email}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge
                                                    variant={
                                                        member.role === "owner"
                                                            ? "success"
                                                            : "warning"
                                                    }
                                                >
                                                    {member.role === "owner"
                                                        ? "Owner"
                                                        : "TA"}
                                                </Badge>
                                                {isOwner &&
                                                    member.role !== "owner" && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() =>
                                                                handleRemoveMember(
                                                                    member.professor_id,
                                                                )
                                                            }
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="surface-elevated border-border/70">
                            <CardContent className="space-y-4 p-5 sm:p-6">
                                <Badge variant="warning" className="w-fit">
                                    Invite & permissions
                                </Badge>
                                <div>
                                    <h3 className="text-lg font-semibold tracking-[-0.02em] text-foreground">
                                        Add a team member
                                    </h3>
                                    <p className="mt-1 text-sm text-soft">
                                        Use the existing Quorum account email and
                                        choose the right level of access for this
                                        group.
                                    </p>
                                </div>

                                <div className="rounded-2xl border border-border/70 bg-transparent p-4">
                                    <p className="text-sm font-medium text-foreground">
                                        Access guidance
                                    </p>
                                    <p className="mt-2 text-sm text-soft">
                                        Invite shared owners only when they need
                                        to manage permissions or group-level
                                        settings. Use TA for day-to-day support.
                                    </p>
                                </div>

                                {isOwner && billingSummary?.features.team_members ? (
                                    <Dialog
                                        open={teamOpen}
                                        onOpenChange={setTeamOpen}
                                    >
                                        <DialogTrigger asChild>
                                            <Button className="w-full">
                                                <Plus className="mr-2 h-4 w-4" />
                                                Add Member
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <form onSubmit={handleAddMember}>
                                                <DialogHeader>
                                                    <DialogTitle>
                                                        Add Team Member
                                                    </DialogTitle>
                                                </DialogHeader>
                                                <div className="space-y-4 py-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="memberEmail">
                                                            Account Email
                                                        </Label>
                                                        <Input
                                                            id="memberEmail"
                                                            type="email"
                                                            placeholder="ta@university.edu"
                                                            value={memberEmail}
                                                            onChange={(e) =>
                                                                setMemberEmail(
                                                                    e.target.value,
                                                                )
                                                            }
                                                            required
                                                        />
                                                        <p className="text-xs text-soft">
                                                            The member must
                                                            already have a Quorum
                                                            account.
                                                        </p>
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label>Role</Label>
                                                        <Select
                                                            value={memberRole}
                                                            onValueChange={(
                                                                value,
                                                            ) =>
                                                                setMemberRole(
                                                                    value as
                                                                        | "owner"
                                                                        | "ta",
                                                                )
                                                            }
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="ta">
                                                                    TA
                                                                </SelectItem>
                                                                <SelectItem value="owner">
                                                                    Shared Owner
                                                                </SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <DialogFooter>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={() =>
                                                            setTeamOpen(false)
                                                        }
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        type="submit"
                                                        disabled={addingMember}
                                                    >
                                                        {addingMember && (
                                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                        )}
                                                        Save Access
                                                    </Button>
                                                </DialogFooter>
                                            </form>
                                        </DialogContent>
                                    </Dialog>
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-border/70 bg-transparent p-4 text-sm text-soft">
                                        {isOwner
                                            ? `Upgrade to Plus or Pro to add team members. Current plan: ${billingSummary?.plan.label || "Free"}.`
                                            : "Only owners can invite or remove team members for this group."}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}


