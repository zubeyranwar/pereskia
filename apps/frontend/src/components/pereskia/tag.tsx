import { cn } from "cn"
import { X } from "lucide-react"

export type TagColor = "default" | "gray" | "brown" | "orange" | "yellow" | "green" | "blue" | "purple" | "pink" | "red"

type TagLike = { name: string; color: TagColor }

const tagStyle = (color: TagColor) => ({
    background: `var(--tag-${color}-bg)`,
    color: `var(--tag-${color}-text)`,
})

function RemoveButton({ onRemove, className }: { onRemove: () => void; className?: string }) {
    return (
        <button
            type="button"
            aria-label="Remove"
            onClick={(e) => {
                e.stopPropagation()
                onRemove()
            }}
            className={cn("flex size-4 cursor-pointer items-center justify-center rounded-sm opacity-50 hover:opacity-100", className)}
        >
            <X className="size-3" strokeWidth={2.5} />
        </button>
    )
}

export function Tag({ option, onRemove, className }: { option: TagLike; onRemove?: () => void; className?: string }) {
    return (
        <span
            className={cn(
                "inline-flex h-5 max-w-full min-w-0 shrink-0 items-center rounded-[3px] px-1.5 text-sm leading-[1.2] whitespace-nowrap",
                className,
            )}
            style={tagStyle(option.color)}
        >
            <span className="truncate">{option.name}</span>
            {onRemove && <RemoveButton onRemove={onRemove} className="-mr-0.5 ml-0.5" />}
        </span>
    )
}

export function StatusPill({ option, onRemove, className }: { option: TagLike; onRemove?: () => void; className?: string }) {
    return (
        <span
            className={cn(
                "inline-flex h-5 max-w-full min-w-0 shrink-0 items-center gap-1.5 rounded-full pr-2 pl-1.75 text-sm leading-[1.2] whitespace-nowrap",
                className,
            )}
            style={tagStyle(option.color)}
        >
            <span className="size-2 shrink-0 rounded-full" style={{ background: `var(--tag-${option.color}-dot)` }} />
            <span className="truncate">{option.name}</span>
            {onRemove && <RemoveButton onRemove={onRemove} className="-mr-1" />}
        </span>
    )
}

export function OptionChip({ option, isStatus, onRemove }: { option: TagLike; isStatus: boolean; onRemove?: () => void }) {
    return isStatus ? <StatusPill option={option} onRemove={onRemove} /> : <Tag option={option} onRemove={onRemove} />
}

export function ColorSwatch({ color }: { color: TagColor }) {
    return (
        <span
            className="size-4.5 rounded-[3px] shadow-[inset_0_0_0_1px_var(--pk-input-border)]"
            style={{ background: `var(--tag-${color}-bg)` }}
        />
    )
}
