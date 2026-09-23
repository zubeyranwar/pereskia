import { useState } from "react"
import { Button, ErrorText, Field, Input, Spinner } from "@/components/pereskia"
import { useLogin, useSignup } from "@/hooks/use-session"
import { errorMessage } from "@/lib/http"

export function LoginForm({ email: fixedEmail, onSuccess }: { email?: string; onSuccess?: () => void }) {
    const [email, setEmail] = useState(fixedEmail ?? "")
    const [password, setPassword] = useState("")
    const login = useLogin()

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
                e.preventDefault()
                login.mutate({ email, password }, { onSuccess })
            }}
        >
            <Field label="Email">
                <Input
                    type="email"
                    autoFocus={!fixedEmail}
                    value={email}
                    readOnly={!!fixedEmail}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                />
            </Field>
            <Field label="Password">
                <Input
                    type="password"
                    autoFocus={!!fixedEmail}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                />
            </Field>
            {login.error && <ErrorText>{errorMessage(login.error)}</ErrorText>}
            <Button type="submit" variant="primary" className="mt-2 w-full" disabled={!email || !password || login.isPending}>
                {login.isPending && <Spinner />}
                Continue
            </Button>
        </form>
    )
}

export function SignupForm({
    email: fixedEmail,
    inviteToken,
    submitLabel = "Create account",
    onSuccess,
}: {
    email?: string
    inviteToken?: string
    submitLabel?: string
    onSuccess?: () => void
}) {
    const [name, setName] = useState("")
    const [email, setEmail] = useState(fixedEmail ?? "")
    const [password, setPassword] = useState("")
    const signup = useSignup()
    const ready = name.trim() && email.includes("@") && password.length >= 8

    return (
        <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
                e.preventDefault()
                if (ready) signup.mutate({ name, email, password, inviteToken }, { onSuccess })
            }}
        >
            <Field label="Your name">
                <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
            <Field label="Email">
                <Input type="email" value={email} readOnly={!!fixedEmail} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </Field>
            <Field label="Password" hint="At least 8 characters.">
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </Field>
            {signup.error && <ErrorText>{errorMessage(signup.error)}</ErrorText>}
            <Button type="submit" variant="primary" className="mt-2 w-full" disabled={!ready || signup.isPending}>
                {signup.isPending && <Spinner />}
                {submitLabel}
            </Button>
        </form>
    )
}
