import { forwardRef, type ReactNode } from "react"
import { cn } from "cn"

const fieldClass =
    "w-full min-w-0 rounded-md border border-(--pk-input-border) bg-(--pk-input-bg) text-sm outline-none placeholder:text-(--pk-text-tertiary) focus:border-(--pk-blue) focus:shadow-(--pk-focus-ring)"

export const Input = forwardRef<HTMLInputElement, Omit<React.ComponentProps<"input">, "size"> & { size?: "sm" | "md" }>(function Input(
    { className, size = "md", ...props },
    ref,
) {
    return <input ref={ref} className={cn(fieldClass, size === "md" ? "h-8 px-2.5" : "h-7 px-2", className)} {...props} />
})

export function SearchInput({
    value,
    onChange,
    placeholder,
    onKeyDown,
}: {
    value: string
    onChange: (value: string) => void
    placeholder: string
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
}) {
    return (
        <Input
            data-autofocus
            size="sm"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
        />
    )
}

export function BareInput({ className, ...props }: React.ComponentProps<"input">) {
    return (
        <input
            className={cn("w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-(--pk-text-tertiary)", className)}
            {...props}
        />
    )
}

export function Field({
    label,
    hint,
    children,
    className,
}: {
    label: string
    hint?: ReactNode
    children: ReactNode
    className?: string
}) {
    return (
        <label className={cn("flex min-w-0 flex-col gap-1", className)}>
            <span className="text-xs font-medium text-(--pk-text-secondary)">{label}</span>
            {children}
            {hint && <span className="text-xs text-(--pk-text-tertiary)">{hint}</span>}
        </label>
    )
}

export function Code({ children }: { children: ReactNode }) {
    return <code className="rounded bg-(--pk-hover) px-1 text-[0.92em]">{children}</code>
}
