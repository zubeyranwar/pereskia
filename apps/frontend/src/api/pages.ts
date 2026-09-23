import { http } from "@/lib/http"
import type { Page, PageKind, PageMeta, PagePatch } from "./types"

export const pagesApi = {
    list: (workspaceId: string) => http.get<PageMeta[]>(`/workspaces/${workspaceId}/pages`).then((r) => r.data),
    get: (id: string) => http.get<Page>(`/pages/${id}`).then((r) => r.data),
    create: (input: { id: string; workspaceId: string; parentId?: string | null; kind: PageKind; title?: string; content?: unknown }) =>
        http.post<Page>("/pages", input).then((r) => r.data),
    update: (id: string, patch: PagePatch, options?: { keepalive?: boolean }) =>
        http
            .patch<PageMeta>(
                `/pages/${id}`,
                patch,
                options?.keepalive ? { adapter: "fetch", fetchOptions: { keepalive: true } } : undefined,
            )
            .then((r) => r.data),
    remove: (id: string) => http.delete<{ deleted: string[] }>(`/pages/${id}`).then((r) => r.data),
}
