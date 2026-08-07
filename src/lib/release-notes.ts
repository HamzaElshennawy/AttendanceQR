export interface ReleaseNote {
    version: string;
    date: string;
    tag: string;
    title: string;
    notes: string[];
}

export const releaseNotes: ReleaseNote[] = [
    {
        version: "v0.9.0",
        date: "May 20, 2026",
        tag: "Latest",
        title: "Weekly Sessions And Professor Workflow Upgrades",
        notes: [
            "Groups now include a weekly session configuration area where professors can save recurring lecture and tutorial templates by weekday, start time, duration, QR behavior, and location radius.",
            "Weekly session templates can be enabled, disabled, edited, deleted, and used to prefill the normal live session start flow.",
            "Session starts are faster with quick Lecture and Tutorial actions, remembered group defaults, and explicit session type selection.",
            "The live session page now includes a searchable roster with attendance status and a manual Mark Present action for cases where QR check-in fails during class.",
            "Completed sessions now open with a post-session Review tab that highlights attendance rate, absent students, manual overrides, late/excused records, violations, and export actions.",
            "Group workspaces now show attendance insights, recent session trends, and low-attendance students who may need follow-up.",
            "Student imports now preview ready, missing, duplicate, and already-enrolled rows before import, while bulk student removal is available from the roster.",
        ],
    },
    {
        version: "v0.8.2",
        date: "May 6, 2026",
        tag: "Security",
        title: "Layered Device Fingerprinting for Attendance Integrity",
        notes: [
            "Device duplicate detection now uses two layers: a persistent device UUID stored in the browser for hard blocks, and a hardware-derived FingerprintJS signal for soft warnings.",
            "Hard violations (same UUID, different student) block check-in and are highlighted in red on the session dashboard and Excel export with the matched UUID shown.",
            "Soft violations (same fingerprint, different student) allow check-in but flag a warning in amber for professor review with the matched fingerprint shown.",
            "The violations tab now distinguishes between 'Duplicate Device' (hard, red) and 'Similar Device' (soft, amber) badges with full identifier details.",
            "Excel attendance exports now use red highlighting for confirmed duplicate devices and yellow highlighting for possible device similarity, with the relevant identifier included in the status column.",
            "Exam device-lock detection was also upgraded to the same layered approach, with hard blocks on UUID mismatch and soft logging on fingerprint mismatch.",
        ],
    },
    {
        version: "v0.8.1",
        date: "April 29, 2026",
        tag: "Fixes",
        title: "Subscription and Session Reliability Updates",
        notes: [
            "Fixed an issue where static QR sessions would expire prematurely by ensuring they consistently receive a 1-hour expiration and remain active via background polling.",
            "Resolved a subscription synchronization bug that caused successful payments to not reflect on the user's account.",
        ],
    },
    {
        version: "v0.8.0",
        date: "April 1, 2026",
        tag: "Fixes",
        title: "Quorum Academic UX And Product Surface Redesign",
        notes: [
            "The dashboard shell, sidebar, search, and shared UI primitives were redesigned around the Quorum Academic system for a calmer and more consistent workspace.",
            "Group, session, live attendance, student detail, coursework, grading, exam, settings, feedback, and admin screens were updated to match the new product direction without adding unsupported workflows.",
            "Student, session, and coursework flows now use clearer breadcrumbs, stronger section hierarchy, improved dialogs, and more consistent table and tab behavior across the app.",
            "The live QR session screen now includes a cleaner light-theme command view and a dedicated full-screen projection mode for classroom display.",
            "Login, register, landing, pricing, and package comparison pages were redesigned so the public-facing experience matches the product system more closely.",
            "Release notes now use a richer update-log layout with summary metrics and structured release entries for easier product review.",
        ],
    },
    {
        version: "v0.7.0",
        date: "March 26, 2026",
        tag: "Coursework",
        title: "LMS Coursework, Imports, And Search",
        notes: [
            "Groups now support a separate LMS-style coursework area for quizzes, assignments, worksheets, midterms, practicals, participation, and final exams.",
            "Coursework can be managed independently from attendance, with per-assessment grade entry, editing, and spreadsheet import.",
            "Doctors and TAs can now upload Excel or CSV files for students, coursework grades, and past attendance imports.",
            "Historical attendance import now supports one uploaded file with multiple session mappings, each with its own title, date, type, and spreadsheet column.",
            "The dashboard now includes student search inside groups plus a site-wide search across groups, students, sessions, and coursework.",
            "System popups were replaced with in-app dialogs so alerts and confirmations match the rest of the UI.",
            "Coursework can now be exported to Excel, with an option to include cumulative attendance grades in the final sheet.",
        ],
    },
    {
        version: "v0.6.0",
        date: "March 25, 2026",
        tag: "Grading",
        title: "Editable Grading Policies",
        notes: [
            "Each group can now define its own grading values for present, late, excused, and absent attendance.",
            "Professors and TAs can update those grading rules from the Settings page.",
            "Late arrivals can now be assigned automatically after a configurable number of minutes from session start.",
            "Attendance exports now use each group's saved grading policy instead of fixed values.",
            "The grading rules UI is now shown as a vertical rule table for easier editing.",
            "Password changes now open in a dialog instead of taking space on the main settings page.",
        ],
    },
    {
        version: "v0.5.0",
        date: "March 25, 2026",
        tag: "Attendance",
        title: "Lecture And Tutorial Sessions",
        notes: [
            "Sessions are now automatically classified by who starts them.",
            "When a professor or owner starts a session, it is saved as a lecture.",
            "When a TA starts a session, it is saved as a tutorial.",
            "Session lists, live session screens, student history, and exported cumulative attendance now show whether each session was a lecture or tutorial.",
            "Attendance reporting now keeps lecture and tutorial performance separated, so professors can review each track independently.",
            "Professors can now mark a student as late, and late attendance counts as 0.5 grade by default.",
        ],
    },
    {
        version: "v0.4.0",
        date: "March 25, 2026",
        tag: "Feedback",
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
