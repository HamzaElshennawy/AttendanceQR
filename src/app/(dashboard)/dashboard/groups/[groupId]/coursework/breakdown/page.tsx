"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CourseworkAssessment, SessionCategory } from "@/lib/coursework";
import { CourseworkBreakdownEditor } from "@/components/coursework/CourseworkBreakdownEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Student {
    id: string;
    name: string;
    university_id: string;
}

interface SessionOption {
    id: string;
    title: string | null;
    category: SessionCategory;
    started_at: string;
}

interface Group {
    id: string;
    name: string;
}

interface AssessmentRow extends Omit<CourseworkAssessment, "session"> {
    session:
        | {
              title: string | null;
              category: SessionCategory;
          }
        | {
              title: string | null;
              category: SessionCategory;
          }[]
        | null;
}

function normalizeAssessment(assessment: AssessmentRow): CourseworkAssessment {
    return {
        ...assessment,
        session: Array.isArray(assessment.session)
            ? (assessment.session[0] ?? null)
            : assessment.session,
    };
}

export default function CourseworkBreakdownPage() {
    const params = useParams();
    const groupId = params.groupId as string;
    const supabase = createClient();
    const [group, setGroup] = useState<Group | null>(null);
    const [students, setStudents] = useState<Student[]>([]);
    const [sessions, setSessions] = useState<SessionOption[]>([]);
    const [assessments, setAssessments] = useState<CourseworkAssessment[]>([]);
    const [loading, setLoading] = useState(true);

    const loadPage = useCallback(async () => {
        setLoading(true);
        const [groupRes, studentsRes, sessionsRes, assessmentsRes] = await Promise.all([
            supabase.from("groups").select("id, name").eq("id", groupId).maybeSingle(),
            supabase
                .from("students")
                .select("id, name, university_id")
                .eq("group_id", groupId)
                .order("name", { ascending: true }),
            supabase
                .from("sessions")
                .select("id, title, category, started_at")
                .eq("group_id", groupId)
                .order("started_at", { ascending: true }),
            supabase
                .from("coursework_assessments")
                .select(
                    "id, group_id, session_id, title, assessment_kind, max_score, category, assessment_date, created_at, session:sessions(title, category)",
                )
                .eq("group_id", groupId)
                .order("assessment_date", { ascending: false }),
        ]);

        setGroup((groupRes.data || null) as Group | null);
        setStudents(((studentsRes.data || []) as Student[]) || []);
        setSessions(((sessionsRes.data || []) as SessionOption[]) || []);
        setAssessments(
            ((assessmentsRes.data || []) as AssessmentRow[]).map(normalizeAssessment),
        );
        setLoading(false);
    }, [groupId, supabase]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            void loadPage();
        }, 0);
        return () => window.clearTimeout(timeout);
    }, [loadPage]);

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    <Link href="/dashboard" className="transition-colors hover:text-primary">
                        Dashboard
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <Link href={`/dashboard/groups/${groupId}`} className="transition-colors hover:text-primary">
                        {group?.name || "Group"}
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <span className="text-primary">Coursework breakdown</span>
                </div>

                <Button asChild variant="ghost" className="w-fit px-0 text-muted-foreground hover:text-foreground">
                    <Link href={`/dashboard/groups/${groupId}`}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to group hub
                    </Link>
                </Button>
            </div>

            <section className="rounded-[30px] border border-border/70 bg-[linear-gradient(180deg,rgba(251,253,255,0.98),rgba(245,248,252,0.96))] px-6 py-6 shadow-[0_24px_60px_-42px_rgba(22,47,95,0.3)] md:px-8">
                <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
                    <div className="space-y-4">
                        <Badge variant="outline" className="bg-primary/6 text-primary">
                            Weighted grading model
                        </Badge>
                        <div className="space-y-2">
                            <h1 className="font-display text-4xl text-foreground">
                                Coursework breakdown
                            </h1>
                            <p className="max-w-3xl text-sm leading-7 text-muted-foreground">
                                Define how attendance, quizzes, midterms, finals, and grouped coursework
                                categories contribute to the course total for this group.
                            </p>
                        </div>
                    </div>

                    <div className="rounded-[24px] border border-border/70 bg-background/90 px-5 py-5 shadow-sm">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                            Group context
                        </div>
                        <div className="mt-3 space-y-3">
                            <div>
                                <div className="font-medium text-foreground">
                                    {group?.name || "Group"}
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {students.length} students, {sessions.length} sessions, {assessments.length} coursework items
                                </p>
                            </div>
                            <div className="rounded-[20px] border border-border/60 bg-card px-4 py-3 text-sm text-muted-foreground">
                                Changes here affect weighted previews and any exports that depend on the group coursework structure.
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {loading ? (
                <div className="rounded-[28px] border border-border/70 bg-card p-12">
                    <div className="flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                </div>
            ) : (
                <CourseworkBreakdownEditor
                    groupId={groupId}
                    students={students}
                    assessments={assessments}
                    sessions={sessions}
                />
            )}
        </div>
    );
}
