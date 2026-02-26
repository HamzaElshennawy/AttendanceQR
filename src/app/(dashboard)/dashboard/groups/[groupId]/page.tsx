"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
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
  Plus,
  Upload,
  Trash2,
  Play,
  Clock,
  Users,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
} from "lucide-react";
import Papa from "papaparse";

interface Group {
  id: string;
  name: string;
}

interface Student {
  id: string;
  university_id: string;
  name: string;
}

interface Session {
  id: string;
  title: string | null;
  duration_minutes: number;
  is_active: boolean;
  started_at: string;
  expires_at: string;
  attendance_count: number;
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.groupId as string;
  const supabase = createClient();

  const [group, setGroup] = useState<Group | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  // Add student dialog
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [addingStudent, setAddingStudent] = useState(false);

  // CSV upload dialog
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [nameColumn, setNameColumn] = useState("");
  const [idColumn, setIdColumn] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; skipped: number } | null>(null);

  // Start session dialog
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionDuration, setSessionDuration] = useState("15");
  const [startingSession, setStartingSession] = useState(false);

  const fetchGroup = useCallback(async () => {
    const { data } = await supabase
      .from("groups")
      .select("*")
      .eq("id", groupId)
      .single();
    setGroup(data);
  }, [supabase, groupId]);

  const fetchStudents = useCallback(async () => {
    const { data } = await supabase
      .from("students")
      .select("*")
      .eq("group_id", groupId)
      .order("name");
    setStudents(data || []);
  }, [supabase, groupId]);

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

          // Check if session expired
          const isExpired = new Date(session.expires_at) < new Date();
          if (session.is_active && isExpired) {
            await supabase
              .from("sessions")
              .update({ is_active: false })
              .eq("id", session.id);
            session.is_active = false;
          }

          return { ...session, attendance_count: count || 0 };
        })
      );
      setSessions(sessionsWithCounts);
    }
  }, [supabase, groupId]);

  useEffect(() => {
    Promise.all([fetchGroup(), fetchStudents(), fetchSessions()]).then(() =>
      setLoading(false)
    );
  }, [fetchGroup, fetchStudents, fetchSessions]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingStudent(true);

    const { error } = await supabase.from("students").insert({
      group_id: groupId,
      name: studentName,
      university_id: studentId,
    });

    if (error) {
      if (error.code === "23505") {
        alert("A student with this ID already exists in this group.");
      } else {
        alert(error.message);
      }
    } else {
      setStudentName("");
      setStudentId("");
      setAddStudentOpen(false);
      fetchStudents();
    }
    setAddingStudent(false);
  };

  const handleDeleteStudent = async (id: string) => {
    if (!confirm("Remove this student from the group?")) return;
    await supabase.from("students").delete().eq("id", id);
    fetchStudents();
  };

  // CSV handling
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      complete: (results) => {
        const data = results.data as string[][];
        if (data.length > 0) {
          setCsvHeaders(data[0]);
          setCsvData(data.slice(1).filter((row) => row.some((cell) => cell?.trim())));
          setNameColumn("");
          setIdColumn("");
          setImportResult(null);
        }
      },
    });
  };

  const handleImportCsv = async () => {
    if (!nameColumn || !idColumn) return;
    setImporting(true);

    const nameIndex = csvHeaders.indexOf(nameColumn);
    const idIndex = csvHeaders.indexOf(idColumn);

    const studentsToInsert = csvData
      .filter((row) => row[nameIndex]?.trim() && row[idIndex]?.trim())
      .map((row) => ({
        group_id: groupId,
        name: row[nameIndex].trim(),
        university_id: row[idIndex].trim(),
      }));

    let success = 0;
    let skipped = 0;

    for (const student of studentsToInsert) {
      const { error } = await supabase.from("students").insert(student);
      if (error) {
        skipped++;
      } else {
        success++;
      }
    }

    setImportResult({ success, skipped });
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

  // Session handling
  const handleStartSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setStartingSession(true);

    const durationMinutes = parseInt(sessionDuration);
    const expiresAt = new Date(
      Date.now() + durationMinutes * 60 * 1000
    ).toISOString();

    const { data, error } = await supabase
      .from("sessions")
      .insert({
        group_id: groupId,
        title: sessionTitle || null,
        duration_minutes: durationMinutes,
        is_active: true,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (!error && data) {
      router.push(`/dashboard/session/${data.id}/live`);
    }
    setStartingSession(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!group) {
    return <div className="text-center py-20 text-gray-500">Group not found</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
          <p className="text-gray-500 text-sm">
            {students.length} students · {sessions.length} sessions
          </p>
        </div>
      </div>

      <Tabs defaultValue="sessions" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
        </TabsList>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={sessionOpen} onOpenChange={setSessionOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Play className="mr-2 h-4 w-4" />
                  Start Session
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleStartSession}>
                  <DialogHeader>
                    <DialogTitle>Start New Session</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="sessionTitle">Title (optional)</Label>
                      <Input
                        id="sessionTitle"
                        placeholder="e.g., Lecture 5"
                        value={sessionTitle}
                        onChange={(e) => setSessionTitle(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="duration">Duration</Label>
                      <Select value={sessionDuration} onValueChange={setSessionDuration}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 minutes</SelectItem>
                          <SelectItem value="10">10 minutes</SelectItem>
                          <SelectItem value="15">15 minutes</SelectItem>
                          <SelectItem value="20">20 minutes</SelectItem>
                          <SelectItem value="30">30 minutes</SelectItem>
                          <SelectItem value="45">45 minutes</SelectItem>
                          <SelectItem value="60">1 hour</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setSessionOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={startingSession}>
                      {startingSession && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Start Session
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {sessions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-gray-500">No sessions yet. Start one to take attendance.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {sessions.map((session) => (
                <Card
                  key={session.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() =>
                    session.is_active
                      ? router.push(`/dashboard/session/${session.id}/live`)
                      : router.push(`/dashboard/groups/${groupId}/sessions/${session.id}`)
                  }
                >
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center ${
                          session.is_active ? "bg-green-100" : "bg-gray-100"
                        }`}
                      >
                        {session.is_active ? (
                          <Play className="h-5 w-5 text-green-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {session.title || "Untitled Session"}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(session.started_at).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-700">
                          {session.attendance_count} / {students.length}
                        </p>
                        <p className="text-xs text-gray-400">attended</p>
                      </div>
                      {session.is_active ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                          Live
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Ended</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students" className="space-y-4">
          <div className="flex justify-end gap-2">
            {/* CSV Upload */}
            <Dialog open={csvOpen} onOpenChange={(open) => { if (!open) handleCloseCsv(); else setCsvOpen(true); }}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Import CSV
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Import Students from CSV</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* File Upload */}
                  <div>
                    <Label htmlFor="csvFile">Upload CSV File</Label>
                    <Input
                      id="csvFile"
                      type="file"
                      accept=".csv"
                      onChange={handleFileUpload}
                      className="mt-2"
                    />
                  </div>

                  {csvHeaders.length > 0 && (
                    <>
                      {/* Column Mapping */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Student Name Column</Label>
                          <Select value={nameColumn} onValueChange={setNameColumn}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>
                              {csvHeaders.map((header) => (
                                <SelectItem key={header} value={header}>
                                  {header}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Student ID Column</Label>
                          <Select value={idColumn} onValueChange={setIdColumn}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>
                              {csvHeaders.map((header) => (
                                <SelectItem key={header} value={header}>
                                  {header}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Preview */}
                      {nameColumn && idColumn && (
                        <div>
                          <Label className="mb-2 block">Preview (first 5 rows)</Label>
                          <div className="border rounded-lg overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Name</TableHead>
                                  <TableHead>University ID</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {csvData.slice(0, 5).map((row, i) => (
                                  <TableRow key={i}>
                                    <TableCell>{row[csvHeaders.indexOf(nameColumn)]}</TableCell>
                                    <TableCell>{row[csvHeaders.indexOf(idColumn)]}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                          <p className="text-sm text-gray-500 mt-2">
                            {csvData.length} students found in file
                          </p>
                        </div>
                      )}

                      {importResult && (
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span>{importResult.success} students imported</span>
                          </div>
                          {importResult.skipped > 0 && (
                            <div className="flex items-center gap-2 text-sm mt-1">
                              <XCircle className="h-4 w-4 text-amber-600" />
                              <span>{importResult.skipped} skipped (duplicates)</span>
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={handleCloseCsv}>
                    {importResult ? "Done" : "Cancel"}
                  </Button>
                  {nameColumn && idColumn && !importResult && (
                    <Button onClick={handleImportCsv} disabled={importing}>
                      {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Import {csvData.length} Students
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Add Single Student */}
            <Dialog open={addStudentOpen} onOpenChange={setAddStudentOpen}>
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
                      <Label htmlFor="sName">Student Name</Label>
                      <Input
                        id="sName"
                        placeholder="Ahmed Hassan"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sId">University ID</Label>
                      <Input
                        id="sId"
                        placeholder="20210451"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setAddStudentOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={addingStudent}>
                      {addingStudent && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add Student
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {students.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-gray-300 mb-3" />
                <p className="text-gray-500">
                  No students yet. Add students manually or import from CSV.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>University ID</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">{student.name}</TableCell>
                      <TableCell>{student.university_id}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-400 hover:text-red-600"
                          onClick={() => handleDeleteStudent(student.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
