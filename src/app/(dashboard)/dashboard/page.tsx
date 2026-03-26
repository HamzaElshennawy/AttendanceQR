"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Users, ClipboardList, ChevronRight, Loader2, Trash2 } from "lucide-react";
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
    const { data: { user } } = await supabase.auth.getUser();

    const { data: memberships, error: membershipsError } = user
      ? await supabase
          .from("group_memberships")
          .select("group_id, role")
          .eq("professor_id", user.id)
      : { data: [], error: null };

    if (membershipsError) {
      console.warn("Falling back to owner-only groups view:", membershipsError.message);
    }

    const membershipRoleByGroup = new Map(
      (memberships || []).map((membership) => [membership.group_id, membership.role as "owner" | "ta"])
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
        })
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

    const { data: { user } } = await supabase.auth.getUser();
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

  const handleDeleteGroup = async (groupId: string, e: React.MouseEvent) => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Groups</h1>
          <p className="text-gray-500 mt-1">Manage your classes and student groups</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Group
            </Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleCreateGroup}>
              <DialogHeader>
                <DialogTitle>Create New Group</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <Label htmlFor="groupName">Group Name</Label>
                <Input
                  id="groupName"
                  placeholder="e.g., CS101 - Data Structures"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="mt-2"
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {groups.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
              <Users className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No groups yet</h3>
            <p className="text-gray-500 text-center mb-4">
              Create your first group to start tracking attendance
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card
              key={group.id}
              className="cursor-pointer hover:shadow-md transition-shadow group relative"
              onClick={() => router.push(`/dashboard/groups/${group.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <CardTitle className="text-lg">{group.name}</CardTitle>
                    <Badge
                      variant="outline"
                      className={
                        group.access_role === "owner"
                          ? "border-emerald-200 text-emerald-700"
                          : "border-amber-200 text-amber-700"
                      }
                    >
                      {group.access_role === "owner" ? "Owner" : "TA"}
                    </Badge>
                  </div>
                  {group.access_role === "owner" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-600"
                      onClick={(e) => handleDeleteGroup(group.id, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 text-sm text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4" />
                    <span>{group.student_count} students</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ClipboardList className="h-4 w-4" />
                    <span>{group.session_count} sessions</span>
                  </div>
                </div>
                <div className="flex items-center justify-end mt-4 text-blue-600 text-sm font-medium">
                  View Group
                  <ChevronRight className="ml-1 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
