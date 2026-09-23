import { useState } from "react"
import { cn } from "cn"
import type { PageMeta } from "@/api/types"
import { BareInput, Dialog, MenuHint, PageIcon } from "@/components/pereskia"
import { pageTitle, usePages } from "@/hooks/use-pages"
import { useAppStore } from "@/stores/app-store"

export function SearchDialog() {
    const open = useAppStore((s) => s.dialog === "search")
    const { closeDialog, openPage } = useAppStore()
    const { data: pages = [] } = usePages()
    const [query, setQuery] = useState("")
    const [highlight, setHighlight] = useState(0)
    const results = pages
        .filter((p) => pageTitle(p).toLowerCase().includes(query.trim().toLowerCase()))
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 50)

    const go = (page: PageMeta | undefined) => {
        if (!page) return
        openPage(page.id)
        closeDialog()
        setQuery("")
    }

    return (
        <Dialog open={open} onOpenChange={(o) => !o && closeDialog()} className="max-w-140">
            <div className="border-b border-(--pk-divider) p-3">
                <BareInput
                    autoFocus
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value)
                        setHighlight(0)
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "ArrowDown") setHighlight((h) => Math.min(results.length - 1, h + 1))
                        if (e.key === "ArrowUp") setHighlight((h) => Math.max(0, h - 1))
                        if (e.key === "Enter") go(results[highlight])
                    }}
                    placeholder="Search pages…"
                    className="text-base"
                />
            </div>
            <div className="p-1">
                {results.map((page, i) => (
                    <button
                        key={page.id}
                        type="button"
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => go(page)}
                        className={cn("flex h-9 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm", i === highlight && "bg-(--pk-hover)")}
                    >
                        <span className="flex size-5 items-center justify-center text-(--pk-text-secondary)">
                            <PageIcon icon={page.icon} kind={page.kind} />
                        </span>
                        <span className="truncate">{pageTitle(page)}</span>
                    </button>
                ))}
                {results.length === 0 && <MenuHint>No results</MenuHint>}
            </div>
        </Dialog>
    )
}
