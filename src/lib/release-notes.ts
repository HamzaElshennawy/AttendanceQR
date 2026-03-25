export interface ReleaseNote {
    version: string;
    date: string;
    tag: string;
    title: string;
    notes: string[];
}

export const releaseNotes: ReleaseNote[] = [
    {
        version: "v0.4.0",
        date: "March 25, 2026",
        tag: "Latest",
        title: "Feedback, And Attendance Exporting",
        notes: [
            "Users can now submit structured feedback from inside the dashboard.",
            "Feedback now supports screenshots, recordings, PDFs, drag-and-drop upload, and per-file removal before submit.",
            "Groups can now export one cumulative attendance Excel file across all sessions.",
            "Professors can choose whether excused sessions count as 0 or 1 during cumulative export, while excused sessions remain visually marked.",
        ],
    },
    {
        version: "v0.3.0",
        date: "March 25, 2026",
        tag: "Workflow",
        title: "Shared Teaching And Attendance Follow-Up",
        notes: [
            "Groups can now be shared with other instructors, including TAs and co-owners.",
            "Attendance can now be corrected manually when a student had a valid issue during check-in.",
            "Students now have a history view that shows attendance patterns, excuses, and risk signals over time.",
        ],
    },
    {
        version: "v0.2.0",
        date: "February 26, 2026",
        tag: "Security",
        title: "Stronger Attendance Integrity",
        notes: [
            "Sessions gained location-aware check-in boundaries.",
            "The app started tracking suspicious device reuse and out-of-range attempts.",
            "Session reports now include flagged issues for easier review.",
        ],
    },
    {
        version: "v0.1.0",
        date: "February 26, 2026",
        tag: "Launch",
        title: "Core Attendance Workflow",
        notes: [
            "Professors can create groups, import students, and run attendance sessions.",
            "Students can scan a QR code and check in with their university ID.",
            "Completed sessions can be reviewed and exported.",
        ],
    },
];
