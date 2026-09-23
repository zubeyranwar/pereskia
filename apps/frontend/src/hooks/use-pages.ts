import { useCallback, useEffect, useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { pagesApi } from "@/api/pages"
import type { Page, PageKind, PageMeta, PagePatch } from "@/api/types"
import { queryKeys } from "@/lib/query-client"
import { selectPageId, useAppStore } from "@/stores/app-store"
import { useCurrentWorkspace } from "./use-workspaces"

export const pageTitle = (page: Pick<PageMeta, "title" | "kind"> | undefined) =>
    page?.title || (page?.kind === "database" ? "Untitled" : "New page")

const toMeta = (page: Page): PageMeta => ({
    id: page.id,
    workspaceId: page.workspaceId,
    parentId: page.parentId,
    kind: page.kind,
    title: page.title,
    icon: page.icon,
    position: page.position,
    updatedAt: page.updatedAt,
})

export function usePages() {
    const workspace = useCurrentWorkspace()
    return useQuery({
        queryKey: queryKeys.pages(workspace?.id ?? ""),
        queryFn: () => pagesApi.list(workspace!.id),
        enabled: !!workspace,
    })
}

export const useCurrentPageId = () => useAppStore(selectPageId)

export const usePage = (id: string) => useQuery({ queryKey: queryKeys.page(id), queryFn: () => pagesApi.get(id), staleTime: 0 })

export function usePatchPageMeta() {
    const queryClient = useQueryClient()
    const workspace = useCurrentWorkspace()
    return useCallback(
        (id: string, patch: Partial<PageMeta>) => {
            if (!workspace) return
            queryClient.setQueryData<PageMeta[]>(queryKeys.pages(workspace.id), (prev) =>
                prev?.map((p) => (p.id === id ? { ...p, ...patch } : p)),
            )
        },
        [queryClient, workspace],
    )
}

export function useAddPageToCache() {
    const queryClient = useQueryClient()
    return useCallback(
        (page: Page) => {
            queryClient.setQueryData<PageMeta[]>(queryKeys.pages(page.workspaceId), (prev) =>
                prev?.some((p) => p.id === page.id) ? prev : [...(prev ?? []), toMeta(page)],
            )
            queryClient.setQueryData(queryKeys.page(page.id), page)
        },
        [queryClient],
    )
}

type CreatePageInput = { kind: PageKind; parentId?: string | null; title?: string; content?: unknown; open?: boolean }

export function useCreatePage() {
    const queryClient = useQueryClient()
    const workspace = useCurrentWorkspace()
    const addToCache = useAddPageToCache()
    const openPage = useAppStore((s) => s.openPage)

    const mutation = useMutation({
        mutationFn: (input: CreatePageInput & { id: string; workspaceId: string }) =>
            pagesApi.create({
                id: input.id,
                workspaceId: input.workspaceId,
                parentId: input.parentId,
                kind: input.kind,
                title: input.title,
                content: input.content,
            }),
        onMutate: (input) => {
            const now = Date.now()
            addToCache({
                id: input.id,
                workspaceId: input.workspaceId,
                parentId: input.parentId ?? null,
                kind: input.kind,
                title: input.title ?? "",
                icon: null,
                cover: null,
                content: input.content ?? null,
                position: Number.MAX_SAFE_INTEGER,
                createdAt: now,
                updatedAt: now,
            })
            if (input.open !== false) openPage(input.id)
        },
        onSuccess: (page) => addToCache(page),
        onError: (_error, input) =>
            queryClient.setQueryData<PageMeta[]>(queryKeys.pages(input.workspaceId), (prev) => prev?.filter((p) => p.id !== input.id)),
    })

    return useCallback(
        (input: CreatePageInput) => {
            if (!workspace) return null
            const id = crypto.randomUUID()
            mutation.mutate({ ...input, id, workspaceId: workspace.id })
            return id
        },
        [mutation, workspace],
    )
}

export function useDeletePage() {
    const queryClient = useQueryClient()
    const workspace = useCurrentWorkspace()
    return useMutation({
        mutationFn: pagesApi.remove,
        onSuccess: ({ deleted }) => {
            if (!workspace) return
            const remaining =
                queryClient.setQueryData<PageMeta[]>(queryKeys.pages(workspace.id), (prev) => prev?.filter((p) => !deleted.includes(p.id))) ?? []
            deleted.forEach((id) => queryClient.removeQueries({ queryKey: queryKeys.page(id) }))
            const current = selectPageId(useAppStore.getState())
            if (current && deleted.includes(current)) {
                useAppStore.getState().openPage(remaining.find((p) => p.parentId === null)?.id ?? null, { replace: true })
            }
        },
    })
}

export function useAutosave(pageId: string) {
    const queryClient = useQueryClient()
    const setSaveState = useAppStore((s) => s.setSaveState)
    const patchMeta = usePatchPageMeta()
    const pending = useRef<PagePatch>({})
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const mutation = useMutation({
        mutationFn: (patch: PagePatch) => pagesApi.update(pageId, patch),
        onMutate: () => setSaveState("saving"),
        onSuccess: () => setSaveState("saved"),
        onError: (_error, patch) => {
            pending.current = { ...patch, ...pending.current }
            setSaveState("error")
        },
    })
    const { mutate } = mutation

    const flush = useCallback(
        (keepalive = false) => {
            if (timer.current) clearTimeout(timer.current)
            timer.current = null
            const patch = pending.current
            pending.current = {}
            if (Object.keys(patch).length === 0) return
            if (keepalive) pagesApi.update(pageId, patch, { keepalive: true }).catch(() => {})
            else mutate(patch)
        },
        [mutate, pageId],
    )

    const save = useCallback(
        (patch: PagePatch) => {
            pending.current = { ...pending.current, ...patch }
            queryClient.setQueryData<Page>(queryKeys.page(pageId), (prev) => (prev ? { ...prev, ...patch } : prev))
            if (patch.title !== undefined || patch.icon !== undefined) {
                patchMeta(pageId, {
                    ...(patch.title !== undefined ? { title: patch.title } : {}),
                    ...(patch.icon !== undefined ? { icon: patch.icon } : {}),
                })
            }
            if (timer.current) clearTimeout(timer.current)
            timer.current = setTimeout(() => flush(), 600)
        },
        [flush, pageId, patchMeta, queryClient],
    )

    useEffect(() => {
        const onUnload = () => flush(true)
        window.addEventListener("beforeunload", onUnload)
        return () => {
            window.removeEventListener("beforeunload", onUnload)
            flush()
        }
    }, [flush])

    return save
}
