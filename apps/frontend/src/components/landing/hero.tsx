import { cn } from "cn"
import { BrandMark, Button } from "@/components/pereskia"
import { WorkspaceMockup } from "./mockups"

const NAV_LINKS = [
    { label: "Features", href: "#features" },
    { label: "Self-hosting", href: "#self-hosting" },
    { label: "Teams", href: "#teams" },
]

export function LandingNav({ signupOpen, onLogin, onSignup }: { signupOpen: boolean; onLogin: () => void; onSignup: () => void }) {
    return (
        <header className="sticky top-0 z-10 border-b border-(--pk-divider) bg-(--pk-bg)/85 backdrop-blur-md">
            <nav className="mx-auto flex h-14 w-full max-w-280 items-center gap-2 px-6">
                <a href="#top" className="flex items-center gap-2.5 text-(--pk-text)">
                    <BrandMark size={22} />
                    <span className="text-[15px] font-semibold">Pereskia</span>
                </a>

                <div className="ml-6 hidden items-center gap-1 md:flex">
                    {NAV_LINKS.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            className="rounded-md px-2.5 py-1.5 text-sm text-(--pk-text-secondary) hover:bg-(--pk-hover) hover:text-(--pk-text)"
                        >
                            {link.label}
                        </a>
                    ))}
                </div>

                <div className="ml-auto flex items-center gap-2">
                    <Button variant="ghost" onClick={onLogin}>
                        Log in
                    </Button>
                    {signupOpen && (
                        <Button variant="primary" onClick={onSignup}>
                            Get started
                        </Button>
                    )}
                </div>
            </nav>
        </header>
    )
}

export function Hero({ signupOpen, onLogin, onSignup }: { signupOpen: boolean; onLogin: () => void; onSignup: () => void }) {
    return (
        <section id="top" className="mx-auto w-full max-w-280 px-6 pt-16 pb-10 sm:pt-24">
            <div className="mx-auto max-w-4xl text-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-(--pk-blue-border) bg-(--pk-blue-soft) px-3 py-1 text-xs font-medium text-(--pk-blue)">
                    Open source · self-hosted
                </span>

                <h1 className="mt-6 text-[clamp(2.5rem,6vw,4.25rem)] leading-[1.05] font-bold tracking-[-0.02em] text-balance text-(--pk-text)">
                    Your team's workspace, on your own server.
                </h1>

                <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-pretty text-(--pk-text-secondary) sm:text-[19px]">
                    Pages, inline databases and everything in between — with the data sitting in a database you run.
                    No seats to buy, no vendor to trust with your notes.
                </p>

                <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
                    <Button
                        variant="primary"
                        onClick={signupOpen ? onSignup : onLogin}
                        className="h-10 px-5 text-[15px]"
                    >
                        {signupOpen ? "Start your workspace" : "Log in"}
                    </Button>
                    <a
                        href="#self-hosting"
                        className={cn(
                            "inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-(--pk-input-border) px-5",
                            "text-[15px] font-medium text-(--pk-text) hover:bg-(--pk-hover)",
                        )}
                    >
                        Self-host it
                    </a>
                </div>

                <p className="mt-4 text-xs text-(--pk-text-tertiary)">
                    SQLite, PostgreSQL, MySQL or Supabase — chosen in a three-step wizard.
                </p>
            </div>

            <div className="relative mx-auto mt-14 max-w-5xl sm:mt-20">
                {/* A soft wash behind the frame so it lifts off the page. */}
                <div
                    aria-hidden
                    className="absolute -inset-x-8 -top-8 bottom-8 rounded-[32px] bg-[radial-gradient(60%_60%_at_50%_0%,var(--pk-blue-soft),transparent)]"
                />
                <div className="relative">
                    <WorkspaceMockup />
                </div>
            </div>
        </section>
    )
}
