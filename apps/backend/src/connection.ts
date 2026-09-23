import { SQL } from "bun"
import { t, type Static } from "elysia"

export const PROVIDERS = ["sqlite", "postgres", "mysql", "supabase"] as const
export type Provider = (typeof PROVIDERS)[number]
export type Dialect = "sqlite" | "postgres" | "mysql"
export const ConnectionInput = t.Object({
    provider: t.Union(PROVIDERS.map((p) => t.Literal(p))),
    url: t.Optional(t.String()),
    filename: t.Optional(t.String()),
    host: t.Optional(t.String()),
    port: t.Optional(t.Number()),
    database: t.Optional(t.String()),
    user: t.Optional(t.String()),
    password: t.Optional(t.String()),
    ssl: t.Optional(t.Boolean()),
})
export type ConnectionInput = Static<typeof ConnectionInput>

export const dialectOf = (provider: Provider): Dialect => (provider === "supabase" ? "postgres" : provider)

export function openConnection(input: ConnectionInput, { create = true }: { create?: boolean } = {}): SQL {
    const dialect = dialectOf(input.provider)

    if (dialect === "sqlite") {
        const filename = input.filename?.trim() || input.url?.replace(/^sqlite:\/\//, "").trim()
        if (!filename) throw new Error("A database file path is required")
        return new SQL({ adapter: "sqlite", filename, create, readwrite: true })
    }
    const tls = input.provider === "supabase" ? true : !!input.ssl
    const url = input.url?.trim()
    if (url) {
        return new SQL(url, { adapter: dialect, tls: tls || undefined, max: 10 })
    }
    if (!input.host) throw new Error("Host is required")
    return new SQL({
        adapter: dialect,
        hostname: input.host,
        port: input.port ?? (dialect === "mysql" ? 3306 : 5432),
        database: input.database,
        username: input.user,
        password: input.password,
        tls,
        max: 10,
    })
}
export async function testConnection(input: ConnectionInput): Promise<{ ok: true; version: string } | { ok: false; error: string }> {
    let sql: SQL | undefined
    try {
        sql = openConnection(input)
        const dialect = dialectOf(input.provider)
        const query =
            dialect === "sqlite" ? "SELECT sqlite_version() AS version" : dialect === "mysql" ? "SELECT VERSION() AS version" : "SELECT version() AS version"
        const rows = await withTimeout(sql.unsafe(query), 8000)
        return { ok: true, version: String(rows[0]?.version ?? "") }
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
    } finally {
        await sql?.close().catch(() => {})
    }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s`)), ms)),
    ])
}
export function quoteIdent(name: string, dialect: Dialect) {
    if (dialect === "mysql") return "`" + name.replace(/`/g, "``") + "`"
    return '"' + name.replace(/"/g, '""') + '"'
}
