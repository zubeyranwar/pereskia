import { forwardRef } from "react"
import { cn } from "cn"
import { ChevronDown } from "lucide-react"

type ButtonProps = React.ComponentProps<"button"> & {
    variant?: "primary" | "secondary" | "ghost" | "danger"
    size?: "sm" | "md"
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    { variant = "secondary", size = "md", className, type = "button", ...props },
    ref,
) {
    return (
        <button
            ref={ref}
            type={type}
            className={cn(
                "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors select-none disabled:cursor-default disabled:opacity-40",
                size === "md" ? "h-8 px-3 text-sm" : "h-7 px-2 text-sm",
                variant === "primary" && "bg-(--pk-blue) text-white hover:bg-(--pk-blue-hover)",
                variant === "secondary" && "border border-(--pk-input-border) hover:bg-(--pk-hover)",
                variant === "ghost" && "text-(--pk-text-secondary) hover:bg-(--pk-hover)",
                variant === "danger" && "border border-(--pk-red)/40 text-(--pk-red) hover:bg-(--pk-red)/10",
                className,
            )}
            {...props}
        />
    )
})

type IconButtonProps = React.ComponentProps<"button"> & {
    label: string
    size?: "xs" | "sm" | "md"
    tone?: "secondary" | "tertiary"
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
    { label, size = "md", tone = "secondary", className, type = "button", ...props },
    ref,
) {
    return (
        <button
            ref={ref}
            type={type}
            aria-label={label}
            title={label}
            className={cn(
                "flex shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-(--pk-hover) disabled:cursor-default disabled:opacity-40",
                size === "xs" && "size-5 rounded-sm",
                size === "sm" && "size-6",
                size === "md" && "size-7",
                tone === "secondary" ? "text-(--pk-text-secondary)" : "text-(--pk-text-tertiary)",
                className,
            )}
            {...props}
        />
    )
})

export const DropdownButton = forwardRef<HTMLButtonElement, React.ComponentProps<"button">>(function DropdownButton(
    { children, className, type = "button", ...props },
    ref,
) {
    return (
        <button
            ref={ref}
            type={type}
            className={cn(
                "flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 text-sm text-(--pk-text) select-none hover:bg-(--pk-hover)",
                className,
            )}
            {...props}
        >
            {children}
            <ChevronDown className="size-3 text-(--pk-text-tertiary)" strokeWidth={2.5} />
        </button>
    )
})

export function Pill({
    active,
    children,
    className,
    ...props
}: React.ComponentProps<"button"> & { active: boolean }) {
    return (
        <button
            type="button"
            className={cn(
                "flex h-6 max-w-[260px] shrink-0 cursor-pointer items-center gap-1 rounded-full border px-2 text-sm whitespace-nowrap select-none",
                active
                    ? "border-(--pk-blue-border) bg-(--pk-blue-soft) text-(--pk-blue) hover:bg-(--pk-blue)/12"
                    : "border-(--pk-divider) text-(--pk-text-secondary) hover:bg-(--pk-hover)",
                className,
            )}
            {...props}
        >
            {children}
            <ChevronDown className="size-3 shrink-0" strokeWidth={2.5} />
        </button>
    )
}

export function Segmented<T extends string>({
    value,
    options,
    onChange,
}: {
    value: T
    options: { value: T; label: string }[]
    onChange: (value: T) => void
}) {
    return (
        <div className="flex items-center gap-1 self-start rounded-md bg-(--pk-hover) p-0.5 text-sm">
            {options.map((o) => (
                <button
                    key={o.value}
                    type="button"
                    onClick={() => onChange(o.value)}
                    className={cn(
                        "h-6 cursor-pointer rounded px-2.5",
                        value === o.value ? "bg-(--pk-popover) font-medium shadow-sm" : "text-(--pk-text-secondary)",
                    )}
                >
                    {o.label}
                </button>
            ))}
        </div>
    )
}

export function SplitButton({
    children,
    onClick,
    onMenuClick,
    className,
}: {
    children: React.ReactNode
    onClick: () => void
    onMenuClick: () => void
    className?: string
}) {
    return (
        <div className={cn("flex h-7 overflow-hidden rounded-md bg-(--pk-blue) text-sm font-medium text-white", className)}>
            <button type="button" onClick={onClick} className="cursor-pointer px-2 hover:bg-(--pk-blue-hover)">
                {children}
            </button>
            <span className="w-px bg-(--pk-bg)/25" />
            <button type="button" aria-label="More options" onClick={onMenuClick} className="cursor-pointer px-1 hover:bg-(--pk-blue-hover)">
                <ChevronDown className="size-4" strokeWidth={2} />
            </button>
        </div>
    )
}
