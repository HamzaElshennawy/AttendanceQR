import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AttendanceQR",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Attendance<span className="text-blue-600">QR</span>
          </h1>
          <p className="text-gray-500 mt-2">Smart attendance tracking for educators</p>
        </div>
        {children}
      </div>
    </div>
  );
}
