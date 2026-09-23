import { Elysia, t } from "elysia"
import { ConnectionInput, testConnection } from "../connection"
import { defaultSqlitePath, storageFromEnv, updateConfig } from "../config"
import { EmailInput, emailManagedByEnv, resolveEmailInput, saveEmailSettings, sendTestEmail } from "../mailer"
import { connectStorage, ensureSqliteDir, isConfigured, storage } from "../storage"
import { HttpError, countUsers, createSession, setSessionCookie } from "../auth"
import { createWorkspace } from "./workspaces"
import { createPage } from "./pages"
import { Credentials, createUser, signupOpen } from "./auth"

const assertNotConfigured = () => {
    if (isConfigured()) throw new HttpError(409, "Setup has already been completed.")
}

export const setupRoutes = new Elysia({ prefix: "/api/setup" })
    .get("/status", async () => ({
        configured: isConfigured(),
        provider: isConfigured() ? storage().provider : null,
        managedByEnv: storageFromEnv() !== null,
        defaultSqlitePath: defaultSqlitePath(),
        hasUsers: isConfigured() ? (await countUsers()) > 0 : false,
        signupOpen: signupOpen(),
        emailManagedByEnv: emailManagedByEnv(),
    }))
    .post(
        "/test",
        async ({ body }) => {
            assertNotConfigured()
            await ensureSqliteDir(body)
            return testConnection(body)
        },
        { body: ConnectionInput },
    )
    .post(
        "/email/test",
        async ({ body }) => {
            assertNotConfigured()
            await sendTestEmail(resolveEmailInput(body.email), body.to)
            return { ok: true }
        },
        { body: t.Object({ email: EmailInput, to: t.String({ format: "email", maxLength: 320 }) }) },
    )
    .post(
        "/",
        async ({ body, cookie, request }) => {
            assertNotConfigured()
            await ensureSqliteDir(body.connection)
            const test = await testConnection(body.connection)
            if (!test.ok) throw new HttpError(400, test.error)
            const email = body.email && !emailManagedByEnv() ? resolveEmailInput(body.email) : null

            await connectStorage(body.connection)
            await updateConfig({ storage: body.connection, configuredAt: Date.now() })
            await saveEmailSettings({ email, appUrl: body.appUrl })

            const user = await createUser(body.admin)
            const workspace = await createWorkspace({ name: body.workspaceName.trim() || "My workspace", ownerId: user.id })
            await createPage({
                workspaceId: workspace.id,
                kind: "document",
                title: "Getting started",
                icon: "👋",
                content: [
                    { id: crypto.randomUUID(), type: "paragraph", content: "Welcome to your self-hosted workspace." },
                    { id: crypto.randomUUID(), type: "paragraph", content: "Type '/' for commands, or add a database with /database." },
                    { id: crypto.randomUUID(), type: "paragraph", content: "Invite your team from Settings → Members." },
                ],
            })
            setSessionCookie(cookie, await createSession(user.id), request)
            return { workspace, user }
        },
        {
            body: t.Object({
                connection: ConnectionInput,
                workspaceName: t.String(),
                admin: t.Object(Credentials),
                email: t.Optional(t.Nullable(EmailInput)),
                appUrl: t.Optional(t.String({ maxLength: 500 })),
            }),
        },
    )
