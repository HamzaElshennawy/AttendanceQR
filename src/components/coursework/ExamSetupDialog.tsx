"use client";

import type { CourseworkAssessment } from "@/lib/coursework";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExamSetupEditor } from "@/components/coursework/ExamSetupEditor";

export function ExamSetupDialog({
    assessment,
    open,
    onOpenChange,
    onSaved,
}: {
    assessment: CourseworkAssessment | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: () => void | Promise<void>;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] max-w-7xl overflow-y-auto border-border/80 bg-background px-0 pb-0 shadow-2xl sm:rounded-[32px]">
                <DialogHeader className="border-b border-border/70 px-6 pb-5 pt-6 sm:px-8">
                    <DialogTitle className="font-display text-3xl text-foreground">
                        {assessment ? `${assessment.title} Exam Setup` : "Exam Setup"}
                    </DialogTitle>
                </DialogHeader>
                <div className="px-6 py-6 sm:px-8">
                    <ExamSetupEditor assessment={assessment} onSaved={onSaved} />
                </div>
                <DialogFooter className="border-t border-border/70 px-6 py-5 sm:px-8">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
