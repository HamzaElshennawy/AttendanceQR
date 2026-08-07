"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
    Bell,
    ChevronsUpDown,
    FilePenLine,
    FileText,
    LayoutDashboard,
    LogOut,
    Menu,
    Settings,
    ShieldCheck,
} from "lucide-react";
import { QuorumIcon } from "@/components/QuorumLogo";
import { DashboardSearch } from "@/components/DashboardSearch";
import { FeedbackPrompt } from "@/components/FeedbackPrompt";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [professorName, setProfessorName] = useState("");
    const [isAdmin, setIsAdmin] = useState(false);
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
                const [{ data: professor }, { data: adminRow }] =
                    await Promise.all([
                        supabase
                            .from("professors")
                            .select("name")
                            .eq("id", user.id)
                            .single(),
                        supabase
                            .from("system_admins")
                            .select("user_id")
                            .eq("user_id", user.id)
                            .maybeSingle(),
                    ]);
                if (professor) {
                    setProfessorName(professor.name);
                }
                setIsAdmin(!!adminRow?.user_id);
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

    const bottomNavItems = [
        {
            href: "/dashboard/feedback",
            label: "Feedback",
            icon: FilePenLine,
        },
        {
            href: "/dashboard/release-notes",
            label: "Release Notes",
            icon: FileText,
        },
        ...(isAdmin
            ? [
                  {
                      href: "/dashboard/admin/feedback",
                      label: "Admin Feedback",
                      icon: ShieldCheck,
                  },
              ]
            : []),
        { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ];

    const isActive = (href: string) => {
        if (href === "/dashboard") {
            return pathname === "/dashboard";
        }

        return pathname === href || pathname.startsWith(href + "/");
    };

    const renderNavLink = (
        href: string,
        label: string,
        Icon: typeof LayoutDashboard,
        activeStyle: string,
        inactiveStyle: string,
    ) => (
        <Link
            key={href}
            href={href}
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all ${isActive(href) ? activeStyle : inactiveStyle}`}
        >
            <Icon className="h-5 w-5" />
            {label}
        </Link>
    );

    const renderNavContent = () => (
        <div className="flex h-full flex-col">
            <div className="border-b border-sidebar-border/70 p-6">
                <Link href="/dashboard" className="flex items-center gap-3">
                    <div className="rounded-xl border border-sidebar-border bg-background/80 p-2 text-primary shadow-[inset_0_1px_0_rgb(255_255_255_/_0.9)]">
                        <QuorumIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="font-display text-xl font-semibold tracking-[-0.04em] text-sidebar-foreground">
                            Quorum
                        </div>
                        <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.12em] text-sidebar-foreground/55">
                            Academic Operations
                        </p>
                    </div>
                </Link>
            </div>

            <nav className="flex-1 space-y-6 p-4">
                <div>
                    <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/50">
                        Workspace
                    </p>
                    <div className="space-y-1.5">
                        {navItems.map((item) =>
                            renderNavLink(
                                item.href,
                                item.label,
                                item.icon,
                                "bg-primary/14 text-primary shadow-[inset_0_0_0_1px_rgb(67_56_202_/_0.14)]",
                                "text-sidebar-foreground/72 hover:bg-primary/10 hover:text-primary",
                            ),
                        )}
                    </div>
                </div>

                <div>
                    <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/50">
                        System
                    </p>
                    <div className="space-y-1.5">
                        {bottomNavItems.map((item) =>
                            renderNavLink(
                                item.href,
                                item.label,
                                item.icon,
                                "bg-primary/14 text-primary shadow-[inset_0_0_0_1px_rgb(67_56_202_/_0.14)]",
                                "text-sidebar-foreground/68 hover:bg-primary/10 hover:text-primary",
                            ),
                        )}
                    </div>
                </div>
            </nav>

            <div className="border-t border-sidebar-border/70 p-4">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className="flex w-full items-center gap-3 rounded-2xl border border-sidebar-border bg-background/88 p-3 text-left shadow-[inset_0_1px_0_rgb(255_255_255_/_0.9)] transition-colors hover:bg-background focus-visible:border-primary/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20"
                        >
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
                                <span className="text-sm font-semibold">
                                    {professorName?.charAt(0)?.toUpperCase() || "P"}
                                </span>
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-sidebar-foreground">
                                    {professorName || "Professor"}
                                </p>
                                <p className="truncate text-xs text-sidebar-foreground/55">
                                    Teaching workspace
                                </p>
                            </div>
                            <ChevronsUpDown className="h-4 w-4 text-sidebar-foreground/45" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        align="end"
                        side="top"
                        className="min-w-60 rounded-2xl border-border/70 p-1.5"
                    >
                        <DropdownMenuLabel className="px-3 py-2">
                            <div className="text-sm font-semibold text-foreground">
                                {professorName || "Professor"}
                            </div>
                            <div className="mt-0.5 text-xs font-medium uppercase tracking-[0.08em] text-subtle">
                                Teaching workspace
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            variant="destructive"
                            className="rounded-xl px-3 py-2"
                            onClick={handleLogout}
                        >
                            <LogOut className="h-4 w-4" />
                            Sign Out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-transparent">
            <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-72 lg:flex-col border-r border-sidebar-border/70 bg-sidebar/96 text-sidebar-foreground backdrop-blur">
                {renderNavContent()}
            </aside>

            <div className="sticky top-0 z-40 border-b border-border/70 bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
                <div className="flex items-center gap-3">
                    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                        <SheetTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="rounded-xl"
                            >
                                <Menu className="h-5 w-5" />
                            </Button>
                        </SheetTrigger>
                        {sidebarOpen ? (
                            <SheetContent
                                side="left"
                                className="w-72 border-r-0 bg-sidebar p-0 text-sidebar-foreground"
                            >
                                {renderNavContent()}
                            </SheetContent>
                        ) : null}
                    </Sheet>
                    <Link href="/dashboard" className="flex items-center gap-3">
                        <div className="rounded-lg border border-border/70 bg-card p-1.5 text-foreground">
                            <QuorumIcon className="h-4 w-4" />
                        </div>
                        <span className="font-display text-lg font-semibold tracking-[-0.04em] text-foreground">
                            Quorum
                        </span>
                    </Link>
                </div>
            </div>

            <main className="lg:pl-72">
                <div className="sticky top-0 z-30 hidden border-b border-border/70 bg-background/88 backdrop-blur lg:block">
                    <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4 xl:px-8">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
                                Quorum Workspace
                            </p>
                            <h1 className="mt-1 text-2xl text-foreground">
                                Academic operations
                            </h1>
                        </div>
                        <div className="flex items-center gap-3">
                            <div data-onboarding="dashboard-search">
                                <DashboardSearch enableShortcut />
                            </div>
                            <Button
                                variant="outline"
                                size="icon"
                                className="rounded-xl"
                                aria-label="Notifications"
                            >
                                <Bell className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
                <div className="border-b border-border/70 bg-background/72 px-4 py-3 lg:hidden">
                    <div className="mx-auto max-w-7xl">
                        <div data-onboarding="dashboard-search">
                            <DashboardSearch />
                        </div>
                    </div>
                </div>
                <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 xl:px-10">
                    {children}
                </div>
            </main>
            <FeedbackPrompt />
        </div>
    );
}
