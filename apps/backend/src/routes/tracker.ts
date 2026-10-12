import { Elysia, t } from "elysia"
import { storage } from "../storage"
import { HttpError, hashToken } from "../auth"
import type { Dialect } from "../connection"

// Returns a binder that produces dialect-correct placeholders ($1/$2/... for Postgres, ? for others)
function makeBind(dialect: Dialect) {
    let n = 0
    const params: unknown[] = []
    const bind = (v: unknown) => { params.push(v); return dialect === "postgres" ? `$${++n}` : "?" }
    return { params, bind }
}

// ── Types ──────────────────────────────────────────────────────────────────

type Scope = "tasks:read" | "tasks:write" | "comments:write" | "webhooks:write"
type ServiceToken = { id: string; name: string; workspaceId: string; workspaceName: string; scopes: Scope[] }

// ── Rate limiter ───────────────────────────────────────────────────────────

const rateLimits = new Map<string, { count: number; resetAt: number }>()

function checkTrackerRateLimit(tokenId: string) {
    const now = Date.now()
    const windowMs = 60_000
    const limit = 60
    const entry = rateLimits.get(tokenId)
    if (!entry || entry.resetAt < now) {
        rateLimits.set(tokenId, { count: 1, resetAt: now + windowMs })
        return 0
    }
    entry.count++
    if (entry.count > limit) {
        return Math.ceil((entry.resetAt - now) / 1000)
    }
    return 0
}

// ── Auth ───────────────────────────────────────────────────────────────────

async function resolveToken(authHeader: string | null): Promise<ServiceToken> {
    if (!authHeader?.startsWith("Bearer ")) throw new HttpError(401, "unauthorized")
    const raw = authHeader.slice(7)
    const { sql } = storage()
    const [row] = await sql`SELECT * FROM tracker_service_tokens
                            WHERE token_hash = ${hashToken(raw)} AND revoked_at IS NULL`
    if (!row) throw new HttpError(401, "unauthorized")
    return {
        id: row.id,
        name: row.name,
        workspaceId: row.workspace_id,
        workspaceName: row.workspace_name,
        scopes: JSON.parse(row.scopes),
    }
}

function requireScope(token: ServiceToken, scope: Scope) {
    if (!token.scopes.includes(scope)) throw new HttpError(403, "forbidden")
}

// ── Idempotency ────────────────────────────────────────────────────────────

function bodyHash(body: unknown) {
    return new Bun.CryptoHasher("sha256").update(JSON.stringify(body)).digest("hex")
}

async function checkIdempotency(key: string | null | undefined, bHash: string) {
    if (!key) return null
    const { sql } = storage()
    const kHash = hashToken(key)
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    const [row] = await sql`SELECT * FROM tracker_idempotency_keys
                            WHERE key_hash = ${kHash} AND created_at > ${cutoff}`
    if (!row) return null
    if (row.body_hash !== bHash) throw new HttpError(409, "conflict")
    return { status: Number(row.status_code), body: JSON.parse(row.response) }
}

async function saveIdempotency(key: string | null | undefined, bHash: string, status: number, body: unknown) {
    if (!key) return
    const { sql, dialect } = storage()
    const kHash = hashToken(key)
    const now = Date.now()
    const responseJson = JSON.stringify(body)
    const { params, bind } = makeBind(dialect)
    const p = [kHash, bHash, responseJson, status, now].map(v => bind(v)).join(", ")
    if (dialect === "mysql") {
        await sql.unsafe(`INSERT IGNORE INTO tracker_idempotency_keys (key_hash, body_hash, response, status_code, created_at) VALUES (${p})`, params)
    } else if (dialect === "postgres") {
        await sql.unsafe(`INSERT INTO tracker_idempotency_keys (key_hash, body_hash, response, status_code, created_at) VALUES (${p}) ON CONFLICT (key_hash) DO NOTHING`, params)
    } else {
        await sql.unsafe(`INSERT OR IGNORE INTO tracker_idempotency_keys (key_hash, body_hash, response, status_code, created_at) VALUES (${p})`, params)
    }
}

// ── Task helpers ───────────────────────────────────────────────────────────

const TRACKER_BASE_URL = () => process.env.TRACKER_BASE_URL ?? "https://tracker.gebeta.app"

function toTaskObject(row: any) {
    return {
        id: row.id,
        key: row.key,
        url: `${TRACKER_BASE_URL()}/${row.key}`,
        project_id: row.project_id,
        type: { id: row.type_id, name: row.type_name ?? null },
        title: row.title,
        description: row.description ?? null,
        status: {
            id: row.status_id,
            name: row.status_name ?? null,
            category: row.status_category ?? null,
        },
        priority: row.priority_id ? { id: row.priority_id, name: row.priority_name ?? null, rank: Number(row.priority_rank ?? 0) } : null,
        assignee: row.assignee_id ? { id: row.assignee_id, name: row.assignee_name ?? null, email: row.assignee_email ?? null } : null,
        reporter: row.reporter_id
            ? { id: row.reporter_id, name: row.reporter_name ?? null, email: row.reporter_member_email ?? null }
            : row.reporter_email
              ? { id: null, name: null, email: row.reporter_email }
              : null,
        labels: row.labels ? JSON.parse(row.labels) : [],
        due_date: row.due_date ?? null,
        estimate_points: row.estimate_points != null ? Number(row.estimate_points) : null,
        created_at: new Date(Number(row.created_at)).toISOString(),
        updated_at: new Date(Number(row.updated_at)).toISOString(),
        started_at: row.started_at ? new Date(Number(row.started_at)).toISOString() : null,
        completed_at: row.completed_at ? new Date(Number(row.completed_at)).toISOString() : null,
        deleted_at: row.deleted_at ? new Date(Number(row.deleted_at)).toISOString() : null,
        progress: {
            subtasks_total: Number(row.subtasks_total ?? 0),
            subtasks_done: Number(row.subtasks_done ?? 0),
            checklist_total: Number(row.checklist_total ?? 0),
            checklist_done: Number(row.checklist_done ?? 0),
            percent: Number(row.progress_percent ?? 0),
        },
        parent_id: row.parent_id ?? null,
        external_ref: row.external_ref ? JSON.parse(row.external_ref) : null,
    }
}

async function fetchTask(taskId: string) {
    const { sql } = storage()
    const [row] = await sql`
        SELECT t.*,
               s.name AS status_name, s.category AS status_category,
               ty.name AS type_name,
               p.name AS priority_name, p.rank AS priority_rank,
               a.name AS assignee_name, a.email AS assignee_email,
               rep.name AS reporter_name, rep.email AS reporter_member_email
        FROM tracker_tasks t
        LEFT JOIN tracker_statuses s ON s.id = t.status_id
        LEFT JOIN tracker_types ty ON ty.id = t.type_id
        LEFT JOIN tracker_priorities p ON p.id = t.priority_id
        LEFT JOIN tracker_members a ON a.id = t.assignee_id
        LEFT JOIN tracker_members rep ON rep.id = t.reporter_id
        WHERE t.id = ${taskId}`
    return row ? toTaskObject(row) : null
}

// ── Cursor paging ──────────────────────────────────────────────────────────

function encodeCursor(updated_at: number, id: string) {
    return Buffer.from(JSON.stringify({ u: updated_at, i: id })).toString("base64url")
}

function decodeCursor(cursor: string | null | undefined): { u: number; i: string } | null {
    if (!cursor) return null
    try {
        return JSON.parse(Buffer.from(cursor, "base64url").toString())
    } catch {
        return null
    }
}

// ── Webhook delivery ───────────────────────────────────────────────────────

const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 6 * 60 * 60_000]

async function signAndDeliver(webhookId: string, eventId: string, payload: unknown, retryIndex = 0): Promise<void> {
    try {
        const { sql } = storage()
        const [wh] = await sql`SELECT * FROM tracker_webhooks WHERE id = ${webhookId}`
        if (!wh) return
        const events: string[] = JSON.parse(wh.events)
        if (!events.includes((payload as any).type)) return

        const body = JSON.stringify(payload)
        const ts = Math.floor(Date.now() / 1000)
        const sigInput = new TextEncoder().encode(`${ts}.${body}`)
        const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(wh.secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
        const sigBytes = await crypto.subtle.sign("HMAC", key, sigInput)
        const v1 = Buffer.from(sigBytes).toString("hex")

        const res = await fetch(wh.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Tracker-Event": (payload as any).type,
                "X-Tracker-Delivery": eventId,
                "X-Tracker-Signature": `t=${ts},v1=${v1}`,
            },
            body,
            signal: AbortSignal.timeout(10_000),
        })
        if (!res.ok && retryIndex < RETRY_DELAYS_MS.length) {
            setTimeout(() => signAndDeliver(webhookId, eventId, payload, retryIndex + 1), RETRY_DELAYS_MS[retryIndex])
        }
    } catch {
        if (retryIndex < RETRY_DELAYS_MS.length) {
            setTimeout(() => signAndDeliver(webhookId, eventId, payload, retryIndex + 1), RETRY_DELAYS_MS[retryIndex])
        }
    }
}

async function emitEvent(type: string, projectId: string, task: unknown, extra: Record<string, unknown> = {}) {
    try {
        const { sql } = storage()
        const webhooks = await sql`SELECT id FROM tracker_webhooks`
        const eventId = `evt_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`
        const payload = { id: eventId, type, occurred_at: new Date().toISOString(), project_id: projectId, task, comment: null, changes: null, actor: null, ...extra }
        for (const wh of webhooks) {
            signAndDeliver(wh.id, eventId, payload)
        }
    } catch (err) {
        console.error("Webhook emit error:", err)
    }
}

// ── Routes ─────────────────────────────────────────────────────────────────

export const trackerRoutes = new Elysia({ prefix: "/api/v1" })

    // ── 1. GET /me ──────────────────────────────────────────────────────────
    .get("/me", async ({ headers, set }) => {
        const token = await resolveToken(headers.authorization ?? null)
        const retryAfter = checkTrackerRateLimit(token.id)
        if (retryAfter) {
            set.status = 429
            set.headers["Retry-After"] = String(retryAfter)
            return trackerError("rate_limited", "Too many requests")
        }
        requireScope(token, "tasks:read")
        return {
            token_name: token.name,
            workspace: { id: token.workspaceId, name: token.workspaceName },
            scopes: token.scopes,
        }
    })

    // ── 2. GET /projects ────────────────────────────────────────────────────
    .get("/projects", async ({ headers, query, set }) => {
        const token = await resolveToken(headers.authorization ?? null)
        const retryAfter = checkTrackerRateLimit(token.id)
        if (retryAfter) { set.status = 429; set.headers["Retry-After"] = String(retryAfter); return trackerError("rate_limited", "Too many requests") }
        requireScope(token, "tasks:read")
        const { sql } = storage()
        const limit = Math.min(Number(query.limit ?? 50), 100)
        const cursor = decodeCursor(query.cursor)
        let rows: any[]
        if (cursor) {
            rows = await sql`SELECT * FROM tracker_projects WHERE (created_at > ${cursor.u} OR (created_at = ${cursor.u} AND id > ${cursor.i})) ORDER BY created_at ASC, id ASC LIMIT ${limit + 1}`
        } else {
            rows = await sql`SELECT * FROM tracker_projects ORDER BY created_at ASC, id ASC LIMIT ${limit + 1}`
        }
        const hasMore = rows.length > limit
        const data = rows.slice(0, limit).map((r: any) => ({ id: r.id, key: r.key, name: r.name, archived: !!r.archived }))
        const last = data[data.length - 1]
        return {
            data,
            next_cursor: hasMore && last ? encodeCursor(Number(rows[limit - 1].created_at), rows[limit - 1].id) : null,
        }
    }, { query: t.Object({ limit: t.Optional(t.String()), cursor: t.Optional(t.String()) }) })

    // ── 3. GET /projects/:project_id/fields ─────────────────────────────────
    .get("/projects/:project_id/fields", async ({ headers, params, set }) => {
        const token = await resolveToken(headers.authorization ?? null)
        const retryAfter = checkTrackerRateLimit(token.id)
        if (retryAfter) { set.status = 429; set.headers["Retry-After"] = String(retryAfter); return trackerError("rate_limited", "Too many requests") }
        requireScope(token, "tasks:read")
        const { sql } = storage()
        const [project] = await sql`SELECT id FROM tracker_projects WHERE id = ${params.project_id}`
        if (!project) throw new HttpError(404, "not_found")
        const [statuses, types, priorities, labels] = await Promise.all([
            sql`SELECT id, name, category, order_num FROM tracker_statuses WHERE project_id = ${params.project_id} ORDER BY order_num ASC`,
            sql`SELECT id, name FROM tracker_types WHERE project_id = ${params.project_id}`,
            sql`SELECT id, name, rank FROM tracker_priorities WHERE project_id = ${params.project_id} ORDER BY rank ASC`,
            sql`SELECT id, name FROM tracker_labels WHERE project_id = ${params.project_id}`,
        ])
        return {
            statuses: statuses.map((r: any) => ({ id: r.id, name: r.name, category: r.category, order: Number(r.order_num) })),
            types: types.map((r: any) => ({ id: r.id, name: r.name })),
            priorities: priorities.map((r: any) => ({ id: r.id, name: r.name, rank: Number(r.rank) })),
            labels: labels.map((r: any) => ({ id: r.id, name: r.name })),
        }
    })

    // ── 4. GET /members ─────────────────────────────────────────────────────
    .get("/members", async ({ headers, query, set }) => {
        const token = await resolveToken(headers.authorization ?? null)
        const retryAfter = checkTrackerRateLimit(token.id)
        if (retryAfter) { set.status = 429; set.headers["Retry-After"] = String(retryAfter); return trackerError("rate_limited", "Too many requests") }
        requireScope(token, "tasks:read")
        const { sql } = storage()
        const limit = Math.min(Number(query.limit ?? 50), 100)
        const cursor = decodeCursor(query.cursor)
        let rows: any[]
        if (cursor) {
            rows = await sql`SELECT * FROM tracker_members WHERE (created_at > ${cursor.u} OR (created_at = ${cursor.u} AND id > ${cursor.i})) ORDER BY created_at ASC, id ASC LIMIT ${limit + 1}`
        } else {
            rows = await sql`SELECT * FROM tracker_members ORDER BY created_at ASC, id ASC LIMIT ${limit + 1}`
        }
        const hasMore = rows.length > limit
        const data = rows.slice(0, limit).map((r: any) => ({ id: r.id, name: r.name, email: r.email, active: !!r.active }))
        return {
            data,
            next_cursor: hasMore ? encodeCursor(Number(rows[limit - 1].created_at), rows[limit - 1].id) : null,
        }
    }, { query: t.Object({ limit: t.Optional(t.String()), cursor: t.Optional(t.String()) }) })

    // ── 5. POST /tasks ──────────────────────────────────────────────────────
    .post("/tasks", async ({ headers, body, set }) => {
        const token = await resolveToken(headers.authorization ?? null)
        const retryAfter = checkTrackerRateLimit(token.id)
        if (retryAfter) { set.status = 429; set.headers["Retry-After"] = String(retryAfter); return trackerError("rate_limited", "Too many requests") }
        requireScope(token, "tasks:write")
        const ikey = headers["idempotency-key"] as string | undefined
        const bHash = bodyHash(body)
        const cached = await checkIdempotency(ikey, bHash)
        if (cached) { set.status = cached.status; return cached.body }

        const { sql, dialect } = storage()
        const validationErrors: Record<string, string> = {}

        // Validate project
        const [project] = await sql`SELECT * FROM tracker_projects WHERE id = ${body.project_id} AND archived = 0`
        if (!project) validationErrors.project_id = "not found"

        // Validate type
        const [typeRow] = body.type ? await sql`SELECT * FROM tracker_types WHERE id = ${body.type} AND project_id = ${body.project_id}` : [null]
        if (body.type && !typeRow) validationErrors.type = "not found"

        // Validate priority
        const [priorityRow] = body.priority ? await sql`SELECT * FROM tracker_priorities WHERE id = ${body.priority} AND project_id = ${body.project_id}` : [null]
        if (body.priority && !priorityRow) validationErrors.priority = "not found"

        // Validate assignee
        const [assigneeRow] = body.assignee_id ? await sql`SELECT * FROM tracker_members WHERE id = ${body.assignee_id}` : [null]
        if (body.assignee_id && !assigneeRow) validationErrors.assignee_id = "not found"

        if (Object.keys(validationErrors).length > 0) {
            set.status = 422
            return trackerError("validation_failed", "Some fields are invalid", { fields: validationErrors })
        }

        // Get first todo status
        const [firstStatus] = await sql`SELECT * FROM tracker_statuses WHERE project_id = ${body.project_id} AND category = 'todo' ORDER BY order_num ASC LIMIT 1`
        if (!firstStatus) {
            set.status = 422
            return trackerError("validation_failed", "No todo status configured for this project", {})
        }

        // Resolve reporter
        let reporterId: string | null = null
        if (body.reporter_email) {
            const [member] = await sql`SELECT id FROM tracker_members WHERE email = ${body.reporter_email.toLowerCase()}`
            if (member) reporterId = member.id
        }

        // Allocate task number atomically
        let taskNum: number
        if (dialect === "postgres") {
            const [r] = await sql.unsafe(`UPDATE tracker_projects SET next_task_num = next_task_num + 1 WHERE id = $1 RETURNING next_task_num`, [project.id])
            taskNum = Number(r.next_task_num) - 1
        } else {
            await sql.unsafe(`UPDATE tracker_projects SET next_task_num = next_task_num + 1 WHERE id = ?`, [project.id])
            const [r] = await sql`SELECT next_task_num FROM tracker_projects WHERE id = ${project.id}`
            taskNum = Number(r.next_task_num) - 1
        }

        const id = crypto.randomUUID()
        const taskKey = `${project.key}-${taskNum}`
        const now = Date.now()
        await sql`INSERT INTO tracker_tasks
            (id, key, project_id, type_id, title, description, status_id, priority_id, assignee_id, reporter_id, reporter_email, labels, due_date, estimate_points, external_ref, created_at, updated_at)
            VALUES (${id}, ${taskKey}, ${body.project_id}, ${body.type}, ${body.title},
                    ${body.description ?? null}, ${firstStatus.id}, ${body.priority ?? null},
                    ${body.assignee_id ?? null}, ${reporterId}, ${body.reporter_email ?? null},
                    ${body.labels ? JSON.stringify(body.labels) : null},
                    ${body.due_date ?? null}, ${body.estimate_points ?? null},
                    ${body.external_ref ? JSON.stringify(body.external_ref) : null},
                    ${now}, ${now})`

        const task = await fetchTask(id)
        set.status = 201
        await saveIdempotency(ikey, bHash, 201, task)
        emitEvent("task.created", body.project_id, task)
        return task
    }, {
        body: t.Object({
            project_id: t.String(),
            type: t.String(),
            title: t.String({ maxLength: 200 }),
            description: t.Optional(t.Nullable(t.String({ maxLength: 10000 }))),
            priority: t.Optional(t.Nullable(t.String())),
            assignee_id: t.Optional(t.Nullable(t.String())),
            due_date: t.Optional(t.Nullable(t.String())),
            reporter_email: t.Optional(t.Nullable(t.String())),
            estimate_points: t.Optional(t.Nullable(t.Number())),
            labels: t.Optional(t.Array(t.String())),
            external_ref: t.Optional(t.Nullable(t.Object({
                source: t.String(),
                id: t.String(),
                url: t.Optional(t.String()),
            }))),
        }),
    })

    // ── 6. GET /tasks ───────────────────────────────────────────────────────
    .get("/tasks", async ({ headers, query, set }) => {
        const token = await resolveToken(headers.authorization ?? null)
        const retryAfter = checkTrackerRateLimit(token.id)
        if (retryAfter) { set.status = 429; set.headers["Retry-After"] = String(retryAfter); return trackerError("rate_limited", "Too many requests") }
        requireScope(token, "tasks:read")
        const { sql, dialect } = storage()
        const limit = Math.min(Number(query.limit ?? 50), 100)
        const cursor = decodeCursor(query.cursor)
        const cursorU = cursor?.u ?? 0
        const cursorI = cursor?.i ?? ""

        const { params, bind } = makeBind(dialect)
        const conditions: string[] = []

        if (query.project_id) conditions.push(`t.project_id = ${bind(query.project_id)}`)
        if (query.updated_since) conditions.push(`t.updated_at >= ${bind(new Date(query.updated_since).getTime())}`)
        if (query.include_deleted !== "true") conditions.push(`t.deleted_at IS NULL`)
        if (query.status_category) {
            const cats = query.status_category.split(",").map((c: string) => c.trim())
            conditions.push(`s.category IN (${cats.map(c => bind(c)).join(", ")})`)
        }
        if (query.type) conditions.push(`t.type_id = ${bind(query.type)}`)
        if (query.assignee_id) conditions.push(`t.assignee_id = ${bind(query.assignee_id)}`)
        if (query.external_source) {
            const extCond = dialect === "postgres"
                ? `t.external_ref::jsonb->>'source' = ${bind(query.external_source)}`
                : `json_extract(t.external_ref, '$.source') = ${bind(query.external_source)}`
            conditions.push(`t.external_ref IS NOT NULL AND ${extCond}`)
        }
        const c1 = bind(cursorU), c2 = bind(cursorU), c3 = bind(cursorI)
        conditions.push(`(t.updated_at > ${c1} OR (t.updated_at = ${c2} AND t.id > ${c3}))`)

        const where = `WHERE ${conditions.join(" AND ")}`
        const limitP = bind(limit + 1)

        const rows = await sql.unsafe(`
            SELECT t.*,
                   s.name AS status_name, s.category AS status_category,
                   ty.name AS type_name,
                   pr.name AS priority_name, pr.rank AS priority_rank,
                   a.name AS assignee_name, a.email AS assignee_email,
                   rep.name AS reporter_name, rep.email AS reporter_member_email
            FROM tracker_tasks t
            LEFT JOIN tracker_statuses s ON s.id = t.status_id
            LEFT JOIN tracker_types ty ON ty.id = t.type_id
            LEFT JOIN tracker_priorities pr ON pr.id = t.priority_id
            LEFT JOIN tracker_members a ON a.id = t.assignee_id
            LEFT JOIN tracker_members rep ON rep.id = t.reporter_id
            ${where}
            ORDER BY t.updated_at ASC, t.id ASC
            LIMIT ${limitP}
        `, params)

        const hasMore = rows.length > limit
        const data = rows.slice(0, limit).map(toTaskObject)
        const lastRaw = rows[limit - 1]
        return {
            data,
            next_cursor: hasMore && lastRaw ? encodeCursor(Number(lastRaw.updated_at), lastRaw.id) : null,
        }
    }, {
        query: t.Object({
            project_id: t.Optional(t.String()),
            updated_since: t.Optional(t.String()),
            include_deleted: t.Optional(t.String()),
            status_category: t.Optional(t.String()),
            type: t.Optional(t.String()),
            assignee_id: t.Optional(t.String()),
            external_source: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            cursor: t.Optional(t.String()),
        }),
    })

    // ── 7. GET /tasks/:task_id ──────────────────────────────────────────────
    .get("/tasks/:task_id", async ({ headers, params, set }) => {
        const token = await resolveToken(headers.authorization ?? null)
        const retryAfter = checkTrackerRateLimit(token.id)
        if (retryAfter) { set.status = 429; set.headers["Retry-After"] = String(retryAfter); return trackerError("rate_limited", "Too many requests") }
        requireScope(token, "tasks:read")
        const task = await fetchTask(params.task_id)
        if (!task) throw new HttpError(404, "not_found")
        return task
    })

    // ── 8. GET /history ─────────────────────────────────────────────────────
    .get("/history", async ({ headers, query, set }) => {
        const token = await resolveToken(headers.authorization ?? null)
        const retryAfter = checkTrackerRateLimit(token.id)
        if (retryAfter) { set.status = 429; set.headers["Retry-After"] = String(retryAfter); return trackerError("rate_limited", "Too many requests") }
        requireScope(token, "tasks:read")
        const { sql, dialect } = storage()
        const limit = Math.min(Number(query.limit ?? 50), 100)
        const sinceMs = query.since ? new Date(query.since).getTime() : 0
        const cursor = decodeCursor(query.cursor)
        const cursorU = cursor?.u ?? 0
        const cursorI = cursor?.i ?? ""

        const { params, bind } = makeBind(dialect)
        const c1 = bind(cursorU), c2 = bind(cursorU), c3 = bind(cursorI)
        const conditions: string[] = [`(h.at > ${c1} OR (h.at = ${c2} AND h.id > ${c3}))`]
        if (query.project_id) conditions.push(`t.project_id = ${bind(query.project_id)}`)
        if (sinceMs) conditions.push(`h.at > ${bind(sinceMs)}`)

        const where = `WHERE ${conditions.join(" AND ")}`
        const limitP = bind(limit + 1)

        const rows = await sql.unsafe(`
            SELECT h.*, m.name AS actor_name, m.email AS actor_email
            FROM tracker_task_history h
            JOIN tracker_tasks t ON t.id = h.task_id
            LEFT JOIN tracker_members m ON m.id = h.actor_id
            ${where}
            ORDER BY h.at ASC, h.id ASC
            LIMIT ${limitP}
        `, params)

        const hasMore = rows.length > limit
        const data = rows.slice(0, limit).map((r: any) => ({
            id: r.id,
            task_id: r.task_id,
            at: new Date(Number(r.at)).toISOString(),
            field: r.field,
            from: r.from_value ? JSON.parse(r.from_value) : null,
            to: r.to_value ? JSON.parse(r.to_value) : null,
            actor: r.actor_id ? { id: r.actor_id, name: r.actor_name, email: r.actor_email } : null,
        }))
        const lastRaw = rows[limit - 1]
        return {
            data,
            next_cursor: hasMore && lastRaw ? encodeCursor(Number(lastRaw.at), lastRaw.id) : null,
        }
    }, {
        query: t.Object({
            project_id: t.Optional(t.String()),
            since: t.Optional(t.String()),
            limit: t.Optional(t.String()),
            cursor: t.Optional(t.String()),
        }),
    })

    // ── 9. GET /tasks/:task_id/comments ─────────────────────────────────────
    .get("/tasks/:task_id/comments", async ({ headers, params, query, set }) => {
        const token = await resolveToken(headers.authorization ?? null)
        const retryAfter = checkTrackerRateLimit(token.id)
        if (retryAfter) { set.status = 429; set.headers["Retry-After"] = String(retryAfter); return trackerError("rate_limited", "Too many requests") }
        requireScope(token, "tasks:read")
        const { sql, dialect } = storage()
        const [task] = await sql`SELECT id FROM tracker_tasks WHERE id = ${params.task_id}`
        if (!task) throw new HttpError(404, "not_found")
        const limit = Math.min(Number(query.limit ?? 50), 100)
        const cursor = decodeCursor(query.cursor)
        const cursorU = cursor?.u ?? 0
        const cursorI = cursor?.i ?? ""
        const { params: qp, bind } = makeBind(dialect)
        const rows = await sql.unsafe(`
            SELECT c.*, m.name AS author_name, m.email AS author_member_email
            FROM tracker_comments c
            LEFT JOIN tracker_members m ON m.id = c.author_id
            WHERE c.task_id = ${bind(params.task_id)} AND (c.created_at > ${bind(cursorU)} OR (c.created_at = ${bind(cursorU)} AND c.id > ${bind(cursorI)}))
            ORDER BY c.created_at ASC, c.id ASC
            LIMIT ${bind(limit + 1)}
        `, qp)
        const hasMore = rows.length > limit
        const data = rows.slice(0, limit).map((r: any) => ({
            id: r.id,
            task_id: r.task_id,
            body: r.body,
            author: r.author_id
                ? { id: r.author_id, name: r.author_name, email: r.author_member_email }
                : { id: null, name: null, email: r.author_email },
            created_at: new Date(Number(r.created_at)).toISOString(),
        }))
        const lastRaw = rows[limit - 1]
        return {
            data,
            next_cursor: hasMore && lastRaw ? encodeCursor(Number(lastRaw.created_at), lastRaw.id) : null,
        }
    }, { query: t.Object({ limit: t.Optional(t.String()), cursor: t.Optional(t.String()) }) })

    // ── 10. POST /tasks/:task_id/comments ───────────────────────────────────
    .post("/tasks/:task_id/comments", async ({ headers, params, body, set }) => {
        const token = await resolveToken(headers.authorization ?? null)
        const retryAfter = checkTrackerRateLimit(token.id)
        if (retryAfter) { set.status = 429; set.headers["Retry-After"] = String(retryAfter); return trackerError("rate_limited", "Too many requests") }
        requireScope(token, "comments:write")
        const ikey = headers["idempotency-key"] as string | undefined
        const bHash = bodyHash({ ...body, task_id: params.task_id })
        const cached = await checkIdempotency(ikey, bHash)
        if (cached) { set.status = cached.status; return cached.body }

        const { sql, dialect } = storage()
        const [task] = await sql`SELECT * FROM tracker_tasks WHERE id = ${params.task_id} AND deleted_at IS NULL`
        if (!task) throw new HttpError(404, "not_found")

        let authorId: string | null = null
        if (body.author_email) {
            const [member] = await sql`SELECT id FROM tracker_members WHERE email = ${body.author_email.toLowerCase()}`
            if (member) authorId = member.id
        }

        const id = crypto.randomUUID()
        const now = Date.now()
        await sql`INSERT INTO tracker_comments (id, task_id, body, author_id, author_email, created_at)
                  VALUES (${id}, ${params.task_id}, ${body.body}, ${authorId}, ${body.author_email ?? null}, ${now})`

        // Update task updated_at so sync picks it up
        await sql`UPDATE tracker_tasks SET updated_at = ${now} WHERE id = ${params.task_id}`

        const [cRow] = await sql.unsafe(`
            SELECT c.*, m.name AS author_name, m.email AS author_member_email
            FROM tracker_comments c LEFT JOIN tracker_members m ON m.id = c.author_id
            WHERE c.id = ${dialect === "postgres" ? "$1" : "?"}
        `, [id])
        const comment = {
            id: cRow.id,
            task_id: cRow.task_id,
            body: cRow.body,
            author: authorId
                ? { id: authorId, name: cRow.author_name, email: cRow.author_member_email }
                : { id: null, name: null, email: body.author_email ?? null },
            created_at: new Date(Number(cRow.created_at)).toISOString(),
        }

        set.status = 201
        await saveIdempotency(ikey, bHash, 201, comment)
        const taskObj = await fetchTask(params.task_id)
        emitEvent("comment.created", task.project_id, taskObj, { comment })
        return comment
    }, {
        body: t.Object({
            body: t.String({ maxLength: 5000 }),
            author_email: t.Optional(t.Nullable(t.String())),
        }),
    })

    // ── 11. POST /webhooks (recommended) ────────────────────────────────────
    .post("/webhooks", async ({ headers, body, set }) => {
        const token = await resolveToken(headers.authorization ?? null)
        const retryAfter = checkTrackerRateLimit(token.id)
        if (retryAfter) { set.status = 429; set.headers["Retry-After"] = String(retryAfter); return trackerError("rate_limited", "Too many requests") }
        requireScope(token, "webhooks:write")
        const ikey = headers["idempotency-key"] as string | undefined
        const bHash = bodyHash(body)
        const cached = await checkIdempotency(ikey, bHash)
        if (cached) { set.status = cached.status; return cached.body }

        const { sql } = storage()
        const id = crypto.randomUUID()
        const now = Date.now()
        await sql`INSERT INTO tracker_webhooks (id, url, events, secret, created_at)
                  VALUES (${id}, ${body.url}, ${JSON.stringify(body.events)}, ${body.secret}, ${now})`

        const result = { id, url: body.url, events: body.events, created_at: new Date(now).toISOString() }
        set.status = 201
        await saveIdempotency(ikey, bHash, 201, result)
        return result
    }, {
        body: t.Object({
            url: t.String(),
            events: t.Array(t.String()),
            secret: t.String({ minLength: 43, maxLength: 43 }),
        }),
    })

    // ── 12. DELETE /webhooks/:webhook_id (recommended) ──────────────────────
    .delete("/webhooks/:webhook_id", async ({ headers, params, set }) => {
        const token = await resolveToken(headers.authorization ?? null)
        const retryAfter = checkTrackerRateLimit(token.id)
        if (retryAfter) { set.status = 429; set.headers["Retry-After"] = String(retryAfter); return trackerError("rate_limited", "Too many requests") }
        requireScope(token, "webhooks:write")
        const { sql } = storage()
        const [wh] = await sql`SELECT id FROM tracker_webhooks WHERE id = ${params.webhook_id}`
        if (!wh) throw new HttpError(404, "not_found")
        await sql`DELETE FROM tracker_webhooks WHERE id = ${params.webhook_id}`
        set.status = 204
        return null
    })

    // ── 13. PATCH /tasks/:task_id (optional) ────────────────────────────────
    .patch("/tasks/:task_id", async ({ headers, params, body, set }) => {
        const token = await resolveToken(headers.authorization ?? null)
        const retryAfter = checkTrackerRateLimit(token.id)
        if (retryAfter) { set.status = 429; set.headers["Retry-After"] = String(retryAfter); return trackerError("rate_limited", "Too many requests") }
        requireScope(token, "tasks:write")
        const { sql, dialect } = storage()
        const [task] = await sql`SELECT * FROM tracker_tasks WHERE id = ${params.task_id} AND deleted_at IS NULL`
        if (!task) throw new HttpError(404, "not_found")

        const now = Date.now()
        const { params: bp, bind } = makeBind(dialect)
        const setClauses: string[] = []

        if (body.title !== undefined) setClauses.push(`title = ${bind(body.title)}`)
        if (body.description !== undefined) setClauses.push(`description = ${bind(body.description)}`)
        if (body.due_date !== undefined) setClauses.push(`due_date = ${bind(body.due_date)}`)
        if (body.estimate_points !== undefined) setClauses.push(`estimate_points = ${bind(body.estimate_points)}`)
        if (body.labels !== undefined) setClauses.push(`labels = ${bind(JSON.stringify(body.labels))}`)
        if (body.assignee_id !== undefined) setClauses.push(`assignee_id = ${bind(body.assignee_id)}`)

        // Handle status change with history
        if (body.status !== undefined) {
            const [newStatus] = await sql`SELECT * FROM tracker_statuses WHERE id = ${body.status} AND project_id = ${task.project_id}`
            if (!newStatus) { set.status = 422; return trackerError("validation_failed", "Some fields are invalid", { fields: { status: "not found" } }) }
            const [oldStatus] = await sql`SELECT * FROM tracker_statuses WHERE id = ${task.status_id}`
            setClauses.push(`status_id = ${bind(body.status)}`)

            if (newStatus.category === "in_progress" && !task.started_at) setClauses.push(`started_at = ${bind(now)}`)
            if ((newStatus.category === "done" || newStatus.category === "cancelled") && !task.completed_at) setClauses.push(`completed_at = ${bind(now)}`)
            if (newStatus.category === "in_progress" && task.completed_at) setClauses.push(`completed_at = ${bind(null)}`)

            const { params: hp, bind: hb } = makeBind(dialect)
            const histId = crypto.randomUUID()
            await sql.unsafe(
                `INSERT INTO tracker_task_history (id, task_id, at, field, from_value, to_value, actor_id, created_at) VALUES (${hb(histId)}, ${hb(params.task_id)}, ${hb(now)}, 'status', ${hb(JSON.stringify({ id: task.status_id, name: oldStatus?.name, category: oldStatus?.category }))}, ${hb(JSON.stringify({ id: newStatus.id, name: newStatus.name, category: newStatus.category }))}, NULL, ${hb(now)})`,
                hp,
            )
        }

        if (body.priority !== undefined) setClauses.push(`priority_id = ${bind(body.priority)}`)

        if (setClauses.length === 0) { return fetchTask(params.task_id) }

        setClauses.push(`updated_at = ${bind(now)}`)
        const idP = bind(params.task_id)
        await sql.unsafe(`UPDATE tracker_tasks SET ${setClauses.join(", ")} WHERE id = ${idP}`, bp)

        const updated = await fetchTask(params.task_id)
        const eventType = body.status !== undefined ? "task.status_changed" : "task.updated"
        emitEvent(eventType, task.project_id, updated,
            body.status !== undefined ? { changes: { status: { from: { id: task.status_id }, to: { id: body.status } } }, actor: null } : {})
        return updated
    }, {
        body: t.Object({
            title: t.Optional(t.String({ maxLength: 200 })),
            description: t.Optional(t.Nullable(t.String({ maxLength: 10000 }))),
            priority: t.Optional(t.Nullable(t.String())),
            status: t.Optional(t.String()),
            assignee_id: t.Optional(t.Nullable(t.String())),
            due_date: t.Optional(t.Nullable(t.String())),
            estimate_points: t.Optional(t.Nullable(t.Number())),
            labels: t.Optional(t.Array(t.String())),
        }),
    })

    // ── 14. GET /webhooks (optional) ────────────────────────────────────────
    .get("/webhooks", async ({ headers, query, set }) => {
        const token = await resolveToken(headers.authorization ?? null)
        const retryAfter = checkTrackerRateLimit(token.id)
        if (retryAfter) { set.status = 429; set.headers["Retry-After"] = String(retryAfter); return trackerError("rate_limited", "Too many requests") }
        requireScope(token, "webhooks:write")
        const { sql, dialect } = storage()
        const limit = Math.min(Number(query.limit ?? 50), 100)
        const cursor = decodeCursor(query.cursor)
        const cursorU = cursor?.u ?? 0
        const cursorI = cursor?.i ?? ""
        const { params: wp, bind: wb } = makeBind(dialect)
        const c1 = wb(cursorU), c2 = wb(cursorU), c3 = wb(cursorI), lp = wb(limit + 1)
        const rows = await sql.unsafe(
            `SELECT * FROM tracker_webhooks WHERE (created_at > ${c1} OR (created_at = ${c2} AND id > ${c3})) ORDER BY created_at ASC, id ASC LIMIT ${lp}`,
            wp,
        )
        const hasMore = rows.length > limit
        const data = rows.slice(0, limit).map((r: any) => ({
            id: r.id, url: r.url,
            events: JSON.parse(r.events),
            created_at: new Date(Number(r.created_at)).toISOString(),
        }))
        const lastRaw = rows[limit - 1]
        return {
            data,
            next_cursor: hasMore && lastRaw ? encodeCursor(Number(lastRaw.created_at), lastRaw.id) : null,
        }
    }, { query: t.Object({ limit: t.Optional(t.String()), cursor: t.Optional(t.String()) }) })

// ── Error shape helper ─────────────────────────────────────────────────────

function trackerError(code: string, message: string, details?: Record<string, unknown>) {
    return { error: { code, message, ...(details ? { details } : {}) } }
}

// ── Admin helpers (create tokens, seed data) ───────────────────────────────

export async function createServiceToken(name: string, workspaceId: string, workspaceName: string, scopes: Scope[]) {
    const { sql } = storage()
    const raw = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "")
    const id = crypto.randomUUID()
    await sql`INSERT INTO tracker_service_tokens (id, name, token_hash, scopes, workspace_id, workspace_name, created_at)
              VALUES (${id}, ${name}, ${hashToken(raw)}, ${JSON.stringify(scopes)}, ${workspaceId}, ${workspaceName}, ${Date.now()})`
    return { id, token: raw }
}
