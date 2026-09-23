import { ApiError, http } from "@/lib/http"
import type { Credentials, InvitationInfo, User } from "./types"

export const authApi = {
    me: () =>
        http
            .get<User>("/auth/me")
            .then((r) => r.data)
            .catch((err) => {
                if (err instanceof ApiError && err.status === 401) return null
                throw err
            }),
    login: (input: { email: string; password: string }) => http.post<User>("/auth/login", input).then((r) => r.data),
    signup: (input: Credentials & { inviteToken?: string }) => http.post<User>("/auth/signup", input).then((r) => r.data),
    logout: () => http.post("/auth/logout").then(() => undefined),
    invitation: (token: string) => http.get<InvitationInfo>(`/invitations/${token}`).then((r) => r.data),
    acceptInvitation: (token: string) =>
        http.post<{ workspaceId: string }>(`/invitations/${token}/accept`).then((r) => r.data),
}
