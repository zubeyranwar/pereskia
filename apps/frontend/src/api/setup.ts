import { http } from "@/lib/http"
import type { ConnectionInput, Credentials, EmailInput, SetupStatus, User, Workspace } from "./types"

export type SetupInput = {
    connection: ConnectionInput
    workspaceName: string
    admin: Credentials
    email: EmailInput | null
    appUrl?: string
}

export const setupApi = {
    status: () => http.get<SetupStatus>("/setup/status").then((r) => r.data),
    test: (connection: ConnectionInput) =>
        http
            .post<{ ok: true; version: string } | { ok: false; error: string }>("/setup/test", connection)
            .then((r) => r.data),
    testEmail: (email: EmailInput, to: string) => http.post("/setup/email/test", { email, to }).then(() => undefined),
    complete: (input: SetupInput) =>
        http.post<{ workspace: Workspace; user: User }>("/setup", input).then((r) => r.data),
}
