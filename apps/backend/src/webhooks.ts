import { storage } from "./storage"

const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000, 6 * 60 * 60_000]

export type TrackerEvent = {
    id: string
    type: "task.created" | "task.updated" | "task.status_changed" | "task.deleted" | "comment.created"
    occurred_at: string
    project_id: string
    task: unknown
    changes: Record<string, { from: unknown; to: unknown }> | null
    actor: { id: string | null; name: string | null; email: string | null } | null
    comment: unknown
}

export async function sign(secret: string, timestamp: number, body: string) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`))
    return Buffer.from(signature).toString("hex")
}

async function deliver(webhookId: string, event: TrackerEvent, attempt = 0): Promise<void> {
    const { sql } = storage()
    const [hook] = await sql`SELECT * FROM tracker_webhooks WHERE id = ${webhookId}`
    if (!hook) return
    const body = JSON.stringify(event)
    const timestamp = Math.floor(Date.now() / 1000)
    let ok = false
    try {
        const res = await fetch(hook.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Tracker-Event": event.type,
                "X-Tracker-Delivery": event.id,
                "X-Tracker-Signature": `t=${timestamp},v1=${await sign(hook.secret, timestamp, body)}`,
            },
            body,
            signal: AbortSignal.timeout(10_000),
        })
        ok = res.ok
    } catch {
        ok = false
    }
    if (!ok && attempt < RETRY_DELAYS_MS.length) {
        setTimeout(() => deliver(webhookId, event, attempt + 1).catch(() => {}), RETRY_DELAYS_MS[attempt])
    }
}

export async function emit(workspaceId: string, event: Omit<TrackerEvent, "id" | "occurred_at">) {
    const { sql } = storage()
    const hooks = await sql`SELECT id, events FROM tracker_webhooks WHERE workspace_id = ${workspaceId}`
    const full: TrackerEvent = {
        id: `evt_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
        occurred_at: new Date().toISOString(),
        ...event,
    }
    for (const hook of hooks) {
        if (JSON.parse(hook.events).includes(event.type)) deliver(hook.id, full).catch(() => {})
    }
}
