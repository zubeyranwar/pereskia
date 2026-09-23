import { useState } from "react"
import type { EmailSettings } from "@/api/types"
import { Button, Code, DialogSection, ErrorText, Spinner, StatusDot, SuccessText } from "@/components/pereskia"
import { AppUrlField, EmailForm, TestEmail, draftFromSummary, isEmailDraftComplete, toEmailInput } from "@/components/setup/email-form"
import { useEmailSettings, useSaveEmailSettings, useSendTestEmail } from "@/hooks/use-email-settings"
import { useMe } from "@/hooks/use-session"
import { errorMessage } from "@/lib/http"

export function EmailPanel() {
    const { data: settings, error } = useEmailSettings()
    if (error) return <ErrorText>{errorMessage(error)}</ErrorText>
    if (!settings) return <Spinner />
    // Keyed so the form resets to the saved values after each save.
    return <EmailSettingsForm key={JSON.stringify(settings)} settings={settings} />
}

function EmailSettingsForm({ settings }: { settings: EmailSettings }) {
    const { data: me } = useMe()
    const save = useSaveEmailSettings()
    const test = useSendTestEmail()
    const [draft, setDraft] = useState(() => draftFromSummary(settings.config))
    const [appUrl, setAppUrl] = useState(settings.appUrl ?? window.location.origin)
    const secretSaved = !!settings.config?.hasSecret && settings.config.provider === draft.provider
    const complete = isEmailDraftComplete(draft, secretSaved)
    const config = settings.config

    return (
        <>
            <DialogSection title="Email" className="mb-8">
                <p className="mb-4 text-sm text-(--pk-text-secondary)">
                    Used to send invitations for every workspace on this server. Without it, admins copy and share invite links themselves.
                </p>
                {config ? (
                    <div className="mb-4 flex items-center gap-2 text-sm">
                        <span className="flex items-center gap-1.5 text-(--pk-green)">
                            <StatusDot /> Sending
                        </span>
                        <span className="text-(--pk-text-secondary)">
                            via {config.provider === "resend" ? "Resend" : `SMTP (${config.host})`} as {config.from}
                        </span>
                    </div>
                ) : (
                    <div className="mb-4 text-sm text-(--pk-text-tertiary)">Not set up</div>
                )}

                {settings.managedByEnv ? (
                    <p className="text-xs text-(--pk-text-tertiary)">
                        Configured by environment variables (<Code>RESEND_API_KEY</Code> or <Code>SMTP_*</Code>, <Code>MAIL_FROM</Code>). Change them
                        on the server and restart.
                    </p>
                ) : (
                    <EmailForm value={draft} onChange={setDraft} secretSaved={secretSaved} />
                )}
            </DialogSection>

            <DialogSection title="Links" className="mb-8">
                <AppUrlField value={appUrl} onChange={setAppUrl} disabled={settings.appUrlFromEnv} />
                {settings.appUrlFromEnv && (
                    <p className="mt-2 text-xs text-(--pk-text-tertiary)">
                        Set by the <Code>APP_URL</Code> environment variable.
                    </p>
                )}
            </DialogSection>

            {!settings.managedByEnv && (
                <DialogSection title="Test" className="mb-8">
                    <TestEmail
                        defaultTo={me?.email}
                        disabled={!complete}
                        send={(to) => test.mutateAsync({ email: toEmailInput(draft), to })}
                    />
                </DialogSection>
            )}

            {save.error && <ErrorText className="mb-3">{errorMessage(save.error)}</ErrorText>}
            {save.isSuccess && <SuccessText className="mb-3">Saved.</SuccessText>}
            <div className="flex items-center gap-2">
                <Button
                    variant="primary"
                    disabled={save.isPending || (!settings.managedByEnv && !complete)}
                    onClick={() => save.mutate({ email: settings.managedByEnv ? null : toEmailInput(draft), appUrl })}
                >
                    {save.isPending && <Spinner />}
                    Save
                </Button>
                {config && !settings.managedByEnv && (
                    <Button variant="ghost" disabled={save.isPending} onClick={() => save.mutate({ email: null, appUrl })}>
                        Turn off email
                    </Button>
                )}
            </div>
        </>
    )
}
