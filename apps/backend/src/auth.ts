import { Elysia, type Cookie } from "elysia"
import { storage } from "./storage"

export type Role = "owner" | "admin" | "member"
export type User = { id: string; email: string; name: string; createdAt: number }

export const SESSION_COOKIE = "pereskia_session"
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000
const ROLE_RANK: Record<Role, number> = { member: 0, admin: 1, owner: 2 }

export class HttpError extends Error {
    status: number
    constructor(status: number, message: string) {
        super(message)
        this.status = status
    }
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase()

export const toUser = (row: any): User => ({
    id: row.id,
    email: row.email,
    name: row.name,
    createdAt: Number(row.created_at),
})

export function randomToken() {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    return Buffer.from(bytes).toString("base64url")
}

export const hashToken = (token: string) => new Bun.CryptoHasher("sha256").update(token).digest("hex")

let dummyHash: Promise<string> | null = null

export async function verifyPassword(password: string, hash: string | null) {
    if (!hash) {
        dummyHash ??= Bun.password.hash("pereskia-timing-guard")
        await Bun.password.verify(password, await dummyHash)
        return false
    }
    return Bun.password.verify(password, hash)
}

export const hashPassword = (password: string) => Bun.password.hash(password, { algorithm: "argon2id" })

export async function createSession(userId: string) {
    const { sql } = storage()
    const token = randomToken()
    const now = Date.now()
    await sql`INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
              VALUES (${hashToken(token)}, ${userId}, ${now + SESSION_TTL}, ${now})`
    return token
}

export async function userForSession(token: string | undefined): Promise<User | null> {
    if (!token) return null
    const { sql } = storage()
    const [row] = await sql`SELECT u.id, u.email, u.name, u.created_at, s.expires_at
                            FROM sessions s JOIN users u ON u.id = s.user_id
                            WHERE s.token_hash = ${hashToken(token)}`
    if (!row || Number(row.expires_at) < Date.now()) return null
    return toUser(row)
}

export async function deleteSession(token: string | undefined) {
    if (!token) return
    const { sql } = storage()
    await sql`DELETE FROM sessions WHERE token_hash = ${hashToken(token)}`
}

const isSecureRequest = (request: Request) =>
    process.env.COOKIE_SECURE === "true" ||
    request.headers.get("x-forwarded-proto") === "https" ||
    new URL(request.url).protocol === "https:"

export function setSessionCookie(cookie: Record<string, Cookie<unknown>>, token: string, request: Request) {
    cookie[SESSION_COOKIE].set({
        value: token,
        httpOnly: true,
        sameSite: "lax",
        secure: isSecureRequest(request),
        path: "/",
        maxAge: SESSION_TTL / 1000,
    })
}

export function clearSessionCookie(cookie: Record<string, Cookie<unknown>>) {
    cookie[SESSION_COOKIE].set({ value: "", httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 })
}

export const authPlugin = new Elysia({ name: "auth" }).macro({
    auth: {
        async resolve({ cookie, status }) {
            const user = await userForSession(cookie[SESSION_COOKIE]?.value as string | undefined)
            if (!user) return status(401, { error: "You need to sign in.", code: "UNAUTHORIZED" })
            return { user }
        },
    },
})

export async function roleIn(userId: string, workspaceId: string): Promise<Role | null> {
    const { sql } = storage()
    const [row] = await sql`SELECT role FROM workspace_members WHERE workspace_id = ${workspaceId} AND user_id = ${userId}`
    return (row?.role as Role) ?? null
}

export async function requireRole(userId: string, workspaceId: string, min: Role = "member") {
    const role = await roleIn(userId, workspaceId)
    if (!role) throw new HttpError(404, "Workspace not found")
    if (ROLE_RANK[role] < ROLE_RANK[min]) throw new HttpError(403, "You don't have permission to do that.")
    return role
}

export async function requirePageAccess(userId: string, pageId: string) {
    const { sql } = storage()
    const [row] = await sql`SELECT workspace_id FROM pages WHERE id = ${pageId}`
    if (!row) throw new HttpError(404, "Page not found")
    await requireRole(userId, row.workspace_id)
    return row.workspace_id as string
}

export async function addMember(workspaceId: string, userId: string, role: Role) {
    const { sql } = storage()
    if (await roleIn(userId, workspaceId)) return
    await sql`INSERT INTO workspace_members (workspace_id, user_id, role, created_at)
              VALUES (${workspaceId}, ${userId}, ${role}, ${Date.now()})`
}

// The first account (created during setup) administers the server itself, e.g. its email settings.
export async function isInstanceAdmin(userId: string) {
    const { sql } = storage()
    const [row] = await sql`SELECT id FROM users ORDER BY created_at LIMIT 1`
    return row?.id === userId
}

export async function countUsers() {
    const { sql } = storage()
    const [row] = await sql`SELECT COUNT(*) AS n FROM users`
    return Number(row?.n ?? 0)
}

const attempts = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(key: string, limit = 10, windowMs = 15 * 60 * 1000) {
    const now = Date.now()
    const entry = attempts.get(key)
    if (!entry || entry.resetAt < now) {
        attempts.set(key, { count: 1, resetAt: now + windowMs })
        return
    }
    entry.count++
    if (entry.count > limit) throw new HttpError(429, "Too many attempts. Try again in a few minutes.")
}
