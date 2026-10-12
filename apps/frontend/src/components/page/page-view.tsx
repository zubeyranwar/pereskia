import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Plug } from "lucide-react"
import type { Page, PagePatch } from "@/api/types"
import { databasesApi } from "@/api/databases"
import { pagesApi } from "@/api/pages"
import { DatabaseView } from "@/components/database/database-view"
import { RowPanel } from "@/components/database/row-panel"
import type { DatabaseData } from "@/components/database/model"
import { Document } from "@/components/editor/document"
import { Button, Input, Popover, Skeleton } from "@/components/pereskia"
import { schemaChanged, useRowSync } from "@/hooks/use-database"
import { useAutosave, useCreatePage, usePage } from "@/hooks/use-pages"
import { useCurrentWorkspace } from "@/hooks/use-workspaces"
import { queryKeys } from "@/lib/query-client"

export function PageView({ pageId }: { pageId: string }) {
    const { data: page, error } = usePage(pageId)
    const save = useAutosave(pageId)
    if (error && !page) {
        return <div className="pk-root px-24 pt-24 text-sm text-(--pk-text-secondary)">This page couldn't be loaded: {error.message}</div>
    }
    if (!page) return <PageSkeleton />
    if (page.kind === "database") return <DatabasePage page={page} save={save} />
    return <Document page={page} save={save} />
}

const taskFromUrl = () => new URLSearchParams(window.location.search).get("task")

function DatabasePage({ page, save }: { page: Page; save: (patch: PagePatch) => void }) {
    const queryClient = useQueryClient()
    useQuery({ queryKey: queryKeys.page(page.id), queryFn: () => pagesApi.get(page.id), refetchInterval: 30_000 })
    const [data, setData] = useState<DatabaseData>(() => page.content as DatabaseData)
    const latest = useRef(data)
    const [openRowId, setOpenRowId] = useState<string | null>(taskFromUrl)

    const cache = (next: DatabaseData) =>
        queryClient.setQueryData<Page>(queryKeys.page(page.id), (prev) => (prev ? { ...prev, content: next } : prev))
    const setLocal = (next: DatabaseData) => {
        latest.current = next
        setData(next)
    }

    const rows = useRowSync(page.id, (keys) => {
        const next = { ...latest.current, rows: latest.current.rows.map((r) => (keys[r.id] ? { ...r, key: keys[r.id] } : r)) }
        setLocal(next)
        cache(next)
    })

    // A refetch brings in rows added elsewhere, e.g. tasks filed from the dashboard.
    useEffect(() => {
        if (page.content !== latest.current && !rows.hasPending()) setLocal(page.content as DatabaseData)
    }, [page.content, rows])

    const onChange = (fn: (d: DatabaseData) => DatabaseData) => {
        const prev = latest.current
        const next = fn(prev)
        setLocal(next)
        rows.queue(prev, next)
        if (schemaChanged(prev, next)) save({ content: next, ...(next.title !== prev.title ? { title: next.title } : {}) })
        else cache(next)
    }

    const openRow = (id: string | null) => {
        window.history.replaceState(null, "", id ? `/${page.id}?task=${id}` : `/${page.id}`)
        if (!id) return setOpenRowId(null)
        rows.flush().then(() => setOpenRowId(id))
    }

    return (
        <>
            <div className="px-[max(24px,min(96px,8vw))] pt-20 pb-32">
                <TrackerConnection pageId={page.id} />
                <DatabaseView variant="page" data={data} onChange={onChange} onOpenRow={openRow} />
            </div>
            {openRowId && (
                <RowPanel key={openRowId} pageId={page.id} rowId={openRowId} data={data} onChange={onChange} onClose={() => openRow(null)} />
            )}
        </>
    )
}

function TrackerConnection({ pageId }: { pageId: string }) {
    const queryClient = useQueryClient()
    const workspace = useCurrentWorkspace()
    const isAdmin = workspace?.role === "owner" || workspace?.role === "admin"
    const [open, setOpen] = useState(false)
    const [projectKey, setProjectKey] = useState("ENG")
    const { data: status } = useQuery({ queryKey: queryKeys.tracker(pageId), queryFn: () => databasesApi.tracker(pageId) })
    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.tracker(pageId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.page(pageId), exact: true })
    }
    const connect = useMutation({ mutationFn: () => databasesApi.connectTracker(pageId, projectKey), onSuccess: () => (setOpen(false), refresh()) })
    const disconnect = useMutation({ mutationFn: () => databasesApi.disconnectTracker(pageId), onSuccess: () => (setOpen(false), refresh()) })

    if (!status || (!status.connected && !isAdmin)) return null

    return (
        <div className="mb-2 flex">
            <Popover
                open={open}
                onOpenChange={setOpen}
                className="w-[300px] p-3"
                trigger={
                    <button
                        type="button"
                        className="flex h-6 cursor-pointer items-center gap-1.5 rounded-sm px-1.5 text-xs text-(--pk-text-secondary) hover:bg-(--pk-hover)"
                    >
                        <Plug className="size-3.5" strokeWidth={1.75} />
                        {status.connected ? `Tracker API · ${status.projectKey}` : "Connect to tracker API"}
                    </button>
                }
            >
                {status.connected ? (
                    <div className="flex flex-col gap-2 text-sm">
                        <p className="text-(--pk-text-secondary)">
                            The company dashboard reads and files tasks in this database as project <b>{status.projectKey}</b>.
                        </p>
                        {isAdmin && (
                            <Button variant="secondary" size="sm" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>
                                Disconnect
                            </Button>
                        )}
                    </div>
                ) : (
                    <form
                        className="flex flex-col gap-2 text-sm"
                        onSubmit={(e) => {
                            e.preventDefault()
                            connect.mutate()
                        }}
                    >
                        <p className="text-(--pk-text-secondary)">
                            Let the company dashboard read and file tasks here. Tasks get keys like {projectKey || "ENG"}-12, and a Type, Priority and
                            Assignee property is added if missing.
                        </p>
                        <Input
                            size="sm"
                            value={projectKey}
                            onChange={(e) => setProjectKey(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
                            placeholder="Project key, e.g. ENG"
                        />
                        {connect.error && <span className="text-xs text-(--pk-red)">{connect.error.message}</span>}
                        <Button variant="primary" size="sm" type="submit" disabled={connect.isPending || projectKey.length < 2}>
                            Connect
                        </Button>
                    </form>
                )}
            </Popover>
        </div>
    )
}

function PageSkeleton() {
    return (
        <div className="mx-auto w-full max-w-225 px-[max(24px,min(96px,8vw))] pt-28">
            <Skeleton className="h-10 w-2/5" />
            <div className="mt-8 flex flex-col gap-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-3/5" />
            </div>
        </div>
    )
}

export function EmptyWorkspace() {
    const createPage = useCreatePage()
    return (
        <div className="pk-root flex flex-col items-center justify-center gap-3 pt-40 text-sm text-(--pk-text-secondary)">
            No pages yet.
            <Button variant="primary" onClick={() => createPage({ kind: "document" })}>
                Create a page
            </Button>
        </div>
    )
}
