import { BrandMark, Button } from "@/components/pereskia"
import { useSetupStatus } from "@/hooks/use-session"
import { useAppStore } from "@/stores/app-store"
import { FeatureSections, SelfHosting } from "./feature-sections"
import { Hero, LandingNav } from "./hero"

/*
 * Shown at "/" to visitors who aren't signed in. Both calls to action push a
 * path that App resolves to the auth screen, so the landing page never renders
 * a form of its own.
 */
export function LandingPage() {
    const navigate = useAppStore((s) => s.navigate)
    const { data: setup } = useSetupStatus()
    const signupOpen = setup?.signupOpen !== false

    const onLogin = () => navigate("/login")
    const onSignup = () => navigate("/signup")

    return (
        <div className="pk-root pk-scroller min-h-svh bg-(--pk-bg)">
            <LandingNav signupOpen={signupOpen} onLogin={onLogin} onSignup={onSignup} />
            <main>
                <Hero signupOpen={signupOpen} onLogin={onLogin} onSignup={onSignup} />
                <FeatureSections />
                <SelfHosting />
                <ClosingCta signupOpen={signupOpen} onLogin={onLogin} onSignup={onSignup} />
            </main>
            <Footer />
        </div>
    )
}

function ClosingCta({ signupOpen, onLogin, onSignup }: { signupOpen: boolean; onLogin: () => void; onSignup: () => void }) {
    return (
        <section className="mx-auto w-full max-w-280 px-6 pt-6 pb-20">
            <div className="rounded-2xl border border-(--pk-border) bg-(--pk-sidebar) px-6 py-14 text-center sm:px-16">
                <h2 className="mx-auto max-w-2xl text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.15] font-bold tracking-[-0.015em] text-balance text-(--pk-text)">
                    Move your team's pages somewhere you control.
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-[16px] text-pretty text-(--pk-text-secondary)">
                    Start on SQLite in a minute, switch to Postgres whenever you're ready.
                </p>
                <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
                    <Button
                        variant="primary"
                        onClick={signupOpen ? onSignup : onLogin}
                        className="h-10 px-5 text-[15px]"
                    >
                        {signupOpen ? "Create your workspace" : "Log in"}
                    </Button>
                </div>
                {!signupOpen && (
                    <p className="mt-4 text-xs text-(--pk-text-tertiary)">
                        Sign-ups are invite-only on this server. Ask an admin for an invitation.
                    </p>
                )}
            </div>
        </section>
    )
}

function Footer() {
    return (
        <footer className="border-t border-(--pk-divider)">
            <div className="mx-auto flex w-full max-w-280 flex-wrap items-center gap-4 px-6 py-8">
                <span className="flex items-center gap-2.5 text-(--pk-text)">
                    <BrandMark size={18} />
                    <span className="text-[13px] font-semibold">Pereskia</span>
                </span>
                <span className="text-[13px] text-(--pk-text-tertiary)">Self-hosted team workspace.</span>
                <a
                    href="https://github.com/zubeyranwar/pereskia"
                    className="ml-auto text-[13px] text-(--pk-text-secondary) hover:text-(--pk-text)"
                >
                    GitHub
                </a>
            </div>
        </footer>
    )
}
