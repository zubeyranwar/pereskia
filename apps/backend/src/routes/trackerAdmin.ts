import { Elysia, t } from "elysia"
import { storage } from "../storage"
import { ALL_SCOPES, createServiceToken } from "./tracker"
import { HttpError, SESSION_COOKIE, requireRole, userForSession } from "../auth"

async function requireAdmin(cookie: Record<string, any>, workspaceId: string) {
    const user = await userForSession(cookie[SESSION_COOKIE]?.value as string | undefined)
    if (!user) throw new HttpError(401, "You need to sign in.")
    await requireRole(user.id, workspaceId, "admin")
    return user
}

export const trackerAdminRoutes = new Elysia({ prefix: "/api/workspaces/:id/tracker-tokens" })
    .get("/", async ({ cookie, params }) => {
        await requireAdmin(cookie, params.id)
        const { sql } = storage()
        const rows = await sql`SELECT id, name, scopes, created_at, revoked_at FROM tracker_service_tokens
                               WHERE workspace_id = ${params.id} ORDER BY created_at`
        return rows.map((r: any) => ({
            id: r.id,
            name: r.name,
            scopes: JSON.parse(r.scopes),
            createdAt: Number(r.created_at),
            revokedAt: r.revoked_at == null ? null : Number(r.revoked_at),
        }))
    })
    .post(
        "/",
        async ({ cookie, params, body }) => {
            await requireAdmin(cookie, params.id)
            const { id, token } = await createServiceToken(body.name, params.id, ALL_SCOPES)
            return { id, token, note: "Store this token securely — it will not be shown again." }
        },
        { body: t.Object({ name: t.String({ minLength: 1, maxLength: 100 }) }) },
    )
    .delete("/:tokenId", async ({ cookie, params }) => {
        await requireAdmin(cookie, params.id)
        const { sql } = storage()
        const result = await sql`UPDATE tracker_service_tokens SET revoked_at = ${Date.now()}
                                 WHERE id = ${params.tokenId} AND workspace_id = ${params.id} AND revoked_at IS NULL`
        if (!result.count) throw new HttpError(404, "Token not found")
        // A replaced or revoked token's webhooks would keep firing at the dashboard; remove them with it.
        await sql`DELETE FROM tracker_webhooks WHERE token_id = ${params.tokenId}`
        return { revoked: true }
    })
