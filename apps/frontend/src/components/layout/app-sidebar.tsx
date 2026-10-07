import { useRef, useState } from "react"
import { cn } from "cn"
import { Check, ChevronDown, ChevronRight, ChevronsLeft, Download, Ellipsis, LogOut, Plus, Search, Settings, SquarePen, Trash2, UserPlus } from "lucide-react"
import type { PageMeta } from "@/api/types"
import {
    IconButton,
    Input,
    MenuItem,
    MenuSection,
    MenuSeparator,
    PageIcon,
    Popover,
    SidebarItem,
    SidebarSectionHeader,
    WorkspaceMark,
    Button,
} from "@/components/pereskia"
import { Sidebar, useSidebar } from "@/components/ui/sidebar"
import { pageTitle, useCreatePage, useCurrentPageId, useDeletePage, usePages } from "@/hooks/use-pages"
import { useLogout, useMe } from "@/hooks/use-session"
import { canManage, useCreateWorkspace, useCurrentWorkspace, useWorkspaces } from "@/hooks/use-workspaces"
import { useAppStore } from "@/stores/app-store"

export function AppSidebar() {
    const { data: pages = [] } = usePages()
    const createPage = useCreatePage()
    const openDialog = useAppStore((s) => s.openDialog)
    const workspace = useCurrentWorkspace()
    const roots = pages.filter((p) => p.parentId === null)

    return (
        <Sidebar className="pk-sidebar-shell">
            <div className="pk-root pk-sidebar flex h-full flex-col bg-(--pk-sidebar) text-(--pk-sidebar-text)">
                <WorkspaceSwitcher />

                <div className="flex flex-col gap-px px-1 pb-2">
                    <SidebarItem icon={<Search className="size-4.5" strokeWidth={1.75} />} label="Search" onClick={() => openDialog("search")} />
                    <SidebarItem icon={<Settings className="size-4.5" strokeWidth={1.75} />} label="Settings" onClick={() => openDialog("settings", "general")} />
                    {canManage(workspace) && (
                        <SidebarItem
                            icon={<UserPlus className="size-4.5" strokeWidth={1.75} />}
                            label="Invite members"
                            onClick={() => openDialog("settings", "members")}
                        />
                    )}
                </div>

                <div className="pk-scroller min-h-0 flex-1 overflow-y-auto px-1 pb-2">
                    <SidebarSectionHeader
                        label="Workspace"
                        action={
                            <IconButton label="Add a page" size="xs" tone="tertiary" onClick={() => createPage({ kind: "document" })}>
                                <Plus className="size-4" />
                            </IconButton>
                        }
                    />
                    {roots.map((page) => (
                        <PageTreeItem key={page.id} page={page} pages={pages} depth={0} />
                    ))}
                    <SidebarItem icon={<Plus className="size-4.5" strokeWidth={1.75} />} label="Add a page" muted onClick={() => createPage({ kind: "document" })} />
                </div>

                {canManage(workspace) && (
                    <div className="flex flex-col gap-px border-t border-(--pk-divider) px-1 py-2">
                        <SidebarItem icon={<Download className="size-4.5" strokeWidth={1.75} />} label="Import from database" onClick={() => openDialog("import")} />
                        <SidebarItem icon={<Download className="size-4.5" strokeWidth={1.75} />} label="Import from Notion" onClick={() => openDialog("notionImport")} />
                    </div>
                )}
            </div>
        </Sidebar>
    )
}

function WorkspaceSwitcher() {
    const { data: workspaces = [] } = useWorkspaces()
    const workspace = useCurrentWorkspace()
    const { data: me } = useMe()
    const { toggleSidebar } = useSidebar()
    const createPage = useCreatePage()
    const createWorkspace = useCreateWorkspace()
    const logout = useLogout()
    const { setWorkspaceId, openPage, openDialog } = useAppStore()
    const [open, setOpen] = useState(false)
    const [creating, setCreating] = useState(false)
    const [newName, setNewName] = useState("")

    const create = () => {
        if (!newName.trim()) return
        createWorkspace.mutate(newName.trim(), {
            onSuccess: () => {
                setNewName("")
                setCreating(false)
                setOpen(false)
            },
        })
    }

    return (
        <div className="group/header flex h-11 shrink-0 items-center gap-0.5 px-2">
            <Popover
                open={open}
                onOpenChange={(o) => {
                    setOpen(o)
                    if (!o) setCreating(false)
                }}
                className="w-75"
                trigger={
                    <button type="button" className="flex h-8 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-1.5 text-left hover:bg-(--pk-sidebar-hover)">
                        <WorkspaceMark name={workspace?.name ?? ""} />
                        <span className="truncate text-sm font-medium text-(--pk-text)">{workspace?.name ?? "Workspace"}</span>
                        <ChevronDown className="size-3.5 shrink-0 text-(--pk-text-tertiary)" strokeWidth={2.25} />
                    </button>
                }
            >
                {me && <div className="truncate px-3 pt-2.5 pb-1 text-xs text-(--pk-text-tertiary)">{me.email}</div>}
                <MenuSection>
                    {workspaces.map((ws) => (
                        <MenuItem
                            key={ws.id}
                            icon={<WorkspaceMark name={ws.name} size={20} />}
                            label={ws.name}
                            right={ws.id === workspace?.id ? <Check className="size-4 text-(--pk-text)" /> : null}
                            onClick={() => {
                                setOpen(false)
                                if (ws.id !== workspace?.id) {
                                    setWorkspaceId(ws.id)
                                    openPage(null)
                                }
                            }}
                        />
                    ))}
                    {creating ? (
                        <form
                            className="flex items-center gap-1.5 px-1 py-0.5"
                            onSubmit={(e) => {
                                e.preventDefault()
                                create()
                            }}
                        >
                            <Input size="sm" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Workspace name" />
                            <Button type="submit" variant="primary" size="sm" disabled={!newName.trim() || createWorkspace.isPending}>
                                Create
                            </Button>
                        </form>
                    ) : (
                        <MenuItem
                            icon={<Plus className="size-4 text-(--pk-text-secondary)" />}
                            label={<span className="text-(--pk-text-secondary)">New workspace</span>}
                            onClick={() => setCreating(true)}
                        />
                    )}
                </MenuSection>
                <MenuSeparator />
                <MenuSection>
                    <MenuItem
                        icon={<Settings className="size-4" strokeWidth={1.75} />}
                        label="Settings"
                        onClick={() => {
                            setOpen(false)
                            openDialog("settings", "general")
                        }}
                    />
                    <MenuItem
                        icon={<LogOut className="size-4" strokeWidth={1.75} />}
                        label="Log out"
                        onClick={() => {
                            setOpen(false)
                            logout.mutate()
                        }}
                    />
                </MenuSection>
            </Popover>
            <IconButton label="Close sidebar" tone="tertiary" className="opacity-0 group-hover/header:opacity-100 hover:bg-(--pk-sidebar-hover)" onClick={toggleSidebar}>
                <ChevronsLeft className="size-4.5" />
            </IconButton>
            <IconButton label="New page" className="hover:bg-(--pk-sidebar-hover)" onClick={() => createPage({ kind: "document" })}>
                <SquarePen className="size-4.5" strokeWidth={1.75} />
            </IconButton>
        </div>
    )
}

function PageTreeItem({ page, pages, depth }: { page: PageMeta; pages: PageMeta[]; depth: number }) {
    const currentPageId = useCurrentPageId()
    const openPage = useAppStore((s) => s.openPage)
    const createPage = useCreatePage()
    const deletePage = useDeletePage()
    const [expanded, setExpanded] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const [confirmDelete, setConfirmDelete] = useState(false)
    const moreRef = useRef<HTMLButtonElement>(null)
    const children = pages.filter((p) => p.parentId === page.id)
    const active = currentPageId === page.id

    return (
        <>
            <div
                role="button"
                tabIndex={0}
                onClick={() => openPage(page.id)}
                onKeyDown={(e) => e.key === "Enter" && openPage(page.id)}
                style={{ paddingLeft: 8 + depth * 12 }}
                className={cn(
                    "group/item flex h-7.5 cursor-pointer items-center gap-1.5 rounded-md pr-1 text-sm font-medium select-none",
                    active ? "bg-(--pk-sidebar-active) text-(--pk-text)" : "hover:bg-(--pk-sidebar-hover)",
                )}
            >
                <span className="relative flex size-5.5 shrink-0 items-center justify-center">
                    <span className="flex group-hover/item:opacity-0">
                        <PageIcon icon={page.icon} kind={page.kind} />
                    </span>
                    <IconButton
                        label={expanded ? "Collapse" : "Expand"}
                        size="xs"
                        className="absolute inset-0 m-auto opacity-0 group-hover/item:opacity-100 hover:bg-(--pk-active)"
                        onClick={(e) => {
                            e.stopPropagation()
                            setExpanded(!expanded)
                        }}
                    >
                        <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} />
                    </IconButton>
                </span>
                <span className="min-w-0 flex-1 truncate">{pageTitle(page)}</span>
                <span className={cn("flex items-center opacity-0 group-hover/item:opacity-100", menuOpen && "opacity-100")}>
                    <IconButton
                        ref={moreRef}
                        label="More"
                        size="sm"
                        tone="tertiary"
                        className="hover:bg-(--pk-active)"
                        onClick={(e) => {
                            e.stopPropagation()
                            setConfirmDelete(false)
                            setMenuOpen(true)
                        }}
                    >
                        <Ellipsis className="size-4" />
                    </IconButton>
                    <IconButton
                        label="Add a page inside"
                        size="sm"
                        tone="tertiary"
                        className="hover:bg-(--pk-active)"
                        onClick={(e) => {
                            e.stopPropagation()
                            setExpanded(true)
                            createPage({ kind: "document", parentId: page.id })
                        }}
                    >
                        <Plus className="size-4" />
                    </IconButton>
                </span>
            </div>

            <Popover open={menuOpen} onOpenChange={setMenuOpen} anchor={moreRef} className="w-60">
                <MenuSection>
                    {confirmDelete ? (
                        <>
                            <div className="px-2 py-1 text-xs text-(--pk-text-secondary)">
                                Delete “{pageTitle(page)}”{children.length > 0 ? " and the pages inside it" : ""}? This can't be undone.
                            </div>
                            <MenuItem
                                danger
                                icon={<Trash2 className="size-4" strokeWidth={1.75} />}
                                label="Delete page"
                                onClick={() => {
                                    setMenuOpen(false)
                                    deletePage.mutate(page.id)
                                }}
                            />
                        </>
                    ) : (
                        <MenuItem icon={<Trash2 className="size-4" strokeWidth={1.75} />} label="Delete" onClick={() => setConfirmDelete(true)} />
                    )}
                </MenuSection>
            </Popover>

            {expanded &&
                (children.length > 0 ? (
                    children.map((child) => <PageTreeItem key={child.id} page={child} pages={pages} depth={depth + 1} />)
                ) : (
                    <div style={{ paddingLeft: 8 + (depth + 1) * 12 + 28 }} className="flex h-7.5 items-center text-sm text-(--pk-text-tertiary)">
                        No pages inside
                    </div>
                ))}
        </>
    )
}
