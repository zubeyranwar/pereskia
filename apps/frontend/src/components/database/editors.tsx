import { useMemo, useRef, useState, type ReactNode } from "react"
import { nanoid } from "nanoid"
import { cn } from "cn"
import { Check, ChevronLeft, ChevronRight, Ellipsis, GripVertical, Trash2 } from "lucide-react"
import {
    STATUS_GROUP_LABELS,
    TAG_COLORS,
    TAG_COLOR_LABELS,
    formatDate,
    randomTagColor,
    toISODate,
    type Property,
    type SelectOption,
    type StatusGroup,
    type TagColor,
} from "./model"
import {
    ColorSwatch,
    MenuItem,
    MenuLabel,
    MenuSection,
    MenuSeparator,
    Popover,
    Checkbox,
    OptionChip,
    Input,
} from "@/components/pereskia"

type OptionPickerProps = {
    property: Property
    selected: string[]
    multi: boolean
    onChange: (ids: string[]) => void
    onDone?: () => void
    allowCreate?: boolean
    showCheckboxes?: boolean
    onOptionsChange?: (options: SelectOption[]) => void
}

type PickerItem = { kind: "option"; option: SelectOption } | { kind: "create"; name: string }

export function OptionPicker({
    property,
    selected,
    multi,
    onChange,
    onDone,
    allowCreate = true,
    showCheckboxes = false,
    onOptionsChange,
}: OptionPickerProps) {
    const [query, setQuery] = useState("")
    const [highlight, setHighlight] = useState(0)
    const [createColor, setCreateColor] = useState<TagColor>(randomTagColor)
    const isStatus = property.type === "status"
    const options = property.options ?? []
    const byId = new Map(options.map((o) => [o.id, o]))

    const matching = options.filter((o) => o.name.toLowerCase().includes(query.trim().toLowerCase()))
    const canCreate =
        allowCreate && query.trim() !== "" && !options.some((o) => o.name.toLowerCase() === query.trim().toLowerCase())

    const items: PickerItem[] = [
        ...matching.map((option) => ({ kind: "option" as const, option })),
        ...(canCreate ? [{ kind: "create" as const, name: query.trim() }] : []),
    ]

    const choose = (id: string) => {
        if (multi) {
            onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id])
            setQuery("")
        } else {
            onChange(selected[0] === id && showCheckboxes ? [] : [id])
            onDone?.()
        }
    }

    const create = (name: string) => {
        const option: SelectOption = {
            id: nanoid(),
            name,
            color: createColor,
            ...(isStatus ? { group: "todo" as StatusGroup } : {}),
        }
        onOptionsChange?.([...options, option])
        setCreateColor(randomTagColor())
        setQuery("")
        if (multi) onChange([...selected, option.id])
        else {
            onChange([option.id])
            onDone?.()
        }
    }

    const activate = (item: PickerItem | undefined) => {
        if (!item) return
        if (item.kind === "create") create(item.name)
        else choose(item.option.id)
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "ArrowDown") {
            e.preventDefault()
            setHighlight((h) => Math.min(items.length - 1, h + 1))
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setHighlight((h) => Math.max(0, h - 1))
        } else if (e.key === "Enter") {
            e.preventDefault()
            activate(items[highlight])
        } else if (e.key === "Backspace" && query === "" && selected.length > 0) {
            onChange(selected.slice(0, -1))
        }
    }

    const renderItem = (item: PickerItem, index: number) => {
        if (item.kind === "create") {
            return (
                <button
                    key="__create"
                    type="button"
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => activate(item)}
                    className={cn(
                        "flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-md px-2 text-sm",
                        highlight === index && "bg-(--pk-hover)",
                    )}
                >
                    <span className="text-(--pk-text-secondary)">Create</span>
                    <OptionChip option={{ name: item.name, color: createColor }} isStatus={isStatus} />
                </button>
            )
        }
        const { option } = item
        const isSelected = selected.includes(option.id)
        return (
            <OptionRow
                key={option.id}
                option={option}
                isStatus={isStatus}
                highlighted={highlight === index}
                selected={isSelected}
                showCheckbox={showCheckboxes}
                editable={!!onOptionsChange}
                onHover={() => setHighlight(index)}
                onClick={() => activate(item)}
                onUpdate={(next) => onOptionsChange?.(options.map((o) => (o.id === next.id ? next : o)))}
                onDelete={() => {
                    onOptionsChange?.(options.filter((o) => o.id !== option.id))
                    onChange(selected.filter((s) => s !== option.id))
                }}
            />
        )
    }

    let list: ReactNode
    if (isStatus && query.trim() === "") {
        list = (["todo", "inProgress", "complete"] as StatusGroup[]).map((group) => {
            const groupItems = items
                .map((item, index) => ({ item, index }))
                .filter(({ item }) => item.kind === "option" && (item.option.group ?? "todo") === group)
            return (
                <div key={group} className="flex flex-col gap-px">
                    <MenuLabel>{STATUS_GROUP_LABELS[group]}</MenuLabel>
                    {groupItems.map(({ item, index }) => renderItem(item, index))}
                </div>
            )
        })
    } else {
        list = items.map(renderItem)
    }

    return (
        <div className="flex w-full flex-col">
            <div className="flex min-h-[34px] flex-wrap items-center gap-1.5 border-b border-(--pk-divider) bg-(--pk-input-bg) px-2.5 py-1.5">
                {selected.map((id) => {
                    const option = byId.get(id)
                    if (!option) return null
                    return (
                        <OptionChip
                            key={id}
                            option={option}
                            isStatus={isStatus}
                            onRemove={() => onChange(selected.filter((s) => s !== id))}
                        />
                    )
                })}
                <input
                    data-autofocus
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value)
                        setHighlight(0)
                    }}
                    onKeyDown={onKeyDown}
                    placeholder={selected.length ? "" : allowCreate ? "Search for an option..." : "Search options..."}
                    className="h-5 min-w-[60px] flex-1 bg-transparent text-sm outline-none placeholder:text-(--pk-text-tertiary)"
                />
            </div>
            <div className="flex flex-col gap-px p-1">
                {!isStatus && (
                    <div className="px-2 pt-1 pb-1 text-xs text-(--pk-text-secondary) select-none">
                        {allowCreate ? "Select an option or create one" : "Select options"}
                    </div>
                )}
                {list}
                {items.length === 0 && (
                    <div className="px-2 py-1 text-sm text-(--pk-text-tertiary)">No options found</div>
                )}
            </div>
        </div>
    )
}

function OptionRow({
    option,
    isStatus,
    highlighted,
    selected,
    showCheckbox,
    editable,
    onHover,
    onClick,
    onUpdate,
    onDelete,
}: {
    option: SelectOption
    isStatus: boolean
    highlighted: boolean
    selected: boolean
    showCheckbox: boolean
    editable: boolean
    onHover: () => void
    onClick: () => void
    onUpdate: (option: SelectOption) => void
    onDelete: () => void
}) {
    const [menuOpen, setMenuOpen] = useState(false)
    const rowRef = useRef<HTMLDivElement>(null)

    return (
        <div
            ref={rowRef}
            role="button"
            tabIndex={-1}
            onMouseEnter={onHover}
            onClick={onClick}
            className={cn(
                "group/opt flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-sm",
                (highlighted || menuOpen) && "bg-(--pk-hover)",
            )}
        >
            {showCheckbox ? (
                <Checkbox checked={selected} onChange={onClick} />
            ) : (
                <GripVertical className="size-4 shrink-0 text-(--pk-text-tertiary)" strokeWidth={1.75} />
            )}
            <span className="flex min-w-0 flex-1">
                <OptionChip option={option} isStatus={isStatus} />
            </span>
            {selected && !showCheckbox && <Check className="size-4 shrink-0 text-(--pk-text)" strokeWidth={2} />}
            {editable && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation()
                        setMenuOpen(true)
                    }}
                    className={cn(
                        "flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm text-(--pk-text-secondary) hover:bg-(--pk-active)",
                        highlighted || menuOpen ? "opacity-100" : "opacity-0",
                    )}
                >
                    <Ellipsis className="size-4" />
                </button>
            )}
            {editable && (
                <Popover open={menuOpen} onOpenChange={setMenuOpen} anchor={rowRef} side="right" align="start" className="w-[220px]">
                    <div onClick={(e) => e.stopPropagation()}>
                        <div className="p-2 pb-1">
                            <Input
                                data-autofocus
                                defaultValue={option.name}
                                onBlur={(e) => e.target.value.trim() && onUpdate({ ...option, name: e.target.value.trim() })}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        const name = e.currentTarget.value.trim()
                                        if (name) onUpdate({ ...option, name })
                                        setMenuOpen(false)
                                    }
                                }}
                                size="sm"
                            />
                        </div>
                        <MenuSection>
                            <MenuItem
                                danger
                                icon={<Trash2 className="size-4" strokeWidth={1.75} />}
                                label="Delete"
                                onClick={() => {
                                    setMenuOpen(false)
                                    onDelete()
                                }}
                            />
                        </MenuSection>
                        <MenuSeparator />
                        <MenuSection>
                            <MenuLabel>Colors</MenuLabel>
                            {TAG_COLORS.map((color) => (
                                <MenuItem
                                    key={color}
                                    icon={<ColorSwatch color={color} />}
                                    label={TAG_COLOR_LABELS[color]}
                                    right={option.color === color ? <Check className="size-4 text-(--pk-text)" /> : null}
                                    onClick={() => onUpdate({ ...option, color })}
                                />
                            ))}
                        </MenuSection>
                    </div>
                </Popover>
            )}
        </div>
    )
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

export function Calendar({ value, onChange }: { value: string | null; onChange: (value: string) => void }) {
    const initial = value ? new Date(value + "T00:00:00") : new Date()
    const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1))
    const today = toISODate(new Date())

    const days = useMemo(() => {
        const start = new Date(month)
        start.setDate(1 - start.getDay())
        return Array.from({ length: 42 }, (_, i) => {
            const d = new Date(start)
            d.setDate(start.getDate() + i)
            return d
        })
    }, [month])

    const shift = (delta: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1))

    return (
        <div className="px-3 pt-1 pb-2 select-none">
            <div className="mb-1 flex h-8 items-center">
                <span className="flex-1 pl-1 text-sm font-semibold">
                    {month.toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                </span>
                <button
                    type="button"
                    onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
                    className="h-6 cursor-pointer rounded-md px-1.5 text-sm text-(--pk-text-secondary) hover:bg-(--pk-hover)"
                >
                    Today
                </button>
                <button
                    type="button"
                    onClick={() => shift(-1)}
                    className="flex size-6 cursor-pointer items-center justify-center rounded-md text-(--pk-text-secondary) hover:bg-(--pk-hover)"
                >
                    <ChevronLeft className="size-4" />
                </button>
                <button
                    type="button"
                    onClick={() => shift(1)}
                    className="flex size-6 cursor-pointer items-center justify-center rounded-md text-(--pk-text-secondary) hover:bg-(--pk-hover)"
                >
                    <ChevronRight className="size-4" />
                </button>
            </div>
            <div className="grid grid-cols-7 gap-y-px">
                {WEEKDAYS.map((d) => (
                    <div key={d} className="flex h-8 items-center justify-center text-xs text-(--pk-text-tertiary)">
                        {d}
                    </div>
                ))}
                {days.map((d) => {
                    const iso = toISODate(d)
                    const inMonth = d.getMonth() === month.getMonth()
                    const isSelected = iso === value
                    const isToday = iso === today
                    return (
                        <button
                            key={iso}
                            type="button"
                            onClick={() => onChange(iso)}
                            className={cn(
                                "mx-auto flex size-8 cursor-pointer items-center justify-center rounded-md text-sm",
                                !inMonth && "text-(--pk-text-tertiary)",
                                isSelected ? "bg-(--pk-blue) text-white hover:bg-(--pk-blue-hover)" : "hover:bg-(--pk-hover)",
                            )}
                        >
                            {isToday && !isSelected ? (
                                <span className="flex size-6 items-center justify-center rounded-full bg-(--pk-red) text-white">
                                    {d.getDate()}
                                </span>
                            ) : (
                                d.getDate()
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

export function DatePicker({
    value,
    onChange,
    showClear = true,
}: {
    value: string | null
    onChange: (value: string | null) => void
    showClear?: boolean
}) {
    return (
        <div className="flex w-[250px] flex-col">
            <div className="p-2 pb-1">
                <div className="flex h-7 items-center rounded-md border border-(--pk-blue) bg-(--pk-input-bg) px-2 text-sm shadow-(--pk-focus-ring)">
                    {value ? formatDate(value) : <span className="text-(--pk-text-tertiary)">Select a date</span>}
                </div>
            </div>
            <Calendar value={value} onChange={onChange} />
            {showClear && (
                <>
                    <MenuSeparator />
                    <MenuSection>
                        <MenuItem label="Clear" onClick={() => onChange(null)} />
                    </MenuSection>
                </>
            )}
        </div>
    )
}
