import type { ReactNode } from "react"
import { cn } from "cn"
import { CircleAlert, CircleCheck, Loader2 } from "lucide-react"

export function Spinner({ className }: { className?: string }) {
    return <Loader2 className={cn("size-4 animate-spin", className)} />
}

export function ErrorText({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn("flex items-start gap-2 text-sm text-(--pk-red)", className)}>
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 wrap-break-word">{children}</span>
        </div>
    )
}

export function SuccessText({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn("flex items-start gap-2 text-sm text-(--pk-green)", className)}>
            <CircleCheck className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 wrap-break-word">{children}</span>
        </div>
    )
}

export function Skeleton({ className }: { className?: string }) {
    return <div className={cn("animate-pulse rounded-md bg-(--pk-hover)", className)} />
}

export function FullScreen({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <div className={cn("pk-root flex h-svh flex-col items-center justify-center gap-3 bg-(--pk-bg) text-sm text-(--pk-text-secondary)", className)}>
            {children}
        </div>
    )
}

export function StatusDot({ tone = "green" }: { tone?: "green" | "red" }) {
    return <span className={cn("size-2 rounded-full", tone === "green" ? "bg-(--pk-green)" : "bg-(--pk-red)")} />
}
