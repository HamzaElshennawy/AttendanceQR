"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, ChevronRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { CourseworkAssessment, SessionCategory } from "@/lib/coursework";
import { ExamSetupEditor } from "@/components/coursework/ExamSetupEditor";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Group {
    id: string;
    name: string;
}

interface BillingSummary {
    features: {
        exams: boolean;
    };
    plan: {
        label: string;
    };
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
    const [assessment, setAssessment] = useState<CourseworkAssessment | null>(
        null,
    );
    const [loading, setLoading] = useState(true);
    const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(
        null,
    );

    const loadPage = useCallback(async () => {
        setLoading(true);
        const [groupRes, assessmentRes, billingRes] = await Promise.all([
            supabase
                .from("groups")
                .select("id, name")
                .eq("id", groupId)
                .maybeSingle(),
            supabase
                .from("coursework_assessments")
                .select(
                    "id, group_id, session_id, title, assessment_kind, max_score, category, assessment_date, created_at, session:sessions(title, category)",
                )
                .eq("group_id", groupId)
                .eq("id", assessmentId)
                .maybeSingle(),
            fetch("/api/billing/summary").then(async (response) =>
                response.ok
                    ? ((await response.json()) as BillingSummary)
                    : null,
            ),
        ]);

        setGroup((groupRes.data || null) as Group | null);
        setAssessment(
            assessmentRes.data
                ? normalizeAssessment(assessmentRes.data as AssessmentRow)
                : null,
        );
        setBillingSummary(billingRes);
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
            <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                    <Link
                        href="/dashboard"
                        className="transition-colors hover:text-primary"
                    >
                        Dashboard
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <Link
                        href={`/dashboard/groups/${groupId}`}
                        className="transition-colors hover:text-primary"
                    >
                        {group?.name || "Group"}
                    </Link>
                    <ChevronRight className="h-3.5 w-3.5" />
                    <span className="text-primary">Exam setup</span>
                </div>

                <Button
                    asChild
                    variant="ghost"
                    className="w-fit px-0 text-muted-foreground hover:text-foreground"
                >
                    <Link href={`/dashboard/groups/${groupId}`}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to group hub
                    </Link>
                </Button>
            </div>

            <section className="rounded-[30px] border border-border/80 bg-card px-6 py-6 shadow-sm md:px-8">
                <div className="flex flex-wrap items-start justify-between gap-5">
                    <div className="space-y-3">
                        <Badge
                            variant="outline"
                            className="bg-primary/6 text-primary"
                        >
                            Instructor workflow
                        </Badge>
                        <div className="space-y-2">
                            <h1 className="font-display text-4xl text-foreground">
                                Exam setup
                            </h1>
                            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                                Build the exam structure, confirm student-facing
                                rules, and review launch confidence before the
                                assessment goes live.
                            </p>
                        </div>
                    </div>
                    <div className="rounded-[22px] border border-border/80 bg-background px-4 py-4 text-sm text-muted-foreground">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                            Assessment
                        </div>
                        <div className="mt-3 font-medium text-foreground">
                            {assessment?.title || "Loading assessment"}
                        </div>
                        <p className="mt-2">
                            {group?.name || "Group"}
                            {assessment?.session?.title
                                ? ` · ${assessment.session.title}`
                                : ""}
                        </p>
                    </div>
                </div>
            </section>

            {loading ? (
                <div className="rounded-[28px] border border-border/80 bg-card p-12 shadow-sm">
                    <div className="flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                </div>
            ) : billingSummary && !billingSummary.features.exams ? (
                <div className="rounded-[28px] border border-border/80 bg-card p-8 shadow-sm">
                    <Badge
                        variant="warning"
                        className="w-fit"
                    >
                        Pro feature
                    </Badge>
                    <h2 className="mt-4 text-2xl font-semibold text-foreground">
                        Exam setup is locked on your current plan
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                        Upgrade to Pro to create and manage student exam
                        workflows. Your current plan is{" "}
                        {billingSummary.plan.label}.
                    </p>
                    <Button
                        asChild
                        className="mt-6"
                    >
                        <Link href="/dashboard/settings">
                            Open billing settings
                        </Link>
                    </Button>
                </div>
            ) : (
                <ExamSetupEditor
                    assessment={assessment}
                    onSaved={loadPage}
                />
            )}
        </div>
    );
}
