
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { ArrowRight, Check, ChevronRight, Mail, ShieldCheck } from "lucide-react";
import { QuorumIcon } from "@/components/QuorumLogo";

const plans = [
    {
        name: "Starter",
        price: "$29",
        cadence: "/month",
        audience: "Individual instructor or single pilot section",
        summary: "A fast way to run QR attendance and basic coursework without a heavy rollout.",
        cta: "Start free",
        href: "/register",
        features: [
            "1 active teaching workspace",
            "QR attendance sessions",
            "Coursework items and grade entry",
            "CSV or spreadsheet imports",
            "Basic exports",
        ],
    },
    {
        name: "Department",
        price: "$199",
        cadence: "/month",
        audience: "Department teams coordinating multiple courses and TAs",
        summary: "The best balance for shared academic operations, exam setup, and clearer reporting.",
        cta: "Book a demo",
        href: "mailto:sales@quorum.app",
        featured: true,
        features: [
            "Multiple groups and staff roles",
            "Exam setup and student exam flow",
            "Weighted coursework breakdowns",
            "Attendance and coursework exports",
            "Priority support",
        ],
    },
    {
        name: "Faculty",
        price: "Custom",
        cadence: "annual",
        audience: "Faculty-wide deployments with governance and rollout planning",
        summary: "For broader adoption, implementation planning, and operational consistency across academic units.",
        cta: "Talk to sales",
        href: "mailto:sales@quorum.app",
        features: [
            "Rollout planning",
            "Shared implementation support",
            "Expanded reporting consultation",
            "Admin coordination workflows",
            "Procurement-ready engagement",
        ],
    },
    {
        name: "Enterprise",
        price: "Custom",
        cadence: "annual",
        audience: "Institution-led deployment across departments or campuses",
        summary: "For institutions that need contractual, security, and onboarding alignment before launch.",
        cta: "Contact sales",
        href: "mailto:sales@quorum.app",
        features: [
            "Institutional onboarding",
            "Procurement and security review support",
            "Higher-touch rollout coordination",
            "Operational design partnership",
            "Commercial packaging flexibility",
        ],
    },
];

const comparisonRows = [
    ["QR attendance sessions", "Yes", "Yes", "Yes", "Yes"],
    ["Coursework and grade entry", "Yes", "Yes", "Yes", "Yes"],
    ["Exam management", "-", "Yes", "Yes", "Yes"],
    ["Team roles and collaboration", "-", "Yes", "Yes", "Yes"],
    ["Weighted grading structures", "-", "Yes", "Yes", "Yes"],
    ["Procurement and rollout support", "-", "Limited", "Yes", "Yes"],
    ["Commercial flexibility", "-", "-", "Some", "Yes"],
];

export default async function PricingPage() {
    const supabase = await createClient();
    const {
        data: { session },
    } = await supabase.auth.getSession();

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
                <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6">
                    <Link href="/" className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-card text-primary shadow-sm">
                            <QuorumIcon className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="text-lg font-semibold tracking-tight text-foreground">Quorum</div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Academic operations</div>
                        </div>
                    </Link>
                    <div className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
                        <Link href="/" className="transition-colors hover:text-primary">Home</Link>
                        <Link href="/login" className="transition-colors hover:text-primary">Sign in</Link>
                        {session ? <Button asChild><Link href="/dashboard">Open dashboard</Link></Button> : <Button asChild><Link href="/register">Start free</Link></Button>}
                    </div>
                </div>
            </header>

            <main>
                <section className="border-b border-border/70 bg-[radial-gradient(circle_at_top_left,rgba(205,223,255,0.48),transparent_34%),linear-gradient(180deg,rgba(253,253,255,0.98),rgba(247,250,255,0.95))]">
                    <div className="mx-auto max-w-7xl px-6 py-18 lg:py-22">
                        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                            <Link href="/" className="transition-colors hover:text-primary">Home</Link>
                            <ChevronRight className="h-3.5 w-3.5" />
                            <span className="text-primary">Pricing</span>
                        </div>
                        <Badge variant="outline" className="mt-6 bg-primary/6 text-primary">Pricing and packages</Badge>
                        <h1 className="mt-5 max-w-4xl font-display text-5xl text-foreground sm:text-6xl">Choose the package that fits your academic rollout.</h1>
                        <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">Built to support both self-serve interest and institution-led buying. The pricing structure stays simple enough for a fast evaluation while still leaving room for faculty or enterprise rollout conversations.</p>
                    </div>
                </section>
                <section className="py-18">
                    <div className="mx-auto max-w-7xl px-6">
                        <div className="mb-8 rounded-[28px] border border-border/70 bg-card/75 px-5 py-5 shadow-sm">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                                        Recommended path
                                    </div>
                                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                                        Most academic teams start with
                                        <span className="mx-1 font-semibold text-foreground">
                                            Department
                                        </span>
                                        because it covers shared staff workflows, exams, and weighted grading without jumping straight into enterprise rollout.
                                    </p>
                                </div>
                                <Badge variant="outline" className="w-fit bg-background/90">
                                    Best for multi-course teams
                                </Badge>
                            </div>
                        </div>
                        <div className="grid gap-5 xl:grid-cols-4">
                            {plans.map((plan) => (
                                <article
                                    key={plan.name}
                                    className={`rounded-[30px] border px-5 shadow-sm ${
                                        plan.featured
                                            ? "border-primary/20 bg-primary py-8 text-primary-foreground shadow-[0_34px_90px_-40px_rgba(22,47,95,0.66)] transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_40px_100px_-42px_rgba(22,47,95,0.76)]"
                                            : "mt-6 border-border/70 bg-card py-6 transition-transform duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_26px_70px_-42px_rgba(22,47,95,0.22)]"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <h2 className={`text-2xl font-semibold ${plan.featured ? "text-primary-foreground" : "text-foreground"}`}>{plan.name}</h2>
                                            <p className={`mt-2 text-sm ${plan.featured ? "text-primary-foreground/78" : "text-muted-foreground"}`}>{plan.audience}</p>
                                        </div>
                                        {plan.featured ? <Badge className="border-white/20 bg-white/10 text-primary-foreground">Recommended</Badge> : null}
                                    </div>
                                    <div className={`mt-6 text-4xl font-semibold ${plan.featured ? "text-primary-foreground" : "text-foreground"}`}>{plan.price}</div>
                                    <div className={`mt-1 text-sm ${plan.featured ? "text-primary-foreground/76" : "text-muted-foreground"}`}>{plan.cadence}</div>
                                    <p className={`mt-4 text-sm leading-7 ${plan.featured ? "text-primary-foreground/82" : "text-muted-foreground"}`}>{plan.summary}</p>
                                    <ul className="mt-6 space-y-3">
                                        {plan.features.map((feature) => (
                                            <li key={feature} className={`flex items-start gap-3 text-sm ${plan.featured ? "text-primary-foreground/84" : "text-muted-foreground"}`}>
                                                <Check className={`mt-0.5 h-4 w-4 shrink-0 ${plan.featured ? "text-primary-foreground" : "text-primary"}`} />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                    <Button asChild size="lg" variant={plan.featured ? "secondary" : "default"} className={`mt-8 w-full rounded-full ${plan.featured ? "border-white/20 bg-white/12 text-primary-foreground hover:bg-white/18" : ""}`}>
                                        {plan.href.startsWith("mailto:") ? (
                                            <a href={plan.href}>
                                                {plan.cta}
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </a>
                                        ) : (
                                            <Link href={plan.href}>
                                                {plan.cta}
                                                <ArrowRight className="ml-2 h-4 w-4" />
                                            </Link>
                                        )}
                                    </Button>
                                    {plan.featured ? <div className="h-8" aria-hidden="true" /> : null}
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="border-y border-border/70 bg-card/45 py-18">
                    <div className="mx-auto max-w-7xl px-6">
                        <div className="max-w-3xl">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Comparison</div>
                            <h2 className="mt-4 font-display text-4xl text-foreground">The differences are visible in under a minute.</h2>
                            <p className="mt-4 text-lg leading-8 text-muted-foreground">This comparison keeps the focus on scale, exams, collaboration, governance, and support instead of drowning buyers in tiny feature-checkbox noise.</p>
                        </div>
                        <div className="mt-10 overflow-hidden rounded-[30px] border border-border/70 bg-background shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="min-w-full text-sm">
                                    <thead className="bg-card/80">
                                        <tr className="border-b border-border/70">
                                            <th className="px-5 py-4 text-left font-semibold text-foreground">Capability</th>
                                            {plans.map((plan) => (
                                                <th key={plan.name} className="px-5 py-4 text-left font-semibold text-foreground">{plan.name}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {comparisonRows.map((row) => (
                                            <tr key={row[0]} className="border-b border-border/60 last:border-b-0">
                                                {row.map((cell, index) => (
                                                    <td key={`${row[0]}-${index}`} className={`px-5 py-4 ${index === 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>{cell}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="mt-6 rounded-[24px] border border-border/70 bg-background px-5 py-4 text-sm text-muted-foreground shadow-sm">
                            Use this comparison for scale and buying-path discussions. If you need implementation help, governance support, or rollout planning, move the conversation to Faculty or Enterprise.
                        </div>
                    </div>
                </section>
                <section className="py-18">
                    <div className="mx-auto max-w-7xl px-6">
                        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                            <div className="rounded-[30px] border border-border/70 bg-card px-6 py-7 shadow-sm">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">Buying path</div>
                                <h2 className="mt-4 font-display text-4xl text-foreground">Two ways to evaluate Quorum.</h2>
                                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                                    <div className="rounded-[24px] border border-border/70 bg-background px-4 py-4">
                                        <div className="text-lg font-semibold text-foreground">Self-serve interest</div>
                                        <p className="mt-2 text-sm leading-7 text-muted-foreground">Best for pilots, individual instructors, and fast experiments where teams want to move quickly.</p>
                                    </div>
                                    <div className="rounded-[24px] border border-border/70 bg-background px-4 py-4">
                                        <div className="text-lg font-semibold text-foreground">Institution-led buying</div>
                                        <p className="mt-2 text-sm leading-7 text-muted-foreground">Best for departments, faculties, and campuses that need implementation conversations, security review, and rollout planning.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-[30px] border border-border/70 bg-card px-6 py-7 shadow-sm">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                                    <ShieldCheck className="h-5 w-5" />
                                </div>
                                <h2 className="mt-5 font-display text-3xl text-foreground">Need a faculty or enterprise proposal?</h2>
                                <p className="mt-4 text-sm leading-7 text-muted-foreground">We can tailor a package around rollout support, training, governance expectations, and evaluation requirements.</p>
                                <div className="mt-6 flex flex-wrap gap-3">
                                    <Button asChild size="lg" className="rounded-full px-7">
                                        <a href="mailto:sales@quorum.app">
                                            <Mail className="mr-2 h-4 w-4" />
                                            Contact sales
                                        </a>
                                    </Button>
                                    <Button asChild size="lg" variant="outline" className="rounded-full px-7">
                                        <Link href="/">Back to home</Link>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
            </main>
        </div>
    );
}
