import { useState } from "react"
import type { EmailInput, EmailSummary } from "@/api/types"
import { Button, CheckboxLabel, ErrorText, Field, Input, Segmented, Spinner, SuccessText } from "@/components/pereskia"
import { errorMessage } from "@/lib/http"

export type EmailDraft = {
    provider: EmailInput["provider"]
    apiKey: string
    from: string
    host: string
    port: string
    secure: boolean
    user: string
    pass: string
}

export const emptyEmailDraft: EmailDraft = {
    provider: "resend",
    apiKey: "",
    from: "",
    host: "",
    port: "587",
    secure: false,
    user: "",
    pass: "",
}

// Secrets are never sent to the browser; the form starts blank and a blank secret keeps the saved one.
export const draftFromSummary = (summary: EmailSummary | null): EmailDraft =>
    summary
        ? {
              ...emptyEmailDraft,
              provider: summary.provider,
              from: summary.from,
              host: summary.host ?? "",
              port: String(summary.port ?? 587),
              secure: summary.secure ?? false,
              user: summary.user ?? "",
          }
        : emptyEmailDraft

export const toEmailInput = (draft: EmailDraft): EmailInput =>
    draft.provider === "resend"
        ? { provider: "resend", apiKey: draft.apiKey.trim() || undefined, from: draft.from.trim() || undefined }
        : {
              provider: "smtp",
              host: draft.host.trim(),
              port: Number(draft.port) || 587,
              secure: draft.secure,
              user: draft.user.trim() || undefined,
              pass: draft.pass || undefined,
              from: draft.from.trim() || undefined,
          }

export const isEmailDraftComplete = (draft: EmailDraft, secretSaved = false) =>
    draft.provider === "resend"
        ? !!draft.apiKey.trim() || secretSaved
        : !!draft.host.trim() && Number(draft.port) > 0 && (!!draft.from.trim() || !!draft.user.trim())

export function EmailForm({
    value,
    onChange,
    secretSaved = false,
}: {
    value: EmailDraft
    onChange: (value: EmailDraft) => void
    secretSaved?: boolean
}) {
    const set = (patch: Partial<EmailDraft>) => onChange({ ...value, ...patch })
    const keepSecret = secretSaved ? "Saved · leave blank to keep" : undefined

    return (
        <div className="flex flex-col gap-3">
            <Segmented
                value={value.provider}
                options={[
                    { value: "resend", label: "Resend" },
                    { value: "smtp", label: "SMTP" },
                ]}
                onChange={(provider) => set({ provider })}
            />

            {value.provider === "resend" ? (
                <>
                    <Field
                        label="API key"
                        hint={
                            <>
                                Create one at{" "}
                                <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" className="text-(--pk-blue) hover:underline">
                                    resend.com/api-keys
                                </a>
                                .
                            </>
                        }
                    >
                        <Input
                            type="password"
                            value={value.apiKey}
                            onChange={(e) => set({ apiKey: e.target.value })}
                            placeholder={keepSecret ?? "re_…"}
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </Field>
                    <Field
                        label="Sender"
                        hint="Use an address on a domain you verified in Resend. Left blank, Resend's test sender only delivers to your own Resend account."
                    >
                        <Input value={value.from} onChange={(e) => set({ from: e.target.value })} placeholder="Pereskia <invites@example.com>" />
                    </Field>
                </>
            ) : (
                <>
                    <div className="grid grid-cols-[1fr_96px] gap-3">
                        <Field label="Host">
                            <Input value={value.host} onChange={(e) => set({ host: e.target.value })} placeholder="smtp.example.com" spellCheck={false} />
                        </Field>
                        <Field label="Port">
                            <Input
                                type="number"
                                value={value.port}
                                onChange={(e) => {
                                    const port = e.target.value
                                    set({ port, secure: port === "465" ? true : port === "587" ? false : value.secure })
                                }}
                            />
                        </Field>
                        <Field label="Username">
                            <Input value={value.user} onChange={(e) => set({ user: e.target.value })} autoComplete="off" spellCheck={false} />
                        </Field>
                        <Field label="Password">
                            <Input
                                type="password"
                                value={value.pass}
                                onChange={(e) => set({ pass: e.target.value })}
                                placeholder={keepSecret}
                                autoComplete="new-password"
                            />
                        </Field>
                    </div>
                    <CheckboxLabel checked={value.secure} onChange={(secure) => set({ secure })}>
                        Connect with TLS (usually port 465; port 587 upgrades automatically)
                    </CheckboxLabel>
                    <Field label="Sender" hint="Defaults to the username.">
                        <Input value={value.from} onChange={(e) => set({ from: e.target.value })} placeholder="Pereskia <invites@example.com>" />
                    </Field>
                </>
            )}
        </div>
    )
}

export function AppUrlField({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
    return (
        <Field label="Public URL" hint="Where people open Pereskia. Links in emails point here.">
            <Input
                value={value}
                disabled={disabled}
                onChange={(e) => onChange(e.target.value)}
                placeholder="https://pereskia.example.com"
                spellCheck={false}
            />
        </Field>
    )
}

export function TestEmail({
    defaultTo = "",
    disabled,
    send,
}: {
    defaultTo?: string
    disabled?: boolean
    send: (to: string) => Promise<unknown>
}) {
    const [to, setTo] = useState(defaultTo)
    const [state, setState] = useState<{ status: "idle" | "sending" | "sent" } | { status: "error"; error: string }>({ status: "idle" })

    return (
        <div>
            <div className="flex items-end gap-2">
                <Field label="Send a test email to" className="flex-1">
                    <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="you@example.com" />
                </Field>
                <Button
                    disabled={disabled || !to.includes("@") || state.status === "sending"}
                    onClick={async () => {
                        setState({ status: "sending" })
                        try {
                            await send(to.trim())
                            setState({ status: "sent" })
                        } catch (err) {
                            setState({ status: "error", error: errorMessage(err) })
                        }
                    }}
                >
                    {state.status === "sending" && <Spinner />}
                    Send test
                </Button>
            </div>
            {state.status === "sent" && <SuccessText className="mt-2">Sent. Check the inbox (and the spam folder) of {to}.</SuccessText>}
            {state.status === "error" && <ErrorText className="mt-2">{state.error}</ErrorText>}
        </div>
    )
}
