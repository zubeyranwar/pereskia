import { useMemo } from "react"
import { useCurrentWorkspace, useMembers } from "@/hooks/use-workspaces"
import { setPeople, type DatabaseData, type SelectOption } from "./model"

type Update = (fn: (data: DatabaseData) => DatabaseData) => void

// Person properties list the workspace's members as their options while on screen; the options are never saved.
export function usePeopleView(data: DatabaseData, onChange: Update): [DatabaseData, Update] {
    const workspace = useCurrentWorkspace()
    const { data: members } = useMembers(workspace?.id ?? "")
    const people = useMemo<SelectOption[]>(() => {
        const list = (members ?? []).map(({ user }) => ({ id: user.id, name: user.name, color: "default" as const }))
        setPeople(list)
        return list
    }, [members])
    const view = useMemo(
        () => ({ ...data, properties: data.properties.map((p) => (p.type === "person" ? { ...p, options: people } : p)) }),
        [data, people],
    )
    const update: Update = (fn) =>
        onChange((d) => {
            const next = fn(d)
            return { ...next, properties: next.properties.map((p) => (p.type === "person" ? { ...p, options: undefined } : p)) }
        })
    return [view, update]
}
