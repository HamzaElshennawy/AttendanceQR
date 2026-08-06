"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
    Loader2,
    Lock,
    CheckCircle2,
    AlertCircle,
    SlidersHorizontal,
    Clock3,
} from "lucide-react";
import {
    defaultGradingSettings,
    formatGrade,
    normalizeGradingSettings,
    type GradingSettings,
} from "@/lib/grading-settings";
import { BillingPanel } from "@/components/billing/BillingPanel";

interface Group {
    id: string;
    name: string;
    professor_id: string;
}

interface GroupSettingsForm {
    present_grade: string;
    late_grade: string;
    excused_grade: string;
    absent_grade: string;
    late_after_minutes: string;
}

const defaultFormValues: GroupSettingsForm = {
    present_grade: String(defaultGradingSettings.present_grade),
    late_grade: String(defaultGradingSettings.late_grade),
    excused_grade: String(defaultGradingSettings.excused_grade),
    absent_grade: String(defaultGradingSettings.absent_grade),
    late_after_minutes: "",
};

export default function SettingsPage() {
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [groups, setGroups] = useState<Group[]>([]);
    const [groupRoles, setGroupRoles] = useState<
        Record<string, "owner" | "ta">
    >({});
    const [groupForms, setGroupForms] = useState<
        Record<string, GroupSettingsForm>
    >({});
    const [groupSaveState, setGroupSaveState] = useState<
        Record<string, { saving: boolean; message: string; error: string }>
    >({});
    const [loadingPolicies, setLoadingPolicies] = useState(true);
    const router = useRouter();
    const supabase = createClient();

    const fetchSettingsData = useCallback(async () => {
        setLoadingPolicies(true);
        const groupsResponse = await fetch("/api/groups");
        const groupsPayload = await groupsResponse.json();

        if (!groupsResponse.ok) {
            setGroups([]);
            setGroupRoles({});
            setGroupForms({});
            setLoadingPolicies(false);
            return;
        }

        const accessibleGroups = (groupsPayload.groups || []) as Array<
            Group & { access_role: "owner" | "ta" }
        >;
        const settingsEntries = await Promise.all(
            accessibleGroups.map(async (group) => {
                const response = await fetch(
                    `/api/groups/${group.id}/grading-settings`,
                );
                const payload = await response.json();
                const normalized = normalizeGradingSettings(
                    (payload.settings ||
                        defaultGradingSettings) as GradingSettings,
                );
                return [
                    group.id,
                    {
                        present_grade: String(normalized.present_grade),
                        late_grade: String(normalized.late_grade),
                        excused_grade: String(normalized.excused_grade),
                        absent_grade: String(normalized.absent_grade),
                        late_after_minutes:
                            normalized.late_after_minutes == null
                                ? ""
                                : String(normalized.late_after_minutes),
                    },
                ] as const;
            }),
        );

        setGroups(accessibleGroups);
        setGroupRoles(
            Object.fromEntries(
                accessibleGroups.map((group) => [group.id, group.access_role]),
            ),
        );
        setGroupForms(
            Object.fromEntries(settingsEntries) as Record<
                string,
                GroupSettingsForm
            >,
        );
        setLoadingPolicies(false);
    }, []);

    useEffect(() => {
        fetchSettingsData();
    }, [fetchSettingsData]);

    const handleGroupSettingChange = (
        groupId: string,
        field: keyof GroupSettingsForm,
        value: string,
    ) => {
        setGroupForms((prev) => ({
            ...prev,
            [groupId]: {
                ...(prev[groupId] || defaultFormValues),
                [field]: value,
            },
        }));
        setGroupSaveState((prev) => ({
            ...prev,
            [groupId]: { saving: false, message: "", error: "" },
        }));
    };

    const handleSaveGroupSettings = async (groupId: string) => {
        const form = groupForms[groupId];
        if (!form) return;

        const normalized = normalizeGradingSettings({
            present_grade: form.present_grade,
            late_grade: form.late_grade,
            excused_grade: form.excused_grade,
            absent_grade: form.absent_grade,
            late_after_minutes: form.late_after_minutes,
        });

        setGroupSaveState((prev) => ({
            ...prev,
            [groupId]: { saving: true, message: "", error: "" },
        }));

        const response = await fetch(
            `/api/groups/${groupId}/grading-settings`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(normalized),
            },
        );
        const payload = await response.json();

        if (!response.ok) {
            setGroupSaveState((prev) => ({
                ...prev,
                [groupId]: {
                    saving: false,
                    message: "",
                    error: payload.error || "Failed to save grading settings.",
                },
            }));
            return;
        }

        setGroupForms((prev) => ({
            ...prev,
            [groupId]: {
                present_grade: String(normalized.present_grade),
                late_grade: String(normalized.late_grade),
                excused_grade: String(normalized.excused_grade),
                absent_grade: String(normalized.absent_grade),
                late_after_minutes:
                    normalized.late_after_minutes == null
                        ? ""
                        : String(normalized.late_after_minutes),
            },
        }));
        setGroupSaveState((prev) => ({
            ...prev,
            [groupId]: {
                saving: false,
                message: "Grading settings saved.",
                error: "",
            },
        }));
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (newPassword.length < 6) {
            setError("New password must be at least 6 characters long.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("New passwords do not match.");
            return;
        }

        if (currentPassword === newPassword) {
            setError("New password must be different from current password.");
            return;
        }

        setLoading(true);

        try {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user?.email) {
                setError(
                    "Unable to verify your identity. Please try logging in again.",
                );
                setLoading(false);
                return;
            }

            const { error: signInError } =
                await supabase.auth.signInWithPassword({
                    email: user.email,
                    password: currentPassword,
                });

            if (signInError) {
                setError("Current password is incorrect.");
                setLoading(false);
                return;
            }

            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (updateError) {
                setError(updateError.message);
                setLoading(false);
                return;
            }

            setSuccess("Password updated successfully!");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setPasswordDialogOpen(false);
            router.push("/dashboard");
        } catch {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-8">
            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(19rem,0.72fr)]">
                <div className="overflow-hidden rounded-[28px] border border-border/70 bg-[linear-gradient(180deg,rgba(251,253,255,0.98),rgba(245,248,252,0.96))] shadow-[0_24px_60px_-42px_rgba(22,47,95,0.28)]">
                    <div className="px-6 py-6 sm:px-7">
                        <Badge className="rounded-full border-primary/20 bg-primary/8 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-primary hover:bg-primary/8">
                            System settings
                        </Badge>
                        <h1 className="mt-4 font-display text-[2rem] leading-tight text-foreground">
                            Policy and account controls
                        </h1>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-soft">
                            Manage grading policies, late rules, and account
                            security with clearer grouped settings and safer
                            save flows.
                        </p>
                    </div>
                </div>

                <div className="rounded-[28px] border border-border/70 bg-background/96 p-6 shadow-[0_24px_60px_-42px_rgba(22,47,95,0.24)]">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Security
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-foreground">
                        Account access
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-soft">
                        Keep your teaching workspace protected by rotating your
                        password when needed.
                    </p>
                    <div className="mt-5 rounded-2xl border border-border/70 bg-transparent px-4 py-4 text-sm text-soft">
                        Password changes apply to your full Quorum account and
                        affect access across all groups.
                    </div>
                    <div className="mt-5">
                        <Dialog
                            open={passwordDialogOpen}
                            onOpenChange={(open) => {
                                setPasswordDialogOpen(open);
                                if (!open) {
                                    setCurrentPassword("");
                                    setNewPassword("");
                                    setConfirmPassword("");
                                    setError("");
                                    setSuccess("");
                                }
                            }}
                        >
                            <DialogTrigger asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full justify-start"
                                >
                                    <Lock className="mr-2 h-4 w-4" />
                                    Change Password
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Change Password</DialogTitle>
                                    <DialogDescription>
                                        Update your password to keep your
                                        account secure.
                                    </DialogDescription>
                                </DialogHeader>
                                <form
                                    onSubmit={handleChangePassword}
                                    className="space-y-4"
                                >
                                    <div className="space-y-2">
                                        <Label htmlFor="currentPassword">
                                            Current Password
                                        </Label>
                                        <Input
                                            id="currentPassword"
                                            type="password"
                                            placeholder="••••••••"
                                            value={currentPassword}
                                            onChange={(e) =>
                                                setCurrentPassword(
                                                    e.target.value,
                                                )
                                            }
                                            required
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="newPassword">
                                            New Password
                                        </Label>
                                        <Input
                                            id="newPassword"
                                            type="password"
                                            placeholder="••••••••"
                                            value={newPassword}
                                            onChange={(e) =>
                                                setNewPassword(e.target.value)
                                            }
                                            required
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Must be at least 6 characters
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPassword">
                                            Confirm New Password
                                        </Label>
                                        <Input
                                            id="confirmPassword"
                                            type="password"
                                            placeholder="••••••••"
                                            value={confirmPassword}
                                            onChange={(e) =>
                                                setConfirmPassword(
                                                    e.target.value,
                                                )
                                            }
                                            required
                                        />
                                    </div>

                                    {error && (
                                        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-600">
                                            <AlertCircle className="h-4 w-4 shrink-0" />
                                            {error}
                                        </div>
                                    )}

                                    {success && (
                                        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2.5 text-sm text-green-600">
                                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                                            {success}
                                        </div>
                                    )}

                                    <DialogFooter>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                setPasswordDialogOpen(false)
                                            }
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={loading}
                                        >
                                            {loading && (
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            )}
                                            Update Password
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </section>

            <section className="grid gap-5">
                <BillingPanel />
            </section>

            <div className="mb-2 flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-semibold text-foreground">
                        Group grading policies
                    </h2>
                    <p className="mt-1 text-soft">
                        Each group keeps its own attendance grading rules and
                        late cutoff.
                    </p>
                </div>
            </div>

            <div className="space-y-6">
                <Card className="border-border/70 shadow-[0_24px_60px_-42px_rgba(22,47,95,0.24)]">
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50">
                                <SlidersHorizontal className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">
                                    Group Grading Policies
                                </CardTitle>
                                <CardDescription>
                                    These settings are shared across each group,
                                    so professors and TAs see the same grades
                                    and late cutoff.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <Separator />
                    <CardContent className="space-y-4 pt-6">
                        {loadingPolicies ? (
                            <div className="flex items-center justify-center py-10">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        ) : groups.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-500">
                                No groups available yet.
                            </div>
                        ) : (
                            groups.map((group) => {
                                const form =
                                    groupForms[group.id] || defaultFormValues;
                                const saveState = groupSaveState[group.id] || {
                                    saving: false,
                                    message: "",
                                    error: "",
                                };

                                return (
                                    <div
                                        key={group.id}
                                        className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                                    >
                                        <div className="mb-4 flex items-center justify-between gap-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h2 className="font-semibold text-gray-900">
                                                        {group.name}
                                                    </h2>
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            groupRoles[
                                                                group.id
                                                            ] === "owner"
                                                                ? "border-emerald-200 text-emerald-700"
                                                                : "border-amber-200 text-amber-700"
                                                        }
                                                    >
                                                        {groupRoles[
                                                            group.id
                                                        ] === "owner"
                                                            ? "Owner"
                                                            : "TA"}
                                                    </Badge>
                                                </div>
                                                <p className="mt-1 text-sm text-gray-500">
                                                    Edit the grade value for
                                                    each attendance result.
                                                </p>
                                            </div>
                                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                                                Present default:{" "}
                                                {formatGrade(
                                                    defaultGradingSettings.present_grade,
                                                )}
                                            </div>
                                        </div>

                                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                                            <div className="grid grid-cols-[minmax(140px,180px)_minmax(140px,220px)_1fr] bg-gray-50 px-4 py-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                                                <div>Rule</div>
                                                <div>Value</div>
                                                <div>Notes</div>
                                            </div>

                                            <div className="divide-y divide-gray-200">
                                                <div className="grid grid-cols-[minmax(140px,180px)_minmax(140px,220px)_1fr] items-center gap-4 px-4 py-4">
                                                    <Label
                                                        htmlFor={`present-${group.id}`}
                                                        className="font-medium text-gray-900"
                                                    >
                                                        Present Grade
                                                    </Label>
                                                    <Input
                                                        id={`present-${group.id}`}
                                                        type="number"
                                                        step="0.01"
                                                        value={
                                                            form.present_grade
                                                        }
                                                        onChange={(e) =>
                                                            handleGroupSettingChange(
                                                                group.id,
                                                                "present_grade",
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                    <p className="text-sm text-gray-500">
                                                        Grade applied when the
                                                        student attends on time.
                                                    </p>
                                                </div>

                                                <div className="grid grid-cols-[minmax(140px,180px)_minmax(140px,220px)_1fr] items-center gap-4 px-4 py-4">
                                                    <Label
                                                        htmlFor={`late-${group.id}`}
                                                        className="font-medium text-gray-900"
                                                    >
                                                        Late Grade
                                                    </Label>
                                                    <Input
                                                        id={`late-${group.id}`}
                                                        type="number"
                                                        step="0.01"
                                                        value={form.late_grade}
                                                        onChange={(e) =>
                                                            handleGroupSettingChange(
                                                                group.id,
                                                                "late_grade",
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                    <p className="text-sm text-gray-500">
                                                        Grade applied when the
                                                        student is marked late.
                                                    </p>
                                                </div>

                                                <div className="grid grid-cols-[minmax(140px,180px)_minmax(140px,220px)_1fr] items-center gap-4 px-4 py-4">
                                                    <Label
                                                        htmlFor={`excused-${group.id}`}
                                                        className="font-medium text-gray-900"
                                                    >
                                                        Excused Grade
                                                    </Label>
                                                    <Input
                                                        id={`excused-${group.id}`}
                                                        type="number"
                                                        step="0.01"
                                                        value={
                                                            form.excused_grade
                                                        }
                                                        onChange={(e) =>
                                                            handleGroupSettingChange(
                                                                group.id,
                                                                "excused_grade",
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                    <p className="text-sm text-gray-500">
                                                        Grade applied when the
                                                        absence is excused
                                                        manually.
                                                    </p>
                                                </div>

                                                <div className="grid grid-cols-[minmax(140px,180px)_minmax(140px,220px)_1fr] items-center gap-4 px-4 py-4">
                                                    <Label
                                                        htmlFor={`absent-${group.id}`}
                                                        className="font-medium text-gray-900"
                                                    >
                                                        Absent Grade
                                                    </Label>
                                                    <Input
                                                        id={`absent-${group.id}`}
                                                        type="number"
                                                        step="0.01"
                                                        value={
                                                            form.absent_grade
                                                        }
                                                        onChange={(e) =>
                                                            handleGroupSettingChange(
                                                                group.id,
                                                                "absent_grade",
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                    <p className="text-sm text-gray-500">
                                                        Grade applied when the
                                                        student has no
                                                        attendance record.
                                                    </p>
                                                </div>

                                                <div className="grid grid-cols-[minmax(140px,180px)_minmax(140px,220px)_1fr] items-center gap-4 px-4 py-4">
                                                    <Label
                                                        htmlFor={`late-after-${group.id}`}
                                                        className="flex items-center gap-2 font-medium text-gray-900"
                                                    >
                                                        <Clock3 className="h-4 w-4" />
                                                        Late After Minutes
                                                    </Label>
                                                    <Input
                                                        id={`late-after-${group.id}`}
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        placeholder="Leave blank to disable"
                                                        value={
                                                            form.late_after_minutes
                                                        }
                                                        onChange={(e) =>
                                                            handleGroupSettingChange(
                                                                group.id,
                                                                "late_after_minutes",
                                                                e.target.value,
                                                            )
                                                        }
                                                    />
                                                    <p className="text-sm text-gray-500">
                                                        If a student scans after
                                                        this many minutes from
                                                        session start, the
                                                        system assigns `Late`
                                                        automatically.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {saveState.error && (
                                            <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
                                                <AlertCircle className="h-4 w-4 shrink-0" />
                                                {saveState.error}
                                            </div>
                                        )}

                                        {saveState.message && (
                                            <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-600">
                                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                                                {saveState.message}
                                            </div>
                                        )}

                                        <div className="mt-4 flex justify-end">
                                            <Button
                                                type="button"
                                                onClick={() =>
                                                    handleSaveGroupSettings(
                                                        group.id,
                                                    )
                                                }
                                                disabled={saveState.saving}
                                            >
                                                {saveState.saving && (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                )}
                                                Save Policy
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
