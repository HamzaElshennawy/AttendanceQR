"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CourseworkAssessment, SessionCategory } from "@/lib/coursework";
import { CourseworkBreakdownEditor } from "@/components/coursework/CourseworkBreakdownEditor";
import { Button } from "@/components/ui/button";

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
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <Button asChild variant="ghost" className="mb-2 px-0 text-gray-500 hover:text-gray-900">
                        <Link href={`/dashboard/groups/${groupId}`}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back To Coursework
                        </Link>
                    </Button>
                    <h1 className="text-2xl font-semibold text-gray-900">Coursework Breakdown</h1>
                    <p className="text-sm text-gray-500">
                        {group ? `${group.name} weighted grading structure` : "Weighted grading structure"}
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="rounded-lg border bg-white p-12">
                    <div className="flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
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
