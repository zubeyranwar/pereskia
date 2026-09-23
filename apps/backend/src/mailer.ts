import nodemailer from "nodemailer"
import { t, type Static } from "elysia"
import { updateConfig, type AppConfig, type EmailConfig } from "./config"
import { HttpError } from "./auth"

// Outgoing mail is optional: without it, invitations fall back to a copyable link.
// Environment variables win over settings saved from the setup wizard or Settings → Email:
//   RESEND_API_KEY=re_...                          (Resend)
//   SMTP_URL=smtps://user:pass@smtp.example.com:465 (or SMTP_HOST/PORT/USER/PASS/SECURE)
//   MAIL_FROM="Pereskia <invites@example.com>"
//   APP_URL=https://pereskia.example.com

const RESEND_ENDPOINT = "https://api.resend.com/emails"
const RESEND_TEST_SENDER = "Pereskia <onboarding@resend.dev>"
// For SMTP servers without login, such as a local Mailpit.
const SMTP_DEFAULT_SENDER = "Pereskia <no-reply@localhost>"

let saved: Pick<AppConfig, "email" | "appUrl"> = {}

export function loadEmailConfig(config: AppConfig) {
    saved = { email: config.email, appUrl: config.appUrl }
}

function emailFromEnv(): EmailConfig | null {
    const { RESEND_API_KEY, SMTP_URL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, MAIL_FROM } = process.env
    if (RESEND_API_KEY) return { provider: "resend", apiKey: RESEND_API_KEY, from: MAIL_FROM ?? RESEND_TEST_SENDER }
    if (SMTP_URL) {
        const url = new URL(SMTP_URL)
        const secure = url.protocol === "smtps:"
        const user = decodeURIComponent(url.username) || undefined
        return {
            provider: "smtp",
            host: url.hostname,
            port: Number(url.port || (secure ? 465 : 587)),
            secure,
            user,
            pass: decodeURIComponent(url.password) || undefined,
            from: MAIL_FROM ?? user ?? SMTP_DEFAULT_SENDER,
        }
    }
    if (SMTP_HOST) {
        const port = Number(SMTP_PORT ?? 587)
        return {
            provider: "smtp",
            host: SMTP_HOST,
            port,
            secure: SMTP_SECURE ? SMTP_SECURE === "true" : port === 465,
            user: SMTP_USER,
            pass: SMTP_PASS,
            from: MAIL_FROM ?? SMTP_USER ?? SMTP_DEFAULT_SENDER,
        }
    }
    return null
}

export const emailManagedByEnv = () => emailFromEnv() !== null
const activeEmailConfig = () => emailFromEnv() ?? saved.email ?? null
export const mailEnabled = () => activeEmailConfig() !== null

export const appUrlFromEnv = () => !!process.env.APP_URL
export const configuredAppUrl = () => (process.env.APP_URL ?? saved.appUrl)?.replace(/\/+$/, "") || undefined

// What the browser may see: everything except secrets.
export function describeEmail() {
    const config = activeEmailConfig()
    if (!config) return null
    return config.provider === "resend"
        ? { provider: config.provider, from: config.from, hasSecret: !!config.apiKey }
        : { provider: config.provider, from: config.from, host: config.host, port: config.port, secure: config.secure, user: config.user, hasSecret: !!config.pass }
}

export const EmailInput = t.Union([
    t.Object({
        provider: t.Literal("resend"),
        apiKey: t.Optional(t.String({ maxLength: 500 })),
        from: t.Optional(t.String({ maxLength: 320 })),
    }),
    t.Object({
        provider: t.Literal("smtp"),
        host: t.String({ minLength: 1, maxLength: 255 }),
        port: t.Integer({ minimum: 1, maximum: 65535 }),
        secure: t.Boolean(),
        user: t.Optional(t.String({ maxLength: 320 })),
        pass: t.Optional(t.String({ maxLength: 500 })),
        from: t.Optional(t.String({ maxLength: 320 })),
    }),
])
export type EmailInput = Static<typeof EmailInput>

// Secrets are never sent back to the browser, so a blank secret means "keep the saved one".
export function resolveEmailInput(input: EmailInput): EmailConfig {
    const from = input.from?.trim() ?? ""
    if (input.provider === "resend") {
        const apiKey = input.apiKey?.trim() || (saved.email?.provider === "resend" ? saved.email.apiKey : "")
        if (!apiKey) throw new HttpError(400, "Enter your Resend API key.")
        return { provider: "resend", apiKey, from: from || RESEND_TEST_SENDER }
    }
    const user = input.user?.trim() || undefined
    const previous = saved.email?.provider === "smtp" && saved.email.host === input.host.trim() ? saved.email : null
    const pass = input.pass || (user && previous?.user === user ? previous.pass : undefined)
    if (!from && !user) throw new HttpError(400, "Enter a sender address.")
    return { provider: "smtp", host: input.host.trim(), port: input.port, secure: input.secure, user, pass, from: from || user! }
}

export async function saveEmailSettings(input: { email: EmailConfig | null; appUrl?: string }) {
    const appUrl = input.appUrl?.trim().replace(/\/+$/, "") || undefined
    await updateConfig({ email: input.email ?? undefined, appUrl })
    saved = { email: input.email ?? undefined, appUrl }
}

type Message = { to: string; subject: string; text: string; html: string }

async function sendEmail(config: EmailConfig, message: Message) {
    if (config.provider === "resend") {
        const res = await fetch(RESEND_ENDPOINT, {
            method: "POST",
            headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: config.from, ...message, to: [message.to] }),
            signal: AbortSignal.timeout(10_000),
        })
        if (!res.ok) {
            const body = (await res.json().catch(() => null)) as { message?: string } | null
            throw new Error(`Resend responded ${res.status}: ${body?.message ?? res.statusText}`)
        }
        return
    }
    const transport = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: config.user ? { user: config.user, pass: config.pass ?? "" } : undefined,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
    })
    try {
        await transport.sendMail({ from: config.from, ...message })
    } finally {
        transport.close()
    }
}

export async function sendTestEmail(config: EmailConfig, to: string) {
    try {
        await sendEmail(config, {
            to,
            subject: "Pereskia email is working",
            text: "This is a test email from your Pereskia server. Invitations will be delivered like this one.",
            html: `<p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;color:#37352f">This is a test email from your Pereskia server. Invitations will be delivered like this one.</p>`,
        })
    } catch (err) {
        throw new HttpError(400, err instanceof Error ? err.message : String(err))
    }
}

const escapeHtml = (s: string) =>
    s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

export async function sendInvitationEmail(input: {
    to: string
    inviterName: string
    workspaceName: string
    role: string
    url: string
    baseUrl: string
    expiresAt: number
}) {
    const expires = new Date(input.expiresAt).toUTCString().replace(/ \d\d:\d\d:\d\d GMT$/, "")
    const subject = `${input.inviterName} invited you to ${input.workspaceName} on Pereskia`
    const text = [
        `${input.inviterName} invited you to join the "${input.workspaceName}" workspace on Pereskia as ${input.role === "admin" ? "an admin" : "a member"}.`,
        "",
        `Accept the invitation: ${input.url}`,
        "",
        `This link works once and expires on ${expires}. If you weren't expecting it, you can ignore this email.`,
    ].join("\n")
    const html = `<!doctype html>
<html><body style="margin:0;padding:32px 16px;background:#f7f7f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#37352f">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:480px;background:#fff;border:1px solid #e9e9e7;border-radius:12px;padding:32px" cellpadding="0" cellspacing="0"><tr><td>
      <img src="${escapeHtml(input.baseUrl)}/email-logo.png" width="41" height="56" alt="Pereskia" style="display:block;margin:0 0 20px;border:0">
      <p style="margin:0 0 8px;font-size:20px;font-weight:600">Join ${escapeHtml(input.workspaceName)}</p>
      <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#5f5e5b">
        <strong style="color:#37352f">${escapeHtml(input.inviterName)}</strong> invited you to the
        <strong style="color:#37352f">${escapeHtml(input.workspaceName)}</strong> workspace as ${input.role === "admin" ? "an admin" : "a member"}.
      </p>
      <a href="${escapeHtml(input.url)}" style="display:inline-block;background:#2383e2;color:#fff;text-decoration:none;font-size:14px;font-weight:500;padding:10px 18px;border-radius:8px">Accept invitation</a>
      <p style="margin:24px 0 0;font-size:12px;line-height:1.5;color:#91918e">
        Or paste this link into your browser:<br><a href="${escapeHtml(input.url)}" style="color:#91918e;word-break:break-all">${escapeHtml(input.url)}</a><br><br>
        The link works once and expires on ${escapeHtml(expires)}. If you weren't expecting this, you can ignore this email.
      </p>
    </td></tr></table>
  </td></tr></table>
</body></html>`
    const config = activeEmailConfig()
    if (!config) throw new Error("Email is not configured.")
    await sendEmail(config, { to: input.to, subject, text, html })
}
