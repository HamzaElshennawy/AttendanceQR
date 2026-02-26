import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QrCode, Users, ClipboardList, Download, Shield, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <QrCode className="h-7 w-7 text-blue-600" />
            <span className="text-xl font-bold text-gray-900 tracking-tight">
              Attendance<span className="text-blue-600">QR</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32 text-center">
        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
          <Zap className="h-4 w-4" />
          Smart attendance for modern classrooms
        </div>
        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 tracking-tight mb-6 leading-tight">
          Take attendance in
          <br />
          <span className="text-blue-600">seconds, not minutes</span>
        </h1>
        <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-10">
          Display a rotating QR code on your projector, students scan and check in
          from their phones. No apps, no paper, no hassle.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/register">
            <Button size="lg" className="px-8 text-base">
              Start for Free
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="outline" size="lg" className="px-8 text-base">
              Sign In
            </Button>
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            How it works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Users,
                title: "1. Create your class",
                desc: "Set up a group and import your student roster from any CSV file. Just map the columns — it works with any format.",
              },
              {
                icon: QrCode,
                title: "2. Start a session",
                desc: "Hit 'Start Session' and display the rotating QR code on your projector. It refreshes every 8 seconds to prevent sharing.",
              },
              {
                icon: Download,
                title: "3. Download attendance",
                desc: "After the session, view who attended and download a clean CSV report with all your students marked as present or absent.",
              },
            ].map((step, i) => (
              <div
                key={i}
                className="bg-white rounded-xl p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center mb-5">
                  <step.icon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Built for professors
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Shield,
                title: "Anti-cheating",
                desc: "Rotating QR codes every 8 seconds prevent students from sharing screenshots.",
              },
              {
                icon: ClipboardList,
                title: "Smart CSV Import",
                desc: "Upload any student list CSV — just pick which columns are the name and ID.",
              },
              {
                icon: Zap,
                title: "Auto-expire sessions",
                desc: "Set a duration and the session closes automatically. No more forgetting to stop.",
              },
              {
                icon: Users,
                title: "Multiple groups",
                desc: "Manage as many classes as you need, each with its own student roster.",
              },
              {
                icon: Download,
                title: "One-click reports",
                desc: "Download attendance as CSV: name, ID, present (1) or absent (0).",
              },
              {
                icon: QrCode,
                title: "No app needed",
                desc: "Students just scan the QR code with their phone camera. No downloads required.",
              },
            ].map((feature, i) => (
              <div key={i} className="p-6 rounded-xl border border-gray-100 hover:border-blue-100 transition-colors">
                <feature.icon className="h-5 w-5 text-blue-600 mb-3" />
                <h3 className="font-semibold text-gray-900 mb-1">{feature.title}</h3>
                <p className="text-sm text-gray-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-900 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to simplify attendance?
          </h2>
          <p className="text-gray-400 mb-8 text-lg">
            Free to use. Set up in under 2 minutes.
          </p>
          <Link href="/register">
            <Button size="lg" className="px-10 text-base">
              Get Started
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-400 text-sm">
          © {new Date().getFullYear()} AttendanceQR. Built with ❤️ for educators.
        </div>
      </footer>
    </div>
  );
}
