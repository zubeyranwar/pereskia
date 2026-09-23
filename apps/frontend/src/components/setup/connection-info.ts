import { Database, Feather, Zap } from "lucide-react"
import type { ConnectionInput, Provider } from "@/api/types"

type ProviderInfo = {
    id: Provider
    name: string
    description: string
    color: string
    icon: typeof Database
    defaultPort?: number
}

export const PROVIDER_INFO: Record<Provider, ProviderInfo> = {
    sqlite: { id: "sqlite", name: "SQLite", description: "Single file on this server. No setup.", color: "#0F80CC", icon: Feather },
    postgres: { id: "postgres", name: "PostgreSQL", description: "Your own Postgres server.", color: "#336791", icon: Database, defaultPort: 5432 },
    mysql: { id: "mysql", name: "MySQL", description: "MySQL or MariaDB.", color: "#00758F", icon: Database, defaultPort: 3306 },
    supabase: { id: "supabase", name: "Supabase", description: "Hosted Postgres by Supabase.", color: "#3ECF8E", icon: Zap, defaultPort: 5432 },
}

export function isConnectionComplete(c: ConnectionInput) {
    if (c.provider === "sqlite") return !!c.filename?.trim()
    return !!c.url?.trim() || !!c.host?.trim()
}
