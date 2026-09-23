import { Elysia, t } from "elysia"
import { storage } from "../storage"
import {
    HttpError,
    SESSION_COOKIE,
    addMember,
    authPlugin,
    checkRateLimit,
    clearSessionCookie,
    countUsers,
    createSession,
    deleteSession,
    hashPassword,
    isInstanceAdmin,
    normalizeEmail,
    setSessionCookie,
    toUser,
    verifyPassword,
    type User,
} from "../auth"
import { acceptInvitation, findInvitation } from "./members"

export const signupOpen = () => process.env.ALLOW_SIGNUP !== "false"

export async function createUser(input: { name: string; email: string; password: string }): Promise<User> {
    const { sql } = storage()
    const email = normalizeEmail(input.email)
    const [existing] = await sql`SELECT id FROM users WHERE email = ${email}`
    if (existing) throw new HttpError(409, "An account with this email already exists.")
    const user: User = { id: crypto.randomUUID(), email, name: input.name.trim(), createdAt: Date.now() }
    await sql`INSERT INTO users (id, email, name, password_hash, created_at)
              VALUES (${user.id}, ${user.email}, ${user.name}, ${await hashPassword(input.password)}, ${user.createdAt})`
    return user
}

export const Credentials = {
    name: t.String({ minLength: 1, maxLength: 100 }),
    email: t.String({ format: "email", maxLength: 320 }),
    password: t.String({ minLength: 8, maxLength: 200 }),
}

export const authRoutes = new Elysia({ prefix: "/api/auth" })
    .use(authPlugin)
    .get("/me", async ({ user }) => ({ ...user, instanceAdmin: await isInstanceAdmin(user.id) }), { auth: true })
    .post(
        "/signup",
        async ({ body, cookie, request }) => {
            checkRateLimit(`signup:${request.headers.get("x-forwarded-for") ?? "local"}`, 20)
            const firstUser = (await countUsers()) === 0
            const invitation = body.inviteToken ? await findInvitation(body.inviteToken) : null

            if (invitation) {
                if (invitation.status !== "pending") throw new HttpError(410, "This invitation is no longer valid.")
                if (invitation.email !== normalizeEmail(body.email)) {
                    throw new HttpError(403, `This invitation was sent to ${invitation.email}.`)
                }
            } else if (!firstUser && !signupOpen()) {
                throw new HttpError(403, "Sign-ups are invite-only. Ask a workspace admin for an invitation.")
            }

            const user = await createUser(body)

            if (firstUser) {
                const { sql } = storage()
                const workspaces = await sql`SELECT id FROM workspaces`
                for (const ws of workspaces) await addMember(ws.id, user.id, "owner")
            }
            if (invitation) await acceptInvitation(invitation, user)

            setSessionCookie(cookie, await createSession(user.id), request)
            return user
        },
        { body: t.Object({ ...Credentials, inviteToken: t.Optional(t.String()) }) },
    )
    .post(
        "/login",
        async ({ body, cookie, request }) => {
            const email = normalizeEmail(body.email)
            checkRateLimit(`login:${email}`)
            const { sql } = storage()
            const [row] = await sql`SELECT * FROM users WHERE email = ${email}`
            if (!(await verifyPassword(body.password, row?.password_hash ?? null))) {
                throw new HttpError(401, "Incorrect email or password.")
            }
            setSessionCookie(cookie, await createSession(row.id), request)
            return toUser(row)
        },
        { body: t.Object({ email: t.String(), password: t.String() }) },
    )
    .post("/logout", async ({ cookie }) => {
        await deleteSession(cookie[SESSION_COOKIE]?.value as string | undefined)
        clearSessionCookie(cookie)
        return { ok: true }
    })
