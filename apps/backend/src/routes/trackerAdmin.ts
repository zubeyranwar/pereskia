import { Elysia, t } from "elysia"
import { authPlugin } from "../auth"
import { storage } from "../storage"
import { createServiceToken } from "./tracker"
import { hashToken } from "../auth"

const SEED_STATUSES = [
    { id: "s-todo",      name: "To do",       category: "todo",        order: 0 },
    { id: "s-doing",     name: "In progress", category: "in_progress", order: 1 },
    { id: "s-review",    name: "In review",   category: "in_progress", order: 2 },
    { id: "s-done",      name: "Done",        category: "done",        order: 3 },
    { id: "s-cancelled", name: "Cancelled",   category: "cancelled",   order: 4 },
]
const SEED_TYPES = [
    { id: "t-task", name: "Task" },
    { id: "t-bug",  name: "Bug"  },
    { id: "t-feat", name: "Feature" },
]
const SEED_PRIORITIES = [
    { id: "p-urgent", name: "Urgent", rank: 1 },
    { id: "p-high",   name: "High",   rank: 2 },
    { id: "p-medium", name: "Medium", rank: 3 },
    { id: "p-low",    name: "Low",    rank: 4 },
]

export const trackerAdminRoutes = new Elysia({ prefix: "/api/tracker-admin" })
    .use(authPlugin)

    // POST /api/tracker-admin/token — create a service token (session auth required)
    .post(
        "/token",
        async ({ user, body }) => {
            const result = await createServiceToken(
                body.name,
                body.workspace_id,
                body.workspace_name,
                ["tasks:read", "tasks:write", "comments:write", "webhooks:write"],
            )
            return {
                token: result.token,
                id: result.id,
                base_url: "/api/v1",
                note: "Store this token securely — it will not be shown again.",
            }
        },
        {
            auth: true,
            body: t.Object({
                name: t.String(),
                workspace_id: t.String(),
                workspace_name: t.String(),
            }),
        },
    )

    // POST /api/tracker-admin/seed — seed a default project + fields (session auth required)
    .post(
        "/seed",
        async ({ user, body }) => {
            const { sql } = storage()
            const now = Date.now()
            const projectId = body.project_id ?? `proj-${crypto.randomUUID().slice(0, 8)}`
            const projectKey = body.project_key ?? "ENG"
            const projectName = body.project_name ?? "Engineering"

            // Project
            await sql`INSERT INTO tracker_projects (id, key, name, archived, next_task_num, created_at)
                      VALUES (${projectId}, ${projectKey}, ${projectName}, 0, 1, ${now})
                      ON CONFLICT (id) DO NOTHING`

            // Fields
            for (const s of SEED_STATUSES) {
                await sql`INSERT INTO tracker_statuses (id, project_id, name, category, order_num)
                          VALUES (${s.id + "-" + projectId.slice(-4)}, ${projectId}, ${s.name}, ${s.category}, ${s.order})
                          ON CONFLICT (id) DO NOTHING`
            }
            for (const t of SEED_TYPES) {
                await sql`INSERT INTO tracker_types (id, project_id, name)
                          VALUES (${t.id + "-" + projectId.slice(-4)}, ${projectId}, ${t.name})
                          ON CONFLICT (id) DO NOTHING`
            }
            for (const p of SEED_PRIORITIES) {
                await sql`INSERT INTO tracker_priorities (id, project_id, name, rank)
                          VALUES (${p.id + "-" + projectId.slice(-4)}, ${projectId}, ${p.name}, ${p.rank})
                          ON CONFLICT (id) DO NOTHING`
            }

            // Add current user as a tracker member
            await sql`INSERT INTO tracker_members (id, name, email, active, created_at)
                      VALUES (${user.id}, ${user.name}, ${user.email}, 1, ${now})
                      ON CONFLICT (id) DO NOTHING`

            return {
                project_id: projectId,
                project_key: projectKey,
                project_name: projectName,
                statuses: SEED_STATUSES.length,
                types: SEED_TYPES.length,
                priorities: SEED_PRIORITIES.length,
            }
        },
        {
            auth: true,
            body: t.Object({
                project_id: t.Optional(t.String()),
                project_key: t.Optional(t.String()),
                project_name: t.Optional(t.String()),
            }),
        },
    )
