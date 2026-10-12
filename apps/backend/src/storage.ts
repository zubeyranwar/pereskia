import type { SQL } from "bun"
import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"
import { insertImportedRows } from "./rows"
import { dialectOf, openConnection, type ConnectionInput, type Dialect, type Provider } from "./connection"

let current: { sql: SQL; dialect: Dialect; provider: Provider } | null = null

export function storage() {
    if (!current) throw new StorageNotConfigured()
    return current
}

export const isConfigured = () => current !== null

export class StorageNotConfigured extends Error {
    constructor() {
        super("Storage is not configured. Complete setup first.")
    }
}

export async function ensureSqliteDir(input: ConnectionInput) {
    if (input.provider === "sqlite" && input.filename) {
        await mkdir(dirname(input.filename), { recursive: true })
    }
}

export async function connectStorage(input: ConnectionInput) {
    await ensureSqliteDir(input)
    const sql = openConnection(input)
    const dialect = dialectOf(input.provider)
    await migrate(sql, dialect)
    await current?.sql.close().catch(() => {})
    current = { sql, dialect, provider: input.provider }
}

type ColumnTypes = { id: string; key: string; hash: string; text: string; longText: string; bigint: string; float: string }

const TYPES: Record<Dialect, ColumnTypes> = {
    sqlite: { id: "TEXT", key: "TEXT", hash: "TEXT", text: "TEXT", longText: "TEXT", bigint: "INTEGER", float: "REAL" },
    postgres: { id: "VARCHAR(36)", key: "VARCHAR(320)", hash: "VARCHAR(64)", text: "TEXT", longText: "TEXT", bigint: "BIGINT", float: "DOUBLE PRECISION" },
    mysql: { id: "VARCHAR(36)", key: "VARCHAR(320)", hash: "VARCHAR(64)", text: "TEXT", longText: "LONGTEXT", bigint: "BIGINT", float: "DOUBLE" },
}

async function migrate(sql: SQL, dialect: Dialect) {
    const T = TYPES[dialect]
    const index = (name: string, columns: string) =>
        dialect === "mysql" ? `, INDEX ${name} (${columns})` : ""

    await sql.unsafe(`CREATE TABLE IF NOT EXISTS workspaces (
        id ${T.id} PRIMARY KEY,
        name ${T.text} NOT NULL,
        icon ${T.text},
        created_at ${T.bigint} NOT NULL
    )`)
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS pages (
        id ${T.id} PRIMARY KEY,
        workspace_id ${T.id} NOT NULL,
        parent_id ${T.id},
        kind ${T.text} NOT NULL,
        title ${T.text} NOT NULL,
        icon ${T.text},
        cover ${T.text},
        content ${T.longText},
        position ${T.float} NOT NULL,
        created_at ${T.bigint} NOT NULL,
        updated_at ${T.bigint} NOT NULL
        ${index("idx_pages_workspace", "workspace_id")}
    )`)
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS users (
        id ${T.id} PRIMARY KEY,
        email ${T.key} NOT NULL UNIQUE,
        name ${T.text} NOT NULL,
        password_hash ${T.text} NOT NULL,
        created_at ${T.bigint} NOT NULL
    )`)
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS sessions (
        token_hash ${T.hash} PRIMARY KEY,
        user_id ${T.id} NOT NULL,
        expires_at ${T.bigint} NOT NULL,
        created_at ${T.bigint} NOT NULL
        ${index("idx_sessions_user", "user_id")}
    )`)
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS workspace_members (
        workspace_id ${T.id} NOT NULL,
        user_id ${T.id} NOT NULL,
        role ${T.id} NOT NULL,
        created_at ${T.bigint} NOT NULL,
        PRIMARY KEY (workspace_id, user_id)
        ${index("idx_members_user", "user_id")}
    )`)
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS invitations (
        id ${T.id} PRIMARY KEY,
        workspace_id ${T.id} NOT NULL,
        email ${T.key} NOT NULL,
        role ${T.id} NOT NULL,
        token_hash ${T.hash} NOT NULL UNIQUE,
        invited_by ${T.id} NOT NULL,
        created_at ${T.bigint} NOT NULL,
        expires_at ${T.bigint} NOT NULL,
        accepted_at ${T.bigint}
        ${index("idx_invitations_workspace", "workspace_id")}
    )`)

    if (dialect !== "mysql") {
        await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_pages_workspace ON pages (workspace_id)`)
        await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id)`)
        await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_members_user ON workspace_members (user_id)`)
        await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_invitations_workspace ON invitations (workspace_id)`)
    }

    await sql.unsafe(`CREATE TABLE IF NOT EXISTS database_rows (
        id ${T.id} PRIMARY KEY,
        page_id ${T.id} NOT NULL,
        position ${T.float} NOT NULL,
        cells ${T.longText} NOT NULL,
        body ${T.longText},
        num ${T.bigint},
        reporter_id ${T.id},
        reporter_email ${T.key},
        external_ref ${T.text},
        started_at ${T.bigint},
        completed_at ${T.bigint},
        deleted_at ${T.bigint},
        created_at ${T.bigint} NOT NULL,
        updated_at ${T.bigint} NOT NULL
        ${index("idx_rows_page", "page_id, updated_at")}
    )`)
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS row_comments (
        id ${T.id} PRIMARY KEY,
        row_id ${T.id} NOT NULL,
        page_id ${T.id} NOT NULL,
        body ${T.longText} NOT NULL,
        author_id ${T.id},
        author_email ${T.key},
        created_at ${T.bigint} NOT NULL
        ${index("idx_comments_row", "row_id")}
    )`)
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS row_history (
        id ${T.id} PRIMARY KEY,
        row_id ${T.id} NOT NULL,
        page_id ${T.id} NOT NULL,
        at ${T.bigint} NOT NULL,
        field ${T.text} NOT NULL,
        from_value ${T.text},
        to_value ${T.text},
        actor_id ${T.id},
        actor_email ${T.key}
        ${index("idx_history_page", "page_id, at")}
    )`)
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS tracker_databases (
        page_id ${T.id} PRIMARY KEY,
        workspace_id ${T.id} NOT NULL,
        project_key ${T.text} NOT NULL,
        next_num ${T.bigint} NOT NULL,
        created_at ${T.bigint} NOT NULL
    )`)

    await sql.unsafe(`CREATE TABLE IF NOT EXISTS tracker_service_tokens (
        id ${T.id} PRIMARY KEY,
        name ${T.text} NOT NULL,
        token_hash ${T.hash} NOT NULL UNIQUE,
        scopes ${T.text} NOT NULL,
        workspace_id ${T.id} NOT NULL,
        workspace_name ${T.text} NOT NULL,
        revoked_at ${T.bigint},
        created_at ${T.bigint} NOT NULL
    )`)
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS tracker_webhooks (
        id ${T.id} PRIMARY KEY,
        url ${T.text} NOT NULL,
        events ${T.text} NOT NULL,
        secret ${T.text} NOT NULL,
        created_at ${T.bigint} NOT NULL
    )`)
    await sql.unsafe(`ALTER TABLE tracker_webhooks ADD COLUMN workspace_id ${T.id}`).catch(() => {})
    await sql.unsafe(`ALTER TABLE tracker_webhooks ADD COLUMN token_id ${T.id}`).catch(() => {})
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS tracker_idempotency_keys (
        key_hash ${T.hash} PRIMARY KEY,
        body_hash ${T.hash} NOT NULL,
        response ${T.longText} NOT NULL,
        status_code ${T.bigint} NOT NULL,
        created_at ${T.bigint} NOT NULL
    )`)

    if (dialect !== "mysql") {
        await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_rows_page ON database_rows (page_id, updated_at)`)
        await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_comments_row ON row_comments (row_id)`)
        await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_history_page ON row_history (page_id, at)`)
    }

    await moveDatabaseRowsOutOfContent(sql)
}

// Database pages used to keep their rows inside pages.content; rows now live in database_rows.
async function moveDatabaseRowsOutOfContent(sql: SQL) {
    const pages = await sql`SELECT id, content, created_at FROM pages WHERE kind = 'database'`
    for (const page of pages) {
        const content = page.content ? JSON.parse(page.content) : null
        if (!Array.isArray(content?.rows)) continue
        const { rows, ...schema } = content
        await sql.begin(async (tx) => {
            await insertImportedRows(tx, page.id, rows, Number(page.created_at))
            await tx`UPDATE pages SET content = ${JSON.stringify(schema)} WHERE id = ${page.id}`
        })
    }
}
