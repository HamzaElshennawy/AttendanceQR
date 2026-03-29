"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CourseworkAssessment, SessionCategory } from "@/lib/coursework";
import { ExamSetupEditor } from "@/components/coursework/ExamSetupEditor";
import { Button } from "@/components/ui/button";

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

export default function ExamSetupPage() {
    const params = useParams();
    const groupId = params.groupId as string;
    const assessmentId = params.assessmentId as string;
    const supabase = createClient();
    const [group, setGroup] = useState<Group | null>(null);
    const [assessment, setAssessment] = useState<CourseworkAssessment | null>(null);
    const [loading, setLoading] = useState(true);

    const loadPage = useCallback(async () => {
        setLoading(true);
        const [groupRes, assessmentRes] = await Promise.all([
            supabase.from("groups").select("id, name").eq("id", groupId).maybeSingle(),
            supabase
                .from("coursework_assessments")
                .select(
                    "id, group_id, session_id, title, assessment_kind, max_score, category, assessment_date, created_at, session:sessions(title, category)",
                )
                .eq("group_id", groupId)
                .eq("id", assessmentId)
                .maybeSingle(),
        ]);

        setGroup((groupRes.data || null) as Group | null);
        setAssessment(
            assessmentRes.data
                ? normalizeAssessment(assessmentRes.data as AssessmentRow)
                : null,
        );
        setLoading(false);
    }, [assessmentId, groupId, supabase]);

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
                    <h1 className="text-2xl font-semibold text-gray-900">Exam Setup</h1>
                    <p className="text-sm text-gray-500">
                        {assessment
                            ? `${group?.name || "Group"} · ${assessment.title}`
                            : group
                              ? `${group.name} assessment exam builder`
                              : "Assessment exam builder"}
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
                <ExamSetupEditor assessment={assessment} onSaved={loadPage} />
            )}
        </div>
    );
}
