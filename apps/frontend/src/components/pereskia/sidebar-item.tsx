import type { ReactNode } from "react"
import { cn } from "cn"

export function SidebarItem({
    icon,
    label,
    onClick,
    muted,
    active,
}: {
    icon: ReactNode
    label: ReactNode
    onClick: () => void
    muted?: boolean
    active?: boolean
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex h-7.5 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm font-medium select-none",
                active ? "bg-(--pk-sidebar-active) text-(--pk-text)" : "hover:bg-(--pk-sidebar-hover)",
                muted && "text-(--pk-text-tertiary)",
            )}
        >
            <span className="flex size-5.5 shrink-0 items-center justify-center">{icon}</span>
            <span className="truncate">{label}</span>
        </button>
    )
}

export function SidebarSectionHeader({ label, action }: { label: string; action?: ReactNode }) {
    return (
        <div className="group/section flex h-7.5 items-center rounded-md px-2 hover:bg-(--pk-sidebar-hover)">
            <span className="flex-1 text-xs font-medium text-(--pk-text-tertiary)">{label}</span>
            {action && <span className="opacity-0 group-hover/section:opacity-100">{action}</span>}
        </div>
    )
}

export function TabList<T extends string>({
    value,
    tabs,
    onChange,
}: {
    value: T
    tabs: { value: T; label: string; icon?: ReactNode }[]
    onChange: (value: T) => void
}) {
    return (
        <nav className="flex flex-col gap-px">
            {tabs.map((tab) => (
                <SidebarItem
                    key={tab.value}
                    icon={tab.icon}
                    label={tab.label}
                    active={tab.value === value}
                    onClick={() => onChange(tab.value)}
                />
            ))}
        </nav>
    )
}
