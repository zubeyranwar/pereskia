import { useCallback, useEffect, useRef } from "react"
import { databasesApi } from "@/api/databases"
import type { RowOps } from "@/api/types"
import type { CellValue, DatabaseData } from "@/components/database/model"
import { useAppStore } from "@/stores/app-store"

type Upsert = { id: string; cells?: Record<string, CellValue>; position?: number }

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export const schemaChanged = (a: DatabaseData, b: DatabaseData) =>
    a.title !== b.title || a.properties !== b.properties || a.filters !== b.filters || a.sorts !== b.sorts || a.advancedFilter !== b.advancedFilter

// Rows are saved one change at a time, so rows added elsewhere (e.g. by the tracker API) are never overwritten.
export function useRowSync(pageId: string, onKeys: (keys: Record<string, string>) => void) {
    const setSaveState = useAppStore((s) => s.setSaveState)
    const upserts = useRef(new Map<string, Upsert>())
    const deletes = useRef(new Set<string>())
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const inflight = useRef<Promise<void>>(Promise.resolve())
    const busy = useRef(0)
    const keysRef = useRef(onKeys)
    useEffect(() => {
        keysRef.current = onKeys
    }, [onKeys])

    const take = (): RowOps | null => {
        if (upserts.current.size === 0 && deletes.current.size === 0) return null
        const ops = { upserts: [...upserts.current.values()], deletes: [...deletes.current] }
        upserts.current = new Map()
        deletes.current = new Set()
        return ops
    }

    const requeue = (ops: RowOps) => {
        for (const up of ops.upserts ?? []) {
            const later = upserts.current.get(up.id)
            upserts.current.set(up.id, { ...up, ...later, cells: { ...up.cells, ...later?.cells } })
        }
        for (const id of ops.deletes ?? []) deletes.current.add(id)
    }

    const flush = useCallback(
        (keepalive = false) => {
            if (timer.current) clearTimeout(timer.current)
            timer.current = null
            const ops = take()
            if (!ops) return inflight.current
            if (keepalive) {
                databasesApi.saveRows(pageId, ops, { keepalive: true }).catch(() => {})
                return inflight.current
            }
            setSaveState("saving")
            busy.current++
            inflight.current = inflight.current.then(() =>
                databasesApi
                    .saveRows(pageId, ops)
                    .then(({ rows }) => {
                        setSaveState("saved")
                        const keys = Object.fromEntries(rows.filter((r) => r.key).map((r) => [r.id, r.key!]))
                        if (Object.keys(keys).length) keysRef.current(keys)
                    })
                    .catch(() => {
                        requeue(ops)
                        setSaveState("error")
                    })
                    .finally(() => busy.current--),
            )
            return inflight.current
        },
        [pageId, setSaveState],
    )

    const queue = useCallback(
        (prev: DatabaseData, next: DatabaseData) => {
            if (prev.rows === next.rows) return
            const put = (id: string, patch: Omit<Upsert, "id">) => {
                const current = upserts.current.get(id)
                upserts.current.set(id, {
                    id,
                    ...current,
                    ...patch,
                    ...(patch.cells || current?.cells ? { cells: { ...current?.cells, ...patch.cells } } : {}),
                })
            }
            const before = new Map(prev.rows.map((row, index) => [row.id, { row, index }]))
            next.rows.forEach((row, index) => {
                const old = before.get(row.id)
                if (!old) return put(row.id, { cells: row.cells, position: index })
                if (old.row.cells !== row.cells) {
                    const keys = new Set([...Object.keys(old.row.cells), ...Object.keys(row.cells)])
                    const cells: Record<string, CellValue> = {}
                    for (const key of keys) if (!same(old.row.cells[key], row.cells[key])) cells[key] = row.cells[key] ?? null
                    if (Object.keys(cells).length) put(row.id, { cells })
                }
                if (old.index !== index) put(row.id, { position: index })
            })
            const kept = new Set(next.rows.map((r) => r.id))
            for (const id of before.keys()) {
                if (kept.has(id)) continue
                upserts.current.delete(id)
                deletes.current.add(id)
            }
            if (timer.current) clearTimeout(timer.current)
            timer.current = setTimeout(() => flush(), 500)
        },
        [flush],
    )

    const hasPending = useCallback(
        () => upserts.current.size > 0 || deletes.current.size > 0 || timer.current !== null || busy.current > 0,
        [],
    )

    useEffect(() => {
        const onUnload = () => flush(true)
        window.addEventListener("beforeunload", onUnload)
        return () => {
            window.removeEventListener("beforeunload", onUnload)
            flush()
        }
    }, [flush])

    return { queue, flush, hasPending }
}
