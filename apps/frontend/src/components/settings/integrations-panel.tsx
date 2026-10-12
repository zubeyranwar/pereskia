import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { workspacesApi } from "@/api/workspaces"
import type { Workspace } from "@/api/types"
import { Button, Code, DialogSection, Field, Input, MenuHint } from "@/components/pereskia"
import { queryKeys } from "@/lib/query-client"

export function IntegrationsPanel({ workspace }: { workspace: Workspace }) {
    const queryClient = useQueryClient()
    const [name, setName] = useState("Gebeta dashboard")
    const [created, setCreated] = useState<string | null>(null)
    const key = queryKeys.trackerTokens(workspace.id)
    const { data: tokens = [] } = useQuery({ queryKey: key, queryFn: () => workspacesApi.trackerTokens(workspace.id) })
    const create = useMutation({
        mutationFn: () => workspacesApi.createTrackerToken(workspace.id, name.trim()),
        onSuccess: ({ token }) => {
            setCreated(token)
            queryClient.invalidateQueries({ queryKey: key })
        },
    })
    const revoke = useMutation({
        mutationFn: (tokenId: string) => workspacesApi.revokeTrackerToken(workspace.id, tokenId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    })
    const active = tokens.filter((t) => !t.revokedAt)

    return (
        <>
            <DialogSection title="Tracker API" className="mb-8">
                <p className="mb-4 text-sm text-(--pk-text-secondary)">
                    Lets another app, such as the company dashboard, file and follow tasks in databases connected to the tracker. Its base URL is{" "}
                    <Code>{window.location.origin}/api/v1</Code>. Connect a database from the plug button at the top of the database page.
                </p>
                <form
                    className="flex items-end gap-2"
                    onSubmit={(e) => {
                        e.preventDefault()
                        if (name.trim()) create.mutate()
                    }}
                >
                    <Field label="New service token" className="flex-1">
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Who will use it" />
                    </Field>
                    <Button type="submit" disabled={!name.trim() || create.isPending}>
                        Create token
                    </Button>
                </form>
                {created && (
                    <div className="mt-3 rounded-md border border-(--pk-divider) p-3 text-sm">
                        <div className="mb-1 font-medium">Copy this token now — it won't be shown again.</div>
                        <code className="block rounded bg-(--pk-hover) px-1.5 py-1 text-[0.92em] break-all select-all">{created}</code>
                        <p className="mt-2 text-xs text-(--pk-text-tertiary)">Send it privately, not in a chat channel or a shared document.</p>
                    </div>
                )}
            </DialogSection>
            <DialogSection title={`Active tokens · ${active.length}`}>
                {active.length === 0 ? (
                    <MenuHint>No active tokens</MenuHint>
                ) : (
                    active.map((token) => (
                        <div key={token.id} className="flex items-center gap-3 border-b border-(--pk-divider) py-2.5 last:border-b-0">
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">{token.name}</div>
                                <div className="text-xs text-(--pk-text-tertiary)">
                                    Created {new Date(token.createdAt).toLocaleDateString()} · {token.scopes.join(", ")}
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate(token.id)}>
                                Revoke
                            </Button>
                        </div>
                    ))
                )}
            </DialogSection>
        </>
    )
}
