import { Elysia, t } from "elysia"
import { storage } from "../storage"
import { HttpError, hashToken, normalizeEmail } from "../auth"
import {
    addComment,
    applyRowChanges,
    categoryOf,
    personIds,
    statusOption,
    taskContext,
    taskObject,
    toComment,
    toHistory,
    toRow,
    trackerConfig,
    workspacePeople,
    type Cells,
    type RowRecord,
    type TaskContext,
} from "../rows"

export type Scope = "tasks:read" | "tasks:write" | "comments:write" | "webhooks:write"
export const ALL_SCOPES: Scope[] = ["tasks:read", "tasks:write", "comments:write", "webhooks:write"]
const EVENTS = ["task.created", "task.updated", "task.status_changed", "task.deleted", "comment.created"]

const CODES: Record<number, string> = {
    400: "invalid_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    409: "conflict",
    422: "validation_failed",
    429: "rate_limited",
}

export class TrackerError extends HttpError {
    code: string
    details?: Record<string, unknown>
    retryAfter?: number
    constructor(status: number, message: string, details?: Record<string, unknown>) {
        super(status, message)
        this.code = CODES[status] ?? "internal"
        this.details = details
    }
}

const invalid = (fields: Record<string, string>) => new TrackerError(422, "Some fields are invalid", { fields })

// ── Auth and rate limits ───────────────────────────────────────────────────

type ServiceToken = { id: string; name: string; workspaceId: string; scopes: Scope[] }

const windows = new Map<string, { count: number; resetAt: number }>()

function rateLimit(tokenId: string) {
    const now = Date.now()
    const entry = windows.get(tokenId)
    if (!entry || entry.resetAt < now) {
        windows.set(tokenId, { count: 1, resetAt: now + 60_000 })
        return
    }
    if (++entry.count > 60) {
        const error = new TrackerError(429, "Too many requests")
        error.retryAfter = Math.ceil((entry.resetAt - now) / 1000)
        throw error
    }
}

async function authorize(headers: Record<string, string | undefined>, scope: Scope): Promise<ServiceToken> {
    const auth = headers.authorization
    if (!auth?.startsWith("Bearer ")) throw new TrackerError(401, "Missing service token")
    const { sql } = storage()
    const [row] = await sql`SELECT * FROM tracker_service_tokens WHERE token_hash = ${hashToken(auth.slice(7).trim())} AND revoked_at IS NULL`
    if (!row) throw new TrackerError(401, "This token is wrong or has been revoked")
    const token: ServiceToken = { id: row.id, name: row.name, workspaceId: row.workspace_id, scopes: JSON.parse(row.scopes) }
    rateLimit(token.id)
    if (!token.scopes.includes(scope)) throw new TrackerError(403, `This token lacks the ${scope} scope`)
    return token
}

// ── Idempotency ────────────────────────────────────────────────────────────

const sha = (value: string) => new Bun.CryptoHasher("sha256").update(value).digest("hex")

async function idempotent<T>(
    token: ServiceToken,
    key: string | undefined,
    body: unknown,
    set: { status?: number | string },
    create: () => Promise<T>,
): Promise<T> {
    if (!key) {
        set.status = 201
        return create()
    }
    const { sql } = storage()
    const keyHash = sha(`${token.id}:${key}`)
    const bodyHash = sha(JSON.stringify(body ?? null))
    const [seen] = await sql`SELECT * FROM tracker_idempotency_keys WHERE key_hash = ${keyHash} AND created_at > ${Date.now() - 24 * 60 * 60 * 1000}`
    if (seen) {
        if (seen.body_hash !== bodyHash) throw new TrackerError(409, "This Idempotency-Key was already used with a different body")
        set.status = Number(seen.status_code)
        return JSON.parse(seen.response)
    }
    const result = await create()
    set.status = 201
    await sql`DELETE FROM tracker_idempotency_keys WHERE key_hash = ${keyHash}`
    await sql`INSERT INTO tracker_idempotency_keys (key_hash, body_hash, response, status_code, created_at)
              VALUES (${keyHash}, ${bodyHash}, ${JSON.stringify(result)}, 201, ${Date.now()})`
    return result
}

// ── Paging ─────────────────────────────────────────────────────────────────

type Cursor = { u: number; i: string }

const encodeCursor = (u: number, i: string) => Buffer.from(JSON.stringify({ u, i })).toString("base64url")

function decodeCursor(cursor: string | undefined): Cursor | null {
    if (!cursor) return null
    try {
        const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString())
        if (typeof parsed.u === "number" && typeof parsed.i === "string") return parsed
    } catch {}
    throw new TrackerError(400, "The cursor is not valid")
}

function pageSize(limit: string | undefined) {
    if (limit === undefined) return 50
    const n = Number(limit)
    if (!Number.isInteger(n) || n < 1) throw new TrackerError(400, "limit must be a positive whole number")
    return Math.min(n, 100)
}

function parseTime(value: string | undefined, name: string) {
    if (!value) return null
    const ms = Date.parse(value)
    if (Number.isNaN(ms)) throw new TrackerError(400, `${name} must be an ISO 8601 time`)
    return ms
}

function placeholders() {
    const params: unknown[] = []
    const postgres = storage().dialect === "postgres"
    return { params, bind: (v: unknown) => (params.push(v), postgres ? `$${params.length}` : "?") }
}

const Paging = { limit: t.Optional(t.String()), cursor: t.Optional(t.String()) }

// ── Projects and tasks in the token's workspace ────────────────────────────

async function projectIds(token: ServiceToken) {
    const { sql } = storage()
    const rows = await sql`SELECT page_id FROM tracker_databases WHERE workspace_id = ${token.workspaceId}`
    return rows.map((r: any) => r.page_id as string)
}

async function projectContext(token: ServiceToken, projectId: string): Promise<TaskContext> {
    const tracker = await trackerConfig(projectId)
    if (!tracker || tracker.workspaceId !== token.workspaceId) throw new TrackerError(404, "No such project")
    const ctx = await taskContext(projectId)
    if (!ctx) throw new TrackerError(404, "No such project")
    return ctx
}

async function findTask(token: ServiceToken, taskId: string) {
    const { sql } = storage()
    const [found] = await sql`SELECT * FROM database_rows WHERE id = ${taskId}`
    if (!found) throw new TrackerError(404, "No such task")
    const row = toRow(found)
    const tracker = await trackerConfig(row.pageId)
    if (!tracker || tracker.workspaceId !== token.workspaceId || row.num == null) throw new TrackerError(404, "No such task")
    return { row, ctx: (await taskContext(row.pageId))! }
}

async function personByEmail(token: ServiceToken, email: string | null | undefined) {
    if (!email) return null
    const people = await workspacePeople(token.workspaceId)
    const wanted = normalizeEmail(email)
    return [...people.values()].find((p) => normalizeEmail(p.email) === wanted) ?? null
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

// Turns the spec's task fields into cells of the database, collecting a message per wrong field.
async function taskCells(ctx: TaskContext, token: ServiceToken, input: Record<string, any>) {
    const { fields } = ctx
    const cells: Cells = {}
    const errors: Record<string, string> = {}
    const pick = (field: keyof typeof fields, key: string, id: unknown) => {
        const property = fields[field]
        if (id === undefined) return
        if (!property) return void (errors[key] = "this project has no such field")
        if (id === null) return void (cells[property.id] = null)
        if (!property.options?.some((o) => o.id === id)) return void (errors[key] = "not found")
        cells[property.id] = id
    }

    if (input.title !== undefined) {
        if (typeof input.title !== "string" || !input.title.trim()) errors.title = "required"
        else if (fields.title) cells[fields.title.id] = input.title
    }
    pick("type", "type", input.type)
    pick("priority", "priority", input.priority)
    pick("status", "status", input.status)
    if (input.assignee_id !== undefined) {
        if (!fields.assignee) errors.assignee_id = "this project has no such field"
        else if (input.assignee_id === null) cells[fields.assignee.id] = []
        else if (!(await workspacePeople(token.workspaceId)).has(input.assignee_id)) errors.assignee_id = "not found"
        else cells[fields.assignee.id] = [input.assignee_id]
    }
    if (input.due_date !== undefined) {
        if (input.due_date !== null && !DATE.test(input.due_date)) errors.due_date = "must be YYYY-MM-DD"
        else if (fields.due) cells[fields.due.id] = input.due_date
    }
    if (input.estimate_points !== undefined && fields.estimate) cells[fields.estimate.id] = input.estimate_points
    if (input.labels !== undefined) {
        if (!fields.labels) errors.labels = "this project has no such field"
        else {
            const options = fields.labels.options ?? []
            const ids = (input.labels as string[]).map((name) => options.find((o) => o.name.toLowerCase() === name.toLowerCase() || o.id === name)?.id)
            if (ids.some((id) => !id)) errors.labels = "not found"
            else cells[fields.labels.id] = ids
        }
    }
    if (Object.keys(errors).length) throw invalid(errors)
    return cells
}

function trackerPublicUrl(request: Request) {
    const forwarded = request.headers.get("x-forwarded-host")
    const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "")
    return forwarded ? `${proto}://${forwarded}` : new URL(request.url).origin
}

// Task URLs need the app's public address; fill it from the request when APP_URL isn't configured.
function withUrl<T extends { url: string }>(task: T, request: Request): T {
    return task.url.startsWith("/") ? { ...task, url: trackerPublicUrl(request) + task.url } : task
}

// ── Routes ─────────────────────────────────────────────────────────────────

const ExternalRef = t.Object({ source: t.String(), id: t.String(), url: t.Optional(t.Nullable(t.String())) })

export const trackerRoutes = new Elysia({ prefix: "/api/v1" })

    .get("/me", async ({ headers }) => {
        const token = await authorize(headers, "tasks:read")
        const { sql } = storage()
        const [workspace] = await sql`SELECT id, name FROM workspaces WHERE id = ${token.workspaceId}`
        return { token_name: token.name, workspace: { id: workspace.id, name: workspace.name }, scopes: token.scopes }
    })

    .get(
        "/projects",
        async ({ headers, query }) => {
            const token = await authorize(headers, "tasks:read")
            const limit = pageSize(query.limit)
            const cursor = decodeCursor(query.cursor)
            const { sql } = storage()
            const rows = await sql`SELECT d.page_id, d.project_key, d.created_at, p.title
                                   FROM tracker_databases d JOIN pages p ON p.id = d.page_id
                                   WHERE d.workspace_id = ${token.workspaceId}
                                   ORDER BY d.created_at, d.page_id`
            const after = cursor ? rows.filter((r: any) => Number(r.created_at) > cursor.u || (Number(r.created_at) === cursor.u && r.page_id > cursor.i)) : rows
            const items = after.slice(0, limit)
            const last = items[items.length - 1]
            return {
                data: items.map((r: any) => ({ id: r.page_id, key: r.project_key, name: r.title || "Untitled", archived: false })),
                next_cursor: after.length > limit ? encodeCursor(Number(last.created_at), last.page_id) : null,
            }
        },
        { query: t.Object(Paging) },
    )

    .get("/projects/:project_id/fields", async ({ headers, params }) => {
        const token = await authorize(headers, "tasks:read")
        const { fields } = await projectContext(token, params.project_id)
        return {
            statuses: (fields.status?.options ?? []).map((o, i) => ({ id: o.id, name: o.name, category: categoryOf(o), order: i })),
            types: (fields.type?.options ?? []).map((o) => ({ id: o.id, name: o.name })),
            priorities: (fields.priority?.options ?? []).map((o, i) => ({ id: o.id, name: o.name, rank: i + 1 })),
            labels: (fields.labels?.options ?? []).map((o) => ({ id: o.id, name: o.name })),
        }
    })

    .get(
        "/members",
        async ({ headers, query }) => {
            const token = await authorize(headers, "tasks:read")
            const limit = pageSize(query.limit)
            const cursor = decodeCursor(query.cursor)
            const { sql } = storage()
            const rows = await sql`SELECT u.id, u.name, u.email, m.created_at FROM workspace_members m JOIN users u ON u.id = m.user_id
                                   WHERE m.workspace_id = ${token.workspaceId} ORDER BY m.created_at, u.id`
            const after = cursor ? rows.filter((r: any) => Number(r.created_at) > cursor.u || (Number(r.created_at) === cursor.u && r.id > cursor.i)) : rows
            const items = after.slice(0, limit)
            const last = items[items.length - 1]
            return {
                data: items.map((r: any) => ({ id: r.id, name: r.name, email: r.email, active: true })),
                next_cursor: after.length > limit ? encodeCursor(Number(last.created_at), last.id) : null,
            }
        },
        { query: t.Object(Paging) },
    )

    .post(
        "/tasks",
        async ({ headers, body, set, request }) => {
            const token = await authorize(headers, "tasks:write")
            return idempotent(token, headers["idempotency-key"], body, set, async () => {
                const tracker = await trackerConfig(body.project_id)
                if (!tracker || tracker.workspaceId !== token.workspaceId) throw invalid({ project_id: "not found" })
                const ctx = (await taskContext(body.project_id))!
                const cells = await taskCells(ctx, token, { ...body, status: undefined })
                const todo = statusOption(ctx.fields, {})
                if (ctx.fields.status && todo) cells[ctx.fields.status.id] = todo.id

                const reporter = await personByEmail(token, body.reporter_email)
                const id = crypto.randomUUID()
                const [row] = await applyRowChanges(
                    body.project_id,
                    {
                        upserts: [{
                            id,
                            cells,
                            body: body.description ?? null,
                            reporterId: reporter?.id ?? null,
                            reporterEmail: body.reporter_email ?? null,
                            externalRef: body.external_ref ?? null,
                        }],
                    },
                    { id: reporter?.id ?? null, email: body.reporter_email ?? null },
                )
                return withUrl(taskObject(ctx, row), request)
            })
        },
        {
            body: t.Object({
                project_id: t.String(),
                type: t.String(),
                title: t.String({ minLength: 1, maxLength: 200 }),
                description: t.Optional(t.Nullable(t.String({ maxLength: 10_000 }))),
                priority: t.Optional(t.Nullable(t.String())),
                assignee_id: t.Optional(t.Nullable(t.String())),
                due_date: t.Optional(t.Nullable(t.String())),
                reporter_email: t.Optional(t.Nullable(t.String())),
                estimate_points: t.Optional(t.Nullable(t.Number())),
                labels: t.Optional(t.Array(t.String())),
                external_ref: t.Optional(t.Nullable(ExternalRef)),
            }),
        },
    )

    .get(
        "/tasks",
        async ({ headers, query, request }) => {
            const token = await authorize(headers, "tasks:read")
            const limit = pageSize(query.limit)
            const cursor = decodeCursor(query.cursor) ?? { u: -1, i: "" }
            const since = parseTime(query.updated_since, "updated_since")
            const includeDeleted = query.include_deleted === "true"
            const categories = query.status_category?.split(",").map((s) => s.trim()).filter(Boolean)

            const ids = query.project_id ? [(await projectContext(token, query.project_id)).tracker.pageId] : await projectIds(token)
            if (!ids.length) return { data: [], next_cursor: null }
            const contexts = new Map<string, TaskContext>()
            for (const id of ids) contexts.set(id, (await taskContext(id))!)

            const matches = (ctx: TaskContext, row: RowRecord) => {
                const c = row.cells
                if (categories && !categories.includes(categoryOf(statusOption(ctx.fields, c)))) return false
                if (query.type && (!ctx.fields.type || c[ctx.fields.type.id] !== query.type)) return false
                if (query.assignee_id && (!ctx.fields.assignee || !personIds(c[ctx.fields.assignee.id]).includes(query.assignee_id))) return false
                if (query.external_source && (row.externalRef as any)?.source !== query.external_source) return false
                return true
            }

            const { sql } = storage()
            const found: { ctx: TaskContext; row: RowRecord }[] = []
            let position = cursor
            const BATCH = 200
            while (found.length <= limit) {
                const { params, bind } = placeholders()
                const conditions = [
                    `page_id IN (${ids.map(bind).join(", ")})`,
                    `num IS NOT NULL`,
                    `(updated_at > ${bind(position.u)} OR (updated_at = ${bind(position.u)} AND id > ${bind(position.i)}))`,
                ]
                if (since !== null) conditions.push(`updated_at >= ${bind(since)}`)
                if (!includeDeleted) conditions.push(`deleted_at IS NULL`)
                const batch = (await sql.unsafe(
                    `SELECT * FROM database_rows WHERE ${conditions.join(" AND ")} ORDER BY updated_at, id LIMIT ${bind(BATCH)}`,
                    params,
                )).map(toRow)
                for (const row of batch) {
                    const ctx = contexts.get(row.pageId)!
                    if (matches(ctx, row)) found.push({ ctx, row })
                    if (found.length > limit) break
                }
                if (batch.length < BATCH) break
                const last = batch[batch.length - 1]
                position = { u: last.updatedAt, i: last.id }
            }

            const items = found.slice(0, limit)
            const last = items[items.length - 1]
            return {
                data: items.map(({ ctx, row }) => withUrl(taskObject(ctx, row), request)),
                next_cursor: found.length > limit ? encodeCursor(last.row.updatedAt, last.row.id) : null,
            }
        },
        {
            query: t.Object({
                ...Paging,
                project_id: t.Optional(t.String()),
                updated_since: t.Optional(t.String()),
                include_deleted: t.Optional(t.String()),
                status_category: t.Optional(t.String()),
                type: t.Optional(t.String()),
                assignee_id: t.Optional(t.String()),
                external_source: t.Optional(t.String()),
            }),
        },
    )

    .get("/tasks/:task_id", async ({ headers, params, request }) => {
        const token = await authorize(headers, "tasks:read")
        const { row, ctx } = await findTask(token, params.task_id)
        return withUrl(taskObject(ctx, row), request)
    })

    .patch(
        "/tasks/:task_id",
        async ({ headers, params, body, request }) => {
            const token = await authorize(headers, "tasks:write")
            const { row, ctx } = await findTask(token, params.task_id)
            if (row.deletedAt) throw new TrackerError(404, "This task was deleted")
            const cells = await taskCells(ctx, token, body)
            const [updated] = await applyRowChanges(
                row.pageId,
                { upserts: [{ id: row.id, cells, ...(body.description !== undefined ? { body: body.description } : {}) }] },
                { id: null, email: null },
            )
            return withUrl(taskObject(ctx, updated ?? row), request)
        },
        {
            body: t.Object({
                title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
                description: t.Optional(t.Nullable(t.String({ maxLength: 10_000 }))),
                priority: t.Optional(t.Nullable(t.String())),
                status: t.Optional(t.String()),
                assignee_id: t.Optional(t.Nullable(t.String())),
                due_date: t.Optional(t.Nullable(t.String())),
                labels: t.Optional(t.Array(t.String())),
            }),
        },
    )

    .get(
        "/history",
        async ({ headers, query }) => {
            const token = await authorize(headers, "tasks:read")
            const limit = pageSize(query.limit)
            const cursor = decodeCursor(query.cursor) ?? { u: -1, i: "" }
            const since = parseTime(query.since, "since")
            const ids = query.project_id ? [(await projectContext(token, query.project_id)).tracker.pageId] : await projectIds(token)
            if (!ids.length) return { data: [], next_cursor: null }

            const { params, bind } = placeholders()
            const conditions = [
                `page_id IN (${ids.map(bind).join(", ")})`,
                `(at > ${bind(cursor.u)} OR (at = ${bind(cursor.u)} AND id > ${bind(cursor.i)}))`,
            ]
            if (since !== null) conditions.push(`at > ${bind(since)}`)
            const { sql } = storage()
            const rows = await sql.unsafe(
                `SELECT * FROM row_history WHERE ${conditions.join(" AND ")} ORDER BY at, id LIMIT ${bind(limit + 1)}`,
                params,
            )
            const people = await workspacePeople(token.workspaceId)
            const items = rows.slice(0, limit)
            const last = items[items.length - 1]
            return {
                data: items.map((r: any) => toHistory(r, people)),
                next_cursor: rows.length > limit ? encodeCursor(Number(last.at), last.id) : null,
            }
        },
        { query: t.Object({ ...Paging, project_id: t.Optional(t.String()), since: t.Optional(t.String()) }) },
    )

    .get(
        "/tasks/:task_id/comments",
        async ({ headers, params, query }) => {
            const token = await authorize(headers, "tasks:read")
            const { row } = await findTask(token, params.task_id)
            const limit = pageSize(query.limit)
            const cursor = decodeCursor(query.cursor) ?? { u: -1, i: "" }
            const { sql } = storage()
            const rows = await sql`SELECT * FROM row_comments WHERE row_id = ${row.id}
                                   AND (created_at > ${cursor.u} OR (created_at = ${cursor.u} AND id > ${cursor.i}))
                                   ORDER BY created_at, id LIMIT ${limit + 1}`
            const people = await workspacePeople(token.workspaceId)
            const items = rows.slice(0, limit)
            const last = items[items.length - 1]
            return {
                data: items.map((r: any) => toComment(r, people)),
                next_cursor: rows.length > limit ? encodeCursor(Number(last.created_at), last.id) : null,
            }
        },
        { query: t.Object(Paging) },
    )

    .post(
        "/tasks/:task_id/comments",
        async ({ headers, params, body, set }) => {
            const token = await authorize(headers, "comments:write")
            return idempotent(token, headers["idempotency-key"], { ...body, task_id: params.task_id }, set, async () => {
                const { row } = await findTask(token, params.task_id)
                if (row.deletedAt) throw new TrackerError(404, "This task was deleted")
                const author = await personByEmail(token, body.author_email)
                return addComment(row, body.body, { id: author?.id ?? null, email: body.author_email ?? null })
            })
        },
        { body: t.Object({ body: t.String({ minLength: 1, maxLength: 5000 }), author_email: t.Optional(t.Nullable(t.String())) }) },
    )

    .post(
        "/webhooks",
        async ({ headers, body, set }) => {
            const token = await authorize(headers, "webhooks:write")
            const errors: Record<string, string> = {}
            if (!URL.canParse(body.url) || !/^https?:$/.test(new URL(body.url).protocol)) errors.url = "must be an http(s) URL"
            if (!body.events.length || body.events.some((e) => !EVENTS.includes(e))) errors.events = `must be some of ${EVENTS.join(", ")}`
            if (body.secret.length !== 43) errors.secret = "must be 43 characters"
            if (Object.keys(errors).length) throw invalid(errors)
            return idempotent(token, headers["idempotency-key"], body, set, async () => {
                const { sql } = storage()
                const id = crypto.randomUUID()
                const now = Date.now()
                await sql`INSERT INTO tracker_webhooks (id, url, events, secret, workspace_id, token_id, created_at)
                          VALUES (${id}, ${body.url}, ${JSON.stringify(body.events)}, ${body.secret}, ${token.workspaceId}, ${token.id}, ${now})`
                return { id, url: body.url, events: body.events, created_at: new Date(now).toISOString() }
            })
        },
        { body: t.Object({ url: t.String(), events: t.Array(t.String()), secret: t.String() }) },
    )

    .get(
        "/webhooks",
        async ({ headers, query }) => {
            const token = await authorize(headers, "webhooks:write")
            const limit = pageSize(query.limit)
            const cursor = decodeCursor(query.cursor) ?? { u: -1, i: "" }
            const { sql } = storage()
            const rows = await sql`SELECT * FROM tracker_webhooks WHERE workspace_id = ${token.workspaceId}
                                   AND (created_at > ${cursor.u} OR (created_at = ${cursor.u} AND id > ${cursor.i}))
                                   ORDER BY created_at, id LIMIT ${limit + 1}`
            const items = rows.slice(0, limit)
            const last = items[items.length - 1]
            return {
                data: items.map((r: any) => ({ id: r.id, url: r.url, events: JSON.parse(r.events), created_at: new Date(Number(r.created_at)).toISOString() })),
                next_cursor: rows.length > limit ? encodeCursor(Number(last.created_at), last.id) : null,
            }
        },
        { query: t.Object(Paging) },
    )

    .delete("/webhooks/:webhook_id", async ({ headers, params }) => {
        const token = await authorize(headers, "webhooks:write")
        const { sql } = storage()
        const result = await sql`DELETE FROM tracker_webhooks WHERE id = ${params.webhook_id} AND workspace_id = ${token.workspaceId}`
        if (!result.count) throw new TrackerError(404, "No such webhook")
        return new Response(null, { status: 204 })
    })

// ── Errors in the spec's shape ─────────────────────────────────────────────

function validationFields(error: any): Record<string, string> {
    const fields: Record<string, string> = {}
    const all: any[] = Array.isArray(error?.all) ? error.all : []
    for (const issue of all) {
        const path = String(issue.path ?? "").replace(/^\//, "").replace(/\//g, ".")
        if (!path || fields[path]) continue
        fields[path] = issue.value === undefined ? "required" : (issue.summary ?? issue.message ?? "invalid")
    }
    return fields
}

export function trackerErrorResponse(error: unknown, code: string | number, set: { status?: number | string; headers: Record<string, any> }) {
    if (error instanceof TrackerError) {
        set.status = error.status
        if (error.retryAfter) set.headers["Retry-After"] = String(error.retryAfter)
        return { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } }
    }
    if (error instanceof HttpError) {
        set.status = error.status
        return { error: { code: CODES[error.status] ?? "internal", message: error.message } }
    }
    if (code === "VALIDATION") {
        set.status = 422
        return { error: { code: "validation_failed", message: "Some fields are invalid", details: { fields: validationFields(error) } } }
    }
    if (code === "PARSE") {
        set.status = 400
        return { error: { code: "invalid_request", message: "The request body is not valid JSON" } }
    }
    if (code === "NOT_FOUND") {
        set.status = 404
        return { error: { code: "not_found", message: "No such route" } }
    }
    console.error(error)
    set.status = 500
    return { error: { code: "internal", message: "Something went wrong" } }
}

export async function createServiceToken(name: string, workspaceId: string, scopes: Scope[]) {
    const { sql } = storage()
    const raw = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex")
    const id = crypto.randomUUID()
    const [workspace] = await sql`SELECT name FROM workspaces WHERE id = ${workspaceId}`
    await sql`INSERT INTO tracker_service_tokens (id, name, token_hash, scopes, workspace_id, workspace_name, created_at)
              VALUES (${id}, ${name}, ${hashToken(raw)}, ${JSON.stringify(scopes)}, ${workspaceId}, ${workspace?.name ?? ""}, ${Date.now()})`
    return { id, token: raw }
}

