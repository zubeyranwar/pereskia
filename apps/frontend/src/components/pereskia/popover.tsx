import { useRef, type ReactElement, type ReactNode } from "react"
import { Popover as BasePopover } from "@base-ui/react/popover"
import { cn } from "cn"

type PopoverProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    trigger?: ReactElement
    anchor?: Element | null | React.RefObject<Element | null>
    side?: "top" | "bottom" | "left" | "right"
    align?: "start" | "center" | "end"
    sideOffset?: BasePopover.Positioner.Props["sideOffset"]
    alignOffset?: number
    className?: string
    children: ReactNode
}

export function Popover({
    open,
    onOpenChange,
    trigger,
    anchor,
    side = "bottom",
    align = "start",
    sideOffset = 4,
    alignOffset = 0,
    className,
    children,
}: PopoverProps) {
    const popupRef = useRef<HTMLDivElement>(null)
    return (
        <BasePopover.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
            {trigger && <BasePopover.Trigger render={trigger} />}
            <BasePopover.Portal>
                <BasePopover.Positioner
                    className="z-50 outline-none"
                    anchor={anchor}
                    side={side}
                    align={align}
                    sideOffset={sideOffset}
                    alignOffset={alignOffset}
                >
                    <BasePopover.Popup
                        ref={popupRef}
                        initialFocus={() => popupRef.current?.querySelector<HTMLElement>("[data-autofocus]") ?? true}
                        className={cn(
                            "pk-root pk-scroller max-h-[min(70vh,var(--available-height))] overflow-y-auto rounded-[10px] bg-(--pk-popover) text-(--pk-text) shadow-(--pk-popover-shadow) outline-none",
                            "origin-(--transform-origin) transition-[opacity,scale] duration-100 data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-starting-style:scale-[0.98] data-starting-style:opacity-0",
                            className,
                        )}
                    >
                        {children}
                    </BasePopover.Popup>
                </BasePopover.Positioner>
            </BasePopover.Portal>
        </BasePopover.Root>
    )
}
