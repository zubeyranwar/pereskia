import { createContext, useContext, useState } from "react"
import { filesApi, formatBytes, MAX_FILE_SIZE, type StoredFile } from "@/api/files"
import { errorMessage } from "@/lib/http"

export const UploadPageContext = createContext<string | undefined>(undefined)

export const useUploadPageId = () => useContext(UploadPageContext)

export function useFileUpload(pageId: string | undefined, check?: (file: File) => string | null) {
    const [progress, setProgress] = useState<number | null>(null)
    const [error, setError] = useState<string | null>(null)

    const upload = async (file: File): Promise<StoredFile | null> => {
        setError(null)
        const problem = !pageId
            ? "Files can't be uploaded here."
            : file.size > MAX_FILE_SIZE
              ? `Files can be at most ${formatBytes(MAX_FILE_SIZE)}.`
              : check?.(file)
        if (problem) {
            setError(problem)
            return null
        }
        setProgress(0)
        try {
            return await filesApi.upload(pageId!, file, setProgress)
        } catch (err) {
            setError(errorMessage(err))
            return null
        } finally {
            setProgress(null)
        }
    }

    return { upload, progress, uploading: progress !== null, error }
}
