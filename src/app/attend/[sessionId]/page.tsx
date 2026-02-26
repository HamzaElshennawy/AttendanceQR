"use client";

import { Suspense, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, QrCode, Loader2 } from "lucide-react";

type Status = "idle" | "loading" | "success" | "error" | "already";

function AttendForm() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;
  const token = searchParams.get("token") || "";

  const [universityId, setUniversityId] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [studentName, setStudentName] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!universityId.trim()) return;

    setStatus("loading");

    try {
      const res = await fetch("/api/attend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          university_id: universityId.trim(),
          token: token,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setStatus("success");
        setStudentName(data.student_name);
        setMessage(data.message);
      } else {
        setStatus(data.already_checked_in ? "already" : "error");
        setMessage(data.error);
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    }
  };

  // Success State
  if (status === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center shadow-lg border-0">
          <CardContent className="pt-8 pb-8">
            <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">You&apos;re checked in!</h2>
            <p className="text-gray-600 mb-1">{studentName}</p>
            <p className="text-sm text-gray-400">You can close this page now.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already Checked In State
  if (status === "already") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm text-center shadow-lg border-0">
          <CardContent className="pt-8 pb-8">
            <div className="h-20 w-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-10 w-10 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Already checked in</h2>
            <p className="text-gray-600">{message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm shadow-lg border-0">
        <CardHeader className="text-center pb-4">
          <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
            <QrCode className="h-7 w-7 text-blue-600" />
          </div>
          <CardTitle className="text-xl">
            Attendance<span className="text-blue-600">QR</span>
          </CardTitle>
          <p className="text-sm text-gray-500">Enter your university ID to check in</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="universityId">University ID</Label>
              <Input
                id="universityId"
                type="text"
                placeholder="e.g., 20210451"
                value={universityId}
                onChange={(e) => setUniversityId(e.target.value)}
                required
                autoFocus
                className="text-center text-lg tracking-wider"
              />
            </div>

            {status === "error" && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{message}</span>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={status === "loading"}
              size="lg"
            >
              {status === "loading" ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Checking in...
                </>
              ) : (
                "Check In"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AttendPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <AttendForm />
    </Suspense>
  );
}
