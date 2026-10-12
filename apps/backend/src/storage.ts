import type { SQL } from "bun"
import { mkdir } from "node:fs/promises"
import { dirname } from "node:path"
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

    // Tracker tables
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
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS tracker_projects (
        id ${T.id} PRIMARY KEY,
        key ${T.text} NOT NULL,
        name ${T.text} NOT NULL,
        archived ${T.bigint} NOT NULL DEFAULT 0,
        next_task_num ${T.bigint} NOT NULL DEFAULT 1,
        created_at ${T.bigint} NOT NULL
    )`)
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS tracker_statuses (
        id ${T.id} PRIMARY KEY,
        project_id ${T.id} NOT NULL,
        name ${T.text} NOT NULL,
        category ${T.text} NOT NULL,
        order_num ${T.bigint} NOT NULL DEFAULT 0
    )`)
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS tracker_types (
        id ${T.id} PRIMARY KEY,
        project_id ${T.id} NOT NULL,
        name ${T.text} NOT NULL
    )`)
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS tracker_priorities (
        id ${T.id} PRIMARY KEY,
        project_id ${T.id} NOT NULL,
        name ${T.text} NOT NULL,
        rank ${T.bigint} NOT NULL
    )`)
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS tracker_labels (
        id ${T.id} PRIMARY KEY,
        project_id ${T.id} NOT NULL,
        name ${T.text} NOT NULL
    )`)
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS tracker_members (
        id ${T.id} PRIMARY KEY,
        name ${T.text} NOT NULL,
        email ${T.key} NOT NULL UNIQUE,
        active ${T.bigint} NOT NULL DEFAULT 1,
        created_at ${T.bigint} NOT NULL
    )`)
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS tracker_tasks (
        id ${T.id} PRIMARY KEY,
        key ${T.text} NOT NULL UNIQUE,
        project_id ${T.id} NOT NULL,
        type_id ${T.id} NOT NULL,
        title ${T.text} NOT NULL,
        description ${T.longText},
        status_id ${T.id} NOT NULL,
        priority_id ${T.id},
        assignee_id ${T.id},
        reporter_id ${T.id},
        reporter_email ${T.key},
        labels ${T.text},
        due_date ${T.text},
        estimate_points ${T.float},
        subtasks_total ${T.bigint} NOT NULL DEFAULT 0,
        subtasks_done ${T.bigint} NOT NULL DEFAULT 0,
        checklist_total ${T.bigint} NOT NULL DEFAULT 0,
        checklist_done ${T.bigint} NOT NULL DEFAULT 0,
        progress_percent ${T.bigint} NOT NULL DEFAULT 0,
        parent_id ${T.id},
        external_ref ${T.text},
        started_at ${T.bigint},
        completed_at ${T.bigint},
        deleted_at ${T.bigint},
        created_at ${T.bigint} NOT NULL,
        updated_at ${T.bigint} NOT NULL
        ${index("idx_tracker_tasks_project", "project_id, updated_at")}
    )`)
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS tracker_task_history (
        id ${T.id} PRIMARY KEY,
        task_id ${T.id} NOT NULL,
        at ${T.bigint} NOT NULL,
        field ${T.text} NOT NULL,
        from_value ${T.text},
        to_value ${T.text},
        actor_id ${T.id},
        created_at ${T.bigint} NOT NULL
        ${index("idx_tracker_history_task", "task_id")}
    )`)
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS tracker_comments (
        id ${T.id} PRIMARY KEY,
        task_id ${T.id} NOT NULL,
        body ${T.longText} NOT NULL,
        author_id ${T.id},
        author_email ${T.key},
        created_at ${T.bigint} NOT NULL
        ${index("idx_tracker_comments_task", "task_id")}
    )`)
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS tracker_webhooks (
        id ${T.id} PRIMARY KEY,
        url ${T.text} NOT NULL,
        events ${T.text} NOT NULL,
        secret ${T.text} NOT NULL,
        created_at ${T.bigint} NOT NULL
    )`)
    await sql.unsafe(`CREATE TABLE IF NOT EXISTS tracker_idempotency_keys (
        key_hash ${T.hash} PRIMARY KEY,
        body_hash ${T.hash} NOT NULL,
        response ${T.longText} NOT NULL,
        status_code ${T.bigint} NOT NULL,
        created_at ${T.bigint} NOT NULL
    )`)

    if (dialect !== "mysql") {
        await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_tracker_tasks_project ON tracker_tasks (project_id, updated_at)`)
        await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_tracker_history_task ON tracker_task_history (task_id)`)
        await sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_tracker_comments_task ON tracker_comments (task_id)`)
    }
}
