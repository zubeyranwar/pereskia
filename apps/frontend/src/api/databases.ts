import { http } from "@/lib/http"
import type { RowDetail, RowOps, TaskComment, TrackerStatus } from "./types"

export const databasesApi = {
    saveRows: (pageId: string, ops: RowOps, options?: { keepalive?: boolean }) =>
        http
            .post<{ rows: { id: string; key?: string }[] }>(
                `/databases/${pageId}/rows`,
                ops,
                options?.keepalive ? { adapter: "fetch", fetchOptions: { keepalive: true } } : undefined,
            )
            .then((r) => r.data),
    row: (pageId: string, rowId: string) => http.get<RowDetail>(`/databases/${pageId}/rows/${rowId}`).then((r) => r.data),
    setBody: (pageId: string, rowId: string, body: string) =>
        http.patch(`/databases/${pageId}/rows/${rowId}`, { body }).then(() => undefined),
    comment: (pageId: string, rowId: string, body: string) =>
        http.post<TaskComment>(`/databases/${pageId}/rows/${rowId}/comments`, { body }).then((r) => r.data),
    tracker: (pageId: string) => http.get<TrackerStatus>(`/databases/${pageId}/tracker`).then((r) => r.data),
    connectTracker: (pageId: string, projectKey: string) =>
        http.post<TrackerStatus>(`/databases/${pageId}/tracker`, { projectKey }).then((r) => r.data),
    disconnectTracker: (pageId: string) => http.delete<TrackerStatus>(`/databases/${pageId}/tracker`).then((r) => r.data),
}
