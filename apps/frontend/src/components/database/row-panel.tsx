import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { cn } from "cn"
import { ExternalLink, X } from "lucide-react"
import { databasesApi } from "@/api/databases"
import type { RowDetail, TaskComment, TaskHistoryEntry } from "@/api/types"
import { queryKeys } from "@/lib/query-client"
import { Avatar, Button, PropertyIcon } from "@/components/pereskia"
import { Cell } from "./database-view"
import { usePeopleView } from "./use-people-view"
import { emptyValue, type CellValue, type DatabaseData, type SelectOption } from "./model"

type Update = (fn: (data: DatabaseData) => DatabaseData) => void

const FIELD_LABELS: Record<TaskHistoryEntry["field"], string> = {
    status: "Status",
    assignee: "Assignee",
    priority: "Priority",
    due_date: "Due date",
}

const when = (value: string | number) =>
    new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })

const historyValue = (value: TaskHistoryEntry["from"]) =>
    value == null ? "empty" : typeof value === "string" ? value : (value.name ?? value.email ?? "—")

const personName = (p: { name: string | null; email: string | null } | null) => p?.name ?? p?.email ?? "Someone"

export function RowPanel({
    pageId,
    rowId,
    data,
    onChange,
    onClose,
}: {
    pageId: string
    rowId: string
    data: DatabaseData
    onChange: Update
    onClose: () => void
}) {
    const [view, update] = usePeopleView(data, onChange)
    const [editing, setEditing] = useState<string | null>(null)
    const queryClient = useQueryClient()
    const { data: detail, error } = useQuery({
        queryKey: queryKeys.row(pageId, rowId),
        queryFn: () => databasesApi.row(pageId, rowId),
        staleTime: 0,
    })
    const row = view.rows.find((r) => r.id === rowId)
    const titleProperty = view.properties.find((p) => p.type === "title")

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && !editing && onClose()
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [editing, onClose])

    const setCell = (propertyId: string, value: CellValue) =>
        update((d) => ({
            ...d,
            rows: d.rows.map((r) => (r.id === rowId ? { ...r, cells: { ...r.cells, [propertyId]: value } } : r)),
        }))

    const setOptions = (propertyId: string, options: SelectOption[]) =>
        update((d) => ({ ...d, properties: d.properties.map((p) => (p.id === propertyId ? { ...p, options } : p)) }))

    // Status and other edits change the task's history; refresh the activity once they've been saved.
    useEffect(() => {
        const t = setTimeout(() => queryClient.invalidateQueries({ queryKey: queryKeys.row(pageId, rowId) }), 1500)
        return () => clearTimeout(t)
    }, [row?.cells, pageId, rowId, queryClient])

    return (
        <aside className="pk-root fixed inset-y-0 right-0 z-40 flex w-[min(640px,100vw)] flex-col border-l border-(--pk-border) bg-(--pk-bg) shadow-(--pk-popover-shadow)">
            <div className="flex h-11 shrink-0 items-center gap-2 px-4">
                {detail?.key && (
                    <span className="rounded-sm bg-(--pk-hover) px-1.5 py-0.5 text-xs font-medium text-(--pk-text-secondary)">{detail.key}</span>
                )}
                {detail?.externalRef?.url && (
                    <a
                        href={detail.externalRef.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-(--pk-text-secondary) hover:text-(--pk-text)"
                    >
                        <ExternalLink className="size-3.5" strokeWidth={1.75} />
                        {detail.externalRef.source}
                    </a>
                )}
                <button
                    type="button"
                    aria-label="Close"
                    onClick={onClose}
                    className="ml-auto flex size-7 cursor-pointer items-center justify-center rounded-md text-(--pk-text-secondary) hover:bg-(--pk-hover)"
                >
                    <X className="size-4.5" strokeWidth={1.75} />
                </button>
            </div>

            {!row ? (
                <div className="px-12 py-10 text-sm text-(--pk-text-secondary)">This row no longer exists.</div>
            ) : (
                <div className="flex-1 overflow-y-auto px-12 pb-16">
                    {titleProperty && (
                        <textarea
                            value={String(row.cells[titleProperty.id] ?? "")}
                            onChange={(e) => setCell(titleProperty.id, e.target.value)}
                            placeholder="Untitled"
                            rows={1}
                            className="field-sizing-content mt-4 mb-4 w-full resize-none bg-transparent text-[32px] leading-tight font-bold outline-none placeholder:text-(--pk-text-tertiary)"
                        />
                    )}

                    <div className="flex flex-col gap-0.5">
                        {view.properties
                            .filter((p) => p.type !== "title")
                            .map((property) => (
                                <div key={property.id} className="flex min-h-[34px] items-start">
                                    <div className="flex h-[34px] w-[160px] shrink-0 items-center gap-1.5 px-1 text-sm text-(--pk-text-secondary)">
                                        <PropertyIcon type={property.type} className="text-(--pk-text-tertiary)" />
                                        <span className="truncate">{property.name}</span>
                                    </div>
                                    <Cell
                                        as="div"
                                        className="min-h-[34px] min-w-0 flex-1 rounded-sm hover:bg-(--pk-hover)"
                                        property={property}
                                        value={row.cells[property.id] ?? emptyValue(property.type)}
                                        editing={editing === property.id}
                                        onEdit={(on) => setEditing(on ? property.id : null)}
                                        onChange={(value) => setCell(property.id, value)}
                                        onOptionsChange={(options) => setOptions(property.id, options)}
                                    />
                                </div>
                            ))}
                        {detail?.reporter && (
                            <ReadOnlyProperty label="Reported by" value={personName(detail.reporter)} />
                        )}
                        {detail && <ReadOnlyProperty label="Created" value={when(detail.createdAt)} />}
                        {detail?.startedAt && <ReadOnlyProperty label="Started" value={when(detail.startedAt)} />}
                        {detail?.completedAt && <ReadOnlyProperty label="Completed" value={when(detail.completedAt)} />}
                    </div>

                    <div className="my-6 h-px bg-(--pk-divider)" />
                    {error ? (
                        <div className="text-sm text-(--pk-text-secondary)">Details couldn't be loaded: {error.message}</div>
                    ) : detail ? (
                        <>
                            <Description pageId={pageId} rowId={rowId} initial={detail.body} />
                            <Activity pageId={pageId} rowId={rowId} detail={detail} />
                        </>
                    ) : null}
                </div>
            )}
        </aside>
    )
}

function ReadOnlyProperty({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex h-[34px] items-center">
            <div className="w-[160px] shrink-0 px-1 text-sm text-(--pk-text-secondary)">{label}</div>
            <div className="truncate px-2 text-sm">{value}</div>
        </div>
    )
}

function Description({ pageId, rowId, initial }: { pageId: string; rowId: string; initial: string }) {
    const [text, setText] = useState(initial)
    const saved = useRef(initial)
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const save = (value: string) => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = null
        if (value === saved.current) return
        saved.current = value
        databasesApi.setBody(pageId, rowId, value).catch(() => {
            saved.current = ""
        })
    }

    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current)
    }, [])

    return (
        <section className="mb-8">
            <h3 className="mb-1 text-sm font-semibold text-(--pk-text-secondary)">Description</h3>
            <textarea
                value={text}
                onChange={(e) => {
                    setText(e.target.value)
                    if (timer.current) clearTimeout(timer.current)
                    const value = e.target.value
                    timer.current = setTimeout(() => save(value), 800)
                }}
                onBlur={() => save(text)}
                placeholder="Add details, steps to reproduce, links…"
                className="field-sizing-content min-h-[72px] w-full resize-none rounded-md bg-transparent px-1 py-1 text-base leading-relaxed outline-none placeholder:text-(--pk-text-tertiary) hover:bg-(--pk-hover) focus:bg-transparent"
            />
        </section>
    )
}

function Activity({ pageId, rowId, detail }: { pageId: string; rowId: string; detail: RowDetail }) {
    const queryClient = useQueryClient()
    const [draft, setDraft] = useState("")
    const comment = useMutation({
        mutationFn: (body: string) => databasesApi.comment(pageId, rowId, body),
        onSuccess: (created) => {
            setDraft("")
            queryClient.setQueryData<RowDetail>(queryKeys.row(pageId, rowId), (prev) =>
                prev ? { ...prev, comments: [...prev.comments, created] } : prev,
            )
        },
    })

    const items = [
        ...detail.comments.map((c) => ({ at: c.created_at, comment: c as TaskComment, change: null as TaskHistoryEntry | null })),
        ...detail.history
            .filter((h) => !(h.field === "status" && h.from === null))
            .map((h) => ({ at: h.at, comment: null as TaskComment | null, change: h })),
    ].sort((a, b) => a.at.localeCompare(b.at))

    const submit = () => draft.trim() && !comment.isPending && comment.mutate(draft.trim())

    return (
        <section>
            <h3 className="mb-3 text-sm font-semibold text-(--pk-text-secondary)">Activity</h3>
            <div className="flex flex-col gap-3">
                {items.map(({ comment: c, change: h }) =>
                    c ? (
                        <div key={c.id} className="flex gap-2.5">
                            <Avatar name={personName(c.author)} seed={c.author.id ?? c.author.email ?? ""} size={24} />
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-2 text-sm">
                                    <span className="font-medium">{personName(c.author)}</span>
                                    <span className="text-xs text-(--pk-text-tertiary)">{when(c.created_at)}</span>
                                </div>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{c.body}</p>
                            </div>
                        </div>
                    ) : (
                        <div key={h!.id} className="pl-8 text-xs text-(--pk-text-secondary)">
                            <span className="font-medium">{personName(h!.actor)}</span> changed {FIELD_LABELS[h!.field]} from{" "}
                            <span className="font-medium">{historyValue(h!.from)}</span> to{" "}
                            <span className="font-medium">{historyValue(h!.to)}</span> · {when(h!.at)}
                        </div>
                    ),
                )}
            </div>
            <div className="mt-4 flex flex-col gap-2 rounded-md border border-(--pk-border) p-2 focus-within:border-(--pk-blue)">
                <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                            e.preventDefault()
                            submit()
                        }
                    }}
                    placeholder="Add a comment…"
                    rows={2}
                    className="field-sizing-content w-full resize-none bg-transparent px-1 text-sm outline-none placeholder:text-(--pk-text-tertiary)"
                />
                <div className={cn("flex items-center justify-end gap-2")}>
                    {comment.error && <span className="text-xs text-(--pk-red)">{comment.error.message}</span>}
                    <Button variant="primary" size="sm" disabled={!draft.trim() || comment.isPending} onClick={submit}>
                        Comment
                    </Button>
                </div>
            </div>
        </section>
    )
}
