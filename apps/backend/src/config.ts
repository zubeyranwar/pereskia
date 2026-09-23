import { mkdir, chmod } from "node:fs/promises"
import { join, resolve } from "node:path"
import type { ConnectionInput, Provider } from "./connection"

export const DATA_DIR = resolve(process.env.DATA_DIR ?? join(import.meta.dir, "..", "data"))
const CONFIG_PATH = join(DATA_DIR, "config.json")

export type EmailConfig =
    | { provider: "resend"; apiKey: string; from: string }
    | { provider: "smtp"; host: string; port: number; secure: boolean; user?: string; pass?: string; from: string }

// Everything here is optional: storage can come from DATABASE_URL, email from env or be left unset.
export type AppConfig = {
    storage?: ConnectionInput
    email?: EmailConfig
    appUrl?: string
    configuredAt?: number
}

export function storageFromEnv(): ConnectionInput | null {
    const url = process.env.DATABASE_URL
    if (!url) return null
    const scheme = url.split(":")[0]
    const provider: Provider =
        (process.env.DATABASE_PROVIDER as Provider) ??
        (scheme === "mysql" || scheme === "mariadb" ? "mysql" : scheme === "sqlite" || scheme === "file" ? "sqlite" : "postgres")
    return { provider, url, ssl: process.env.DATABASE_SSL === "true" }
}

async function readConfigFile(): Promise<AppConfig> {
    const file = Bun.file(CONFIG_PATH)
    if (!(await file.exists())) return {}
    return (await file.json()) as AppConfig
}

export async function loadConfig(): Promise<AppConfig> {
    const config = await readConfigFile()
    const env = storageFromEnv()
    return env ? { ...config, storage: env } : config
}

export async function updateConfig(patch: Partial<AppConfig>) {
    const next = { ...(await readConfigFile()), ...patch }
    await mkdir(DATA_DIR, { recursive: true })
    await Bun.write(CONFIG_PATH, JSON.stringify(next, null, 2))
    await chmod(CONFIG_PATH, 0o600).catch(() => {})
}

export const defaultSqlitePath = () => join(DATA_DIR, "pereskia.db")
