import type { ReactNode } from "react"
import { cn } from "cn"

export function MenuItem({
    icon,
    label,
    right,
    onClick,
    danger,
    active,
    className,
    onMouseEnter,
}: {
    icon?: ReactNode
    label: ReactNode
    right?: ReactNode
    onClick?: () => void
    danger?: boolean
    active?: boolean
    className?: string
    onMouseEnter?: () => void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            className={cn(
                "flex h-7 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left text-sm leading-[1.2] select-none hover:bg-(--pk-hover)",
                active && "bg-(--pk-hover)",
                danger && "hover:text-(--pk-red) [&:hover_svg]:text-(--pk-red)",
                className,
            )}
        >
            {icon && <span className="flex size-5 shrink-0 items-center justify-center text-(--pk-text)">{icon}</span>}
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {right && <span className="flex shrink-0 items-center text-xs text-(--pk-text-tertiary)">{right}</span>}
        </button>
    )
}

export function MenuSection({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={cn("flex flex-col gap-px p-1", className)}>{children}</div>
}

export function MenuSeparator() {
    return <div className="h-px bg-(--pk-divider)" />
}

export function MenuLabel({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn("flex h-6 items-center px-2 text-xs font-medium text-(--pk-text-secondary) select-none", className)}>
            {children}
        </div>
    )
}

export function MenuHint({ children }: { children: ReactNode }) {
    return <div className="px-2 py-1 text-sm text-(--pk-text-tertiary)">{children}</div>
}
