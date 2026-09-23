import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { instanceApi } from "@/api/instance"
import type { EmailInput } from "@/api/types"
import { queryKeys } from "@/lib/query-client"

export const useEmailSettings = () => useQuery({ queryKey: queryKeys.emailSettings, queryFn: instanceApi.email })

export function useSaveEmailSettings() {
    const queryClient = useQueryClient()
    return useMutation({
        mutationFn: instanceApi.saveEmail,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.emailSettings }),
    })
}

export const useSendTestEmail = () =>
    useMutation({ mutationFn: ({ email, to }: { email: EmailInput; to: string }) => instanceApi.testEmail(email, to) })
