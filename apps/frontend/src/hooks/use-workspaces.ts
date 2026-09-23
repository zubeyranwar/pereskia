import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { workspacesApi } from "@/api/workspaces"
import { pagesApi } from "@/api/pages"
import type { Role, Workspace } from "@/api/types"
import { queryKeys } from "@/lib/query-client"
import { useAppStore } from "@/stores/app-store"

export const useWorkspaces = (enabled = true) =>
    useQuery({ queryKey: queryKeys.workspaces, queryFn: workspacesApi.list, enabled })

export function useCurrentWorkspace(): Workspace | null {
    const { data } = useWorkspaces()
    const workspaceId = useAppStore((s) => s.workspaceId)
    return data?.find((w) => w.id === workspaceId) ?? data?.[0] ?? null
}

export const canManage = (workspace: Workspace | null) => workspace?.role === "owner" || workspace?.role === "admin"

export function useCreateWorkspace() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: async (name: string) => {
            const workspace = await workspacesApi.create(name)
            const page = await pagesApi.create({ id: crypto.randomUUID(), workspaceId: workspace.id, kind: "document" })
            return { workspace, page }
        },
        onSuccess: ({ workspace, page }) => {
            queryClient.setQueryData<Workspace[]>(queryKeys.workspaces, (prev) => [...(prev ?? []), workspace])
            useAppStore.getState().setWorkspaceId(workspace.id)
            useAppStore.getState().openPage(page.id)
        },
    })
}

export function useRenameWorkspace(workspaceId: string) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: (name: string) => workspacesApi.update(workspaceId, { name }),
        onSuccess: (updated) =>
            queryClient.setQueryData<Workspace[]>(queryKeys.workspaces, (prev) =>
                prev?.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)),
            ),
    })
}

export const useMembers = (workspaceId: string) =>
    useQuery({ queryKey: queryKeys.members(workspaceId), queryFn: () => workspacesApi.members(workspaceId) })

export const useInvitations = (workspaceId: string, enabled: boolean) =>
    useQuery({ queryKey: queryKeys.invitations(workspaceId), queryFn: () => workspacesApi.invitations(workspaceId), enabled })

function useTeamMutation<T>(workspaceId: string, fn: (input: T) => Promise<unknown>) {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: fn,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.members(workspaceId) })
            queryClient.invalidateQueries({ queryKey: queryKeys.invitations(workspaceId) })
        },
    })
}

export const useInvite = (workspaceId: string) => {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: ({ email, role }: { email: string; role: Exclude<Role, "owner"> }) => workspacesApi.invite(workspaceId, email, role),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.invitations(workspaceId) }),
    })
}

export const useRevokeInvitation = (workspaceId: string) =>
    useTeamMutation(workspaceId, (inviteId: string) => workspacesApi.revokeInvitation(workspaceId, inviteId))

export const useSetRole = (workspaceId: string) =>
    useTeamMutation(workspaceId, ({ userId, role }: { userId: string; role: Exclude<Role, "owner"> }) =>
        workspacesApi.setRole(workspaceId, userId, role),
    )

export const useRemoveMember = (workspaceId: string) =>
    useTeamMutation(workspaceId, (userId: string) => workspacesApi.removeMember(workspaceId, userId))
