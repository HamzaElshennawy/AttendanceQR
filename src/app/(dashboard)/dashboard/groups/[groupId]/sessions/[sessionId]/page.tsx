"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

interface SessionDetail {
  id: string;
  title: string | null;
  duration_minutes: number;
  is_active: boolean;
  started_at: string;
  expires_at: string;
  group_id: string;
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

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;
  const sessionId = params.sessionId as string;
  const supabase = createClient();

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const [sessionRes, attendanceRes, studentsRes] = await Promise.all([
      supabase.from("sessions").select("*").eq("id", sessionId).single(),
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
    ]);

    setSession(sessionRes.data);
    setAttendance(attendanceRes.data || []);
    setAllStudents(studentsRes.data || []);
    setLoading(false);
  }, [supabase, sessionId, groupId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDownloadCsv = () => {
    if (!allStudents.length) return;

    const attendedIds = new Set(attendance.map((a) => a.university_id));

    const csvRows = [
      ["Name", "University ID", "Attended"],
      ...allStudents.map((student) => [
        student.name,
        student.university_id,
        attendedIds.has(student.university_id) ? "1" : "0",
      ]),
    ];

    const csvContent = csvRows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
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
    return <div className="text-center py-20 text-gray-500">Session not found</div>;
  }

  const attendedIds = new Set(attendance.map((a) => a.university_id));

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
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Live</Badge>
            ) : (
              <Badge variant="secondary">Ended</Badge>
            )}
          </div>
          <p className="text-gray-500 text-sm mt-1">
            {new Date(session.started_at).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
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
              ? Math.round((attendance.length / allStudents.length) * 100)
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
      </div>

      {/* Download Button */}
      <div className="flex justify-end mb-4">
        <Button onClick={handleDownloadCsv} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Download Attendance CSV
        </Button>
      </div>

      {/* Attendance Table */}
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
                (a) => a.university_id === student.university_id
              );
              return (
                <TableRow key={student.id}>
                  <TableCell className="text-gray-400">{index + 1}</TableCell>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell>{student.university_id}</TableCell>
                  <TableCell>
                    {record ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                        Present
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-gray-500">
                        Absent
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {record
                      ? new Date(record.scanned_at).toLocaleTimeString("en-US", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
