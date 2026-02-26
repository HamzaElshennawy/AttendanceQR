"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
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
    Pencil,
    MapPin,
    RefreshCw,
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
    latitude: number | null;
    longitude: number | null;
    radius_meters: number | null;
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

    const fetchGroup = useCallback(async () => {
        const { data } = await supabase
            .from("groups")
            .select("*")
            .eq("id", groupId)
            .single();
        setGroup(data);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groupId]);

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

    useEffect(() => {
        Promise.all([fetchGroup(), fetchStudents(), fetchSessions()]).then(() =>
            setLoading(false),
        );
    }, [fetchGroup, fetchStudents, fetchSessions]);

    // Rename group
    const handleRenameGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        setRenaming(true);
        await supabase
            .from("groups")
            .update({ name: newGroupName })
            .eq("id", groupId);
        setRenaming(false);
        setRenameOpen(false);
        fetchGroup();
    };

    // Add student
    const handleAddStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        setAddingStudent(true);
        const { error } = await supabase.from("students").insert({
            group_id: groupId,
            name: studentName,
            university_id: studentId,
        });
        if (error) {
            if (error.code === "23505")
                alert("A student with this ID already exists in this group.");
            else alert(error.message);
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

    const handleEditStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editStudent) return;
        setEditingStudent(true);
        await supabase
            .from("students")
            .update({ name: editStudentName, university_id: editStudentId })
            .eq("id", editStudent.id);
        setEditingStudent(false);
        setEditStudentOpen(false);
        fetchStudents();
    };

    // Delete session
    const handleDeleteSession = async (
        sessionId: string,
        e: React.MouseEvent,
    ) => {
        e.stopPropagation();
        if (!confirm("Delete this session and all its attendance records?"))
            return;
        await supabase.from("sessions").delete().eq("id", sessionId);
        fetchSessions();
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
                    setCsvData(
                        data
                            .slice(1)
                            .filter((row) => row.some((cell) => cell?.trim())),
                    );
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
            if (error) skipped++;
            else success++;
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
                alert(
                    "Could not get your location. Please enable location access.",
                );
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

        const { data, error } = await supabase
            .from("sessions")
            .insert(sessionData)
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
        return (
            <div className="text-center py-20 text-gray-500">
                Group not found
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
                    onClick={() => router.push("/dashboard")}
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-gray-900">
                            {group.name}
                        </h1>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-gray-400 hover:text-gray-600"
                            onClick={() => {
                                setNewGroupName(group.name);
                                setRenameOpen(true);
                            }}
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <p className="text-gray-500 text-sm">
                        {students.length} students · {sessions.length} sessions
                    </p>
                </div>
            </div>

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
                defaultValue="sessions"
                className="space-y-6"
            >
                <TabsList>
                    <TabsTrigger value="sessions">Sessions</TabsTrigger>
                    <TabsTrigger value="students">Students</TabsTrigger>
                </TabsList>

                {/* Sessions Tab */}
                <TabsContent
                    value="sessions"
                    className="space-y-4"
                >
                    <div className="flex justify-end">
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

                    {sessions.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <Clock className="h-12 w-12 text-gray-300 mb-3" />
                                <p className="text-gray-500">
                                    No sessions yet. Start one to take
                                    attendance.
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="space-y-3">
                            {sessions.map((session) => (
                                <Card
                                    key={session.id}
                                    className="cursor-pointer hover:shadow-md transition-shadow group"
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
                                                className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                                    session.is_active
                                                        ? "bg-green-100"
                                                        : "bg-gray-100"
                                                }`}
                                            >
                                                {session.is_active ? (
                                                    <Play className="h-5 w-5 text-green-600" />
                                                ) : (
                                                    <Clock className="h-5 w-5 text-gray-400" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium text-gray-900">
                                                        {session.title ||
                                                            "Untitled Session"}
                                                    </p>
                                                    {session.latitude && (
                                                        <MapPin className="h-3.5 w-3.5 text-blue-500" />
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-500">
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
                                                <p className="text-sm font-medium text-gray-700">
                                                    {session.attendance_count} /{" "}
                                                    {students.length}
                                                </p>
                                                <p className="text-xs text-gray-400">
                                                    attended
                                                </p>
                                            </div>
                                            {session.is_active ? (
                                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
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
                                                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-600"
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
                <TabsContent
                    value="students"
                    className="space-y-4"
                >
                    <div className="flex justify-end gap-2">
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
                                        Import Students from CSV
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div>
                                        <Label htmlFor="csvFile">
                                            Upload CSV File
                                        </Label>
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
                                                            {csvHeaders.map(
                                                                (h) => (
                                                                    <SelectItem
                                                                        key={h}
                                                                        value={
                                                                            h
                                                                        }
                                                                    >
                                                                        {h}
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
                                                            {csvHeaders.map(
                                                                (h) => (
                                                                    <SelectItem
                                                                        key={h}
                                                                        value={
                                                                            h
                                                                        }
                                                                    >
                                                                        {h}
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
                                                                                            csvHeaders.indexOf(
                                                                                                nameColumn,
                                                                                            )
                                                                                        ]
                                                                                    }
                                                                                </TableCell>
                                                                                <TableCell>
                                                                                    {
                                                                                        row[
                                                                                            csvHeaders.indexOf(
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

                    {students.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-12">
                                <Users className="h-12 w-12 text-gray-300 mb-3" />
                                <p className="text-gray-500">
                                    No students yet. Add students manually or
                                    import from CSV.
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
                                        <TableHead className="w-24"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {students.map((student) => (
                                        <TableRow key={student.id}>
                                            <TableCell className="font-medium">
                                                {student.name}
                                            </TableCell>
                                            <TableCell>
                                                {student.university_id}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-gray-400 hover:text-blue-600"
                                                        onClick={() => {
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
                                                        className="h-8 w-8 text-gray-400 hover:text-red-600"
                                                        onClick={() =>
                                                            handleDeleteStudent(
                                                                student.id,
                                                            )
                                                        }
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
                    )}
                </TabsContent>
            </Tabs>
        </div>
    );
}
