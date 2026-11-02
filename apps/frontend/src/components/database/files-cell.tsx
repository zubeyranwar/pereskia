import { useEffect, useRef } from "react"
import { Download, Paperclip, Plus, X } from "lucide-react"
import { filesApi, formatBytes, type StoredFile } from "@/api/files"
import { IconButton, MenuItem, MenuSection, Spinner } from "@/components/pereskia"
import { useFileUpload, useUploadPageId } from "@/hooks/use-file-upload"

export function FilesDisplay({ files }: { files: StoredFile[] }) {
    return (
        <span className="flex min-w-0 flex-wrap gap-1.5">
            {files.map((file) => (
                <a
                    key={file.key}
                    href={filesApi.url(file)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="flex max-w-50 items-center gap-1 rounded-sm bg-(--pk-hover) px-1.5 py-0.5 text-sm hover:underline"
                >
                    <Paperclip className="size-3 shrink-0 text-(--pk-text-secondary)" />
                    <span className="truncate">{file.name}</span>
                </a>
            ))}
        </span>
    )
}

export function FilesEditor({ files, onChange }: { files: StoredFile[]; onChange: (files: StoredFile[]) => void }) {
    const inputRef = useRef<HTMLInputElement>(null)
    const { upload, progress, uploading, error } = useFileUpload(useUploadPageId())
    const latest = useRef(files)
    useEffect(() => {
        latest.current = files
    }, [files])

    const handlePicked = async (picked: FileList | null) => {
        for (const file of Array.from(picked ?? [])) {
            const stored = await upload(file)
            if (!stored) break
            latest.current = [...latest.current, stored]
            onChange(latest.current)
        }
    }

    return (
        <MenuSection>
            {files.map((file) => (
                <div key={file.key} className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-(--pk-hover)">
                    <Paperclip className="size-4 shrink-0 text-(--pk-text-secondary)" />
                    <a href={filesApi.url(file)} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm hover:underline">
                        {file.name}
                    </a>
                    <span className="shrink-0 text-xs text-(--pk-text-tertiary)">{formatBytes(file.size)}</span>
                    <IconButton label="Download" size="sm" tone="tertiary" onClick={() => window.location.assign(filesApi.url(file, true))}>
                        <Download className="size-3.5" />
                    </IconButton>
                    <IconButton label="Remove" size="sm" tone="tertiary" onClick={() => onChange(files.filter((f) => f.key !== file.key))}>
                        <X className="size-3.5" />
                    </IconButton>
                </div>
            ))}
            <input
                ref={inputRef}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                    handlePicked(e.target.files)
                    e.target.value = ""
                }}
            />
            <MenuItem
                icon={uploading ? <Spinner /> : <Plus className="size-4" strokeWidth={1.75} />}
                label={uploading ? `Uploading… ${Math.round(progress! * 100)}%` : "Upload a file"}
                onClick={() => !uploading && inputRef.current?.click()}
            />
            {error && <p className="px-2 pb-1 text-xs text-red-500">{error}</p>}
        </MenuSection>
    )
}
