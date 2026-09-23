import { useState } from "react"
import { ArrowLeft } from "lucide-react"
import { setupApi } from "@/api/setup"
import type { ConnectionInput, Credentials } from "@/api/types"
import { Button, Code, ErrorText, Field, Input, OnboardingLayout, OnboardingTitle, Spinner, SuccessText } from "@/components/pereskia"
import { useCompleteSetup, useSetupStatus, useTestConnection } from "@/hooks/use-session"
import { errorMessage } from "@/lib/http"
import { ConnectionForm } from "./connection-form"
import { isConnectionComplete } from "./connection-info"
import { AppUrlField, EmailForm, TestEmail, emptyEmailDraft, isEmailDraftComplete, toEmailInput, type EmailDraft } from "./email-form"

type Step = "storage" | "email" | "account"

export function SetupWizard() {
    const { data: setup } = useSetupStatus()
    const [step, setStep] = useState<Step>("storage")
    const [connection, setConnection] = useState<ConnectionInput>({ provider: "sqlite", filename: setup?.defaultSqlitePath ?? "" })
    const [admin, setAdmin] = useState<Credentials>({ name: "", email: "", password: "" })
    const [workspaceName, setWorkspaceName] = useState("")
    const [email, setEmail] = useState<EmailDraft>(emptyEmailDraft)
    const [useEmail, setUseEmail] = useState(false)
    const [appUrl, setAppUrl] = useState(window.location.origin)
    const test = useTestConnection()
    const complete = useCompleteSetup()

    const runTest = async () => {
        try {
            return (await test.mutateAsync(connection)).ok
        } catch {
            return false
        }
    }

    // Email configured through environment variables needs no wizard step.
    const steps: Step[] = setup?.emailManagedByEnv ? ["storage", "account"] : ["storage", "email", "account"]
    const back = () => setStep(steps[steps.indexOf(step) - 1]!)
    const next = () => setStep(steps[steps.indexOf(step) + 1]!)

    const accountReady = admin.name.trim() && admin.email.includes("@") && admin.password.length >= 8 && workspaceName.trim()

    return (
        <OnboardingLayout aside={`Step ${steps.indexOf(step) + 1} of ${steps.length}`}>
            {step === "storage" ? (
                <>
                    <OnboardingTitle
                        title="Where should your data live?"
                        description="Pages and databases are stored in a database you control. SQLite works out of the box; pick Postgres, MySQL or Supabase to use your own server."
                    />
                    <ConnectionForm
                        value={connection}
                        onChange={(c) => {
                            setConnection(c)
                            test.reset()
                        }}
                        sqlitePlaceholder={setup?.defaultSqlitePath ?? "/var/lib/pereskia/pereskia.db"}
                    />
                    <div className="mt-4">
                        {test.isPending && (
                            <span className="flex items-center gap-2 text-sm text-(--pk-text-secondary)">
                                <Spinner /> Connecting…
                            </span>
                        )}
                        {test.data?.ok && <SuccessText>Connected · {test.data.version.split(" on ")[0]}</SuccessText>}
                        {test.data && !test.data.ok && <ErrorText>{test.data.error}</ErrorText>}
                        {test.error && <ErrorText>{errorMessage(test.error)}</ErrorText>}
                    </div>
                    <div className="mt-6 flex items-center gap-2">
                        <Button onClick={runTest} disabled={!isConnectionComplete(connection) || test.isPending}>
                            Test connection
                        </Button>
                        <div className="flex-1" />
                        <Button
                            variant="primary"
                            disabled={!isConnectionComplete(connection) || test.isPending}
                            onClick={async () => {
                                if (test.data?.ok || (await runTest())) next()
                            }}
                        >
                            Continue
                        </Button>
                    </div>
                    <p className="mt-6 text-xs text-(--pk-text-tertiary)">
                        Deploying with Docker? Set <Code>DATABASE_URL</Code> instead and this step is skipped.
                    </p>
                </>
            ) : step === "email" ? (
                <>
                    <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={back}>
                        <ArrowLeft className="size-4" /> Back
                    </Button>
                    <OnboardingTitle
                        title="Send invitations by email"
                        description="Connect Resend or any SMTP server so Pereskia can email invite links to your team. Optional: without it, you copy and share the links yourself. You can change this later in Settings → Email."
                    />
                    <div className="flex flex-col gap-4">
                        <EmailForm value={email} onChange={setEmail} />
                        <AppUrlField value={appUrl} onChange={setAppUrl} />
                        <TestEmail
                            disabled={!isEmailDraftComplete(email)}
                            send={(to) => setupApi.testEmail(toEmailInput(email), to)}
                        />
                    </div>
                    <div className="mt-6 flex items-center gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setUseEmail(false)
                                next()
                            }}
                        >
                            Skip for now
                        </Button>
                        <div className="flex-1" />
                        <Button
                            variant="primary"
                            disabled={!isEmailDraftComplete(email)}
                            onClick={() => {
                                setUseEmail(true)
                                next()
                            }}
                        >
                            Continue
                        </Button>
                    </div>
                    <p className="mt-6 text-xs text-(--pk-text-tertiary)">
                        Deploying with Docker? Set <Code>RESEND_API_KEY</Code> or <Code>SMTP_URL</Code> instead and this step is skipped.
                    </p>
                </>
            ) : (
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        if (accountReady)
                            complete.mutate({ connection, workspaceName, admin, email: useEmail ? toEmailInput(email) : null, appUrl })
                    }}
                >
                    <Button variant="ghost" size="sm" className="mb-4 -ml-2" onClick={back}>
                        <ArrowLeft className="size-4" /> Back
                    </Button>
                    <OnboardingTitle
                        title="Create your admin account"
                        description="You'll own the first workspace and can invite your team from Settings → Members."
                    />
                    <div className="flex flex-col gap-3">
                        <Field label="Your name">
                            <Input autoFocus value={admin.name} onChange={(e) => setAdmin({ ...admin, name: e.target.value })} autoComplete="name" />
                        </Field>
                        <Field label="Email">
                            <Input
                                type="email"
                                value={admin.email}
                                onChange={(e) => setAdmin({ ...admin, email: e.target.value })}
                                autoComplete="email"
                            />
                        </Field>
                        <Field label="Password" hint="At least 8 characters.">
                            <Input
                                type="password"
                                value={admin.password}
                                onChange={(e) => setAdmin({ ...admin, password: e.target.value })}
                                autoComplete="new-password"
                            />
                        </Field>
                        <Field label="Workspace name">
                            <Input value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="Acme Inc." />
                        </Field>
                    </div>
                    {complete.error && <ErrorText className="mt-4">{errorMessage(complete.error)}</ErrorText>}
                    <Button type="submit" variant="primary" className="mt-6 w-full" disabled={!accountReady || complete.isPending}>
                        {complete.isPending && <Spinner />}
                        Create workspace
                    </Button>
                </form>
            )}
        </OnboardingLayout>
    )
}
