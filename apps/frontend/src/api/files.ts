import { http } from "@/lib/http"

export type StoredFile = { key: string; name: string; size: number; type: string }

export const MAX_FILE_SIZE = 25 * 1024 * 1024

export const filesApi = {
    upload: (pageId: string, file: File, onProgress?: (fraction: number) => void) => {
        const form = new FormData()
        form.append("file", file)
        return http
            .post<StoredFile>(`/pages/${pageId}/files`, form, {
                headers: { "content-type": "multipart/form-data" },
                onUploadProgress: (e) => e.total && onProgress?.(e.loaded / e.total),
            })
            .then((r) => r.data)
    },
    url: (file: StoredFile, download = false) => {
        const params = new URLSearchParams({ key: file.key, name: file.name })
        if (download) params.set("download", "true")
        return `/api/files?${params}`
    },
}

export function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
