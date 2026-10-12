import type { SQL } from "bun"
import { storage } from "./storage"
import { HttpError } from "./auth"
import { configuredAppUrl } from "./mailer"
import { emit, type TrackerEvent } from "./webhooks"

export type StatusGroup = "todo" | "inProgress" | "complete"
export type SelectOption = { id: string; name: string; color?: string; group?: StatusGroup }
export type Property = { id: string; name: string; type: string; width?: number; options?: SelectOption[] }
export type Schema = { title?: string; properties: Property[]; [key: string]: unknown }
export type Cells = Record<string, unknown>
export type Category = "todo" | "in_progress" | "blocked" | "done" | "cancelled"
export type Actor = { id: string | null; email: string | null }
export type Person = { id: string; name: string; email: string }

export type RowRecord = {
    id: string
    pageId: string
    position: number
    cells: Cells
    body: string | null
    num: number | null
    reporterId: string | null
    reporterEmail: string | null
    externalRef: unknown
    startedAt: number | null
    completedAt: number | null
    deletedAt: number | null
    createdAt: number
    updatedAt: number
}

export type TrackerConfig = { pageId: string; workspaceId: string; projectKey: string }

export const toRow = (r: any): RowRecord => ({
    id: r.id,
    pageId: r.page_id,
    position: Number(r.position),
    cells: JSON.parse(r.cells),
    body: r.body ?? null,
    num: r.num == null ? null : Number(r.num),
    reporterId: r.reporter_id ?? null,
    reporterEmail: r.reporter_email ?? null,
    externalRef: r.external_ref ? JSON.parse(r.external_ref) : null,
    startedAt: r.started_at == null ? null : Number(r.started_at),
    completedAt: r.completed_at == null ? null : Number(r.completed_at),
    deletedAt: r.deleted_at == null ? null : Number(r.deleted_at),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
})

// ── Schema and tracker field mapping ───────────────────────────────────────

export function splitContent(content: unknown): { schema: Schema; rows: { id: string; cells: Cells }[] } {
    const { rows, ...schema } = (content ?? { properties: [] }) as Schema & { rows?: { id: string; cells: Cells }[] }
    return { schema: { ...schema, properties: schema.properties ?? [] }, rows: Array.isArray(rows) ? rows : [] }
}

export async function loadDatabase(pageId: string) {
    const { sql } = storage()
    const [page] = await sql`SELECT id, workspace_id, kind, title, content FROM pages WHERE id = ${pageId}`
    if (!page || page.kind !== "database") return null
    return {
        id: page.id as string,
        workspaceId: page.workspace_id as string,
        title: page.title as string,
        schema: splitContent(page.content ? JSON.parse(page.content) : null).schema,
    }
}

export type TrackerFields = Partial<Record<"title" | "status" | "type" | "priority" | "assignee" | "due" | "labels" | "estimate", Property>>

const named = (props: Property[], type: string, pattern: RegExp) => props.find((p) => p.type === type && pattern.test(p.name.trim()))

export function trackerFields(schema: Schema): TrackerFields {
    const p = schema.properties
    return {
        title: p.find((x) => x.type === "title"),
        status: p.find((x) => x.type === "status"),
        type: named(p, "select", /^(type|task type|kind)$/i),
        priority: named(p, "select", /^priority$/i),
        assignee: named(p, "person", /assign|owner/i) ?? p.find((x) => x.type === "person"),
        due: named(p, "date", /due|deadline/i) ?? p.find((x) => x.type === "date"),
        labels: named(p, "multiSelect", /^(labels?|tags?)$/i) ?? p.find((x) => x.type === "multiSelect"),
        estimate: named(p, "number", /estimate|points/i),
    }
}

// Status groups say todo / in progress / complete; the option name refines that into the spec's five categories.
export function categoryOf(option: SelectOption | undefined): Category {
    const name = option?.name.toLowerCase() ?? ""
    if (option?.group === "complete") return /cancel|won.?t|duplicate|declin|abandon/.test(name) ? "cancelled" : "done"
    if (/block|on hold|stuck/.test(name)) return "blocked"
    return option?.group === "inProgress" ? "in_progress" : "todo"
}

export function statusOption(fields: TrackerFields, cells: Cells) {
    const options = fields.status?.options ?? []
    return options.find((o) => o.id === cells[fields.status!.id]) ?? options.find((o) => (o.group ?? "todo") === "todo")
}

const optionById = (property: Property | undefined, cells: Cells) =>
    property ? property.options?.find((o) => o.id === cells[property.id]) : undefined

const statusSnapshot = (o: SelectOption | undefined) => (o ? { id: o.id, name: o.name, category: categoryOf(o) } : null)
const prioritySnapshot = (p: Property | undefined, o: SelectOption | undefined) =>
    o ? { id: o.id, name: o.name, rank: (p!.options ?? []).indexOf(o) + 1 } : null

export async function trackerConfig(pageId: string): Promise<TrackerConfig | null> {
    const { sql } = storage()
    const [row] = await sql`SELECT * FROM tracker_databases WHERE page_id = ${pageId}`
    return row ? { pageId: row.page_id, workspaceId: row.workspace_id, projectKey: row.project_key } : null
}

export async function workspacePeople(workspaceId: string): Promise<Map<string, Person>> {
    const { sql } = storage()
    const rows = await sql`SELECT u.id, u.name, u.email FROM workspace_members m JOIN users u ON u.id = m.user_id
                           WHERE m.workspace_id = ${workspaceId}`
    return new Map(rows.map((r: any) => [r.id, { id: r.id, name: r.name, email: r.email }]))
}

// ── Task object (the spec's shape) ─────────────────────────────────────────

export type TaskContext = { schema: Schema; fields: TrackerFields; tracker: TrackerConfig; people: Map<string, Person> }

export async function taskContext(pageId: string): Promise<TaskContext | null> {
    const [db, tracker] = await Promise.all([loadDatabase(pageId), trackerConfig(pageId)])
    if (!db || !tracker) return null
    return { schema: db.schema, fields: trackerFields(db.schema), tracker, people: await workspacePeople(db.workspaceId) }
}

// Person cells hold a list of user ids (older ones a single id); the spec's assignee is the first person.
export const personIds = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : typeof value === "string" && value ? [value] : []

const iso = (ms: number | null) => (ms == null ? null : new Date(ms).toISOString())
const personOf = (people: Map<string, Person>, id: unknown) => {
    const p = typeof id === "string" ? people.get(id) : undefined
    return p ? { id: p.id, name: p.name, email: p.email } : null
}

export function taskKey(ctx: TaskContext, row: RowRecord) {
    return `${ctx.tracker.projectKey}-${row.num}`
}

export function taskObject(ctx: TaskContext, row: RowRecord) {
    const { fields, people } = ctx
    const c = row.cells
    const status = statusOption(fields, c)
    const category = categoryOf(status)
    const type = optionById(fields.type, c)
    const labelIds = fields.labels && Array.isArray(c[fields.labels.id]) ? (c[fields.labels.id] as string[]) : []
    const estimate = fields.estimate ? c[fields.estimate.id] : null
    const reporter = row.reporterId && people.has(row.reporterId)
        ? personOf(people, row.reporterId)
        : row.reporterEmail
          ? { id: null, name: null, email: row.reporterEmail }
          : null
    return {
        id: row.id,
        key: taskKey(ctx, row),
        url: `${configuredAppUrl() ?? ""}/${row.pageId}?task=${row.id}`,
        project_id: row.pageId,
        type: type ? { id: type.id, name: type.name } : null,
        title: fields.title ? String(c[fields.title.id] ?? "") : "",
        description: row.body,
        status: statusSnapshot(status),
        priority: prioritySnapshot(fields.priority, optionById(fields.priority, c)),
        assignee: fields.assignee ? personOf(people, personIds(c[fields.assignee.id])[0]) : null,
        reporter,
        labels: labelIds.map((id) => fields.labels!.options?.find((o) => o.id === id)?.name).filter(Boolean),
        due_date: fields.due && typeof c[fields.due.id] === "string" ? (c[fields.due.id] as string) : null,
        estimate_points: typeof estimate === "number" ? estimate : null,
        created_at: iso(row.createdAt),
        updated_at: iso(row.updatedAt),
        started_at: iso(row.startedAt),
        completed_at: iso(row.completedAt),
        deleted_at: iso(row.deletedAt),
        progress: { subtasks_total: 0, subtasks_done: 0, checklist_total: 0, checklist_done: 0, percent: category === "done" ? 100 : 0 },
        parent_id: null,
        external_ref: row.externalRef ?? null,
    }
}

// ── Reading rows ───────────────────────────────────────────────────────────

export async function listRows(pageId: string) {
    const { sql } = storage()
    const [rows, tracker] = await Promise.all([
        sql`SELECT * FROM database_rows WHERE page_id = ${pageId} AND deleted_at IS NULL ORDER BY position, created_at, id`,
        trackerConfig(pageId),
    ])
    return rows.map((r: any) => {
        const row = toRow(r)
        return { id: row.id, cells: row.cells, ...(tracker && row.num != null ? { key: `${tracker.projectKey}-${row.num}` } : {}) }
    })
}

export async function getRow(rowId: string) {
    const { sql } = storage()
    const [r] = await sql`SELECT * FROM database_rows WHERE id = ${rowId}`
    return r ? toRow(r) : null
}

// Row ids only have to be unique within one database; a copied or re-imported database gets fresh ids where they clash.
export async function insertImportedRows(tx: SQL, pageId: string, rows: { id: string; cells: Cells }[], createdAt = Date.now()) {
    const now = Date.now()
    const ids = rows.map((r) => r.id).filter(Boolean)
    const taken = new Set<string>(ids.length ? (await tx`SELECT id FROM database_rows WHERE id IN ${tx(ids)}`).map((r: any) => r.id) : [])
    for (const [i, row] of rows.entries()) {
        const id = !row.id || taken.has(row.id) ? crypto.randomUUID() : row.id
        taken.add(id)
        await tx`INSERT INTO database_rows (id, page_id, position, cells, created_at, updated_at)
                 VALUES (${id}, ${pageId}, ${i}, ${JSON.stringify(row.cells ?? {})}, ${createdAt}, ${now})`
    }
}

// ── Writing rows ───────────────────────────────────────────────────────────

export type RowUpsert = {
    id: string
    cells?: Cells
    position?: number
    body?: string | null
    reporterId?: string | null
    reporterEmail?: string | null
    externalRef?: unknown
}

export type RowChanges = { upserts?: RowUpsert[]; deletes?: string[] }

type PendingEvent = { type: TrackerEvent["type"]; rowId: string; changes: TrackerEvent["changes"] }

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export async function nextNumber(tx: SQL, pageId: string) {
    if (storage().dialect === "mysql") {
        await tx`UPDATE tracker_databases SET next_num = next_num + 1 WHERE page_id = ${pageId}`
        const [row] = await tx`SELECT next_num FROM tracker_databases WHERE page_id = ${pageId}`
        return Number(row.next_num) - 1
    }
    const [row] = await tx`UPDATE tracker_databases SET next_num = next_num + 1 WHERE page_id = ${pageId} RETURNING next_num`
    return Number(row.next_num) - 1
}

function lifecycle(category: Category, row: { startedAt: number | null; completedAt: number | null }, now: number) {
    const working = category === "in_progress" || category === "blocked"
    const finished = category === "done" || category === "cancelled"
    return {
        startedAt: row.startedAt ?? (working ? now : null),
        completedAt: finished ? (row.completedAt ?? now) : null,
    }
}

export async function applyRowChanges(pageId: string, changes: RowChanges, actor: Actor): Promise<RowRecord[]> {
    const db = await loadDatabase(pageId)
    if (!db) throw new HttpError(404, "Database not found")
    const fields = trackerFields(db.schema)
    const tracker = await trackerConfig(pageId)
    const { sql } = storage()
    const now = Date.now()
    const events: PendingEvent[] = []
    const touched: string[] = []

    const historyFields: { name: string; property: Property | undefined; snapshot: (cells: Cells) => unknown }[] = [
        { name: "status", property: fields.status, snapshot: (c) => statusSnapshot(statusOption(fields, c)) },
        { name: "assignee", property: fields.assignee, snapshot: (c) => (fields.assignee ? personSnapshot(personIds(c[fields.assignee.id])[0]) : null) },
        { name: "priority", property: fields.priority, snapshot: (c) => prioritySnapshot(fields.priority, optionById(fields.priority, c)) },
        { name: "due_date", property: fields.due, snapshot: (c) => (fields.due ? (c[fields.due.id] ?? null) : null) },
    ]
    const people = await workspacePeople(db.workspaceId)
    const personSnapshot = (id: unknown) => personOf(people, id)

    await sql.begin(async (tx) => {
        const record = async (rowId: string, field: string, from: unknown, to: unknown) => {
            await tx`INSERT INTO row_history (id, row_id, page_id, at, field, from_value, to_value, actor_id, actor_email)
                     VALUES (${crypto.randomUUID()}, ${rowId}, ${pageId}, ${now}, ${field},
                             ${from == null ? null : JSON.stringify(from)}, ${to == null ? null : JSON.stringify(to)},
                             ${actor.id}, ${actor.email})`
        }

        for (const up of changes.upserts ?? []) {
            const [found] = await tx`SELECT * FROM database_rows WHERE id = ${up.id}`
            const existing = found ? toRow(found) : null
            if (existing && existing.pageId !== pageId) throw new HttpError(400, "That row belongs to another database.")

            if (!existing) {
                const cells = up.cells ?? {}
                const times = lifecycle(categoryOf(statusOption(fields, cells)), { startedAt: null, completedAt: null }, now)
                let position = up.position
                if (position === undefined) {
                    const [{ max }] = await tx`SELECT MAX(position) AS max FROM database_rows WHERE page_id = ${pageId}`
                    position = Number(max ?? -1) + 1
                }
                await tx`INSERT INTO database_rows (id, page_id, position, cells, body, num, reporter_id, reporter_email, external_ref,
                                                    started_at, completed_at, created_at, updated_at)
                         VALUES (${up.id}, ${pageId}, ${position}, ${JSON.stringify(cells)}, ${up.body ?? null},
                                 ${tracker ? await nextNumber(tx, pageId) : null},
                                 ${up.reporterId ?? actor.id}, ${up.reporterEmail ?? actor.email},
                                 ${up.externalRef == null ? null : JSON.stringify(up.externalRef)},
                                 ${times.startedAt}, ${times.completedAt}, ${now}, ${now})`
                if (fields.status) await record(up.id, "status", null, statusSnapshot(statusOption(fields, cells)))
                events.push({ type: "task.created", rowId: up.id, changes: null })
                touched.push(up.id)
                continue
            }

            if (existing.deletedAt) continue
            const cells = { ...existing.cells, ...(up.cells ?? {}) }
            const changedKeys = Object.keys(up.cells ?? {}).filter((k) => !same(existing.cells[k], cells[k]))
            const bodyChanged = up.body !== undefined && up.body !== existing.body
            const position = up.position ?? existing.position

            if (changedKeys.length === 0 && !bodyChanged) {
                if (position !== existing.position) await tx`UPDATE database_rows SET position = ${position} WHERE id = ${up.id}`
                continue
            }

            const eventChanges: Record<string, { from: unknown; to: unknown }> = {}
            for (const h of historyFields) {
                if (!h.property || !changedKeys.includes(h.property.id)) continue
                const from = h.snapshot(existing.cells)
                const to = h.snapshot(cells)
                if (same(from, to)) continue
                await record(up.id, h.name, from, to)
                eventChanges[h.name] = { from, to }
            }
            const times = lifecycle(categoryOf(statusOption(fields, cells)), existing, now)
            await tx`UPDATE database_rows SET cells = ${JSON.stringify(cells)}, body = ${bodyChanged ? (up.body ?? null) : existing.body},
                                              position = ${position}, started_at = ${times.startedAt},
                                              completed_at = ${times.completedAt}, updated_at = ${now}
                     WHERE id = ${up.id}`
            events.push({
                type: eventChanges.status ? "task.status_changed" : "task.updated",
                rowId: up.id,
                changes: Object.keys(eventChanges).length ? eventChanges : null,
            })
            touched.push(up.id)
        }

        for (const id of changes.deletes ?? []) {
            const result = await tx`UPDATE database_rows SET deleted_at = ${now}, updated_at = ${now}
                                    WHERE id = ${id} AND page_id = ${pageId} AND deleted_at IS NULL`
            if (result.count) {
                events.push({ type: "task.deleted", rowId: id, changes: null })
                touched.push(id)
            }
        }
    })

    const rows: RowRecord[] = touched.length ? (await sql`SELECT * FROM database_rows WHERE id IN ${sql(touched)}`).map((r: any) => toRow(r)) : []
    if (tracker && events.length) {
        const ctx: TaskContext = { schema: db.schema, fields, tracker, people }
        const byId = new Map(rows.map((r) => [r.id, r]))
        const actorInfo = actor.id ? personOf(people, actor.id) : actor.email ? { id: null, name: null, email: actor.email } : null
        for (const e of events) {
            const row = byId.get(e.rowId)
            if (!row) continue
            emit(db.workspaceId, {
                type: e.type,
                project_id: pageId,
                task: taskObject(ctx, row),
                changes: e.changes,
                actor: actorInfo,
                comment: null,
            }).catch(() => {})
        }
    }
    return rows
}

export async function touchRow(rowId: string, now = Date.now()) {
    const { sql } = storage()
    await sql`UPDATE database_rows SET updated_at = ${now} WHERE id = ${rowId}`
}

// ── Comments and history ───────────────────────────────────────────────────

export type Comment = { id: string; task_id: string; body: string; author: { id: string | null; name: string | null; email: string | null }; created_at: string }

export function toComment(r: any, people: Map<string, Person>): Comment {
    return {
        id: r.id,
        task_id: r.row_id,
        body: r.body,
        author: personOf(people, r.author_id) ?? { id: null, name: null, email: r.author_email ?? null },
        created_at: new Date(Number(r.created_at)).toISOString(),
    }
}

export async function addComment(row: RowRecord, body: string, author: Actor): Promise<Comment> {
    const { sql } = storage()
    const db = await loadDatabase(row.pageId)
    if (!db) throw new HttpError(404, "Database not found")
    const people = await workspacePeople(db.workspaceId)
    const id = crypto.randomUUID()
    const now = Date.now()
    await sql`INSERT INTO row_comments (id, row_id, page_id, body, author_id, author_email, created_at)
              VALUES (${id}, ${row.id}, ${row.pageId}, ${body}, ${author.id}, ${author.email}, ${now})`
    await touchRow(row.id, now)
    const comment = toComment({ id, row_id: row.id, body, author_id: author.id, author_email: author.email, created_at: now }, people)

    const tracker = await trackerConfig(row.pageId)
    if (tracker) {
        const ctx: TaskContext = { schema: db.schema, fields: trackerFields(db.schema), tracker, people }
        emit(db.workspaceId, {
            type: "comment.created",
            project_id: row.pageId,
            task: taskObject(ctx, { ...row, updatedAt: now }),
            changes: null,
            actor: comment.author,
            comment,
        }).catch(() => {})
    }
    return comment
}

export function toHistory(r: any, people: Map<string, Person>) {
    return {
        id: r.id,
        task_id: r.row_id,
        at: new Date(Number(r.at)).toISOString(),
        field: r.field,
        from: r.from_value ? JSON.parse(r.from_value) : null,
        to: r.to_value ? JSON.parse(r.to_value) : null,
        actor: personOf(people, r.actor_id) ?? (r.actor_email ? { id: null, name: null, email: r.actor_email } : null),
    }
}

// Tasks already in progress when tracking began, or moved into an in-progress group later, have no start time yet.
export async function backfillStartedAt(pageId?: string) {
    const { sql } = storage()
    const pages = pageId ? [pageId] : (await sql`SELECT page_id FROM tracker_databases`).map((r: any) => r.page_id as string)
    const now = Date.now()
    for (const id of pages) {
        const db = await loadDatabase(id)
        if (!db) continue
        const fields = trackerFields(db.schema)
        const rows = await sql`SELECT id, cells FROM database_rows WHERE page_id = ${id} AND started_at IS NULL AND deleted_at IS NULL`
        for (const row of rows) {
            const category = categoryOf(statusOption(fields, JSON.parse(row.cells)))
            if (category === "in_progress" || category === "blocked") {
                await sql`UPDATE database_rows SET started_at = ${now}, updated_at = ${now} WHERE id = ${row.id}`
            }
        }
    }
}

// ── Connecting a database to the tracker API ───────────────────────────────

const newOption = (name: string, color: string, extra: Partial<SelectOption> = {}): SelectOption => ({
    id: crypto.randomUUID().replace(/-/g, "").slice(0, 21),
    name,
    color,
    ...extra,
})

// The spec needs a status, a type with a "Bug" option, priorities and an assignee; add whatever the database lacks.
export function withTrackerProperties(schema: Schema): Schema {
    const properties = [...schema.properties]
    const fields = trackerFields(schema)
    const add = (p: Omit<Property, "id">) => properties.push({ id: crypto.randomUUID().replace(/-/g, "").slice(0, 21), width: 160, ...p })
    if (!fields.status) {
        add({ name: "Status", type: "status", options: [
            newOption("Not started", "default", { group: "todo" }),
            newOption("In progress", "blue", { group: "inProgress" }),
            newOption("Done", "green", { group: "complete" }),
        ] })
    }
    if (!fields.type) add({ name: "Type", type: "select", options: [newOption("Task", "gray"), newOption("Bug", "red"), newOption("Feature", "blue")] })
    else if (!fields.type.options?.some((o) => /bug/i.test(o.name))) {
        const i = properties.indexOf(fields.type)
        properties[i] = { ...fields.type, options: [...(fields.type.options ?? []), newOption("Bug", "red")] }
    }
    if (!fields.priority) {
        add({ name: "Priority", type: "select", options: [newOption("Urgent", "red"), newOption("High", "orange"), newOption("Medium", "yellow"), newOption("Low", "green")] })
    }
    if (!fields.assignee) add({ name: "Assignee", type: "person" })
    return { ...schema, properties }
}
