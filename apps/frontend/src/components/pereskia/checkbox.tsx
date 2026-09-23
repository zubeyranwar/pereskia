import { cn } from "cn"
import { Check } from "lucide-react"

export function Checkbox({ checked, onChange }: { checked: boolean; onChange?: (checked: boolean) => void }) {
    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={(e) => {
                e.stopPropagation()
                onChange?.(!checked)
            }}
            className={cn(
                "flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[3px] transition-colors duration-100",
                checked
                    ? "bg-(--pk-blue) hover:bg-(--pk-blue-hover)"
                    : "shadow-[inset_0_0_0_1.5px_var(--pk-text-secondary)] hover:bg-(--pk-hover)",
            )}
        >
            {checked && <Check className="size-3 text-white" strokeWidth={3.5} />}
        </button>
    )
}

export function CheckboxLabel({
    checked,
    onChange,
    children,
}: {
    checked: boolean
    onChange: (checked: boolean) => void
    children: React.ReactNode
}) {
    return (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-(--pk-text-secondary) select-none">
            <Checkbox checked={checked} onChange={onChange} />
            {children}
        </label>
    )
}
