"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { LayoutDashboard, LogOut, Menu, QrCode } from "lucide-react";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [professorName, setProfessorName] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    const supabase = createClient();

    useEffect(() => {
        const fetchProfile = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase
                    .from("professors")
                    .select("name")
                    .eq("id", user.id)
                    .single();
                if (data) setProfessorName(data.name);
            }
        };
        fetchProfile();
    }, [supabase]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
    };

    const navItems = [
        { href: "/dashboard", label: "Groups", icon: LayoutDashboard },
    ];

    const isActive = (href: string) =>
        pathname === href || pathname.startsWith(href + "/");

    const renderNavContent = () => (
        <div className="flex flex-col h-full">
            <div className="p-6">
                <Link
                    href="/dashboard"
                    className="flex items-center gap-2"
                >
                    <div className="bg-zinc-900 p-1.5 rounded-md">
                        <QrCode className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xl font-bold text-zinc-900 tracking-tight">
                        Quorum
                    </span>
                </Link>
            </div>
            <Separator />
            <nav className="flex-1 p-4 space-y-1">
                {navItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            isActive(item.href)
                                ? "bg-blue-50 text-blue-700"
                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                        }`}
                    >
                        <item.icon className="h-5 w-5" />
                        {item.label}
                    </Link>
                ))}
            </nav>
            <Separator />
            <div className="p-4">
                <div className="flex items-center gap-3 px-3 py-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-sm font-semibold text-blue-700">
                            {professorName?.charAt(0)?.toUpperCase() || "P"}
                        </span>
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                            {professorName || "Professor"}
                        </p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    className="w-full justify-start text-gray-600 hover:text-red-600 hover:bg-red-50"
                    onClick={handleLogout}
                >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                </Button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col bg-white border-r border-gray-200">
                {renderNavContent()}
            </aside>

            {/* Mobile Header */}
            <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
                <Sheet
                    open={sidebarOpen}
                    onOpenChange={setSidebarOpen}
                >
                    <SheetTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                        >
                            <Menu className="h-5 w-5" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent
                        side="left"
                        className="p-0 w-64"
                    >
                        {renderNavContent()}
                    </SheetContent>
                </Sheet>
                <Link
                    href="/dashboard"
                    className="flex items-center gap-2"
                >
                    <div className="bg-zinc-900 p-1 rounded-sm">
                        <QrCode className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-lg font-bold text-zinc-900">
                        Quorum
                    </span>
                </Link>
            </div>

            {/* Main Content */}
            <main className="lg:pl-64">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
