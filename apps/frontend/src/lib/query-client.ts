import { QueryClient } from "@tanstack/react-query"
import { ApiError } from "./http"

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
        },
    },
})

export const queryKeys = {
    setup: ["setup"] as const,
    me: ["me"] as const,
    workspaces: ["workspaces"] as const,
    pages: (workspaceId: string) => ["workspaces", workspaceId, "pages"] as const,
    page: (id: string) => ["page", id] as const,
    members: (workspaceId: string) => ["workspaces", workspaceId, "members"] as const,
    invitations: (workspaceId: string) => ["workspaces", workspaceId, "invitations"] as const,
    invitation: (token: string) => ["invitation", token] as const,
    emailSettings: ["instance", "email"] as const,
}
