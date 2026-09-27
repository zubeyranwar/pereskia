import type { ReactNode } from "react"
import { cn } from "cn"
import { ArrowUpDown, ChevronDown, Filter, Plus, Search, Table2 } from "lucide-react"
import { BrandMark, Checkbox, PropertyIcon, StatusPill, Tag, type TagColor } from "@/components/pereskia"

/*
 * The landing page shows the product by rebuilding its screens from the same
 * tokens and components the app itself uses, instead of embedding screenshots.
 * Nothing here is interactive — these are static compositions, so they stay
 * sharp at any size, follow the light/dark theme, and cannot drift out of date
 * the way a captured PNG does.
 */

/* The window chrome every mockup sits in: a hairline card with a title bar. */
export function Frame({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div
            className={cn(
                "pk-root overflow-hidden rounded-xl bg-(--pk-bg) shadow-(--pk-popover-shadow) select-none",
                className,
            )}
        >
            <div className="flex h-9 items-center gap-1.5 border-b border-(--pk-divider) px-3.5">
                <span className="size-2.5 rounded-full bg-(--pk-active)" />
                <span className="size-2.5 rounded-full bg-(--pk-active)" />
                <span className="size-2.5 rounded-full bg-(--pk-active)" />
            </div>
            {children}
        </div>
    )
}

/* ---------------------------------------------------------------- workspace */

const SIDEBAR_PAGES: { icon: string; name: string; active?: boolean }[] = [
    { icon: "🚀", name: "Launch plan", active: true },
    { icon: "📊", name: "Roadmap" },
    { icon: "🧾", name: "Meeting notes" },
    { icon: "🎯", name: "Q3 goals" },
    { icon: "🧩", name: "Engineering" },
]

/* The full app: off-white sidebar beside a document with a gradient cover. */
export function WorkspaceMockup() {
    return (
        <Frame>
            <div className="flex h-[420px] sm:h-[480px]">
                <aside className="hidden w-56 shrink-0 flex-col bg-(--pk-sidebar) py-2.5 text-(--pk-sidebar-text) sm:flex">
                    <div className="flex items-center gap-2 px-3 pb-3">
                        <span className="flex size-5 items-center justify-center rounded bg-(--pk-blue) text-[11px] font-semibold text-white">
                            A
                        </span>
                        <span className="text-[13px] font-medium text-(--pk-text)">Acme</span>
                        <ChevronDown className="ml-auto size-3.5 opacity-60" strokeWidth={2} />
                    </div>

                    <div className="flex items-center gap-2 px-3 py-1 text-[13px]">
                        <Search className="size-4 opacity-70" strokeWidth={1.75} />
                        Search
                    </div>

                    <div className="px-3 pt-4 pb-1 text-[11px] font-medium tracking-wide text-(--pk-text-tertiary)">
                        Private
                    </div>

                    {SIDEBAR_PAGES.map((page) => (
                        <div
                            key={page.name}
                            className={cn(
                                "mx-1.5 flex items-center gap-2 rounded px-1.5 py-1 text-[13px]",
                                page.active && "bg-(--pk-sidebar-active) font-medium text-(--pk-text)",
                            )}
                        >
                            <span className="text-[13px] leading-none">{page.icon}</span>
                            {page.name}
                        </div>
                    ))}
                </aside>

                <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="h-20 bg-[linear-gradient(135deg,#a1c4fd_0%,#c2e9fb_100%)]" />
                    <div className="px-6 sm:px-10">
                        <div className="-mt-6 text-[44px] leading-none">🚀</div>
                        <h3 className="pt-3 text-[28px] leading-tight font-bold text-(--pk-text)">Launch plan</h3>
                        <div className="mt-5 space-y-2.5 text-[15px] leading-[1.6] text-(--pk-text)">
                            <p>Everything we need to ship, in one place.</p>
                            <div className="flex items-start gap-2.5">
                                <span className="pt-0.5">
                                    <Checkbox checked />
                                </span>
                                <span className="text-(--pk-text-tertiary) line-through">Pick the database</span>
                            </div>
                            <div className="flex items-start gap-2.5">
                                <span className="pt-0.5">
                                    <Checkbox checked={false} />
                                </span>
                                <span>Invite the team</span>
                            </div>
                            <div className="flex items-start gap-2.5">
                                <span className="pt-0.5">
                                    <Checkbox checked={false} />
                                </span>
                                <span>Move the roadmap over</span>
                            </div>
                        </div>

                        <div className="mt-6 rounded-md border border-(--pk-border)">
                            <div className="flex items-center gap-2 border-b border-(--pk-border) px-3 py-1.5 text-[13px] font-medium">
                                <Table2 className="size-4 text-(--pk-text-secondary)" strokeWidth={1.75} />
                                Milestones
                            </div>
                            {[
                                { name: "Beta on staging", status: { name: "In progress", color: "blue" as TagColor } },
                                { name: "Docs pass", status: { name: "Not started", color: "default" as TagColor } },
                            ].map((row) => (
                                <div
                                    key={row.name}
                                    className="flex items-center justify-between px-3 py-1.5 text-[13px] last:border-0"
                                >
                                    {row.name}
                                    <StatusPill option={row.status} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </Frame>
    )
}

/* ------------------------------------------------------------ setup wizard */

const PROVIDERS = [
    { name: "SQLite", detail: "Single file on this server.", mark: "◱" },
    { name: "PostgreSQL", detail: "Your own Postgres server.", mark: "◈", selected: true },
    { name: "MySQL", detail: "MySQL or MariaDB.", mark: "◎" },
    { name: "Supabase", detail: "Hosted Postgres.", mark: "◆" },
]

export function WizardMockup() {
    return (
        <Frame>
            <div className="px-6 py-7 sm:px-10">
                <div className="flex items-center gap-2.5 text-(--pk-text)">
                    <BrandMark size={20} />
                    <span className="text-[13px] font-semibold">Pereskia</span>
                    <span className="ml-auto text-xs text-(--pk-text-tertiary)">Step 1 of 3</span>
                </div>

                <h3 className="pt-6 text-[26px] leading-tight font-bold text-(--pk-text)">Where should your data live?</h3>
                <p className="mt-2 text-[13px] text-(--pk-text-secondary)">
                    Pages and databases are stored in a database you control.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-2">
                    {PROVIDERS.map((provider) => (
                        <div
                            key={provider.name}
                            className={cn(
                                "flex items-start gap-2.5 rounded-md border p-2.5",
                                provider.selected
                                    ? "border-(--pk-blue-border) bg-(--pk-blue-soft)"
                                    : "border-(--pk-input-border)",
                            )}
                        >
                            <span
                                className={cn(
                                    "flex size-7 shrink-0 items-center justify-center rounded text-sm",
                                    provider.selected
                                        ? "bg-(--pk-blue) text-white"
                                        : "bg-(--pk-input-bg) text-(--pk-text-secondary)",
                                )}
                            >
                                {provider.mark}
                            </span>
                            <span className="min-w-0">
                                <span className="block text-[13px] font-medium text-(--pk-text)">{provider.name}</span>
                                <span className="block truncate text-xs text-(--pk-text-tertiary)">{provider.detail}</span>
                            </span>
                        </div>
                    ))}
                </div>

                <div className="mt-5 grid grid-cols-[1fr_88px] gap-2">
                    <Field label="Host" value="localhost" />
                    <Field label="Port" value="5432" />
                </div>
                <div className="mt-3">
                    <Field label="Database" value="pereskia" />
                </div>

                <div className="mt-6 flex items-center justify-between">
                    <span className="inline-flex h-8 items-center rounded-md border border-(--pk-input-border) px-3 text-sm font-medium text-(--pk-text)">
                        Test connection
                    </span>
                    <span className="inline-flex h-8 items-center rounded-md bg-(--pk-blue) px-3 text-sm font-medium text-white">
                        Continue
                    </span>
                </div>
            </div>
        </Frame>
    )
}

function Field({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="pb-1 text-xs text-(--pk-text-secondary)">{label}</div>
            <div className="flex h-8 items-center rounded-md border border-(--pk-input-border) bg-(--pk-input-bg) px-2.5 text-[13px] text-(--pk-text)">
                {value}
            </div>
        </div>
    )
}

/* ---------------------------------------------------------------- database */

type Row = {
    name: string
    status: { name: string; color: TagColor }
    tags: { name: string; color: TagColor }[]
    done: boolean
}

const ROWS: Row[] = [
    {
        name: "Ship self-hosting guide",
        status: { name: "In progress", color: "blue" },
        tags: [{ name: "Docs", color: "purple" }],
        done: false,
    },
    {
        name: "Postgres migration",
        status: { name: "Done", color: "green" },
        tags: [{ name: "Backend", color: "orange" }],
        done: true,
    },
    {
        name: "Invite flow polish",
        status: { name: "In progress", color: "blue" },
        tags: [
            { name: "Design", color: "pink" },
            { name: "Web", color: "blue" },
        ],
        done: false,
    },
    {
        name: "Audit log",
        status: { name: "Not started", color: "default" },
        tags: [{ name: "Backend", color: "orange" }],
        done: false,
    },
]

/* minmax(0,...) lets every column shrink, so the table never spills past the frame. */
const GRID = cn(
    "grid grid-cols-[minmax(0,1.5fr)_minmax(0,104px)_minmax(0,1fr)]",
    "sm:grid-cols-[minmax(0,1.5fr)_minmax(0,124px)_minmax(0,1.1fr)_72px]",
)

export function DatabaseMockup() {
    return (
        <Frame>
            <div className="px-4 pt-4 sm:px-6">
                <div className="flex items-center gap-3 pb-3 text-[13px]">
                    <span className="border-b-2 border-(--pk-text) pb-1.5 font-medium text-(--pk-text)">Table</span>
                    <span className="pb-1.5 text-(--pk-text-tertiary)">Board</span>
                    <span className="ml-auto flex items-center gap-3 text-(--pk-text-secondary)">
                        <span className="flex items-center gap-1">
                            <Filter className="size-3.5" strokeWidth={1.75} /> Filter
                        </span>
                        <span className="flex items-center gap-1">
                            <ArrowUpDown className="size-3.5" strokeWidth={1.75} /> Sort
                        </span>
                    </span>
                </div>
            </div>

            <div className="border-t border-(--pk-border)">
                <div className={cn(GRID, "border-b border-(--pk-border) text-xs text-(--pk-text-secondary)")}>
                    <HeadCell type="title">Task</HeadCell>
                    <HeadCell type="status">Status</HeadCell>
                    <HeadCell type="multiSelect">Team</HeadCell>
                    <HeadCell type="checkbox" className="hidden sm:flex">
                        Done
                    </HeadCell>
                </div>

                {ROWS.map((row) => (
                    <div key={row.name} className={cn(GRID, "border-b border-(--pk-border) text-[13px]")}>
                        <Cell className="truncate font-medium text-(--pk-text)">{row.name}</Cell>
                        <Cell>
                            <StatusPill option={row.status} />
                        </Cell>
                        <Cell className="gap-1 whitespace-nowrap">
                            {row.tags.map((tag) => (
                                <Tag key={tag.name} option={tag} />
                            ))}
                        </Cell>
                        <Cell className="hidden sm:flex">
                            <Checkbox checked={row.done} />
                        </Cell>
                    </div>
                ))}

                <div className="flex items-center gap-1.5 px-3 py-2 text-[13px] text-(--pk-text-tertiary)">
                    <Plus className="size-3.5" strokeWidth={2} /> New
                </div>
            </div>
        </Frame>
    )
}

function HeadCell({
    type,
    children,
    className,
}: {
    type: "title" | "status" | "multiSelect" | "checkbox"
    children: ReactNode
    className?: string
}) {
    return (
        <div
            className={cn(
                "flex min-w-0 items-center gap-1.5 overflow-hidden border-r border-(--pk-border) px-2.5 py-2 last:border-r-0",
                className,
            )}
        >
            <PropertyIcon type={type} className="size-3.5 opacity-70" />
            <span className="truncate">{children}</span>
        </div>
    )
}

function Cell({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div
            className={cn(
                "flex min-w-0 items-center overflow-hidden border-r border-(--pk-border) px-2.5 py-2 last:border-r-0",
                className,
            )}
        >
            {children}
        </div>
    )
}

/* ------------------------------------------------------------------ blocks */

export function BlocksMockup() {
    return (
        <Frame>
            <div className="space-y-3 px-6 py-7 text-[15px] leading-[1.6] text-(--pk-text) sm:px-10">
                <h3 className="text-[26px] leading-tight font-bold">Weekly sync</h3>
                <p className="text-(--pk-text-secondary)">Notes from Tuesday.</p>

                <div className="pt-1 text-[19px] font-semibold">Decisions</div>
                <p>
                    We're moving the roadmap into an inline database so status lives next to the notes instead of in a
                    separate tool.
                </p>

                <div className="flex items-start gap-2.5">
                    <span className="pt-0.5">
                        <Checkbox checked />
                    </span>
                    <span className="text-(--pk-text-tertiary) line-through">Agree on the property set</span>
                </div>
                <div className="flex items-start gap-2.5">
                    <span className="pt-0.5">
                        <Checkbox checked={false} />
                    </span>
                    <span>Backfill last quarter</span>
                </div>

                <div className="flex items-center gap-2 rounded-md border border-(--pk-blue-border) bg-(--pk-blue-soft) px-2.5 py-1.5 text-[13px] text-(--pk-text-secondary)">
                    <Plus className="size-3.5 text-(--pk-blue)" strokeWidth={2} />
                    Type <span className="font-medium text-(--pk-text)">/</span> for headings, to-dos, tables and pages
                </div>
            </div>
        </Frame>
    )
}

/* ----------------------------------------------------------------- members */

const MEMBERS = [
    { name: "Zubeyr", email: "zubeyr@acme.com", role: "Owner", color: "blue" as TagColor },
    { name: "Hana", email: "hana@acme.com", role: "Admin", color: "purple" as TagColor },
    { name: "Samuel", email: "samuel@acme.com", role: "Member", color: "green" as TagColor },
]

export function MembersMockup() {
    return (
        <Frame>
            <div className="px-6 py-7 sm:px-8">
                <div className="text-[15px] font-semibold text-(--pk-text)">Members</div>
                <p className="mt-1 text-[13px] text-(--pk-text-secondary)">
                    Invite by email, or share the link yourself.
                </p>

                <div className="mt-4 flex gap-2">
                    <div className="flex h-8 flex-1 items-center rounded-md border border-(--pk-input-border) bg-(--pk-input-bg) px-2.5 text-[13px] text-(--pk-text-tertiary)">
                        teammate@acme.com
                    </div>
                    <span className="inline-flex h-8 shrink-0 items-center rounded-md bg-(--pk-blue) px-3 text-sm font-medium text-white">
                        Invite
                    </span>
                </div>

                <div className="mt-5 space-y-3">
                    {MEMBERS.map((member) => (
                        <div key={member.email} className="flex items-center gap-2.5">
                            <span
                                className="flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                                style={{
                                    background: `var(--tag-${member.color}-bg)`,
                                    color: `var(--tag-${member.color}-text)`,
                                }}
                            >
                                {member.name[0]}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-medium text-(--pk-text)">
                                    {member.name}
                                </span>
                                <span className="block truncate text-xs text-(--pk-text-tertiary)">{member.email}</span>
                            </span>
                            <span className="flex items-center gap-1 text-[13px] text-(--pk-text-secondary)">
                                {member.role}
                                <ChevronDown className="size-3.5 opacity-60" strokeWidth={2} />
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </Frame>
    )
}
