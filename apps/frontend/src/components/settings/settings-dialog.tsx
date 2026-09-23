import { useState } from "react"
import { Database, Mail, SlidersHorizontal, Users } from "lucide-react"
import { Button, Code, Dialog, DialogSection, Field, Input, StatusDot, TabList } from "@/components/pereskia"
import { ProviderMark } from "@/components/setup/connection-form"
import { PROVIDER_INFO } from "@/components/setup/connection-info"
import { useMe, useSetupStatus } from "@/hooks/use-session"
import { canManage, useCurrentWorkspace, useRenameWorkspace } from "@/hooks/use-workspaces"
import { useAppStore, type SettingsTab } from "@/stores/app-store"
import { EmailPanel } from "./email-panel"
import { MembersPanel } from "./members-panel"

const TABS: { value: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { value: "general", label: "General", icon: <SlidersHorizontal className="size-4" strokeWidth={1.75} /> },
    { value: "members", label: "Members", icon: <Users className="size-4" strokeWidth={1.75} /> },
    { value: "storage", label: "Storage", icon: <Database className="size-4" strokeWidth={1.75} /> },
]
const EMAIL_TAB = { value: "email" as const, label: "Email", icon: <Mail className="size-4" strokeWidth={1.75} /> }

export function SettingsDialog() {
    const open = useAppStore((s) => s.dialog === "settings")
    const tab = useAppStore((s) => s.settingsTab)
    const { closeDialog, openDialog } = useAppStore()
    const workspace = useCurrentWorkspace()
    const { data: me } = useMe()
    const instanceAdmin = !!me?.instanceAdmin

    return (
        <Dialog open={open} onOpenChange={(o) => !o && closeDialog()} className="h-[76vh] max-w-240">
            <div className="flex min-h-0 flex-1">
                <aside className="w-55 shrink-0 bg-(--pk-sidebar) p-2 text-(--pk-sidebar-text)">
                    <div className="truncate px-2 pt-1 pb-2 text-xs font-medium text-(--pk-text-tertiary)">{workspace?.name}</div>
                    <TabList value={tab} tabs={instanceAdmin ? [...TABS, EMAIL_TAB] : TABS} onChange={(t) => openDialog("settings", t)} />
                </aside>
                <div className="pk-scroller min-w-0 flex-1 overflow-y-auto px-10 py-8">
                    {tab === "general" && <GeneralPanel />}
                    {tab === "members" && workspace && <MembersPanel workspace={workspace} />}
                    {tab === "storage" && <StoragePanel />}
                    {tab === "email" && instanceAdmin && <EmailPanel />}
                </div>
            </div>
        </Dialog>
    )
}

function GeneralPanel() {
    const workspace = useCurrentWorkspace()
    const rename = useRenameWorkspace(workspace?.id ?? "")
    const [name, setName] = useState(workspace?.name ?? "")
    const editable = canManage(workspace)

    return (
        <DialogSection title="Workspace">
            <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                    e.preventDefault()
                    if (name.trim()) rename.mutate(name.trim())
                }}
            >
                <Field label="Name" className="flex-1">
                    <Input value={name} disabled={!editable} onChange={(e) => setName(e.target.value)} />
                </Field>
                {editable && (
                    <Button type="submit" disabled={!name.trim() || name === workspace?.name || rename.isPending}>
                        Update
                    </Button>
                )}
            </form>
            {!editable && <p className="mt-2 text-xs text-(--pk-text-tertiary)">Only owners and admins can rename the workspace.</p>}
        </DialogSection>
    )
}

function StoragePanel() {
    const { data: setup } = useSetupStatus()
    const provider = setup?.provider
    return (
        <DialogSection title="Storage">
            {provider && (
                <div className="flex items-center gap-3">
                    <ProviderMark provider={provider} size={32} />
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{PROVIDER_INFO[provider].name}</div>
                        <div className="text-xs text-(--pk-text-secondary)">
                            {setup?.managedByEnv ? "Configured by the DATABASE_URL environment variable" : "Configured during setup"}
                        </div>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs text-(--pk-green)">
                        <StatusDot /> Connected
                    </span>
                </div>
            )}
            <p className="mt-4 text-xs text-(--pk-text-tertiary)">
                For safety, storage can't be changed from the browser. To move to another database, set <Code>DATABASE_URL</Code> or edit{" "}
                <Code>data/config.json</Code> on the server and restart.
            </p>
        </DialogSection>
    )
}
