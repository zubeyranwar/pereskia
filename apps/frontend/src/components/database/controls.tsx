import { useRef, useState, type ReactNode } from "react"
import { nanoid } from "nanoid"
import { cn } from "cn"
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    Check,
    Ellipsis,
    GripVertical,
    ListFilter,
    Plus,
    Search,
    Table2,
    Trash2,
    X,
} from "lucide-react"
import {
    DEFAULT_OPERATOR,
    OPERATORS_BY_TYPE,
    OPERATOR_LABELS,
    newFilter,
    formatDate,
    isEmptyValue,
    operatorNeedsValue,
    type CellValue,
    type DatabaseData,
    type Filter,
    type Property,
    type Sort,
    type SortDirection,
} from "./model"
import { DatePicker, OptionPicker } from "./editors"
import {
    DropdownButton,
    Input,
    MenuItem,
    Pill,
    SplitButton,
    MenuSection,
    MenuSeparator,
    Popover,
    OptionChip,
    PropertyIcon,
    SearchInput,
} from "@/components/pereskia"

type Update = (fn: (data: DatabaseData) => DatabaseData) => void

export function PropertyPicker({
    properties,
    placeholder,
    onPick,
    footer,
}: {
    properties: Property[]
    placeholder: string
    onPick: (property: Property) => void
    footer?: ReactNode
}) {
    const [query, setQuery] = useState("")
    const [highlight, setHighlight] = useState(0)
    const matching = properties.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))

    return (
        <div className="flex w-[260px] flex-col">
            <div className="p-2 pb-1">
                <SearchInput
                    value={query}
                    onChange={(v) => {
                        setQuery(v)
                        setHighlight(0)
                    }}
                    placeholder={placeholder}
                    onKeyDown={(e) => {
                        if (e.key === "ArrowDown") {
                            e.preventDefault()
                            setHighlight((h) => Math.min(matching.length - 1, h + 1))
                        } else if (e.key === "ArrowUp") {
                            e.preventDefault()
                            setHighlight((h) => Math.max(0, h - 1))
                        } else if (e.key === "Enter" && matching[highlight]) {
                            e.preventDefault()
                            onPick(matching[highlight])
                        }
                    }}
                />
            </div>
            <MenuSection>
                {matching.map((p, i) => (
                    <MenuItem
                        key={p.id}
                        active={i === highlight}
                        onMouseEnter={() => setHighlight(i)}
                        icon={<PropertyIcon type={p.type} className="text-(--pk-text-secondary)" />}
                        label={p.name}
                        onClick={() => onPick(p)}
                    />
                ))}
                {matching.length === 0 && <div className="px-2 py-1 text-sm text-(--pk-text-tertiary)">No results</div>}
            </MenuSection>
            {footer && (
                <>
                    <MenuSeparator />
                    <MenuSection>{footer}</MenuSection>
                </>
            )}
        </div>
    )
}

function Choice<T extends string>({
    value,
    options,
    onChange,
    render,
    className,
    buttonLabel,
}: {
    value: T
    options: T[]
    onChange: (value: T) => void
    render: (value: T) => ReactNode
    className?: string
    buttonLabel?: ReactNode
}) {
    const [open, setOpen] = useState(false)
    return (
        <Popover
            open={open}
            onOpenChange={setOpen}
            className="min-w-[180px]"
            trigger={<DropdownButton className={className}>{buttonLabel ?? render(value)}</DropdownButton>}
        >
            <MenuSection>
                {options.map((option) => (
                    <MenuItem
                        key={option}
                        label={render(option)}
                        right={option === value ? <Check className="size-4 text-(--pk-text)" /> : null}
                        onClick={() => {
                            onChange(option)
                            setOpen(false)
                        }}
                    />
                ))}
            </MenuSection>
        </Popover>
    )
}

function PropertyChoice({
    properties,
    value,
    onChange,
    className,
}: {
    properties: Property[]
    value: string
    onChange: (property: Property) => void
    className?: string
}) {
    const [open, setOpen] = useState(false)
    const current = properties.find((p) => p.id === value)
    return (
        <Popover
            open={open}
            onOpenChange={setOpen}
            trigger={
                <DropdownButton className={cn("border border-(--pk-divider)", className)}>
                    {current && <PropertyIcon type={current.type} className="text-(--pk-text-secondary)" />}
                    <span className="truncate">{current?.name ?? "Property"}</span>
                </DropdownButton>
            }
        >
            <PropertyPicker
                properties={properties}
                placeholder="Search for a property..."
                onPick={(p) => {
                    onChange(p)
                    setOpen(false)
                }}
            />
        </Popover>
    )
}

function FilterValueEditor({
    property,
    filter,
    onChange,
}: {
    property: Property
    filter: Filter
    onChange: (value: CellValue) => void
}) {
    if (!operatorNeedsValue(filter.operator)) return null

    switch (property.type) {
        case "title":
        case "text":
        case "number":
            return (
                <div className="p-2 pt-0">
                    <Input
                        data-autofocus
                        size="sm"
                        type={property.type === "number" ? "number" : "text"}
                        value={filter.value === null ? "" : String(filter.value)}
                        onChange={(e) => {
                            const raw = e.target.value
                            if (property.type === "number") onChange(raw === "" ? null : Number(raw))
                            else onChange(raw)
                        }}
                        placeholder="Type a value…"
                    />
                </div>
            )
        case "select":
        case "status":
        case "multiSelect":
            return (
                <div className="border-t border-(--pk-divider)">
                    <OptionPicker
                        property={property}
                        selected={(filter.value as string[]) ?? []}
                        multi
                        allowCreate={false}
                        showCheckboxes
                        onChange={(ids) => onChange(ids)}
                    />
                </div>
            )
        case "date":
            return (
                <div className="border-t border-(--pk-divider)">
                    <DatePicker value={(filter.value as string) ?? null} onChange={onChange} showClear={false} />
                </div>
            )
        case "checkbox":
            return (
                <MenuSection className="border-t border-(--pk-divider)">
                    {[true, false].map((checked) => (
                        <MenuItem
                            key={String(checked)}
                            label={checked ? "Checked" : "Unchecked"}
                            right={filter.value === checked ? <Check className="size-4 text-(--pk-text)" /> : null}
                            onClick={() => onChange(checked)}
                        />
                    ))}
                </MenuSection>
            )
    }
}

function InlineFilterValue({
    property,
    filter,
    onChange,
}: {
    property: Property
    filter: Filter
    onChange: (value: CellValue) => void
}) {
    const [open, setOpen] = useState(false)
    if (!operatorNeedsValue(filter.operator)) return <div className="flex-1" />

    if (property.type === "title" || property.type === "text" || property.type === "number") {
        return (
            <Input
                size="sm"
                type={property.type === "number" ? "number" : "text"}
                value={filter.value === null ? "" : String(filter.value)}
                onChange={(e) => {
                    const raw = e.target.value
                    if (property.type === "number") onChange(raw === "" ? null : Number(raw))
                    else onChange(raw)
                }}
                placeholder="Value"
                className="flex-1"
            />
        )
    }

    if (property.type === "checkbox") {
        return (
            <Choice
                value={filter.value ? "checked" : "unchecked"}
                options={["checked", "unchecked"]}
                onChange={(v) => onChange(v === "checked")}
                render={(v) => (v === "checked" ? "Checked" : "Unchecked")}
                className="flex-1 justify-between border border-(--pk-divider)"
            />
        )
    }

    let summary: ReactNode = <span className="text-(--pk-text-tertiary)">Select…</span>
    if (property.type === "date" && filter.value) summary = formatDate(filter.value as string)
    if (Array.isArray(filter.value) && filter.value.length) {
        summary = (
            <span className="flex min-w-0 gap-1 overflow-hidden">
                {filter.value.map((id) => {
                    const option = property.options?.find((o) => o.id === id)
                    return option ? <OptionChip key={id} option={option} isStatus={property.type === "status"} /> : null
                })}
            </span>
        )
    }

    return (
        <Popover
            open={open}
            onOpenChange={setOpen}
            className={property.type === "date" ? "" : "w-[260px]"}
            trigger={
                <DropdownButton className="min-w-0 flex-1 justify-between border border-(--pk-divider)">
                    <span className="flex min-w-0 flex-1 truncate">{summary}</span>
                </DropdownButton>
            }
        >
            {property.type === "date" ? (
                <DatePicker
                    value={(filter.value as string) ?? null}
                    onChange={(v) => {
                        onChange(v)
                        setOpen(false)
                    }}
                    showClear={false}
                />
            ) : (
                <OptionPicker
                    property={property}
                    selected={(filter.value as string[]) ?? []}
                    multi
                    allowCreate={false}
                    showCheckboxes
                    onChange={(ids) => onChange(ids)}
                />
            )}
        </Popover>
    )
}

function filterSummary(filter: Filter, property: Property): string | null {
    const op = filter.operator
    if (!operatorNeedsValue(op)) return OPERATOR_LABELS[op]
    if (property.type === "checkbox") {
        const checked = op === "isNot" ? !filter.value : !!filter.value
        return checked ? "Checked" : "Unchecked"
    }
    if (isEmptyValue(filter.value)) return null

    const prefix = op === DEFAULT_OPERATOR[property.type] ? "" : OPERATOR_LABELS[op] + " "
    let text: string
    if (Array.isArray(filter.value)) {
        text = filter.value
            .map((id) => property.options?.find((o) => o.id === id)?.name)
            .filter(Boolean)
            .join(", ")
    } else if (property.type === "date") {
        text = formatDate(filter.value as string)
    } else {
        text = String(filter.value)
    }
    return property.type === "number" ? `${OPERATOR_LABELS[op]} ${text}` : prefix + text
}

function FilterChip({
    filter,
    property,
    open,
    onOpenChange,
    update,
}: {
    filter: Filter
    property: Property
    open: boolean
    onOpenChange: (open: boolean) => void
    update: Update
}) {
    const [menuOpen, setMenuOpen] = useState(false)
    const summary = filterSummary(filter, property)

    const setFilter = (patch: Partial<Filter>) =>
        update((d) => ({ ...d, filters: d.filters.map((f) => (f.id === filter.id ? { ...f, ...patch } : f)) }))

    const remove = () => {
        onOpenChange(false)
        update((d) => ({ ...d, filters: d.filters.filter((f) => f.id !== filter.id) }))
    }

    const moveToAdvanced = () => {
        onOpenChange(false)
        update((d) => ({
            ...d,
            filters: d.filters.filter((f) => f.id !== filter.id),
            advancedFilter: {
                conjunction: d.advancedFilter?.conjunction ?? "and",
                rules: [...(d.advancedFilter?.rules ?? []), filter],
            },
        }))
    }

    return (
        <Popover
            open={open}
            onOpenChange={onOpenChange}
            className="w-[290px]"
            trigger={
                <Pill active={summary !== null}>
                    <PropertyIcon type={property.type} className="size-3.5" />
                    <span className="truncate">
                        <span className="font-medium">{property.name}</span>
                        {summary && <span>: {summary}</span>}
                    </span>
                </Pill>
            }
        >
            <div className="flex items-center gap-0.5 px-2 pt-1.5 pb-1 text-xs text-(--pk-text-secondary)">
                <span className="truncate px-0.5">{property.name}</span>
                <Choice
                    value={filter.operator}
                    options={OPERATORS_BY_TYPE[property.type]}
                    onChange={(operator) => setFilter({ operator })}
                    render={(op) => OPERATOR_LABELS[op].toLowerCase()}
                    className="h-6 px-1 text-xs text-(--pk-text-secondary)"
                />
                <div className="flex-1" />
                <Popover
                    open={menuOpen}
                    onOpenChange={setMenuOpen}
                    align="end"
                    className="w-[220px]"
                    trigger={
                        <button
                            type="button"
                            className="flex size-6 cursor-pointer items-center justify-center rounded-md hover:bg-(--pk-hover)"
                        >
                            <Ellipsis className="size-4" />
                        </button>
                    }
                >
                    <MenuSection>
                        <MenuItem
                            danger
                            icon={<Trash2 className="size-4" strokeWidth={1.75} />}
                            label="Delete filter"
                            onClick={remove}
                        />
                        <MenuItem
                            icon={<ListFilter className="size-4" strokeWidth={1.75} />}
                            label="Add to advanced filter"
                            onClick={moveToAdvanced}
                        />
                    </MenuSection>
                </Popover>
            </div>
            <FilterValueEditor property={property} filter={filter} onChange={(value) => setFilter({ value })} />
        </Popover>
    )
}

function AdvancedFilterChip({
    data,
    open,
    onOpenChange,
    update,
}: {
    data: DatabaseData
    open: boolean
    onOpenChange: (open: boolean) => void
    update: Update
}) {
    const [addOpen, setAddOpen] = useState(false)
    const adv = data.advancedFilter!
    const count = adv.rules.length

    const setAdv = (fn: (a: NonNullable<DatabaseData["advancedFilter"]>) => DatabaseData["advancedFilter"]) =>
        update((d) => ({ ...d, advancedFilter: d.advancedFilter ? fn(d.advancedFilter) : null }))

    const setRule = (id: string, patch: Partial<Filter>) =>
        setAdv((a) => ({ ...a, rules: a.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) }))

    return (
        <Popover
            open={open}
            onOpenChange={onOpenChange}
            className="w-[600px] max-w-[calc(100vw-32px)]"
            trigger={
                <Pill active>
                    <ListFilter className="size-3.5" />
                    <span>
                        {count} {count === 1 ? "rule" : "rules"}
                    </span>
                </Pill>
            }
        >
            <div className="flex flex-col gap-1 p-2">
                {adv.rules.map((rule, index) => {
                    const property = data.properties.find((p) => p.id === rule.propertyId)
                    if (!property) return null
                    return (
                        <div key={rule.id} className="flex items-center gap-1.5">
                            <div className="w-[68px] shrink-0 text-sm">
                                {index === 0 ? (
                                    <span className="px-2">Where</span>
                                ) : index === 1 ? (
                                    <Choice
                                        value={adv.conjunction}
                                        options={["and", "or"]}
                                        onChange={(conjunction) => setAdv((a) => ({ ...a, conjunction }))}
                                        render={(c) => (c === "and" ? "And" : "Or")}
                                        className="w-full justify-between border border-(--pk-divider)"
                                    />
                                ) : (
                                    <span className="px-2 text-(--pk-text-secondary)">
                                        {adv.conjunction === "and" ? "And" : "Or"}
                                    </span>
                                )}
                            </div>
                            <PropertyChoice
                                properties={data.properties}
                                value={rule.propertyId}
                                onChange={(p) => setRule(rule.id, { ...newFilter(p), id: rule.id })}
                                className="w-[130px] justify-between"
                            />
                            <Choice
                                value={rule.operator}
                                options={OPERATORS_BY_TYPE[property.type]}
                                onChange={(operator) => setRule(rule.id, { operator })}
                                render={(op) => OPERATOR_LABELS[op]}
                                className="w-[130px] justify-between border border-(--pk-divider)"
                            />
                            <InlineFilterValue
                                property={property}
                                filter={rule}
                                onChange={(value) => setRule(rule.id, { value })}
                            />
                            <button
                                type="button"
                                onClick={() => setAdv((a) => ({ ...a, rules: a.rules.filter((r) => r.id !== rule.id) }))}
                                className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-(--pk-text-secondary) hover:bg-(--pk-hover)"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                    )
                })}
                {count === 0 && <div className="px-2 py-1 text-sm text-(--pk-text-tertiary)">No filter rules applied to this view</div>}
            </div>
            <MenuSeparator />
            <MenuSection>
                <Popover
                    open={addOpen}
                    onOpenChange={setAddOpen}
                    trigger={
                        <button
                            type="button"
                            className="flex h-7 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-(--pk-text-secondary) hover:bg-(--pk-hover)"
                        >
                            <Plus className="size-4" /> Add filter rule
                        </button>
                    }
                >
                    <PropertyPicker
                        properties={data.properties}
                        placeholder="Filter by..."
                        onPick={(p) => {
                            setAdv((a) => ({ ...a, rules: [...a.rules, newFilter(p)] }))
                            setAddOpen(false)
                        }}
                    />
                </Popover>
                <MenuItem
                    danger
                    icon={<Trash2 className="size-4 text-(--pk-text-secondary)" strokeWidth={1.75} />}
                    label={<span className="text-(--pk-text-secondary)">Delete filter</span>}
                    onClick={() => {
                        onOpenChange(false)
                        update((d) => ({ ...d, advancedFilter: null }))
                    }}
                />
            </MenuSection>
        </Popover>
    )
}

function SortChip({
    data,
    open,
    onOpenChange,
    update,
}: {
    data: DatabaseData
    open: boolean
    onOpenChange: (open: boolean) => void
    update: Update
}) {
    const [addOpen, setAddOpen] = useState(false)
    const [dragId, setDragId] = useState<string | null>(null)
    const [overId, setOverId] = useState<string | null>(null)
    const { sorts, properties } = data
    const first = sorts[0]
    const firstProperty = properties.find((p) => p.id === first?.propertyId)

    const setSort = (id: string, patch: Partial<Sort>) =>
        update((d) => ({ ...d, sorts: d.sorts.map((s) => (s.id === id ? { ...s, ...patch } : s)) }))

    const drop = (targetId: string) => {
        if (!dragId || dragId === targetId) return
        update((d) => {
            const next = [...d.sorts]
            const from = next.findIndex((s) => s.id === dragId)
            const to = next.findIndex((s) => s.id === targetId)
            const [moved] = next.splice(from, 1)
            next.splice(to, 0, moved)
            return { ...d, sorts: next }
        })
    }

    const unused = properties.filter((p) => !sorts.some((s) => s.propertyId === p.id))
    const DirectionIcon = first?.direction === "descending" ? ArrowDown : ArrowUp

    return (
        <Popover
            open={open}
            onOpenChange={onOpenChange}
            className="w-[400px] max-w-[calc(100vw-32px)]"
            trigger={
                <Pill active>
                    {sorts.length === 1 ? <DirectionIcon className="size-3.5" /> : <ArrowUpDown className="size-3.5" />}
                    <span className="truncate font-medium">
                        {sorts.length === 1 ? firstProperty?.name : `${sorts.length} sorts`}
                    </span>
                </Pill>
            }
        >
            <div className="flex flex-col gap-1 p-2">
                {sorts.map((sort) => (
                    <div
                        key={sort.id}
                        onDragOver={(e) => {
                            e.preventDefault()
                            setOverId(sort.id)
                        }}
                        onDrop={() => drop(sort.id)}
                        className={cn(
                            "flex items-center gap-1.5 rounded-md",
                            overId === sort.id && dragId !== sort.id && "shadow-[0_-2px_0_0_var(--pk-blue)]",
                        )}
                    >
                        <span
                            draggable
                            onDragStart={() => setDragId(sort.id)}
                            onDragEnd={() => {
                                setDragId(null)
                                setOverId(null)
                            }}
                            className="flex h-7 w-4 shrink-0 cursor-grab items-center justify-center text-(--pk-text-tertiary)"
                        >
                            <GripVertical className="size-4" strokeWidth={1.75} />
                        </span>
                        <PropertyChoice
                            properties={properties.filter(
                                (p) => p.id === sort.propertyId || !sorts.some((s) => s.propertyId === p.id),
                            )}
                            value={sort.propertyId}
                            onChange={(p) => setSort(sort.id, { propertyId: p.id })}
                            className="min-w-0 flex-1 justify-between"
                        />
                        <Choice<SortDirection>
                            value={sort.direction}
                            options={["ascending", "descending"]}
                            onChange={(direction) => setSort(sort.id, { direction })}
                            render={(dir) => (dir === "ascending" ? "Ascending" : "Descending")}
                            className="w-[124px] justify-between border border-(--pk-divider)"
                        />
                        <button
                            type="button"
                            onClick={() => update((d) => ({ ...d, sorts: d.sorts.filter((s) => s.id !== sort.id) }))}
                            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-(--pk-text-secondary) hover:bg-(--pk-hover)"
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                ))}
            </div>
            <MenuSeparator />
            <MenuSection>
                {unused.length > 0 && (
                    <Popover
                        open={addOpen}
                        onOpenChange={setAddOpen}
                        trigger={
                            <button
                                type="button"
                                className="flex h-7 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-(--pk-text-secondary) hover:bg-(--pk-hover)"
                            >
                                <Plus className="size-4" /> Add sort
                            </button>
                        }
                    >
                        <PropertyPicker
                            properties={unused}
                            placeholder="Sort by..."
                            onPick={(p) => {
                                update((d) => ({
                                    ...d,
                                    sorts: [...d.sorts, { id: nanoid(), propertyId: p.id, direction: "ascending" }],
                                }))
                                setAddOpen(false)
                            }}
                        />
                    </Popover>
                )}
                <MenuItem
                    danger
                    icon={<Trash2 className="size-4 text-(--pk-text-secondary)" strokeWidth={1.75} />}
                    label={<span className="text-(--pk-text-secondary)">Delete sort</span>}
                    onClick={() => {
                        onOpenChange(false)
                        update((d) => ({ ...d, sorts: [] }))
                    }}
                />
            </MenuSection>
        </Popover>
    )
}

export type ControlsState = {
    barVisible: boolean
    openFilterId: string | null
    sortOpen: boolean
    advancedOpen: boolean
}

export function DatabaseToolbar({
    data,
    update,
    state,
    setState,
    search,
    onSearchChange,
    onNewRow,
}: {
    data: DatabaseData
    update: Update
    state: ControlsState
    setState: (patch: Partial<ControlsState>) => void
    search: string
    onSearchChange: (value: string) => void
    onNewRow: () => void
}) {
    const [filterPickerOpen, setFilterPickerOpen] = useState(false)
    const [sortPickerOpen, setSortPickerOpen] = useState(false)
    const [searchOpen, setSearchOpen] = useState(false)
    const searchRef = useRef<HTMLInputElement>(null)
    const filterBtnRef = useRef<HTMLButtonElement>(null)
    const sortBtnRef = useRef<HTMLButtonElement>(null)

    const hasFilters = data.filters.length > 0 || !!data.advancedFilter
    const hasSorts = data.sorts.length > 0

    const addFilter = (property: Property) => {
        const filter = newFilter(property)
        update((d) => ({ ...d, filters: [...d.filters, filter] }))
        setFilterPickerOpen(false)
        setState({ barVisible: true, openFilterId: filter.id })
    }

    const addAdvanced = () => {
        const first = data.properties[0]
        update((d) => ({ ...d, advancedFilter: { conjunction: "and", rules: first ? [newFilter(first)] : [] } }))
        setFilterPickerOpen(false)
        setState({ barVisible: true, advancedOpen: true })
    }

    const addSort = (property: Property) => {
        update((d) => ({ ...d, sorts: [...d.sorts, { id: nanoid(), propertyId: property.id, direction: "ascending" }] }))
        setSortPickerOpen(false)
        setState({ barVisible: true, sortOpen: true })
    }

    const iconButton =
        "flex h-7 cursor-pointer items-center justify-center gap-1 rounded-md px-1.5 text-sm hover:bg-(--pk-hover)"

    return (
        <div className="flex h-10 items-center gap-1 border-b border-(--pk-divider)">
            <div className="flex h-full items-center">
                <div className="relative flex h-full items-center">
                    <button
                        type="button"
                        className="flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-sm font-medium hover:bg-(--pk-hover)"
                    >
                        <Table2 className="size-4" strokeWidth={1.75} />
                        Table
                    </button>
                    <div className="absolute inset-x-1 bottom-0 h-0.5 bg-(--pk-text)" />
                </div>
            </div>
            <div className="flex-1" />

            <button
                ref={filterBtnRef}
                type="button"
                aria-label="Filter"
                onClick={() => (hasFilters ? setState({ barVisible: !state.barVisible }) : setFilterPickerOpen(true))}
                className={cn(iconButton, hasFilters ? "text-(--pk-blue)" : "text-(--pk-text-secondary)")}
            >
                <ListFilter className="size-4" strokeWidth={1.75} />
            </button>
            <Popover open={filterPickerOpen} onOpenChange={setFilterPickerOpen} anchor={filterBtnRef} align="end">
                <PropertyPicker
                    properties={data.properties}
                    placeholder="Filter by..."
                    onPick={addFilter}
                    footer={
                        <MenuItem
                            icon={<Plus className="size-4 text-(--pk-text-secondary)" />}
                            label={<span className="text-(--pk-text-secondary)">Add advanced filter</span>}
                            onClick={addAdvanced}
                        />
                    }
                />
            </Popover>

            <button
                ref={sortBtnRef}
                type="button"
                aria-label="Sort"
                onClick={() => (hasSorts ? setState({ barVisible: !state.barVisible }) : setSortPickerOpen(true))}
                className={cn(iconButton, hasSorts ? "text-(--pk-blue)" : "text-(--pk-text-secondary)")}
            >
                <ArrowUpDown className="size-4" strokeWidth={1.75} />
            </button>
            <Popover open={sortPickerOpen} onOpenChange={setSortPickerOpen} anchor={sortBtnRef} align="end">
                <PropertyPicker properties={data.properties} placeholder="Sort by..." onPick={addSort} />
            </Popover>

            <div className="flex items-center">
                <button
                    type="button"
                    aria-label="Search"
                    onClick={() => {
                        setSearchOpen(true)
                        setTimeout(() => searchRef.current?.focus(), 0)
                    }}
                    className={cn(iconButton, search ? "text-(--pk-blue)" : "text-(--pk-text-secondary)")}
                >
                    <Search className="size-4" strokeWidth={1.75} />
                </button>
                <div
                    className={cn(
                        "flex items-center overflow-hidden transition-[width] duration-200",
                        searchOpen || search ? "w-[150px]" : "w-0",
                    )}
                >
                    <input
                        ref={searchRef}
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        onBlur={() => !search && setSearchOpen(false)}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") {
                                onSearchChange("")
                                setSearchOpen(false)
                                e.currentTarget.blur()
                            }
                        }}
                        placeholder="Type to search..."
                        className="h-7 w-full bg-transparent text-sm outline-none placeholder:text-(--pk-text-tertiary)"
                    />
                    {search && (
                        <button
                            type="button"
                            onClick={() => onSearchChange("")}
                            className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full bg-(--pk-text-tertiary) text-(--pk-bg)"
                        >
                            <X className="size-3" strokeWidth={3} />
                        </button>
                    )}
                </div>
            </div>

            <SplitButton className="ml-1" onClick={onNewRow} onMenuClick={onNewRow}>
                New
            </SplitButton>
        </div>
    )
}

export function FilterSortBar({
    data,
    update,
    state,
    setState,
}: {
    data: DatabaseData
    update: Update
    state: ControlsState
    setState: (patch: Partial<ControlsState>) => void
}) {
    const [addOpen, setAddOpen] = useState(false)
    const hasAny = data.filters.length > 0 || !!data.advancedFilter || data.sorts.length > 0
    if (!hasAny || !state.barVisible) return null

    return (
        <div className="flex min-h-10 flex-wrap items-center gap-1.5 border-b border-(--pk-divider) py-1.5">
            {data.sorts.length > 0 && (
                <>
                    <SortChip
                        data={data}
                        update={update}
                        open={state.sortOpen}
                        onOpenChange={(sortOpen) => setState({ sortOpen })}
                    />
                    {(data.filters.length > 0 || data.advancedFilter) && (
                        <div className="mx-0.5 h-6 w-px bg-(--pk-divider)" />
                    )}
                </>
            )}
            {data.advancedFilter && (
                <AdvancedFilterChip
                    data={data}
                    update={update}
                    open={state.advancedOpen}
                    onOpenChange={(advancedOpen) => setState({ advancedOpen })}
                />
            )}
            {data.filters.map((filter) => {
                const property = data.properties.find((p) => p.id === filter.propertyId)
                if (!property) return null
                return (
                    <FilterChip
                        key={filter.id}
                        filter={filter}
                        property={property}
                        update={update}
                        open={state.openFilterId === filter.id}
                        onOpenChange={(open) => setState({ openFilterId: open ? filter.id : null })}
                    />
                )
            })}
            <Popover
                open={addOpen}
                onOpenChange={setAddOpen}
                trigger={
                    <button
                        type="button"
                        className="flex h-6 cursor-pointer items-center gap-1 rounded-md px-1.5 text-sm text-(--pk-text-secondary) hover:bg-(--pk-hover)"
                    >
                        <Plus className="size-3.5" /> Filter
                    </button>
                }
            >
                <PropertyPicker
                    properties={data.properties}
                    placeholder="Filter by..."
                    onPick={(p) => {
                        const filter = newFilter(p)
                        update((d) => ({ ...d, filters: [...d.filters, filter] }))
                        setAddOpen(false)
                        setState({ openFilterId: filter.id })
                    }}
                    footer={
                        !data.advancedFilter && (
                            <MenuItem
                                icon={<Plus className="size-4 text-(--pk-text-secondary)" />}
                                label={<span className="text-(--pk-text-secondary)">Add advanced filter</span>}
                                onClick={() => {
                                    const first = data.properties[0]
                                    update((d) => ({
                                        ...d,
                                        advancedFilter: { conjunction: "and", rules: first ? [newFilter(first)] : [] },
                                    }))
                                    setAddOpen(false)
                                    setState({ advancedOpen: true })
                                }}
                            />
                        )
                    }
                />
            </Popover>
        </div>
    )
}
