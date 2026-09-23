import { Elysia, t } from "elysia"
import { HttpError, authPlugin, isInstanceAdmin } from "../auth"
import {
    EmailInput,
    appUrlFromEnv,
    configuredAppUrl,
    describeEmail,
    emailManagedByEnv,
    resolveEmailInput,
    saveEmailSettings,
    sendTestEmail,
} from "../mailer"

async function requireInstanceAdmin(userId: string) {
    if (!(await isInstanceAdmin(userId))) throw new HttpError(403, "Only the server owner can change email settings.")
}

export const instanceRoutes = new Elysia({ prefix: "/api/instance" })
    .use(authPlugin)
    .get(
        "/email",
        async ({ user }) => {
            await requireInstanceAdmin(user.id)
            return {
                config: describeEmail(),
                managedByEnv: emailManagedByEnv(),
                appUrl: configuredAppUrl() ?? null,
                appUrlFromEnv: appUrlFromEnv(),
            }
        },
        { auth: true },
    )
    .put(
        "/email",
        async ({ body, user }) => {
            await requireInstanceAdmin(user.id)
            if (emailManagedByEnv() && body.email) throw new HttpError(409, "Email is configured by environment variables on the server.")
            await saveEmailSettings({ email: body.email ? resolveEmailInput(body.email) : null, appUrl: body.appUrl })
            return { ok: true }
        },
        { auth: true, body: t.Object({ email: t.Nullable(EmailInput), appUrl: t.Optional(t.String({ maxLength: 500 })) }) },
    )
    .post(
        "/email/test",
        async ({ body, user }) => {
            await requireInstanceAdmin(user.id)
            await sendTestEmail(resolveEmailInput(body.email), body.to)
            return { ok: true }
        },
        { auth: true, body: t.Object({ email: EmailInput, to: t.String({ format: "email", maxLength: 320 }) }) },
    )
