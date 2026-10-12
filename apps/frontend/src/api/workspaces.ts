import { http } from "@/lib/http"
import type { CreatedInvitation, Invitation, Member, Role, TrackerToken, Workspace } from "./types"

export const workspacesApi = {
    list: () => http.get<Workspace[]>("/workspaces").then((r) => r.data),
    create: (name: string) => http.post<Workspace>("/workspaces", { name }).then((r) => r.data),
    update: (id: string, patch: { name?: string; icon?: string | null }) =>
        http.patch<Workspace>(`/workspaces/${id}`, patch).then((r) => r.data),

    members: (id: string) => http.get<Member[]>(`/workspaces/${id}/members`).then((r) => r.data),
    setRole: (id: string, userId: string, role: Exclude<Role, "owner">) =>
        http.patch(`/workspaces/${id}/members/${userId}`, { role }).then(() => undefined),
    removeMember: (id: string, userId: string) => http.delete(`/workspaces/${id}/members/${userId}`).then(() => undefined),

    invitations: (id: string) => http.get<Invitation[]>(`/workspaces/${id}/invitations`).then((r) => r.data),
    invite: (id: string, email: string, role: Exclude<Role, "owner">) =>
        http.post<CreatedInvitation>(`/workspaces/${id}/invitations`, { email, role }).then((r) => r.data),
    revokeInvitation: (id: string, inviteId: string) =>
        http.delete(`/workspaces/${id}/invitations/${inviteId}`).then(() => undefined),

    trackerTokens: (id: string) => http.get<TrackerToken[]>(`/workspaces/${id}/tracker-tokens`).then((r) => r.data),
    createTrackerToken: (id: string, name: string) =>
        http.post<{ id: string; token: string }>(`/workspaces/${id}/tracker-tokens`, { name }).then((r) => r.data),
    revokeTrackerToken: (id: string, tokenId: string) =>
        http.delete(`/workspaces/${id}/tracker-tokens/${tokenId}`).then(() => undefined),
}
