import { Elysia, t } from "elysia"
import { storage } from "../storage"
import { HttpError, SESSION_COOKIE, requirePageAccess, requireRole, userForSession } from "../auth"
import {
    addComment,
    applyRowChanges,
    getRow,
    loadDatabase,
    nextNumber,
    toComment,
    toHistory,
    trackerConfig,
    withTrackerProperties,
    workspacePeople,
} from "../rows"

async function requireUser(cookie: Record<string, any>) {
    const user = await userForSession(cookie[SESSION_COOKIE]?.value as string | undefined)
    if (!user) throw new HttpError(401, "You need to sign in.")
    return user
}

async function requireRowInDatabase(pageId: string, rowId: string) {
    const row = await getRow(rowId)
    if (!row || row.pageId !== pageId || row.deletedAt) throw new HttpError(404, "Row not found")
    return row
}

const Cells = t.Record(t.String(), t.Any())

export const databaseRoutes = new Elysia({ prefix: "/api/databases" })
    .post(
        "/:id/rows",
        async ({ cookie, params, body }) => {
            const user = await requireUser(cookie)
            await requirePageAccess(user.id, params.id)
            const rows = await applyRowChanges(params.id, body, { id: user.id, email: user.email })
            const tracker = await trackerConfig(params.id)
            return { rows: rows.map((r) => ({ id: r.id, ...(tracker && r.num != null ? { key: `${tracker.projectKey}-${r.num}` } : {}) })) }
        },
        {
            body: t.Object({
                upserts: t.Optional(t.Array(t.Object({ id: t.String({ maxLength: 36 }), cells: t.Optional(Cells), position: t.Optional(t.Number()) }))),
                deletes: t.Optional(t.Array(t.String())),
            }),
        },
    )
    .get("/:id/rows/:rowId", async ({ cookie, params }) => {
        const user = await requireUser(cookie)
        const workspaceId = await requirePageAccess(user.id, params.id)
        const row = await requireRowInDatabase(params.id, params.rowId)
        const { sql } = storage()
        const [people, tracker, comments, history] = await Promise.all([
            workspacePeople(workspaceId),
            trackerConfig(params.id),
            sql`SELECT * FROM row_comments WHERE row_id = ${row.id} ORDER BY created_at, id`,
            sql`SELECT * FROM row_history WHERE row_id = ${row.id} ORDER BY at, id`,
        ])
        const reporter = (row.reporterId && people.get(row.reporterId)) || null
        return {
            id: row.id,
            key: tracker && row.num != null ? `${tracker.projectKey}-${row.num}` : null,
            body: row.body ?? "",
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            startedAt: row.startedAt,
            completedAt: row.completedAt,
            reporter: reporter ? { id: reporter.id, name: reporter.name, email: reporter.email } : row.reporterEmail ? { id: null, name: null, email: row.reporterEmail } : null,
            externalRef: row.externalRef,
            comments: comments.map((c: any) => toComment(c, people)),
            history: history.map((h: any) => toHistory(h, people)),
        }
    })
    .patch(
        "/:id/rows/:rowId",
        async ({ cookie, params, body }) => {
            const user = await requireUser(cookie)
            await requirePageAccess(user.id, params.id)
            await requireRowInDatabase(params.id, params.rowId)
            await applyRowChanges(params.id, { upserts: [{ id: params.rowId, body: body.body }] }, { id: user.id, email: user.email })
            return { ok: true }
        },
        { body: t.Object({ body: t.String({ maxLength: 10_000 }) }) },
    )
    .post(
        "/:id/rows/:rowId/comments",
        async ({ cookie, params, body }) => {
            const user = await requireUser(cookie)
            await requirePageAccess(user.id, params.id)
            const row = await requireRowInDatabase(params.id, params.rowId)
            return addComment(row, body.body, { id: user.id, email: user.email })
        },
        { body: t.Object({ body: t.String({ minLength: 1, maxLength: 5000 }) }) },
    )
    .get("/:id/tracker", async ({ cookie, params }) => {
        const user = await requireUser(cookie)
        await requirePageAccess(user.id, params.id)
        const tracker = await trackerConfig(params.id)
        return { connected: !!tracker, projectKey: tracker?.projectKey ?? null }
    })
    .post(
        "/:id/tracker",
        async ({ cookie, params, body }) => {
            const user = await requireUser(cookie)
            const db = await loadDatabase(params.id)
            if (!db) throw new HttpError(404, "Database not found")
            await requireRole(user.id, db.workspaceId, "admin")
            if (await trackerConfig(params.id)) throw new HttpError(409, "This database is already connected to the tracker API.")

            const { sql } = storage()
            const schema = withTrackerProperties(db.schema)
            await sql.begin(async (tx) => {
                await tx`UPDATE pages SET content = ${JSON.stringify(schema)}, updated_at = ${Date.now()} WHERE id = ${params.id}`
                const [{ max }] = await tx`SELECT MAX(num) AS max FROM database_rows WHERE page_id = ${params.id}`
                await tx`INSERT INTO tracker_databases (page_id, workspace_id, project_key, next_num, created_at)
                         VALUES (${params.id}, ${db.workspaceId}, ${body.projectKey}, ${Number(max ?? 0) + 1}, ${Date.now()})`
                const rows = await tx`SELECT id FROM database_rows WHERE page_id = ${params.id} AND num IS NULL ORDER BY created_at, position, id`
                for (const row of rows) {
                    await tx`UPDATE database_rows SET num = ${await nextNumber(tx, params.id)} WHERE id = ${row.id}`
                }
            })
            return { connected: true, projectKey: body.projectKey }
        },
        { body: t.Object({ projectKey: t.String({ pattern: "^[A-Z][A-Z0-9]{1,9}$" }) }) },
    )
    .delete("/:id/tracker", async ({ cookie, params }) => {
        const user = await requireUser(cookie)
        const db = await loadDatabase(params.id)
        if (!db) throw new HttpError(404, "Database not found")
        await requireRole(user.id, db.workspaceId, "admin")
        const { sql } = storage()
        await sql`DELETE FROM tracker_databases WHERE page_id = ${params.id}`
        return { connected: false }
    })
