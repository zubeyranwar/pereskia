import { useEffect } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { authApi } from "@/api/auth"
import { setupApi, type SetupInput } from "@/api/setup"
import type { Credentials } from "@/api/types"
import { onUnauthorized } from "@/lib/http"
import { queryKeys } from "@/lib/query-client"
import { useAppStore } from "@/stores/app-store"

export const useSetupStatus = () => useQuery({ queryKey: queryKeys.setup, queryFn: setupApi.status, staleTime: Infinity })

export function useMe() {
    const queryClient = useQueryClient()
    useEffect(() => onUnauthorized(() => queryClient.setQueryData(queryKeys.me, null)), [queryClient])
    return useQuery({ queryKey: queryKeys.me, queryFn: authApi.me, staleTime: Infinity })
}

function useSignedIn() {
    const queryClient = useQueryClient()
    return async () => {
        await queryClient.invalidateQueries({ queryKey: queryKeys.setup })
        await queryClient.invalidateQueries({ queryKey: queryKeys.me })
        await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces })
    }
}

export function useLogin() {
    const onSuccess = useSignedIn()
    return useMutation({ mutationFn: authApi.login, onSuccess })
}

export function useSignup() {
    const onSuccess = useSignedIn()
    return useMutation({ mutationFn: (input: Credentials & { inviteToken?: string }) => authApi.signup(input), onSuccess })
}

export function useLogout() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: authApi.logout,
        onSuccess: () => {
            queryClient.setQueryData(queryKeys.me, null)
            useAppStore.getState().closeDialog()
            useAppStore.getState().navigate("/", { replace: true })
            queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "me" && query.queryKey[0] !== "setup" })
        },
    })
}

export function useCompleteSetup() {
    const onSuccess = useSignedIn()
    return useMutation({
        mutationFn: (input: SetupInput) => setupApi.complete(input),
        onSuccess: async (data) => {
            useAppStore.getState().setWorkspaceId(data.workspace.id)
            await onSuccess()
        },
    })
}

export const useTestConnection = () => useMutation({ mutationFn: setupApi.test })

export const useInvitation = (token: string) =>
    useQuery({ queryKey: queryKeys.invitation(token), queryFn: () => authApi.invitation(token), retry: false })

export function useAcceptInvitation() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: authApi.acceptInvitation,
        onSuccess: async ({ workspaceId }) => {
            await queryClient.invalidateQueries({ queryKey: queryKeys.workspaces })
            useAppStore.getState().setWorkspaceId(workspaceId)
            useAppStore.getState().navigate("/", { replace: true })
        },
    })
}
