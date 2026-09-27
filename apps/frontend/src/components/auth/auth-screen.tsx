import { useState } from "react"
import { OnboardingLayout, OnboardingTitle, TextLink } from "@/components/pereskia"
import { useSetupStatus } from "@/hooks/use-session"
import { LoginForm, SignupForm } from "./auth-form"

type Mode = "login" | "signup"

export function AuthScreen({ initialMode }: { initialMode?: Mode } = {}) {
    const { data: setup } = useSetupStatus()
    const bootstrap = setup?.hasUsers === false
    const signupOpen = setup?.signupOpen !== false
    const [mode, setMode] = useState<Mode>(bootstrap ? "signup" : (initialMode ?? "login"))

    if (bootstrap) {
        return (
            <OnboardingLayout>
                <OnboardingTitle
                    title="Create the admin account"
                    description="This server has no accounts yet. The first account becomes the owner of every existing workspace."
                />
                <SignupForm submitLabel="Create admin account" />
            </OnboardingLayout>
        )
    }

    return (
        <OnboardingLayout>
            {mode === "login" || !signupOpen ? (
                <>
                    <OnboardingTitle title="Log in" description="Welcome back. Sign in to your workspace." />
                    <LoginForm key="login" />
                    <p className="mt-6 text-sm text-(--pk-text-secondary)">
                        {signupOpen ? (
                            <>
                                Don't have an account? <TextLink onClick={() => setMode("signup")}>Sign up</TextLink>
                            </>
                        ) : (
                            "Need access? Ask a workspace admin to send you an invite link."
                        )}
                    </p>
                </>
            ) : (
                <>
                    <OnboardingTitle title="Create an account" description="Sign up to create your own workspace or join your team's." />
                    <SignupForm key="signup" />
                    <p className="mt-6 text-sm text-(--pk-text-secondary)">
                        Already have an account? <TextLink onClick={() => setMode("login")}>Log in</TextLink>
                    </p>
                </>
            )}
        </OnboardingLayout>
    )
}
