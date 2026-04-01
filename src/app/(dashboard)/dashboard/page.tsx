"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    ArrowRight,
    ChevronRight,
    ClipboardList,
    FolderPlus,
    GraduationCap,
    Loader2,
    Plus,
    Trash2,
    Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAppDialog } from "@/components/AppDialogProvider";

interface Group {
    id: string;
    name: string;
    created_at: string;
    professor_id: string;
    access_role: "owner" | "ta";
    student_count: number;
    session_count: number;
}

export default function DashboardPage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");
    const [creating, setCreating] = useState(false);
    const router = useRouter();
    const supabase = createClient();
    const { showConfirm } = useAppDialog();

    const fetchGroups = async () => {
        const {
            data: { user },
        } = await supabase.auth.getUser();

        const { data: memberships, error: membershipsError } = user
            ? await supabase
                  .from("group_memberships")
                  .select("group_id, role")
                  .eq("professor_id", user.id)
            : { data: [], error: null };

        if (membershipsError) {
            console.warn(
                "Falling back to owner-only groups view:",
                membershipsError.message,
            );
        }

        const membershipRoleByGroup = new Map(
            (memberships || []).map((membership) => [
                membership.group_id,
                membership.role as "owner" | "ta",
            ]),
        );

        const { data: groupsData, error: groupsError } = await supabase
            .from("groups")
            .select("*")
            .order("created_at", { ascending: false });

        if (groupsError) {
            console.error("Failed to load groups:", groupsError.message);
            setGroups([]);
            setLoading(false);
            return;
        }

        if (groupsData) {
            const groupsWithCounts = await Promise.all(
                groupsData.map(async (group) => {
                    const { count: studentCount } = await supabase
                        .from("students")
                        .select("*", { count: "exact", head: true })
                        .eq("group_id", group.id);

                    const { count: sessionCount } = await supabase
                        .from("sessions")
                        .select("*", { count: "exact", head: true })
                        .eq("group_id", group.id);

                    return {
                        ...group,
                        access_role:
                            group.professor_id === user?.id
                                ? "owner"
                                : membershipRoleByGroup.get(group.id) || "ta",
                        student_count: studentCount || 0,
                        session_count: sessionCount || 0,
                    };
                }),
            );
            setGroups(groupsWithCounts);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchGroups();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);

        const {
            data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase.from("groups").insert({
            professor_id: user.id,
            name: newGroupName,
        });

        if (!error) {
            setNewGroupName("");
            setCreateOpen(false);
            fetchGroups();
        }
        setCreating(false);
    };

    const handleDeleteGroup = async (
        groupId: string,
        e: React.MouseEvent,
    ) => {
        e.stopPropagation();
        const confirmed = await showConfirm({
            title: "Delete Group",
            description:
                "This will permanently delete the group, students, sessions, and attendance records.",
            confirmLabel: "Delete Group",
            variant: "error",
        });
        if (!confirmed) return;

        await supabase.from("groups").delete().eq("id", groupId);
        fetchGroups();
    };

    const dashboardStats = useMemo(() => {
        const ownerGroups = groups.filter(
            (group) => group.access_role === "owner",
        ).length;
        const taGroups = groups.length - ownerGroups;
        const studentTotal = groups.reduce(
            (sum, group) => sum + group.student_count,
            0,
        );
        const sessionTotal = groups.reduce(
            (sum, group) => sum + group.session_count,
            0,
        );

        return [
            {
                label: "Active groups",
                value: groups.length,
                detail:
                    groups.length === 1
                        ? "1 teaching workspace"
                        : `${groups.length} teaching workspaces`,
                icon: GraduationCap,
            },
            {
                label: "Students tracked",
                value: studentTotal,
                detail:
                    studentTotal === 0
                        ? "No enrolled students yet"
                        : `${studentTotal} students across all groups`,
                icon: Users,
            },
            {
                label: "Sessions recorded",
                value: sessionTotal,
                detail:
                    sessionTotal === 0
                        ? "Attendance sessions will appear here"
                        : `${sessionTotal} attendance sessions available`,
                icon: ClipboardList,
            },
            {
                label: "Your access",
                value: ownerGroups,
                detail:
                    taGroups > 0
                        ? `${ownerGroups} owner, ${taGroups} TA`
                        : "Owner access across your groups",
                icon: FolderPlus,
            },
        ];
    }, [groups]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <nav
                aria-label="Breadcrumb"
                className="flex flex-wrap items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
            >
                <span>Dashboard</span>
                <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                <span className="text-foreground">Groups</span>
            </nav>

            <section className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,24rem)]">
                <Card className="overflow-hidden">
                    <CardHeader className="relative pb-4">
                        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-primary/0 via-primary/20 to-primary/0" />
                        <Badge variant="outline" className="w-fit border-primary/15 bg-primary/8 text-primary">
                            Professor Dashboard
                        </Badge>
                        <CardTitle className="text-[2rem] leading-tight text-foreground">
                            Your groups at a glance
                        </CardTitle>
                        <CardDescription className="max-w-2xl">
                            Manage classes, review attendance coverage, and move
                            into the group workspace that needs attention next.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {dashboardStats.map((stat) => (
                            <div
                                key={stat.label}
                                className="flex min-h-44 flex-col rounded-2xl border border-border/70 bg-background/80 p-5"
                            >
                                <div className="mb-5 flex items-start justify-between gap-3">
                                    <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
                                        <stat.icon className="h-4 w-4" />
                                    </div>
                                    <span className="max-w-[8rem] text-right text-[11px] leading-4 font-semibold uppercase tracking-[0.08em] text-subtle">
                                        {stat.label}
                                    </span>
                                </div>
                                <div className="text-4xl font-semibold tracking-[-0.045em] text-foreground">
                                    {stat.value}
                                </div>
                                <p className="mt-3 max-w-[18ch] text-sm leading-6 text-soft">
                                    {stat.detail}
                                </p>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="surface-elevated">
                    <CardHeader>
                        <Badge variant="warning" className="w-fit">
                            Quick action
                        </Badge>
                        <CardTitle>Create a new teaching group</CardTitle>
                        <CardDescription>
                            Start a new course space for students, sessions, and
                            coursework from one place.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                            <p className="text-sm font-medium text-foreground">
                                Best for:
                            </p>
                            <p className="mt-2 text-sm text-soft">
                                New semesters, new sections, or separate lab and
                                lecture attendance workflows.
                            </p>
                        </div>
                        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                            <DialogTrigger asChild>
                                <Button className="w-full justify-center">
                                    <Plus className="mr-2 h-4 w-4" />
                                    New Group
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <form onSubmit={handleCreateGroup}>
                                    <DialogHeader>
                                        <DialogTitle>
                                            Create new group
                                        </DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-3 py-4">
                                        <Label htmlFor="groupName">
                                            Group name
                                        </Label>
                                        <Input
                                            id="groupName"
                                            placeholder="e.g., CS101 - Data Structures"
                                            value={newGroupName}
                                            onChange={(e) =>
                                                setNewGroupName(e.target.value)
                                            }
                                            required
                                        />
                                        <p className="text-sm text-soft">
                                            Keep the name specific so students,
                                            sessions, and coursework stay easy to
                                            identify later.
                                        </p>
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setCreateOpen(false)}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={creating}
                                        >
                                            {creating && (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            )}
                                            Create Group
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </CardContent>
                </Card>
            </section>

            {groups.length === 0 ? (
                <Card className="border-dashed border-primary/20 bg-gradient-to-br from-background via-background to-primary/6">
                    <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="mb-5 rounded-3xl bg-primary/10 p-5 text-primary">
                            <Users className="h-9 w-9" />
                        </div>
                        <h2 className="text-2xl text-foreground">
                            No groups yet
                        </h2>
                        <p className="mt-3 max-w-xl text-sm text-soft">
                            Create your first group to start tracking attendance,
                            organizing coursework, and keeping one clear
                            workspace per class or section.
                        </p>
                        <Button
                            className="mt-6"
                            onClick={() => setCreateOpen(true)}
                        >
                            <Plus className="mr-2 h-4 w-4" />
                            Create Group
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <section className="space-y-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 className="text-2xl text-foreground">
                                Group workspace
                            </h2>
                            <p className="text-sm text-soft">
                                Open a group to manage students, sessions,
                                coursework, and attendance records.
                            </p>
                        </div>
                        <Badge variant="secondary" className="w-fit">
                            {groups.length} {groups.length === 1 ? "group" : "groups"}
                        </Badge>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                        {groups.map((group) => (
                            <Card
                                key={group.id}
                                className="group cursor-pointer overflow-hidden transition-transform duration-200 hover:-translate-y-0.5"
                                onClick={() =>
                                    router.push(`/dashboard/groups/${group.id}`)
                                }
                            >
                                <CardHeader className="pb-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="space-y-3">
                                            <Badge
                                                variant={
                                                    group.access_role === "owner"
                                                        ? "success"
                                                        : "warning"
                                                }
                                            >
                                                {group.access_role === "owner"
                                                    ? "Owner"
                                                    : "TA"}
                                            </Badge>
                                            <div>
                                                <CardTitle className="text-xl leading-snug">
                                                    {group.name}
                                                </CardTitle>
                                                <CardDescription className="mt-2">
                                                    Created{" "}
                                                    {new Date(
                                                        group.created_at,
                                                    ).toLocaleDateString()}
                                                </CardDescription>
                                            </div>
                                        </div>
                                        {group.access_role === "owner" && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="opacity-0 transition-opacity group-hover:opacity-100"
                                                onClick={(e) =>
                                                    handleDeleteGroup(
                                                        group.id,
                                                        e,
                                                    )
                                                }
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
                                            <div className="flex items-center gap-2 text-subtle">
                                                <Users className="h-4 w-4" />
                                                <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">
                                                    Students
                                                </span>
                                            </div>
                                            <div className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-foreground">
                                                {group.student_count}
                                            </div>
                                        </div>
                                        <div className="rounded-2xl border border-border/70 bg-background/85 p-4">
                                            <div className="flex items-center gap-2 text-subtle">
                                                <ClipboardList className="h-4 w-4" />
                                                <span className="text-[11px] font-semibold uppercase tracking-[0.08em]">
                                                    Sessions
                                                </span>
                                            </div>
                                            <div className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-foreground">
                                                {group.session_count}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between rounded-2xl border border-primary/10 bg-primary/6 px-4 py-3 text-sm">
                                        <span className="font-medium text-primary">
                                            Open group workspace
                                        </span>
                                        <ArrowRight className="h-4 w-4 text-primary transition-transform duration-200 group-hover:translate-x-0.5" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
