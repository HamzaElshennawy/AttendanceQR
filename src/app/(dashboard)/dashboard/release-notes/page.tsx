import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { releaseNotes } from "@/lib/release-notes";

export default function ReleaseNotesPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">
                    Release Notes
                </h1>
                <p className="text-gray-500 mt-1">
                    A running history of what changed in Quorum.
                </p>
            </div>

            <div className="space-y-4">
                {releaseNotes.map((release) => (
                    <Card key={release.version}>
                        <CardHeader className="pb-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <CardTitle className="text-lg">
                                            {release.version}
                                        </CardTitle>
                                        <Badge
                                            variant="outline"
                                            className={
                                                release.tag === "Latest"
                                                    ? "border-emerald-200 text-emerald-700"
                                                    : "border-blue-200 text-blue-700"
                                            }
                                        >
                                            {release.tag}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {release.date}
                                    </p>
                                </div>
                                <p className="text-sm font-medium text-gray-700">
                                    {release.title}
                                </p>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <ul className="space-y-2 text-sm text-gray-600">
                                {release.notes.map((note) => (
                                    <li
                                        key={note}
                                        className="flex items-start gap-3"
                                    >
                                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                                        <span>{note}</span>
                                    </li>
                                ))}
                            </ul>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
