import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { cn } from "cn"
import { ArrowLeft, Search, Table2 } from "lucide-react"
import { importApi } from "@/api/import"
import type { ConnectionInput } from "@/api/types"
import { BareInput, Button, Dialog, ErrorText, IconButton, MenuHint, PropertyIcon, Spinner } from "@/components/pereskia"
import { ConnectionForm, ProviderMark } from "@/components/setup/connection-form"
import { PROVIDER_INFO, isConnectionComplete } from "@/components/setup/connection-info"
import { useAddPageToCache } from "@/hooks/use-pages"
import { useCurrentWorkspace } from "@/hooks/use-workspaces"
import { errorMessage } from "@/lib/http"
import { useAppStore } from "@/stores/app-store"

export function ImportDialog() {
    const open = useAppStore((s) => s.dialog === "import")
    const { closeDialog, openPage } = useAppStore()
    const workspace = useCurrentWorkspace()
    const addToCache = useAddPageToCache()
    const [connection, setConnection] = useState<ConnectionInput>({ provider: "postgres", host: "localhost", port: 5432 })
    const [query, setQuery] = useState("")
    const [selected, setSelected] = useState<string | null>(null)
    const workspaceId = workspace?.id ?? ""

    const tables = useMutation({ mutationFn: () => importApi.tables(workspaceId, connection) })
    const preview = useMutation({ mutationFn: (table: string) => importApi.preview(workspaceId, connection, table) })
    const run = useMutation({
        mutationFn: () => importApi.run(workspaceId, connection, selected!),
        onSuccess: ({ page }) => {
            addToCache(page)
            openPage(page.id)
            close()
        },
    })

    const close = () => {
        closeDialog()
        tables.reset()
        preview.reset()
        run.reset()
        setSelected(null)
        setQuery("")
    }

    const choose = (table: string) => {
        setSelected(table)
        preview.mutate(table)
    }

    const list = tables.data?.tables ?? []
    const filtered = list.filter((t) => t.toLowerCase().includes(query.trim().toLowerCase()))
    const step = tables.data ? "tables" : "connect"

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => !o && close()}
            title={step === "connect" ? "Import from a database" : `Import from ${PROVIDER_INFO[connection.provider].name}`}
            className={step === "tables" ? "max-w-215" : undefined}
        >
            {step === "connect" ? (
                <div className="p-5">
                    <p className="mb-4 text-sm text-(--pk-text-secondary)">
                        Connect to an existing database and turn one of its tables into a database page. Column types are detected automatically,
                        and the connection is only used for this import.
                    </p>
                    <ConnectionForm value={connection} onChange={setConnection} sqlitePlaceholder="/path/to/database.db" />
                    {tables.error && <ErrorText className="mt-4">{errorMessage(tables.error)}</ErrorText>}
                    <div className="mt-6 flex justify-end">
                        <Button variant="primary" disabled={!isConnectionComplete(connection) || tables.isPending} onClick={() => tables.mutate()}>
                            {tables.isPending && <Spinner />}
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
                                    tables.reset()
                                    preview.reset()
                                    setSelected(null)
                                }}
                            >
                                <ArrowLeft className="size-4" />
                            </IconButton>
                            <div className="flex h-7 flex-1 items-center gap-1.5 rounded-md bg-(--pk-input-bg) px-2">
                                <Search className="size-3.5 shrink-0 text-(--pk-text-tertiary)" />
                                <BareInput autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${list.length} tables`} />
                            </div>
                        </div>
                        <div className="pk-scroller flex-1 overflow-y-auto p-1">
                            {filtered.map((table) => (
                                <button
                                    key={table}
                                    type="button"
                                    onClick={() => choose(table)}
                                    className={cn(
                                        "flex h-7 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-(--pk-hover)",
                                        selected === table && "bg-(--pk-active)",
                                    )}
                                >
                                    <Table2 className="size-4 shrink-0 text-(--pk-text-secondary)" strokeWidth={1.75} />
                                    <span className="truncate">{table}</span>
                                </button>
                            ))}
                            {filtered.length === 0 && <MenuHint>{list.length === 0 ? "This database has no tables" : "No matching tables"}</MenuHint>}
                        </div>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                        {!selected ? (
                            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-(--pk-text-tertiary)">
                                <ProviderMark provider={connection.provider} size={36} />
                                Choose a table to preview
                            </div>
                        ) : !preview.data ? (
                            <div className="flex flex-1 items-center justify-center px-6 text-(--pk-text-tertiary)">
                                {preview.error ? <ErrorText>{errorMessage(preview.error)}</ErrorText> : <Spinner className="size-5" />}
                            </div>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 px-5 pt-4 pb-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-base font-semibold">{selected}</div>
                                        <div className="text-xs text-(--pk-text-secondary)">
                                            {preview.data.total.toLocaleString()} rows · {preview.data.columns.length} properties
                                            {preview.data.total > 5000 && " · first 5,000 rows will be imported"}
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
