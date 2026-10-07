import { http } from "@/lib/http"
import type { ConnectionInput, ImportPreview, Page } from "./types"

export const importApi = {
    tables: (workspaceId: string, connection: ConnectionInput) =>
        http.post<{ tables: string[] }>("/import/tables", { workspaceId, connection }).then((r) => r.data),
    preview: (workspaceId: string, connection: ConnectionInput, table: string) =>
        http.post<ImportPreview>("/import/preview", { workspaceId, connection, table }).then((r) => r.data),
    run: (workspaceId: string, connection: ConnectionInput, table: string) =>
        http
            .post<{ page: Page; imported: number; truncated: boolean }>("/import", { workspaceId, connection, table })
            .then((r) => r.data),
}

export type NotionDatabase = { id: string; title: string }
export type NotionPreview = ImportPreview & { hasMore: boolean }

export const notionImportApi = {
    databases: (workspaceId: string, token: string) =>
        http.post<{ databases: NotionDatabase[] }>("/import/notion/databases", { workspaceId, token }).then((r) => r.data),
    preview: (workspaceId: string, token: string, databaseId: string) =>
        http.post<NotionPreview>("/import/notion/preview", { workspaceId, token, databaseId }).then((r) => r.data),
    run: (workspaceId: string, token: string, databaseId: string) =>
        http
            .post<{ page: Page; imported: number; truncated: boolean }>("/import/notion/run", { workspaceId, token, databaseId })
            .then((r) => r.data),
}
