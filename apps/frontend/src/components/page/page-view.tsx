import { useRef, useState } from "react"
import type { Page, PagePatch } from "@/api/types"
import { DatabaseView } from "@/components/database/database-view"
import type { DatabaseData } from "@/components/database/model"
import { Document } from "@/components/editor/document"
import { Button, Skeleton } from "@/components/pereskia"
import { useAutosave, useCreatePage, usePage } from "@/hooks/use-pages"

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

function DatabasePage({ page, save }: { page: Page; save: (patch: PagePatch) => void }) {
    const [data, setData] = useState<DatabaseData>(() => page.content as DatabaseData)
    const latest = useRef(data)

    const onChange = (fn: (d: DatabaseData) => DatabaseData) => {
        const prev = latest.current
        const next = fn(prev)
        latest.current = next
        setData(next)
        save({ content: next, ...(next.title !== prev.title ? { title: next.title } : {}) })
    }

    return (
        <div className="px-[max(24px,min(96px,8vw))] pt-20 pb-32">
            <DatabaseView variant="page" data={data} onChange={onChange} />
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
