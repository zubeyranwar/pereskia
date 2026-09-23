import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Check, Copy, Ellipsis, LogOut, Trash2 } from "lucide-react"
import type { Role, Workspace } from "@/api/types"
import {
    Avatar,
    Button,
    DialogSection,
    DropdownButton,
    ErrorText,
    IconButton,
    Input,
    MenuHint,
    MenuItem,
    MenuSection,
    Popover,
    TextLink,
} from "@/components/pereskia"
import { useMe } from "@/hooks/use-session"
import { canManage, useInvitations, useInvite, useMembers, useRemoveMember, useRevokeInvitation, useSetRole } from "@/hooks/use-workspaces"
import { errorMessage } from "@/lib/http"
import { queryKeys } from "@/lib/query-client"
import { useAppStore } from "@/stores/app-store"

type AssignableRole = Exclude<Role, "owner">

const ROLE_LABELS: Record<Role, string> = { owner: "Owner", admin: "Admin", member: "Member" }
const ROLE_DESCRIPTIONS: Record<AssignableRole, string> = {
    admin: "Can invite and manage members, import data and rename the workspace.",
    member: "Can view, create and edit pages.",
}

function RolePicker({ value, onChange, disabled }: { value: AssignableRole; onChange: (role: AssignableRole) => void; disabled?: boolean }) {
    const [open, setOpen] = useState(false)
    return (
        <Popover
            open={open}
            onOpenChange={setOpen}
            align="end"
            className="w-70"
            trigger={
                <DropdownButton disabled={disabled} className="text-(--pk-text-secondary)">
                    {ROLE_LABELS[value]}
                </DropdownButton>
            }
        >
            <MenuSection>
                {(["admin", "member"] as AssignableRole[]).map((role) => (
                    <button
                        key={role}
                        type="button"
                        onClick={() => {
                            onChange(role)
                            setOpen(false)
                        }}
                        className="flex w-full cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-(--pk-hover)"
                    >
                        <span className="min-w-0 flex-1">
                            <span className="block text-sm">{ROLE_LABELS[role]}</span>
                            <span className="block text-xs text-(--pk-text-tertiary)">{ROLE_DESCRIPTIONS[role]}</span>
                        </span>
                        {role === value && <Check className="mt-0.5 size-4 shrink-0" />}
                    </button>
                ))}
            </MenuSection>
        </Popover>
    )
}

function InviteForm({ workspaceId }: { workspaceId: string }) {
    const invite = useInvite(workspaceId)
    const { data: me } = useMe()
    const openDialog = useAppStore((s) => s.openDialog)
    const [email, setEmail] = useState("")
    const [role, setRole] = useState<AssignableRole>("member")
    const [link, setLink] = useState<{ email: string; url: string; emailed: boolean; emailError?: string } | null>(null)
    const [copied, setCopied] = useState(false)

    const copy = async () => {
        if (!link) return
        await navigator.clipboard.writeText(link.url)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
    }

    return (
        <div className="mb-8">
            <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                    e.preventDefault()
                    invite.mutate(
                        { email: email.trim(), role },
                        {
                            onSuccess: (created) => {
                                setLink({
                                    email: created.email,
                                    url: `${window.location.origin}/invite/${created.token}`,
                                    emailed: created.emailed,
                                    emailError: created.emailError,
                                })
                                setEmail("")
                                setCopied(false)
                            },
                        },
                    )
                }}
            >
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" />
                <RolePicker value={role} onChange={setRole} />
                <Button type="submit" variant="primary" disabled={!email.includes("@") || invite.isPending}>
                    Invite
                </Button>
            </form>
            {invite.error && <ErrorText className="mt-3">{errorMessage(invite.error)}</ErrorText>}
            {link && (
                <div className="mt-3 rounded-lg border border-(--pk-divider) bg-(--pk-input-bg) p-3">
                    {link.emailError && <ErrorText className="mb-2 text-xs">{link.emailError}</ErrorText>}
                    <div className="mb-2 text-xs text-(--pk-text-secondary)">
                        {link.emailed ? (
                            <>
                                Invitation emailed to <span className="font-medium text-(--pk-text)">{link.email}</span>. You can also share
                                the link directly. It works once and expires in 7 days.
                            </>
                        ) : (
                            <>
                                Send this link to <span className="font-medium text-(--pk-text)">{link.email}</span>. It works once and expires
                                in 7 days.
                            </>
                        )}
                    </div>
                    {!link.emailed && !link.emailError && me?.instanceAdmin && (
                        <div className="mb-2 text-xs text-(--pk-text-tertiary)">
                            Want invitations emailed automatically? <TextLink onClick={() => openDialog("settings", "email")}>Set up email</TextLink>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <Input size="sm" readOnly value={link.url} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
                        <Button size="sm" onClick={copy}>
                            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                            {copied ? "Copied" : "Copy link"}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}

function MemberActions({ workspaceId, userId, self }: { workspaceId: string; userId: string; self: boolean }) {
    const remove = useRemoveMember(workspaceId)
    const queryClient = useQueryClient()
    const [open, setOpen] = useState(false)
    const { openPage, closeDialog, setWorkspaceId } = useAppStore()
    return (
        <Popover
            open={open}
            onOpenChange={setOpen}
            align="end"
            className="w-55"
            trigger={
                <IconButton label="Member options" tone="tertiary">
                    <Ellipsis className="size-4" />
                </IconButton>
            }
        >
            <MenuSection>
                <MenuItem
                    danger
                    icon={self ? <LogOut className="size-4" strokeWidth={1.75} /> : <Trash2 className="size-4" strokeWidth={1.75} />}
                    label={self ? "Leave workspace" : "Remove from workspace"}
                    onClick={() => {
                        setOpen(false)
                        remove.mutate(userId, {
                            onSuccess: () => {
                                if (!self) return
                                closeDialog()
                                setWorkspaceId(null)
                                openPage(null, { replace: true })
                                queryClient.invalidateQueries({ queryKey: queryKeys.workspaces })
                            },
                        })
                    }}
                />
            </MenuSection>
        </Popover>
    )
}

export function MembersPanel({ workspace }: { workspace: Workspace }) {
    const manage = canManage(workspace)
    const { data: me } = useMe()
    const { data: members = [] } = useMembers(workspace.id)
    const { data: invitations = [] } = useInvitations(workspace.id, manage)
    const setRole = useSetRole(workspace.id)
    const revoke = useRevokeInvitation(workspace.id)

    return (
        <>
            {manage && (
                <DialogSection title="Invite people">
                    <InviteForm workspaceId={workspace.id} />
                </DialogSection>
            )}

            <DialogSection title={`Members · ${members.length}`} className="mb-8">
                <div className="flex flex-col">
                    {members.map(({ user, role }) => {
                        const self = user.id === me?.id
                        return (
                            <div key={user.id} className="flex items-center gap-3 border-b border-(--pk-divider) py-2.5 last:border-b-0">
                                <Avatar name={user.name} seed={user.id} size={32} />
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-medium">
                                        {user.name}
                                        {self && <span className="ml-1.5 font-normal text-(--pk-text-tertiary)">(you)</span>}
                                    </div>
                                    <div className="truncate text-xs text-(--pk-text-secondary)">{user.email}</div>
                                </div>
                                {role === "owner" || !manage || self ? (
                                    <span className="px-2 text-sm text-(--pk-text-secondary)">{ROLE_LABELS[role]}</span>
                                ) : (
                                    <RolePicker value={role} onChange={(next) => setRole.mutate({ userId: user.id, role: next })} />
                                )}
                                {role !== "owner" && (manage || self) ? (
                                    <MemberActions workspaceId={workspace.id} userId={user.id} self={self} />
                                ) : (
                                    <span className="w-7" />
                                )}
                            </div>
                        )
                    })}
                </div>
            </DialogSection>

            {manage && (
                <DialogSection title="Pending invitations">
                    {invitations.length === 0 ? (
                        <MenuHint>No pending invitations</MenuHint>
                    ) : (
                        invitations.map((inv) => (
                            <div key={inv.id} className="flex items-center gap-3 border-b border-(--pk-divider) py-2.5 last:border-b-0">
                                <Avatar name={inv.email} size={32} />
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm">{inv.email}</div>
                                    <div className="text-xs text-(--pk-text-tertiary)">
                                        {ROLE_LABELS[inv.role]} · invited by {inv.invitedBy} ·{" "}
                                        {inv.status === "expired" ? "expired" : `expires ${new Date(inv.expiresAt).toLocaleDateString()}`}
                                    </div>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => revoke.mutate(inv.id)}>
                                    Revoke
                                </Button>
                            </div>
                        ))
                    )}
                </DialogSection>
            )}
        </>
    )
}
