import { Elysia, t } from "elysia"
import { storage } from "../storage"
import { createServiceToken } from "./tracker"
import { userForSession, SESSION_COOKIE, HttpError } from "../auth"

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

async function requireSession(cookie: Record<string, any>) {
    const token = cookie[SESSION_COOKIE]?.value as string | undefined
    const user = await userForSession(token)
    if (!user) throw new HttpError(401, "You need to sign in.")
    return user
}

export const trackerAdminRoutes = new Elysia({ prefix: "/api/tracker-admin" })

    .post(
        "/token",
        async ({ cookie, body }) => {
            const user = await requireSession(cookie)
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
            body: t.Object({
                name: t.String(),
                workspace_id: t.String(),
                workspace_name: t.String(),
            }),
        },
    )

    .post(
        "/seed",
        async ({ cookie, body }) => {
            const user = await requireSession(cookie)
            const { sql } = storage()
            const now = Date.now()
            const projectId = body.project_id ?? `proj-${crypto.randomUUID().slice(0, 8)}`
            const projectKey = body.project_key ?? "ENG"
            const projectName = body.project_name ?? "Engineering"

            await sql`INSERT INTO tracker_projects (id, key, name, archived, next_task_num, created_at)
                      VALUES (${projectId}, ${projectKey}, ${projectName}, 0, 1, ${now})
                      ON CONFLICT (id) DO NOTHING`

            for (const s of SEED_STATUSES) {
                await sql`INSERT INTO tracker_statuses (id, project_id, name, category, order_num)
                          VALUES (${s.id + "-" + projectId.slice(-4)}, ${projectId}, ${s.name}, ${s.category}, ${s.order})
                          ON CONFLICT (id) DO NOTHING`
            }
            for (const tp of SEED_TYPES) {
                await sql`INSERT INTO tracker_types (id, project_id, name)
                          VALUES (${tp.id + "-" + projectId.slice(-4)}, ${projectId}, ${tp.name})
                          ON CONFLICT (id) DO NOTHING`
            }
            for (const p of SEED_PRIORITIES) {
                await sql`INSERT INTO tracker_priorities (id, project_id, name, rank)
                          VALUES (${p.id + "-" + projectId.slice(-4)}, ${projectId}, ${p.name}, ${p.rank})
                          ON CONFLICT (id) DO NOTHING`
            }

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
            body: t.Object({
                project_id: t.Optional(t.String()),
                project_key: t.Optional(t.String()),
                project_name: t.Optional(t.String()),
            }),
        },
    )
