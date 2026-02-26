"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";

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
                    .select("*, student:students(name, university_id)")
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

    const handleDownloadCsv = () => {
        if (!allStudents.length) return;

        const attendedIds = new Set(attendance.map((a) => a.university_id));

        const csvRows = [
            ["Name", "University ID", "Attended"],
            ...allStudents.map((student) => [
                `"${student.name}"`,
                student.university_id,
                attendedIds.has(student.university_id) ? "1" : "0",
            ]),
        ];

        const csvContent = csvRows.map((row) => row.join(",")).join("\n");
        // UTF-8 BOM for proper Arabic/Unicode rendering in Excel
        const bom = "\uFEFF";
        const blob = new Blob([bom + csvContent], {
            type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `attendance_${session?.title || sessionId}_${new Date().toISOString().split("T")[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
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
                        <h1 className="text-2xl font-bold text-gray-900">
                            {session.title || "Untitled Session"}
                        </h1>
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
                        {attendance.length} / {allStudents.length}
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
                                  (attendance.length / allStudents.length) *
                                      100,
                              )
                            : 0}
                        %
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
                    onClick={handleDownloadCsv}
                    variant="outline"
                >
                    <Download className="mr-2 h-4 w-4" />
                    Download CSV
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
                                    <TableHead>Time</TableHead>
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
                                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                                        Present
                                                    </Badge>
                                                ) : (
                                                    <Badge
                                                        variant="secondary"
                                                        className="text-gray-500"
                                                    >
                                                        Absent
                                                    </Badge>
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
                                                    : `Same device as ${v.details.original_student_id as string}`}
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
        </div>
    );
}
