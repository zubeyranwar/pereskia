import { Elysia, t } from "elysia"
import { storage } from "../storage"
import {
    HttpError,
    addMember,
    authPlugin,
    hashToken,
    normalizeEmail,
    randomToken,
    requireRole,
    roleIn,
    toUser,
    type Role,
    type User,
} from "../auth"
import { configuredAppUrl, mailEnabled, sendInvitationEmail } from "../mailer"

const INVITE_TTL = 7 * 24 * 60 * 60 * 1000

type Invitation = {
    id: string
    workspaceId: string
    workspaceName: string
    email: string
    role: Role
    invitedBy: string
    createdAt: number
    expiresAt: number
    status: "pending" | "accepted" | "expired"
}

const toInvitation = (row: any): Invitation => ({
    id: row.id,
    workspaceId: row.workspace_id,
    workspaceName: row.workspace_name,
    email: row.email,
    role: row.role,
    invitedBy: row.inviter_name,
    createdAt: Number(row.created_at),
    expiresAt: Number(row.expires_at),
    status: row.accepted_at ? "accepted" : Number(row.expires_at) < Date.now() ? "expired" : "pending",
})

export async function findInvitation(token: string): Promise<Invitation | null> {
    const { sql } = storage()
    const [row] = await sql`SELECT i.*, w.name AS workspace_name, u.name AS inviter_name
                            FROM invitations i
                            JOIN workspaces w ON w.id = i.workspace_id
                            JOIN users u ON u.id = i.invited_by
                            WHERE i.token_hash = ${hashToken(token)}`
    return row ? toInvitation(row) : null
}

export async function acceptInvitation(invitation: Invitation, user: User) {
    const { sql } = storage()
    await addMember(invitation.workspaceId, user.id, invitation.role)
    await sql`UPDATE invitations SET accepted_at = ${Date.now()} WHERE id = ${invitation.id}`
}

// Links in emails need an absolute URL: prefer the configured one, else the origin the admin is using.
function appUrl(request: Request) {
    const base = configuredAppUrl() ?? request.headers.get("origin") ?? new URL(request.url).origin
    return base.replace(/\/+$/, "")
}

const RoleSchema = t.Union([t.Literal("admin"), t.Literal("member")])

export const memberRoutes = new Elysia({ prefix: "/api" })
    .use(authPlugin)
    .get(
        "/workspaces/:id/members",
        async ({ params, user }) => {
            await requireRole(user.id, params.id)
            const { sql } = storage()
            const rows = await sql`SELECT u.id, u.email, u.name, u.created_at, m.role, m.created_at AS joined_at
                                   FROM workspace_members m JOIN users u ON u.id = m.user_id
                                   WHERE m.workspace_id = ${params.id}
                                   ORDER BY m.created_at`
            return rows.map((r: any) => ({ user: toUser(r), role: r.role as Role, joinedAt: Number(r.joined_at) }))
        },
        { auth: true },
    )
    .patch(
        "/workspaces/:id/members/:userId",
        async ({ params, body, user }) => {
            await requireRole(user.id, params.id, "admin")
            const target = await roleIn(params.userId, params.id)
            if (!target) throw new HttpError(404, "Member not found")
            if (target === "owner") throw new HttpError(403, "The workspace owner's role can't be changed.")
            const { sql } = storage()
            await sql`UPDATE workspace_members SET role = ${body.role}
                      WHERE workspace_id = ${params.id} AND user_id = ${params.userId}`
            return { ok: true }
        },
        { auth: true, body: t.Object({ role: RoleSchema }) },
    )
    .delete(
        "/workspaces/:id/members/:userId",
        async ({ params, user }) => {
            const leaving = params.userId === user.id
            await requireRole(user.id, params.id, leaving ? "member" : "admin")
            const target = await roleIn(params.userId, params.id)
            if (!target) throw new HttpError(404, "Member not found")
            if (target === "owner") throw new HttpError(403, "The workspace owner can't be removed.")
            const { sql } = storage()
            await sql`DELETE FROM workspace_members WHERE workspace_id = ${params.id} AND user_id = ${params.userId}`
            return { ok: true }
        },
        { auth: true },
    )
    .get(
        "/workspaces/:id/invitations",
        async ({ params, user }) => {
            await requireRole(user.id, params.id, "admin")
            const { sql } = storage()
            const rows = await sql`SELECT i.*, w.name AS workspace_name, u.name AS inviter_name
                                   FROM invitations i
                                   JOIN workspaces w ON w.id = i.workspace_id
                                   JOIN users u ON u.id = i.invited_by
                                   WHERE i.workspace_id = ${params.id} AND i.accepted_at IS NULL
                                   ORDER BY i.created_at DESC`
            return rows.map(toInvitation)
        },
        { auth: true },
    )
    .post(
        "/workspaces/:id/invitations",
        async ({ params, body, user, request }) => {
            await requireRole(user.id, params.id, "admin")
            const { sql } = storage()
            const email = normalizeEmail(body.email)
            const [member] = await sql`SELECT 1 AS found FROM workspace_members m JOIN users u ON u.id = m.user_id
                                       WHERE m.workspace_id = ${params.id} AND u.email = ${email}`
            if (member) throw new HttpError(409, `${email} is already a member of this workspace.`)

            await sql`DELETE FROM invitations WHERE workspace_id = ${params.id} AND email = ${email} AND accepted_at IS NULL`
            const token = randomToken()
            const now = Date.now()
            const id = crypto.randomUUID()
            await sql`INSERT INTO invitations (id, workspace_id, email, role, token_hash, invited_by, created_at, expires_at)
                      VALUES (${id}, ${params.id}, ${email}, ${body.role}, ${hashToken(token)}, ${user.id}, ${now}, ${now + INVITE_TTL})`
            const expiresAt = now + INVITE_TTL

            let emailed = false
            let emailError: string | undefined
            if (mailEnabled()) {
                const [workspace] = await sql`SELECT name FROM workspaces WHERE id = ${params.id}`
                try {
                    await sendInvitationEmail({
                        to: email,
                        inviterName: user.name,
                        workspaceName: workspace.name,
                        role: body.role,
                        url: `${appUrl(request)}/invite/${token}`,
                        baseUrl: appUrl(request),
                        expiresAt,
                    })
                    emailed = true
                } catch (err) {
                    console.error(`Could not send invitation email to ${email}:`, err)
                    // Only admins see this, and the provider's reason (e.g. an unverified domain) is what they need to fix it.
                    const reason = err instanceof Error ? err.message : String(err)
                    emailError = `The invitation email couldn't be sent (${reason}). Share the link instead.`
                }
            }
            return { id, email, role: body.role, token, expiresAt, emailed, emailError }
        },
        { auth: true, body: t.Object({ email: t.String({ format: "email", maxLength: 320 }), role: RoleSchema }) },
    )
    .delete(
        "/workspaces/:id/invitations/:inviteId",
        async ({ params, user }) => {
            await requireRole(user.id, params.id, "admin")
            const { sql } = storage()
            await sql`DELETE FROM invitations WHERE id = ${params.inviteId} AND workspace_id = ${params.id}`
            return { ok: true }
        },
        { auth: true },
    )
    .get("/invitations/:token", async ({ params }) => {
        const invitation = await findInvitation(params.token)
        if (!invitation) throw new HttpError(404, "This invitation link is invalid.")
        const { sql } = storage()
        const [existing] = await sql`SELECT 1 AS found FROM users WHERE email = ${invitation.email}`
        return {
            workspaceName: invitation.workspaceName,
            email: invitation.email,
            role: invitation.role,
            invitedBy: invitation.invitedBy,
            status: invitation.status,
            hasAccount: !!existing,
        }
    })
    .post(
        "/invitations/:token/accept",
        async ({ params, user }) => {
            const invitation = await findInvitation(params.token)
            if (!invitation) throw new HttpError(404, "This invitation link is invalid.")
            if (invitation.status !== "pending") throw new HttpError(410, "This invitation is no longer valid.")
            if (invitation.email !== user.email) {
                throw new HttpError(403, `This invitation was sent to ${invitation.email}. Sign in with that account to accept it.`)
            }
            await acceptInvitation(invitation, user)
            return { workspaceId: invitation.workspaceId }
        },
        { auth: true },
    )
