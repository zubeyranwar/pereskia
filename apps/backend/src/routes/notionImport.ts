import { Elysia, t } from "elysia"
import { authPlugin, requireRole } from "../auth"
import { createPage } from "./pages"

const NOTION_VERSION = "2022-06-28"
const MAX_IMPORT_ROWS = 5000
const TAG_COLORS = ["blue", "green", "purple", "orange", "pink", "yellow", "red", "brown", "gray", "default"]

type PropertyType = "title" | "text" | "number" | "select" | "multiSelect" | "status" | "date" | "checkbox"
type Option = { id: string; name: string; color: string }
type Property = { id: string; name: string; type: PropertyType; width: number; options?: Option[] }

async function notionFetch(token: string, path: string, body?: unknown) {
    const res = await fetch(`https://api.notion.com/v1${path}`, {
        method: body !== undefined ? "POST" : "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json",
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as any).message ?? `Notion API error ${res.status}`)
    }
    return res.json()
}

async function listDatabases(token: string): Promise<{ id: string; title: string }[]> {
    const data = await notionFetch(token, "/search", { filter: { property: "object", value: "database" }, page_size: 100 })
    return (data.results ?? []).map((db: any) => ({
        id: db.id,
        title: db.title?.[0]?.plain_text ?? "Untitled",
    }))
}

async function getDatabase(token: string, databaseId: string) {
    return notionFetch(token, `/databases/${databaseId}`)
}

function notionColorToApp(color: string): string {
    const map: Record<string, string> = {
        default: "default",
        gray: "gray",
        brown: "brown",
        orange: "orange",
        yellow: "yellow",
        green: "green",
        blue: "blue",
        purple: "purple",
        pink: "pink",
        red: "red",
    }
    return map[color] ?? "default"
}

function buildProperties(schema: any): Property[] {
    const props: Property[] = []
    for (const [name, def] of Object.entries(schema.properties as Record<string, any>)) {
        const type = mapPropertyType(def.type)
        if (!type) continue
        const prop: Property = {
            id: def.id ?? crypto.randomUUID(),
            name,
            type,
            width: type === "title" ? 280 : type === "checkbox" ? 110 : type === "number" ? 130 : 200,
        }
        if ((type === "select" || type === "multiSelect" || type === "status") && def[def.type]) {
            const srcOptions =
                def[def.type]?.options ?? def[def.type]?.groups?.flatMap((g: any) => g.options ?? []) ?? []
            prop.options = srcOptions.map((o: any) => ({
                id: o.id ?? crypto.randomUUID(),
                name: o.name,
                color: notionColorToApp(o.color ?? "default"),
            }))
        }
        props.push(prop)
    }
    // ensure title is first
    const titleIdx = props.findIndex((p) => p.type === "title")
    if (titleIdx > 0) {
        const [t] = props.splice(titleIdx, 1)
        props.unshift(t)
    }
    return props
}

function mapPropertyType(notionType: string): PropertyType | null {
    switch (notionType) {
        case "title": return "title"
        case "rich_text": return "text"
        case "number": return "number"
        case "select": return "select"
        case "multi_select": return "multiSelect"
        case "status": return "status"
        case "date": return "date"
        case "checkbox": return "checkbox"
        case "url":
        case "email":
        case "phone_number":
        case "created_time":
        case "last_edited_time":
            return "text"
        default: return null
    }
}

function extractCell(pageProps: Record<string, any>, propName: string, propDef: Property): unknown {
    const raw = pageProps[propName]
    if (!raw) return null
    const type = raw.type as string
    switch (type) {
        case "title":
        case "rich_text":
            return raw[type]?.map((t: any) => t.plain_text ?? "").join("") ?? ""
        case "number":
            return raw.number ?? null
        case "checkbox":
            return raw.checkbox ?? false
        case "select":
            if (!raw.select) return null
            return propDef.options?.find((o) => o.name === raw.select.name)?.id ?? null
        case "multi_select":
            return (raw.multi_select ?? [])
                .map((s: any) => propDef.options?.find((o) => o.name === s.name)?.id)
                .filter(Boolean) as string[]
        case "status":
            if (!raw.status) return null
            return propDef.options?.find((o) => o.name === raw.status.name)?.id ?? null
        case "date":
            return raw.date?.start ?? null
        case "url":
            return raw.url ?? ""
        case "email":
            return raw.email ?? ""
        case "phone_number":
            return raw.phone_number ?? ""
        case "created_time":
            return raw.created_time?.slice(0, 10) ?? null
        case "last_edited_time":
            return raw.last_edited_time?.slice(0, 10) ?? null
        default:
            return null
    }
}

async function queryAllRows(token: string, databaseId: string, limit: number) {
    const rows: any[] = []
    let cursor: string | undefined
    while (rows.length < limit) {
        const pageSize = Math.min(100, limit - rows.length)
        const body: any = { page_size: pageSize }
        if (cursor) body.start_cursor = cursor
        const data = await notionFetch(token, `/databases/${databaseId}/query`, body)
        rows.push(...(data.results ?? []))
        if (!data.has_more) break
        cursor = data.next_cursor
    }
    return rows
}

function buildDatabaseData(schema: any, notionRows: any[]) {
    const properties = buildProperties(schema)
    const rows = notionRows.map((page) => ({
        id: crypto.randomUUID(),
        cells: Object.fromEntries(
            properties.map((p) => [p.id, extractCell(page.properties, p.name, p)]),
        ),
    }))
    return {
        title: schema.title?.[0]?.plain_text ?? "Untitled",
        properties,
        rows,
        filters: [],
        advancedFilter: null,
        sorts: [],
    }
}

export const notionImportRoutes = new Elysia({ prefix: "/api/import/notion" })
    .use(authPlugin)
    .post(
        "/databases",
        async ({ body, user }) => {
            await requireRole(user.id, body.workspaceId, "admin")
            const databases = await listDatabases(body.token)
            return { databases }
        },
        { auth: true, body: t.Object({ workspaceId: t.String(), token: t.String() }) },
    )
    .post(
        "/preview",
        async ({ body, user }) => {
            await requireRole(user.id, body.workspaceId, "admin")
            const schema = await getDatabase(body.token, body.databaseId)
            const properties = buildProperties(schema)
            const notionRows = await queryAllRows(body.token, body.databaseId, 8)
            const total = schema.results?.length // not reliably available; we'll show what we queried
            const rows = notionRows.map((page) =>
                properties.map((p) => {
                    const val = extractCell(page.properties, p.name, p)
                    if (val === null || val === undefined) return ""
                    if (Array.isArray(val)) return val.join(", ")
                    return String(val)
                }),
            )
            return {
                total: notionRows.length,
                hasMore: notionRows.length === 8,
                columns: properties.map((p) => ({ name: p.name, type: p.type })),
                rows,
            }
        },
        { auth: true, body: t.Object({ workspaceId: t.String(), token: t.String(), databaseId: t.String() }) },
    )
    .post(
        "/run",
        async ({ body, user }) => {
            await requireRole(user.id, body.workspaceId, "admin")
            const schema = await getDatabase(body.token, body.databaseId)
            const notionRows = await queryAllRows(body.token, body.databaseId, MAX_IMPORT_ROWS)
            const database = buildDatabaseData(schema, notionRows)
            const page = await createPage({
                workspaceId: body.workspaceId,
                parentId: body.parentId ?? null,
                kind: "database",
                title: database.title,
                content: database,
            })
            return { page, imported: notionRows.length, truncated: notionRows.length === MAX_IMPORT_ROWS }
        },
        {
            auth: true,
            body: t.Object({
                workspaceId: t.String(),
                token: t.String(),
                databaseId: t.String(),
                parentId: t.Optional(t.Nullable(t.String())),
            }),
        },
    )
