"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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
    ArrowLeft,
    Download,
    Clock,
    Users,
    Loader2,
    CheckCircle2,
    AlertTriangle,
    MapPin,
    Smartphone,
    Pencil,
    Check,
    X,
    FilePenLine,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface SessionDetail {
    id: string;
    title: string | null;
    duration_minutes: number;
    is_active: boolean;
    started_at: string;
    expires_at: string;
    group_id: string;
    latitude: number | null;
    longitude: number | null;
    radius_meters: number | null;
}

interface AttendanceRecord {
    id: string;
    university_id: string;
    scanned_at: string;
    status: "present" | "excused";
    recorded_via: "qr" | "manual";
    note: string | null;
    student: {
        name: string;
        university_id: string;
    };
}

interface Student {
    id: string;
    name: string;
    university_id: string;
}

interface Violation {
    id: string;
    university_id: string;
    student_name: string;
    type: string;
    details: Record<string, unknown>;
    created_at: string;
}

export default function SessionDetailPage() {
    const params = useParams();
    const router = useRouter();
    const groupId = params.groupId as string;
    const sessionId = params.sessionId as string;
    const supabase = createClient();

    const [session, setSession] = useState<SessionDetail | null>(null);
    const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
    const [allStudents, setAllStudents] = useState<Student[]>([]);
    const [violations, setViolations] = useState<Violation[]>([]);
    const [loading, setLoading] = useState(true);
    const [overrideOpen, setOverrideOpen] = useState(false);
    const [overrideStudent, setOverrideStudent] = useState<Student | null>(null);
    const [overrideStatus, setOverrideStatus] = useState<"present" | "excused">(
        "present",
    );
    const [overrideNote, setOverrideNote] = useState("");
    const [savingOverride, setSavingOverride] = useState(false);

    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [isUpdatingTitle, setIsUpdatingTitle] = useState(false);

    const handleUpdateTitle = async () => {
        if (!editTitle.trim() || editTitle.trim() === session?.title) {
            setIsEditingTitle(false);
            return;
        }

        setIsUpdatingTitle(true);
        try {
            const { error } = await supabase
                .from("sessions")
                .update({ title: editTitle.trim() })
                .eq("id", sessionId);

            if (error) throw error;

            setSession((prev) =>
                prev ? { ...prev, title: editTitle.trim() } : prev,
            );
            setIsEditingTitle(false);
        } catch (err) {
            console.error("Failed to update title:", err);
        } finally {
            setIsUpdatingTitle(false);
        }
    };

    const fetchData = useCallback(async () => {
        const [sessionRes, attendanceRes, studentsRes, violationsRes] =
            await Promise.all([
                supabase
                    .from("sessions")
                    .select("*")
                    .eq("id", sessionId)
                    .single(),
                supabase
                    .from("attendance_records")
                    .select(
                        "id, university_id, scanned_at, status, recorded_via, note, student:students(name, university_id)",
                    )
                    .eq("session_id", sessionId)
                    .order("scanned_at"),
                supabase
                    .from("students")
                    .select("*")
                    .eq("group_id", groupId)
                    .order("name"),
                supabase
                    .from("violations")
                    .select("*")
                    .eq("session_id", sessionId)
                    .order("created_at", { ascending: false }),
            ]);

        setSession(sessionRes.data);
        setAttendance(attendanceRes.data || []);
        setAllStudents(studentsRes.data || []);
        setViolations(violationsRes.data || []);
        setLoading(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId, groupId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const openOverrideDialog = (
        student: Student,
        record?: AttendanceRecord | undefined,
    ) => {
        setOverrideStudent(student);
        setOverrideStatus(record?.status || "present");
        setOverrideNote(record?.note || "");
        setOverrideOpen(true);
    };

    const handleSaveOverride = async () => {
        if (!overrideStudent) return;

        setSavingOverride(true);
        try {
            const res = await fetch(
                `/api/sessions/${sessionId}/attendance-override`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        studentId: overrideStudent.id,
                        status: overrideStatus,
                        note: overrideNote,
                    }),
                },
            );

            const data = await res.json();
            if (!res.ok) {
                alert(data.error || "Failed to save override.");
                return;
            }

            setOverrideOpen(false);
            setOverrideStudent(null);
            setOverrideNote("");
            fetchData();
        } finally {
            setSavingOverride(false);
        }
    };

    const handleDownloadExcel = async () => {
        if (!allStudents.length) return;

        // Dynamic import to avoid SSR issues
        const ExcelJS = (await import("exceljs")).default;
        const { saveAs } = (await import("file-saver")).default;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet("Attendance");

        // Define columns
        worksheet.columns = [
            { header: "Name", key: "name", width: 30 },
            { header: "University ID", key: "id", width: 20 },
            { header: "Attended", key: "attended", width: 15 },
            { header: "Status / Violation", key: "status", width: 40 },
        ];

        // Style headers
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE0E0E0" },
        };

        allStudents.forEach((student) => {
            const attendanceRecord = attendance.find(
                (record) => record.university_id === student.university_id,
            );
            const hasAttended = attendanceRecord?.status === "present";
            let statusText = attendanceRecord
                ? attendanceRecord.status === "excused"
                    ? "Excused"
                    : "Present"
                : "Absent";
            let rowColor: string | null = null;

            // Check for violations matching this student
            const studentViolations = violations.filter(
                (v) =>
                    v.university_id === student.university_id ||
                    (v.type === "duplicate_device" &&
                        v.details.original_student_id ===
                            student.university_id),
            );

            if (studentViolations.length > 0) {
                const outOfRange = studentViolations.find(
                    (v) => v.type === "out_of_range",
                );
                const attemptedDuplicate = studentViolations.find(
                    (v) =>
                        v.type === "duplicate_device" &&
                        v.university_id === student.university_id,
                );
                const originalDuplicate = studentViolations.find(
                    (v) =>
                        v.type === "duplicate_device" &&
                        v.details.original_student_id === student.university_id,
                );

                if (attemptedDuplicate) {
                    statusText = `Used device of: ${attemptedDuplicate.details.original_student_name} (${attemptedDuplicate.details.original_student_id})`;
                    rowColor = "FFFFCCCC"; // Light Red
                } else if (originalDuplicate) {
                    statusText = `Device shared with: ${originalDuplicate.student_name} (${originalDuplicate.university_id})`;
                    rowColor = "FFFFEDCC"; // Light Orange/Yellow
                } else if (outOfRange) {
                    statusText = `Out of range (${outOfRange.details.distance_meters}m)`;
                    rowColor = "FFFFCCCC"; // Light Red
                }
            }

            const row = worksheet.addRow({
                name: student.name,
                id: student.university_id,
                attended: hasAttended ? "1" : "0",
                status: statusText,
            });

            // Apply color if violation exists
            if (rowColor) {
                row.eachCell((cell) => {
                    cell.fill = {
                        type: "pattern",
                        pattern: "solid",
                        fgColor: { argb: rowColor as string },
                    };
                });
            }
        });

        // Generate and save file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        saveAs(
            blob,
            `attendance_${session?.title || sessionId}_${new Date().toISOString().split("T")[0]}.xlsx`,
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

    if (!session) {
        return (
            <div className="text-center py-20 text-gray-500">
                Session not found
            </div>
        );
    }

    const presentCount = attendance.filter(
        (record) => record.status === "present",
    ).length;
    const excusedCount = attendance.filter(
        (record) => record.status === "excused",
    ).length;

    return (
        <div>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push(`/dashboard/groups/${groupId}`)}
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        {isEditingTitle ? (
                            <div className="flex items-center gap-2">
                                <Input
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className="h-8 text-lg font-bold w-[250px] bg-white text-gray-900 border-gray-300"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") handleUpdateTitle();
                                        if (e.key === "Escape") setIsEditingTitle(false);
                                    }}
                                    disabled={isUpdatingTitle}
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={handleUpdateTitle}
                                    disabled={isUpdatingTitle}
                                >
                                    {isUpdatingTitle ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Check className="h-4 w-4" />
                                    )}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => setIsEditingTitle(false)}
                                    disabled={isUpdatingTitle}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        ) : (
                            <>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    {session.title || "Untitled Session"}
                                </h1>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-gray-400 hover:text-gray-600 transition-colors"
                                    onClick={() => {
                                        setEditTitle(session.title || "");
                                        setIsEditingTitle(true);
                                    }}
                                >
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                        {session.is_active ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                Live
                            </Badge>
                        ) : (
                            <Badge variant="secondary">Ended</Badge>
                        )}
                        {session.latitude && (
                            <Badge
                                variant="outline"
                                className="text-blue-600 border-blue-200"
                            >
                                <MapPin className="h-3 w-3 mr-1" /> Location
                            </Badge>
                        )}
                    </div>
                    <p className="text-gray-500 text-sm mt-1">
                        {new Date(session.started_at).toLocaleDateString(
                            "en-US",
                            {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                            },
                        )}
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-lg border p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                        <Users className="h-4 w-4" />
                        Attendance
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        {presentCount} / {allStudents.length}
                    </p>
                </div>
                <div className="bg-white rounded-lg border p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                        <CheckCircle2 className="h-4 w-4" />
                        Rate
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        {allStudents.length > 0
                            ? Math.round(
                                  (presentCount / allStudents.length) *
                                      100,
                              )
                            : 0}
                        %
                    </p>
                </div>
                <div className="bg-white rounded-lg border p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                        <FilePenLine className="h-4 w-4" />
                        Excused
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        {excusedCount}
                    </p>
                </div>
                <div className="bg-white rounded-lg border p-4">
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                        <Clock className="h-4 w-4" />
                        Duration
                    </div>
                    <p className="text-2xl font-bold text-gray-900">
                        {session.duration_minutes} min
                    </p>
                </div>
                {violations.length > 0 && (
                    <div className="bg-red-50 rounded-lg border border-red-200 p-4">
                        <div className="flex items-center gap-2 text-sm text-red-600 mb-1">
                            <AlertTriangle className="h-4 w-4" />
                            Violations
                        </div>
                        <p className="text-2xl font-bold text-red-700">
                            {violations.length}
                        </p>
                    </div>
                )}
            </div>

            {/* Download Button */}
            <div className="flex justify-end mb-4">
                <Button
                    onClick={handleDownloadExcel}
                    variant="outline"
                >
                    <Download className="mr-2 h-4 w-4" />
                    Download Excel
                </Button>
            </div>

            <Tabs
                defaultValue="attendance"
                className="space-y-4"
            >
                <TabsList>
                    <TabsTrigger value="attendance">Attendance</TabsTrigger>
                    {violations.length > 0 && (
                        <TabsTrigger
                            value="violations"
                            className="text-red-600"
                        >
                            Violations ({violations.length})
                        </TabsTrigger>
                    )}
                </TabsList>

                {/* Attendance Tab */}
                <TabsContent value="attendance">
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">#</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead>University ID</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Source</TableHead>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Notes</TableHead>
                                    <TableHead className="w-28"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {allStudents.map((student, index) => {
                                    const record = attendance.find(
                                        (a) =>
                                            a.university_id ===
                                            student.university_id,
                                    );
                                    return (
                                        <TableRow key={student.id}>
                                            <TableCell className="text-gray-400">
                                                {index + 1}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {student.name}
                                            </TableCell>
                                            <TableCell>
                                                {student.university_id}
                                            </TableCell>
                                            <TableCell>
                                                {record ? (
                                                    record.status ===
                                                    "excused" ? (
                                                        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                                                            Excused
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                                            Present
                                                        </Badge>
                                                    )
                                                ) : (
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-gray-500"
                                                    >
                                                        Absent
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {record ? (
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            record.recorded_via ===
                                                            "manual"
                                                                ? "border-blue-200 text-blue-700"
                                                                : ""
                                                        }
                                                    >
                                                        {record.recorded_via ===
                                                        "manual"
                                                            ? "Manual"
                                                            : "QR"}
                                                    </Badge>
                                                ) : (
                                                    "—"
                                                )}
                                            </TableCell>
                                            <TableCell className="text-gray-500 text-sm">
                                                {record
                                                    ? new Date(
                                                          record.scanned_at,
                                                      ).toLocaleTimeString(
                                                          "en-US",
                                                          {
                                                              hour: "2-digit",
                                                              minute: "2-digit",
                                                          },
                                                      )
                                                    : "—"}
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-500">
                                                {record?.note || "—"}
                                            </TableCell>
                                            <TableCell>
                                                {!record ||
                                                record.recorded_via ===
                                                    "manual" ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                            openOverrideDialog(
                                                                student,
                                                                record,
                                                            )
                                                        }
                                                    >
                                                        {record
                                                            ? "Update"
                                                            : "Override"}
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs text-gray-400">
                                                        QR locked
                                                    </span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </TabsContent>

                {/* Violations Tab */}
                {violations.length > 0 && (
                    <TabsContent value="violations">
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Student</TableHead>
                                        <TableHead>University ID</TableHead>
                                        <TableHead>Details</TableHead>
                                        <TableHead>Time</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {violations.map((v) => (
                                        <TableRow key={v.id}>
                                            <TableCell>
                                                {v.type === "out_of_range" ? (
                                                    <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">
                                                        <MapPin className="h-3 w-3 mr-1" />
                                                        Out of Range
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                                                        <Smartphone className="h-3 w-3 mr-1" />
                                                        Duplicate Device
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                {v.student_name}
                                            </TableCell>
                                            <TableCell>
                                                {v.university_id}
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-500 max-w-[200px] truncate">
                                                {v.type === "out_of_range"
                                                    ? `${v.details.distance_meters as number}m away (limit: ${v.details.radius_meters as number}m)`
                                                    : `Device already used by ${(v.details.original_student_name as string) || "Unknown"} (${v.details.original_student_id as string})`}
                                            </TableCell>
                                            <TableCell className="text-gray-500 text-sm">
                                                {new Date(
                                                    v.created_at,
                                                ).toLocaleTimeString("en-US", {
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                )}
            </Tabs>

            <Dialog
                open={overrideOpen}
                onOpenChange={setOverrideOpen}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Attendance Override</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <p className="font-medium text-gray-900">
                                {overrideStudent?.name}
                            </p>
                            <p className="text-sm text-gray-500">
                                {overrideStudent?.university_id}
                            </p>
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-700">
                                Status
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant={
                                        overrideStatus === "present"
                                            ? "default"
                                            : "outline"
                                    }
                                    onClick={() => setOverrideStatus("present")}
                                >
                                    Present
                                </Button>
                                <Button
                                    type="button"
                                    variant={
                                        overrideStatus === "excused"
                                            ? "default"
                                            : "outline"
                                    }
                                    onClick={() => setOverrideStatus("excused")}
                                >
                                    Excused
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label
                                htmlFor="overrideNote"
                                className="text-sm font-medium text-gray-700"
                            >
                                Note
                            </label>
                            <textarea
                                id="overrideNote"
                                value={overrideNote}
                                onChange={(e) =>
                                    setOverrideNote(e.target.value)
                                }
                                placeholder="Optional reason or explanation"
                                rows={4}
                                className="flex min-h-[96px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setOverrideOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSaveOverride}
                            disabled={savingOverride}
                        >
                            {savingOverride && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Save Override
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
