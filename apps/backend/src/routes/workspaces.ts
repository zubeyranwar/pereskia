import { Elysia, t } from "elysia"
import { storage } from "../storage"
import { addMember, authPlugin, requireRole, type Role } from "../auth"

export type Workspace = { id: string; name: string; icon: string | null; createdAt: number; role?: Role }

const toWorkspace = (row: any): Workspace => ({
    id: row.id,
    name: row.name,
    icon: row.icon ?? null,
    createdAt: Number(row.created_at),
    ...(row.role ? { role: row.role } : {}),
})

export async function createWorkspace(input: { name: string; icon?: string | null; ownerId: string }): Promise<Workspace> {
    const { sql } = storage()
    const workspace: Workspace = { id: crypto.randomUUID(), name: input.name, icon: input.icon ?? null, createdAt: Date.now() }
    await sql`INSERT INTO workspaces (id, name, icon, created_at)
              VALUES (${workspace.id}, ${workspace.name}, ${workspace.icon}, ${workspace.createdAt})`
    await addMember(workspace.id, input.ownerId, "owner")
    return { ...workspace, role: "owner" }
}

export const workspaceRoutes = new Elysia({ prefix: "/api/workspaces" })
    .use(authPlugin)
    .get(
        "/",
        async ({ user }) => {
            const { sql } = storage()
            const rows = await sql`SELECT w.*, m.role FROM workspaces w
                                   JOIN workspace_members m ON m.workspace_id = w.id
                                   WHERE m.user_id = ${user.id}
                                   ORDER BY w.created_at`
            return rows.map(toWorkspace)
        },
        { auth: true },
    )
    .post("/", ({ body, user }) => createWorkspace({ ...body, ownerId: user.id }), {
        auth: true,
        body: t.Object({ name: t.String({ minLength: 1, maxLength: 100 }), icon: t.Optional(t.Nullable(t.String())) }),
    })
    .patch(
        "/:id",
        async ({ params, body, user }) => {
            const role = await requireRole(user.id, params.id, "admin")
            const { sql } = storage()
            const [existing] = await sql`SELECT * FROM workspaces WHERE id = ${params.id}`
            const next = { ...toWorkspace(existing), ...body, role }
            await sql`UPDATE workspaces SET name = ${next.name}, icon = ${next.icon} WHERE id = ${params.id}`
            return next
        },
        {
            auth: true,
            body: t.Object({ name: t.Optional(t.String({ minLength: 1, maxLength: 100 })), icon: t.Optional(t.Nullable(t.String())) }),
        },
    )
