import type { ReactNode } from "react"
import { Dialog as BaseDialog } from "@base-ui/react/dialog"
import { cn } from "cn"
import { X } from "lucide-react"

export function Dialog({
    open,
    onOpenChange,
    title,
    children,
    className,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    title?: ReactNode
    children: ReactNode
    className?: string
}) {
    return (
        <BaseDialog.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
            <BaseDialog.Portal>
                <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-(--pk-backdrop) transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0" />
                <BaseDialog.Popup
                    className={cn(
                        "pk-root fixed top-[12vh] left-1/2 z-50 flex max-h-[76vh] w-[calc(100vw-32px)] max-w-160 -translate-x-1/2 flex-col overflow-hidden rounded-xl bg-(--pk-popover) text-(--pk-text) shadow-(--pk-popover-shadow) outline-none",
                        "transition-[opacity,scale] duration-150 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0",
                        className,
                    )}
                >
                    {title !== undefined && (
                        <div className="flex h-12 shrink-0 items-center border-b border-(--pk-divider) pr-2 pl-4">
                            <BaseDialog.Title className="flex-1 truncate text-sm font-semibold">{title}</BaseDialog.Title>
                            <BaseDialog.Close className="flex size-7 cursor-pointer items-center justify-center rounded-md text-(--pk-text-secondary) hover:bg-(--pk-hover)">
                                <X className="size-4" />
                            </BaseDialog.Close>
                        </div>
                    )}
                    <div className="pk-scroller flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
                </BaseDialog.Popup>
            </BaseDialog.Portal>
        </BaseDialog.Root>
    )
}

export function DialogSection({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
    return (
        <section className={className}>
            <h2 className="mb-3 border-b border-(--pk-divider) pb-2 text-sm font-semibold">{title}</h2>
            {children}
        </section>
    )
}
