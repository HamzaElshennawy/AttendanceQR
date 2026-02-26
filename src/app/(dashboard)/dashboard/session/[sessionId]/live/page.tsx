"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Users, Clock, XCircle, QrCode } from "lucide-react";

export default function LiveSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;
  const supabase = createClient();

  const [token, setToken] = useState<string | null>(null);
  const [attendanceCount, setAttendanceCount] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [sessionEnded, setSessionEnded] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [groupId, setGroupId] = useState("");
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  const fetchSessionInfo = useCallback(async () => {
    const { data } = await supabase
      .from("sessions")
      .select("*, groups(name)")
      .eq("id", sessionId)
      .single();
    if (data) {
      setSessionTitle(data.title || data.groups?.name || "Session");
      setGroupId(data.group_id);
    }
  }, [supabase, sessionId]);

  const rotateToken = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/token`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.expired || !data.is_active) {
        setSessionEnded(true);
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }

      setToken(data.token);
      setAttendanceCount(data.attendance_count);
      setTotalStudents(data.total_students);
      setExpiresAt(new Date(data.expires_at));
    } catch {
      // Silent retry on next interval
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSessionInfo();
    rotateToken();

    // Rotate token every 8 seconds
    intervalRef.current = setInterval(rotateToken, 8000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchSessionInfo, rotateToken]);

  // Countdown timer
  useEffect(() => {
    const updateTimer = () => {
      if (!expiresAt) return;
      const now = new Date();
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft("00:00");
        setSessionEnded(true);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(
        `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
      );
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [expiresAt]);

  const handleEndSession = async () => {
    await supabase
      .from("sessions")
      .update({ is_active: false })
      .eq("id", sessionId);
    setSessionEnded(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const qrUrl = token ? `${appUrl}/attend/${sessionId}?token=${token}` : "";

  if (sessionEnded) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center text-white">
        <XCircle className="h-20 w-20 text-gray-400 mb-6" />
        <h1 className="text-4xl font-bold mb-2">Session Ended</h1>
        <p className="text-xl text-gray-400 mb-4">
          {attendanceCount} students checked in
        </p>
        <Button
          variant="outline"
          className="text-white border-gray-600 hover:bg-gray-800"
          onClick={() => router.push(`/dashboard/groups/${groupId}`)}
        >
          Back to Group
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center text-white p-8">
      {/* Title */}
      <h1 className="text-2xl md:text-3xl font-bold mb-2">{sessionTitle}</h1>
      <p className="text-gray-400 text-lg mb-8">Scan the QR code to check in</p>

      {/* QR Code */}
      <div className="bg-white p-6 md:p-8 rounded-2xl shadow-2xl mb-8">
        {token ? (
          <QRCodeSVG
            value={qrUrl}
            size={280}
            level="M"
            includeMargin={false}
          />
        ) : (
          <div className="w-[280px] h-[280px] flex items-center justify-center">
            <QrCode className="h-16 w-16 text-gray-300 animate-pulse" />
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-8 mb-8">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-blue-400" />
          <div>
            <p className="text-3xl font-bold">
              {attendanceCount}
              <span className="text-lg text-gray-400"> / {totalStudents}</span>
            </p>
            <p className="text-sm text-gray-500">checked in</p>
          </div>
        </div>
        <div className="w-px h-12 bg-gray-700" />
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 text-amber-400" />
          <div>
            <p className="text-3xl font-bold font-mono">{timeLeft || "--:--"}</p>
            <p className="text-sm text-gray-500">remaining</p>
          </div>
        </div>
      </div>

      {/* Rotating indicator */}
      <div className="flex items-center gap-2 text-gray-500 text-sm mb-8">
        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        QR code rotates every 8 seconds
      </div>

      {/* End Session */}
      <Button
        variant="destructive"
        size="lg"
        onClick={handleEndSession}
        className="px-8"
      >
        End Session
      </Button>
    </div>
  );
}
