import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { cn } from "cn"
import { ArrowLeft, Database, ExternalLink, Search } from "lucide-react"
import { notionImportApi, type NotionDatabase } from "@/api/import"
import { BareInput, Button, Dialog, ErrorText, IconButton, MenuHint, PropertyIcon, Spinner } from "@/components/pereskia"
import { useAddPageToCache } from "@/hooks/use-pages"
import { useCurrentWorkspace } from "@/hooks/use-workspaces"
import { errorMessage } from "@/lib/http"
import { useAppStore } from "@/stores/app-store"

export function NotionImportDialog() {
    const open = useAppStore((s) => s.dialog === "notionImport")
    const { closeDialog, openPage } = useAppStore()
    const workspace = useCurrentWorkspace()
    const addToCache = useAddPageToCache()

    const [token, setToken] = useState("")
    const [query, setQuery] = useState("")
    const [selected, setSelected] = useState<NotionDatabase | null>(null)
    const workspaceId = workspace?.id ?? ""

    const databases = useMutation({ mutationFn: () => notionImportApi.databases(workspaceId, token) })
    const preview = useMutation({ mutationFn: (db: NotionDatabase) => notionImportApi.preview(workspaceId, token, db.id) })
    const run = useMutation({
        mutationFn: () => notionImportApi.run(workspaceId, token, selected!.id),
        onSuccess: ({ page }) => {
            addToCache(page)
            openPage(page.id)
            close()
        },
    })

    const close = () => {
        closeDialog()
        databases.reset()
        preview.reset()
        run.reset()
        setSelected(null)
        setQuery("")
        setToken("")
    }

    const choose = (db: NotionDatabase) => {
        setSelected(db)
        preview.mutate(db)
    }

    const list = databases.data?.databases ?? []
    const filtered = list.filter((d) => d.title.toLowerCase().includes(query.trim().toLowerCase()))
    const step = databases.data ? "databases" : "connect"

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => !o && close()}
            title={step === "connect" ? "Import from Notion" : "Import from Notion"}
            className={step === "databases" ? "max-w-215" : undefined}
        >
            {step === "connect" ? (
                <div className="p-5">
                    <p className="mb-1 text-sm text-(--pk-text-secondary)">
                        Paste a Notion integration token to import a database into your workspace. Column types are detected
                        automatically.
                    </p>
                    <a
                        href="https://www.notion.so/my-integrations"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mb-4 flex items-center gap-1 text-xs text-(--pk-text-tertiary) hover:text-(--pk-text-secondary)"
                    >
                        <ExternalLink className="size-3" />
                        Create an integration at notion.so/my-integrations
                    </a>
                    <label className="mb-1.5 block text-sm font-medium">Integration token</label>
                    <input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="secret_..."
                        className="w-full rounded-md border border-(--pk-border) bg-(--pk-input-bg) px-3 py-2 text-sm outline-none placeholder:text-(--pk-text-tertiary) focus:border-(--pk-primary)"
                    />
                    {databases.error && <ErrorText className="mt-4">{errorMessage(databases.error)}</ErrorText>}
                    <div className="mt-6 flex justify-end">
                        <Button
                            variant="primary"
                            disabled={!token.trim() || databases.isPending}
                            onClick={() => databases.mutate()}
                        >
                            {databases.isPending && <Spinner />}
                            Connect
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex h-[60vh] min-h-90">
                    <div className="flex w-60 shrink-0 flex-col border-r border-(--pk-divider)">
                        <div className="flex items-center gap-2 border-b border-(--pk-divider) p-2">
                            <IconButton
                                label="Back"
                                onClick={() => {
                                    databases.reset()
                                    preview.reset()
                                    setSelected(null)
                                }}
                            >
                                <ArrowLeft className="size-4" />
                            </IconButton>
                            <div className="flex h-7 flex-1 items-center gap-1.5 rounded-md bg-(--pk-input-bg) px-2">
                                <Search className="size-3.5 shrink-0 text-(--pk-text-tertiary)" />
                                <BareInput
                                    autoFocus
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder={`Search ${list.length} databases`}
                                />
                            </div>
                        </div>
                        <div className="pk-scroller flex-1 overflow-y-auto p-1">
                            {filtered.map((db) => (
                                <button
                                    key={db.id}
                                    type="button"
                                    onClick={() => choose(db)}
                                    className={cn(
                                        "flex h-7 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-(--pk-hover)",
                                        selected?.id === db.id && "bg-(--pk-active)",
                                    )}
                                >
                                    <Database className="size-4 shrink-0 text-(--pk-text-secondary)" strokeWidth={1.75} />
                                    <span className="truncate">{db.title}</span>
                                </button>
                            ))}
                            {filtered.length === 0 && (
                                <MenuHint>{list.length === 0 ? "No databases found" : "No matching databases"}</MenuHint>
                            )}
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                        {!selected ? (
                            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-(--pk-text-tertiary)">
                                <Database className="size-9 opacity-40" strokeWidth={1.25} />
                                Choose a database to preview
                            </div>
                        ) : !preview.data ? (
                            <div className="flex flex-1 items-center justify-center px-6 text-(--pk-text-tertiary)">
                                {preview.error ? <ErrorText>{errorMessage(preview.error)}</ErrorText> : <Spinner className="size-5" />}
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 px-5 pt-4 pb-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-base font-semibold">{selected.title}</div>
                                        <div className="text-xs text-(--pk-text-secondary)">
                                            {preview.data.columns.length} properties
                                            {preview.data.hasMore && " · showing first 8 rows"}
                                        </div>
                                    </div>
                                    <Button variant="primary" disabled={run.isPending} onClick={() => run.mutate()}>
                                        {run.isPending && <Spinner />}
                                        Import
                                    </Button>
                                </div>
                                {run.error && <ErrorText className="mb-3 px-5">{errorMessage(run.error)}</ErrorText>}
                                <div className="pk-scroller min-h-0 flex-1 overflow-auto px-5 pb-5">
                                    <table className="border-collapse text-sm">
                                        <thead>
                                            <tr className="border-y border-(--pk-border)">
                                                {preview.data.columns.map((c) => (
                                                    <th
                                                        key={c.name}
                                                        className="h-8 max-w-55 min-w-30 border-r border-(--pk-border) px-2 text-left font-normal whitespace-nowrap text-(--pk-text-secondary) last:border-r-0"
                                                    >
                                                        <span className="flex items-center gap-1.5">
                                                            <PropertyIcon type={c.type} className="text-(--pk-text-tertiary)" />
                                                            <span className="truncate">{c.name}</span>
                                                        </span>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {preview.data.rows.map((row, i) => (
                                                <tr key={i} className="border-b border-(--pk-border)">
                                                    {row.map((cell, j) => (
                                                        <td
                                                            key={j}
                                                            className={cn(
                                                                "h-8 max-w-55 truncate border-r border-(--pk-border) px-2 last:border-r-0",
                                                                preview.data.columns[j].type === "title" && "font-medium",
                                                                preview.data.columns[j].type === "number" && "text-right tabular-nums",
                                                            )}
                                                        >
                                                            {cell}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </Dialog>
    )
}
