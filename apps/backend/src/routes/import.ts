import type { SQL } from "bun"
import { Elysia, t } from "elysia"
import { ConnectionInput, dialectOf, openConnection, quoteIdent, withTimeout, type Dialect } from "../connection"
import { createPage } from "./pages"
import { authPlugin, requireRole } from "../auth"
type PropertyType = "title" | "text" | "number" | "select" | "checkbox" | "date"
type Option = { id: string; name: string; color: string }
type Property = { id: string; name: string; type: PropertyType; width: number; options?: Option[] }

type TableRef = { key: string; schema: string | null; name: string }
type Column = { name: string; dataType: string }

const TAG_COLORS = ["blue", "green", "purple", "orange", "pink", "yellow", "red", "brown", "gray"]
const MAX_IMPORT_ROWS = 5000

async function listTables(sql: SQL, dialect: Dialect): Promise<TableRef[]> {
    if (dialect === "sqlite") {
        const rows = await sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
        return rows.map((r: any) => ({ key: r.name, schema: null, name: r.name }))
    }
    if (dialect === "mysql") {
        const rows = await sql`SELECT TABLE_NAME AS name FROM information_schema.TABLES
                               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`
        return rows.map((r: any) => ({ key: r.name, schema: null, name: r.name }))
    }
    const rows = await sql`SELECT table_schema AS schema, table_name AS name FROM information_schema.tables
                           WHERE table_type = 'BASE TABLE'
                             AND table_schema NOT IN ('pg_catalog', 'information_schema')
                             AND table_schema NOT LIKE 'pg_%'
                           ORDER BY (table_schema = 'public') DESC, table_schema, table_name`
    return rows.map((r: any) => ({
        key: r.schema === "public" ? r.name : `${r.schema}.${r.name}`,
        schema: r.schema,
        name: r.name,
    }))
}

async function listColumns(sql: SQL, dialect: Dialect, table: TableRef): Promise<Column[]> {
    if (dialect === "sqlite") {
        const rows = await sql.unsafe(`PRAGMA table_info(${quoteIdent(table.name, dialect)})`)
        return rows.map((r: any) => ({ name: r.name, dataType: String(r.type || "text").toLowerCase() }))
    }
    if (dialect === "mysql") {
        const rows = await sql`SELECT COLUMN_NAME AS name, COLUMN_TYPE AS type FROM information_schema.COLUMNS
                               WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table.name} ORDER BY ORDINAL_POSITION`
        return rows.map((r: any) => ({ name: r.name, dataType: String(r.type).toLowerCase() }))
    }
    const rows = await sql`SELECT column_name AS name, data_type AS type FROM information_schema.columns
                           WHERE table_schema = ${table.schema} AND table_name = ${table.name} ORDER BY ordinal_position`
    return rows.map((r: any) => ({ name: r.name, dataType: String(r.type).toLowerCase() }))
}

const qualified = (table: TableRef, dialect: Dialect) =>
    table.schema && dialect === "postgres"
        ? `${quoteIdent(table.schema, dialect)}.${quoteIdent(table.name, dialect)}`
        : quoteIdent(table.name, dialect)
async function resolveTable(sql: SQL, dialect: Dialect, key: string) {
    const table = (await listTables(sql, dialect)).find((tbl) => tbl.key === key)
    if (!table) throw new Error(`Table "${key}" was not found`)
    return table
}

async function readRows(sql: SQL, dialect: Dialect, table: TableRef, limit: number) {
    const rows = await sql.unsafe(`SELECT * FROM ${qualified(table, dialect)} LIMIT ${Math.floor(limit)}`)
    return [...rows] as Record<string, unknown>[]
}

async function countRows(sql: SQL, dialect: Dialect, table: TableRef) {
    const [row] = await sql.unsafe(`SELECT COUNT(*) AS n FROM ${qualified(table, dialect)}`)
    return Number(row?.n ?? 0)
}

function inferType(column: Column, values: unknown[]): PropertyType {
    const t = column.dataType
    if (/^(tinyint\(1\)|bool|boolean)/.test(t)) return "checkbox"
    if (/int|numeric|decimal|real|double|float|money|serial/.test(t)) return "number"
    if (/date|time/.test(t)) return "date"
    if (t === "user-defined" || t.startsWith("enum(")) return "select"

    const present = values.filter((v) => v !== null && v !== undefined && v !== "")
    if (present.length === 0) return "text"
    if (present.every((v) => typeof v === "boolean")) return "checkbox"
    if (present.every((v) => typeof v === "number" || typeof v === "bigint")) return "number"
    if (present.every((v) => v instanceof Date)) return "date"
    if (present.every((v) => typeof v === "string" && v.length <= 40)) {
        const distinct = new Set(present as string[])
        if (present.length >= 5 && distinct.size <= 12 && distinct.size <= present.length / 2) return "select"
    }
    return "text"
}

function pickTitleColumn(columns: Column[], types: PropertyType[]) {
    const byName = columns.findIndex((c) => /^(name|title|label|subject|full_?name)$/i.test(c.name))
    if (byName !== -1) return byName
    const text = types.findIndex((t, i) => t === "text" && !/^id$/i.test(columns[i].name))
    return text !== -1 ? text : 0
}

function toText(value: unknown): string {
    if (value === null || value === undefined) return ""
    if (value instanceof Date) return value.toISOString()
    if (value instanceof Uint8Array) return `[binary ${value.byteLength} bytes]`
    if (typeof value === "object") return JSON.stringify(value)
    return String(value)
}

function toCell(value: unknown, property: Property): unknown {
    if (value === null || value === undefined) {
        return property.type === "checkbox" ? false : property.type === "text" || property.type === "title" ? "" : null
    }
    switch (property.type) {
        case "number": {
            const n = Number(value)
            return Number.isFinite(n) ? n : null
        }
        case "checkbox":
            return value === true || value === 1 || ["t", "true", "1", "yes"].includes(String(value).toLowerCase())
        case "date": {
            const d = value instanceof Date ? value : new Date(String(value))
            return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
        }
        case "select":
            return property.options?.find((o) => o.name === toText(value))?.id ?? null
        default:
            return toText(value)
    }
}

function buildProperties(columns: Column[], rows: Record<string, unknown>[]): Property[] {
    const types = columns.map((c) => inferType(c, rows.map((r) => r[c.name])))
    const titleIndex = pickTitleColumn(columns, types)

    return columns.map((column, i) => {
        const type: PropertyType = i === titleIndex ? "title" : types[i]
        const property: Property = {
            id: crypto.randomUUID(),
            name: column.name,
            type,
            width: type === "title" ? 280 : type === "checkbox" ? 110 : type === "number" ? 130 : 200,
        }
        if (type === "select") {
            const names = [...new Set(rows.map((r) => toText(r[column.name])).filter(Boolean))]
            property.options = names.map((name, n) => ({ id: crypto.randomUUID(), name, color: TAG_COLORS[n % TAG_COLORS.length] }))
        }
        return property
    })
}

async function withSource<T>(connection: ConnectionInput, fn: (sql: SQL, dialect: Dialect) => Promise<T>): Promise<T> {
    const sql = openConnection(connection, { create: false })
    try {
        return await withTimeout(fn(sql, dialectOf(connection.provider)), 20000)
    } finally {
        await sql.close().catch(() => {})
    }
}

const WorkspaceScoped = { connection: ConnectionInput, workspaceId: t.String() }

export const importRoutes = new Elysia({ prefix: "/api/import" })
    .use(authPlugin)
    .post(
        "/tables",
        async ({ body, user }) => {
            await requireRole(user.id, body.workspaceId, "admin")
            return withSource(body.connection, async (sql, dialect) => ({
                tables: (await listTables(sql, dialect)).map((tbl) => tbl.key),
            }))
        },
        { auth: true, body: t.Object(WorkspaceScoped) },
    )
    .post(
        "/preview",
        async ({ body, user }) => {
            await requireRole(user.id, body.workspaceId, "admin")
            return withSource(body.connection, async (sql, dialect) => {
                const table = await resolveTable(sql, dialect, body.table)
                const columns = await listColumns(sql, dialect, table)
                const sample = await readRows(sql, dialect, table, 200)
                const properties = buildProperties(columns, sample)
                return {
                    total: await countRows(sql, dialect, table),
                    columns: properties.map((p) => ({ name: p.name, type: p.type })),
                    rows: sample.slice(0, 8).map((r) => columns.map((c) => toText(r[c.name]))),
                }
            })
        },
        { auth: true, body: t.Object({ ...WorkspaceScoped, table: t.String() }) },
    )
    .post(
        "/",
        async ({ body, user }) => {
            await requireRole(user.id, body.workspaceId, "admin")
            const database = await withSource(body.connection, async (sql, dialect) => {
                const table = await resolveTable(sql, dialect, body.table)
                const columns = await listColumns(sql, dialect, table)
                const rows = await readRows(sql, dialect, table, MAX_IMPORT_ROWS)
                const properties = buildProperties(columns, rows)
                return {
                    title: table.name,
                    properties,
                    rows: rows.map((r) => ({
                        id: crypto.randomUUID(),
                        cells: Object.fromEntries(properties.map((p, i) => [p.id, toCell(r[columns[i].name], p)])),
                    })),
                    filters: [],
                    advancedFilter: null,
                    sorts: [],
                }
            })
            const page = await createPage({
                workspaceId: body.workspaceId,
                parentId: body.parentId ?? null,
                kind: "database",
                title: database.title,
                content: database,
            })
            return { page, imported: database.rows.length, truncated: database.rows.length === MAX_IMPORT_ROWS }
        },
        {
            auth: true,
            body: t.Object({ ...WorkspaceScoped, table: t.String(), parentId: t.Optional(t.Nullable(t.String())) }),
        },
    )
