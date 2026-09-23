import type { PropertyKind } from "@/components/pereskia"

export type Provider = "sqlite" | "postgres" | "mysql" | "supabase"
export type Role = "owner" | "admin" | "member"

export type ConnectionInput = {
    provider: Provider
    url?: string
    filename?: string
    host?: string
    port?: number
    database?: string
    user?: string
    password?: string
    ssl?: boolean
}

export type SetupStatus = {
    configured: boolean
    provider: Provider | null
    managedByEnv: boolean
    defaultSqlitePath: string
    hasUsers: boolean
    signupOpen: boolean
    emailManagedByEnv: boolean
}

export type EmailInput =
    | { provider: "resend"; apiKey?: string; from?: string }
    | { provider: "smtp"; host: string; port: number; secure: boolean; user?: string; pass?: string; from?: string }

export type EmailSummary = {
    provider: EmailInput["provider"]
    from: string
    host?: string
    port?: number
    secure?: boolean
    user?: string
    hasSecret: boolean
}

export type EmailSettings = {
    config: EmailSummary | null
    managedByEnv: boolean
    appUrl: string | null
    appUrlFromEnv: boolean
}

export type User = { id: string; email: string; name: string; createdAt: number; instanceAdmin?: boolean }

export type Workspace = { id: string; name: string; icon: string | null; createdAt: number; role?: Role }

export type Member = { user: User; role: Role; joinedAt: number }

export type Invitation = {
    id: string
    email: string
    role: Role
    invitedBy: string
    createdAt: number
    expiresAt: number
    status: "pending" | "accepted" | "expired"
}

export type CreatedInvitation = {
    id: string
    email: string
    role: Role
    token: string
    expiresAt: number
    emailed: boolean
    emailError?: string
}

export type InvitationInfo = {
    workspaceName: string
    email: string
    role: Role
    invitedBy: string
    status: "pending" | "accepted" | "expired"
    hasAccount: boolean
}

export type PageKind = "document" | "database"

export type PageMeta = {
    id: string
    workspaceId: string
    parentId: string | null
    kind: PageKind
    title: string
    icon: string | null
    position: number
    updatedAt: number
}

export type Page = PageMeta & { cover: string | null; content: unknown; createdAt: number }

export type PagePatch = { title?: string; icon?: string | null; cover?: string | null; content?: unknown; parentId?: string | null }

export type ImportPreview = {
    total: number
    columns: { name: string; type: PropertyKind }[]
    rows: string[][]
}

export type Credentials = { name: string; email: string; password: string }
