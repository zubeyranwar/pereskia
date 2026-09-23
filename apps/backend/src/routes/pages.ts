import { Elysia, t } from "elysia"
import { storage } from "../storage"
import { HttpError, authPlugin, requirePageAccess, requireRole } from "../auth"

export type PageKind = "document" | "database"

export type PageMeta = {
    id: string
    workspaceId: string
    parentId: string | null
    kind: PageKind
    title: string
    icon: string | null
    position: number
    updatedAt: number
}

export type Page = PageMeta & { cover: string | null; content: unknown; createdAt: number }

const toMeta = (row: any): PageMeta => ({
    id: row.id,
    workspaceId: row.workspace_id,
    parentId: row.parent_id ?? null,
    kind: row.kind,
    title: row.title,
    icon: row.icon ?? null,
    position: Number(row.position),
    updatedAt: Number(row.updated_at),
})

const toPage = (row: any): Page => ({
    ...toMeta(row),
    cover: row.cover ?? null,
    content: row.content ? JSON.parse(row.content) : null,
    createdAt: Number(row.created_at),
})

async function assertParent(workspaceId: string, parentId: string | null | undefined, pageId?: string) {
    if (!parentId) return
    const { sql } = storage()
    let cursor: string | null = parentId
    for (let depth = 0; cursor && depth < 100; depth++) {
        if (cursor === pageId) throw new HttpError(400, "A page can't be moved inside itself.")
        const [row]: any[] = await sql`SELECT workspace_id, parent_id FROM pages WHERE id = ${cursor}`
        if (!row || row.workspace_id !== workspaceId) throw new HttpError(400, "Parent page not found in this workspace.")
        cursor = row.parent_id ?? null
    }
}

export async function createPage(input: {
    id?: string
    workspaceId: string
    parentId?: string | null
    kind: PageKind
    title?: string
    icon?: string | null
    cover?: string | null
    content?: unknown
}): Promise<Page> {
    const { sql } = storage()
    const [{ max }] = await sql`SELECT MAX(position) AS max FROM pages WHERE workspace_id = ${input.workspaceId}`
    const now = Date.now()
    const page: Page = {
        id: input.id ?? crypto.randomUUID(),
        workspaceId: input.workspaceId,
        parentId: input.parentId ?? null,
        kind: input.kind,
        title: input.title ?? "",
        icon: input.icon ?? null,
        cover: input.cover ?? null,
        content: input.content ?? null,
        position: Number(max ?? 0) + 1,
        createdAt: now,
        updatedAt: now,
    }
    await sql`INSERT INTO pages (id, workspace_id, parent_id, kind, title, icon, cover, content, position, created_at, updated_at)
              VALUES (${page.id}, ${page.workspaceId}, ${page.parentId}, ${page.kind}, ${page.title}, ${page.icon},
                      ${page.cover}, ${page.content === null ? null : JSON.stringify(page.content)}, ${page.position},
                      ${page.createdAt}, ${page.updatedAt})`
    return page
}

const PageKindSchema = t.Union([t.Literal("document"), t.Literal("database")])

export const pageRoutes = new Elysia({ prefix: "/api" })
    .use(authPlugin)
    .get(
        "/workspaces/:id/pages",
        async ({ params, user }) => {
            await requireRole(user.id, params.id)
            const { sql } = storage()
            const rows = await sql`SELECT id, workspace_id, parent_id, kind, title, icon, position, updated_at
                                   FROM pages WHERE workspace_id = ${params.id} ORDER BY position`
            return rows.map(toMeta)
        },
        { auth: true },
    )
    .post(
        "/pages",
        async ({ body, user }) => {
            await requireRole(user.id, body.workspaceId)
            await assertParent(body.workspaceId, body.parentId)
            return createPage(body)
        },
        {
            auth: true,
            body: t.Object({
                id: t.Optional(t.String({ format: "uuid" })),
                workspaceId: t.String(),
                parentId: t.Optional(t.Nullable(t.String())),
                kind: PageKindSchema,
                title: t.Optional(t.String()),
                icon: t.Optional(t.Nullable(t.String())),
                content: t.Optional(t.Any()),
            }),
        },
    )
    .get(
        "/pages/:id",
        async ({ params, user }) => {
            await requirePageAccess(user.id, params.id)
            const { sql } = storage()
            const [row] = await sql`SELECT * FROM pages WHERE id = ${params.id}`
            return toPage(row)
        },
        { auth: true },
    )
    .patch(
        "/pages/:id",
        async ({ params, body, user }) => {
            const workspaceId = await requirePageAccess(user.id, params.id)
            if (body.parentId !== undefined) await assertParent(workspaceId, body.parentId, params.id)
            const { sql } = storage()
            const [row] = await sql`SELECT * FROM pages WHERE id = ${params.id}`
            const next = { ...toPage(row), ...body, updatedAt: Date.now() }
            await sql`UPDATE pages SET
                        title = ${next.title}, icon = ${next.icon}, cover = ${next.cover},
                        content = ${next.content === null ? null : JSON.stringify(next.content)},
                        parent_id = ${next.parentId}, position = ${next.position}, updated_at = ${next.updatedAt}
                      WHERE id = ${params.id}`
            return toMeta({ ...row, title: next.title, icon: next.icon, parent_id: next.parentId, position: next.position, updated_at: next.updatedAt })
        },
        {
            auth: true,
            body: t.Object({
                title: t.Optional(t.String()),
                icon: t.Optional(t.Nullable(t.String())),
                cover: t.Optional(t.Nullable(t.String())),
                content: t.Optional(t.Any()),
                parentId: t.Optional(t.Nullable(t.String())),
                position: t.Optional(t.Number()),
            }),
        },
    )
    .delete(
        "/pages/:id",
        async ({ params, user }) => {
            await requirePageAccess(user.id, params.id)
            const { sql } = storage()
            const ids = [params.id]
            for (let i = 0; i < ids.length; i++) {
                const children = await sql`SELECT id FROM pages WHERE parent_id = ${ids[i]}`
                ids.push(...children.map((c: any) => c.id))
            }
            for (const id of ids) await sql`DELETE FROM pages WHERE id = ${id}`
            return { deleted: ids }
        },
        { auth: true },
    )
