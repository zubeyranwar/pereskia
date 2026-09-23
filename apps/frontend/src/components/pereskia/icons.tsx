import type { ComponentType } from "react"
import { cn } from "cn"
import {
    Calendar,
    CaseSensitive,
    CircleChevronDown,
    FileText,
    Hash,
    List,
    Loader,
    SquareCheck,
    Table2,
    TextAlignStart,
    type LucideProps,
} from "lucide-react"

export type PropertyKind = "title" | "text" | "number" | "select" | "multiSelect" | "status" | "date" | "checkbox"

const PROPERTY_ICONS: Record<PropertyKind, ComponentType<LucideProps>> = {
    title: CaseSensitive,
    text: TextAlignStart,
    number: Hash,
    select: CircleChevronDown,
    multiSelect: List,
    status: Loader,
    date: Calendar,
    checkbox: SquareCheck,
}

export function PropertyIcon({ type, className }: { type: PropertyKind; className?: string }) {
    const Icon = PROPERTY_ICONS[type]
    return <Icon className={cn("size-4 shrink-0", className)} strokeWidth={1.75} />
}

export function PageIcon({ icon, kind, className }: { icon: string | null; kind: "document" | "database"; className?: string }) {
    if (icon) return <span className={cn("text-[15px] leading-none", className)}>{icon}</span>
    const Icon = kind === "database" ? Table2 : FileText
    return <Icon className={cn("size-4.5", className)} strokeWidth={1.6} />
}
