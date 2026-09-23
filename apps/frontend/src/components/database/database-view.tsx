import { useRef, useState } from "react"
import { nanoid } from "nanoid"
import { cn } from "cn"
import {
    ArrowDown,
    ArrowLeftToLine,
    ArrowRightToLine,
    ArrowUp,
    ChevronRight,
    Copy,
    GripVertical,
    ListFilter,
    Plus,
    Trash2,
} from "lucide-react"
import {
    PROPERTY_TYPE_LABELS,
    applyFilters,
    applySorts,
    convertValue,
    createProperty,
    emptyValue,
    formatDate,
    newFilter,
    optionsFromValues,
    searchRows,
    type CellValue,
    type DatabaseData,
    type Property,
    type PropertyType,
    type Row,
    type SelectOption,
} from "./model"
import { DatePicker, OptionPicker } from "./editors"
import { DatabaseToolbar, FilterSortBar, type ControlsState } from "./controls"
import {
    MenuItem,
    MenuSection,
    MenuSeparator,
    Popover,
    Checkbox,
    OptionChip,
    PropertyIcon,
} from "@/components/pereskia"

type Update = (fn: (data: DatabaseData) => DatabaseData) => void
type CellRef = { rowId: string; propertyId: string }

const ADD_COLUMN_WIDTH = 36
const MIN_COLUMN_WIDTH = 60
const PROPERTY_TYPES: PropertyType[] = ["text", "number", "select", "multiSelect", "status", "date", "checkbox"]

export function DatabaseView({
    data,
    onChange,
    variant = "inline",
}: {
    data: DatabaseData
    onChange: Update
    variant?: "inline" | "page"
}) {
    const [controls, setControlsState] = useState<ControlsState>({
        barVisible: true,
        openFilterId: null,
        sortOpen: false,
        advancedOpen: false,
    })
    const setControls = (patch: Partial<ControlsState>) => setControlsState((s) => ({ ...s, ...patch }))
    const [search, setSearch] = useState("")
    const [editing, setEditing] = useState<CellRef | null>(null)
    const [openHeaderId, setOpenHeaderId] = useState<string | null>(null)

    const visibleRows = applySorts(data, searchRows(data, applyFilters(data, data.rows), search))
    const tableWidth = data.properties.reduce((sum, p) => sum + p.width, 0) + ADD_COLUMN_WIDTH
    const titleProperty = data.properties.find((p) => p.type === "title")

    const addRow = (index?: number) => {
        const cells: Record<string, CellValue> = {}
        for (const f of data.filters) {
            const p = data.properties.find((x) => x.id === f.propertyId)
            if (!p || f.value === null) continue
            const values = Array.isArray(f.value) ? f.value : []
            if ((p.type === "select" || p.type === "status") && f.operator === "is" && values.length === 1) {
                cells[p.id] = values[0]
            } else if (p.type === "multiSelect" && f.operator === "contains" && values.length) {
                cells[p.id] = [values[0]]
            } else if (p.type === "checkbox" && f.operator === "is") {
                cells[p.id] = f.value
            } else if ((p.type === "text" || p.type === "title") && (f.operator === "is" || f.operator === "contains")) {
                cells[p.id] = f.value
            }
        }
        const row: Row = { id: nanoid(), cells }
        onChange((d) => {
            const rows = [...d.rows]
            rows.splice(index ?? rows.length, 0, row)
            return { ...d, rows }
        })
        if (titleProperty) setEditing({ rowId: row.id, propertyId: titleProperty.id })
    }

    const setCell = (rowId: string, propertyId: string, value: CellValue) =>
        onChange((d) => ({
            ...d,
            rows: d.rows.map((r) => (r.id === rowId ? { ...r, cells: { ...r.cells, [propertyId]: value } } : r)),
        }))

    const setOptions = (propertyId: string, options: SelectOption[]) =>
        onChange((d) => ({
            ...d,
            properties: d.properties.map((p) => (p.id === propertyId ? { ...p, options } : p)),
        }))

    return (
        <div className={cn("pk-root", variant === "inline" && "my-2")}>
            <input
                value={data.title}
                onChange={(e) => onChange((d) => ({ ...d, title: e.target.value }))}
                placeholder={variant === "page" ? "Untitled" : "New database"}
                className={cn(
                    "w-full bg-transparent font-bold outline-none placeholder:text-(--pk-text-tertiary)",
                    variant === "page" ? "mb-4 h-12 text-[40px] leading-tight" : "mb-1 h-9 text-xl",
                )}
            />
            <DatabaseToolbar
                data={data}
                update={onChange}
                state={controls}
                setState={setControls}
                search={search}
                onSearchChange={setSearch}
                onNewRow={() => addRow()}
            />
            <FilterSortBar data={data} update={onChange} state={controls} setState={setControls} />

            <div className="pk-scroller -ml-14 overflow-x-auto pb-3 pl-14">
                <table className="table-fixed border-collapse" style={{ width: tableWidth }}>
                    <colgroup>
                        {data.properties.map((p) => (
                            <col key={p.id} style={{ width: p.width }} />
                        ))}
                        <col style={{ width: ADD_COLUMN_WIDTH }} />
                    </colgroup>
                    <thead>
                        <tr className="h-[33px] border-b border-(--pk-border)">
                            {data.properties.map((property, index) => (
                                <HeaderCell
                                    key={property.id}
                                    property={property}
                                    index={index}
                                    update={onChange}
                                    open={openHeaderId === property.id}
                                    onOpenChange={(open) => setOpenHeaderId(open ? property.id : null)}
                                    onFilter={() => {
                                        const filter = newFilter(property)
                                        onChange((d) => ({ ...d, filters: [...d.filters, filter] }))
                                        setOpenHeaderId(null)
                                        setControls({ barVisible: true, openFilterId: filter.id })
                                    }}
                                    onInsert={(side) => {
                                        const created = createProperty("text")
                                        onChange((d) => {
                                            const properties = [...d.properties]
                                            const at = properties.findIndex((p) => p.id === property.id)
                                            properties.splice(side === "left" ? at : at + 1, 0, created)
                                            return { ...d, properties }
                                        })
                                        setOpenHeaderId(created.id)
                                    }}
                                />
                            ))}
                            <AddPropertyCell
                                onAdd={(type) => {
                                    const created = createProperty(type)
                                    onChange((d) => ({ ...d, properties: [...d.properties, created] }))
                                    setOpenHeaderId(created.id)
                                }}
                            />
                        </tr>
                    </thead>
                    <tbody>
                        {visibleRows.map((row) => (
                            <BodyRow
                                key={row.id}
                                row={row}
                                data={data}
                                update={onChange}
                                editing={editing?.rowId === row.id ? editing.propertyId : null}
                                onEdit={(propertyId) => setEditing(propertyId ? { rowId: row.id, propertyId } : null)}
                                onSetCell={(propertyId, value) => setCell(row.id, propertyId, value)}
                                onSetOptions={setOptions}
                                onInsertBelow={() => addRow(data.rows.findIndex((r) => r.id === row.id) + 1)}
                            />
                        ))}
                    </tbody>
                </table>
                <button
                    type="button"
                    onClick={() => addRow()}
                    style={{ width: tableWidth }}
                    className="flex h-[33px] cursor-pointer items-center gap-1.5 border-b border-(--pk-border) pl-2 text-sm text-(--pk-text-tertiary) select-none hover:bg-(--pk-hover)"
                >
                    <Plus className="size-4" strokeWidth={1.75} />
                    New page
                </button>
                {visibleRows.length === 0 && data.rows.length > 0 && (
                    <div className="py-2 pl-2 text-sm text-(--pk-text-tertiary)">No results</div>
                )}
            </div>
        </div>
    )
}

function HeaderCell({
    property,
    index,
    update,
    open,
    onOpenChange,
    onFilter,
    onInsert,
}: {
    property: Property
    index: number
    update: Update
    open: boolean
    onOpenChange: (open: boolean) => void
    onFilter: () => void
    onInsert: (side: "left" | "right") => void
}) {
    const thRef = useRef<HTMLTableCellElement>(null)
    const [typeOpen, setTypeOpen] = useState(false)
    const [resizing, setResizing] = useState(false)
    const [dragOver, setDragOver] = useState<"left" | "right" | null>(null)
    const typeRowRef = useRef<HTMLDivElement>(null)

    const setProperty = (patch: Partial<Property>) =>
        update((d) => ({ ...d, properties: d.properties.map((p) => (p.id === property.id ? { ...p, ...patch } : p)) }))

    const sortBy = (direction: "ascending" | "descending") => {
        update((d) => ({
            ...d,
            sorts: [...d.sorts.filter((s) => s.propertyId !== property.id), { id: nanoid(), propertyId: property.id, direction }],
        }))
        onOpenChange(false)
    }

    const changeType = (type: PropertyType) => {
        if (type === property.type) return setTypeOpen(false)
        update((d) => {
            const next: Property = {
                ...property,
                type,
                options:
                    type === "select" || type === "multiSelect" || type === "status"
                        ? optionsFromValues(d.rows, property, type)
                        : undefined,
            }
            return {
                ...d,
                properties: d.properties.map((p) => (p.id === property.id ? next : p)),
                rows: d.rows.map((r) => ({
                    ...r,
                    cells: { ...r.cells, [property.id]: convertValue(r.cells[property.id] ?? null, property, next) },
                })),
                filters: d.filters.filter((f) => f.propertyId !== property.id),
                advancedFilter: d.advancedFilter && {
                    ...d.advancedFilter,
                    rules: d.advancedFilter.rules.filter((f) => f.propertyId !== property.id),
                },
            }
        })
        setTypeOpen(false)
    }

    const duplicate = () => {
        const copy: Property = { ...property, id: nanoid(), name: `${property.name} (1)`, type: property.type === "title" ? "text" : property.type }
        update((d) => {
            const properties = [...d.properties]
            properties.splice(index + 1, 0, copy)
            const rows = d.rows.map((r) => ({
                ...r,
                cells: { ...r.cells, [copy.id]: convertValue(r.cells[property.id] ?? null, property, copy) },
            }))
            return { ...d, properties, rows }
        })
        onOpenChange(false)
    }

    const remove = () => {
        onOpenChange(false)
        update((d) => ({
            ...d,
            properties: d.properties.filter((p) => p.id !== property.id),
            filters: d.filters.filter((f) => f.propertyId !== property.id),
            sorts: d.sorts.filter((s) => s.propertyId !== property.id),
            advancedFilter: d.advancedFilter && {
                ...d.advancedFilter,
                rules: d.advancedFilter.rules.filter((f) => f.propertyId !== property.id),
            },
        }))
    }

    const startResize = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const startX = e.clientX
        const startWidth = property.width
        setResizing(true)
        const move = (ev: MouseEvent) =>
            setProperty({ width: Math.max(MIN_COLUMN_WIDTH, startWidth + ev.clientX - startX) })
        const up = () => {
            setResizing(false)
            window.removeEventListener("mousemove", move)
            window.removeEventListener("mouseup", up)
        }
        window.addEventListener("mousemove", move)
        window.addEventListener("mouseup", up)
    }

    return (
        <th
            ref={thRef}
            draggable={!resizing}
            onDragStart={(e) => {
                e.stopPropagation()
                e.dataTransfer.setData("application/x-pereskia-column", property.id)
                e.dataTransfer.effectAllowed = "move"
            }}
            onDragOver={(e) => {
                if (!e.dataTransfer.types.includes("application/x-pereskia-column")) return
                e.preventDefault()
                e.stopPropagation()
                const rect = e.currentTarget.getBoundingClientRect()
                setDragOver(e.clientX < rect.left + rect.width / 2 ? "left" : "right")
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const draggedId = e.dataTransfer.getData("application/x-pereskia-column")
                const side = dragOver
                setDragOver(null)
                if (!draggedId || draggedId === property.id) return
                update((d) => {
                    const properties = [...d.properties]
                    const [moved] = properties.splice(properties.findIndex((p) => p.id === draggedId), 1)
                    const at = properties.findIndex((p) => p.id === property.id)
                    properties.splice(side === "left" ? at : at + 1, 0, moved)
                    return { ...d, properties }
                })
            }}
            className={cn(
                "relative h-[33px] border-r border-(--pk-border) p-0 text-left font-normal",
                dragOver === "left" && "shadow-[inset_3px_0_0_0_var(--pk-blue)]",
                dragOver === "right" && "shadow-[inset_-3px_0_0_0_var(--pk-blue)]",
            )}
        >
            <button
                type="button"
                onClick={() => onOpenChange(!open)}
                className={cn(
                    "flex h-[33px] w-full cursor-pointer items-center gap-1.5 overflow-hidden px-2 text-sm text-(--pk-text-secondary) select-none hover:bg-(--pk-hover)",
                    open && "bg-(--pk-hover)",
                )}
            >
                <PropertyIcon type={property.type} className="text-(--pk-text-tertiary)" />
                <span className="truncate">{property.name}</span>
            </button>
            <div
                onMouseDown={startResize}
                className={cn(
                    "absolute top-0 -right-[3px] z-10 h-full w-[5px] cursor-col-resize",
                    "after:absolute after:inset-y-0 after:left-[1px] after:w-[3px] after:bg-(--pk-blue) after:opacity-0 hover:after:opacity-60",
                    resizing && "after:opacity-100",
                )}
                style={resizing ? { height: "100vh" } : undefined}
            />

            <Popover open={open} onOpenChange={onOpenChange} anchor={thRef} className="w-[240px]">
                <div className="p-2 pb-1">
                    <div className="flex items-center gap-1.5 rounded-md border border-(--pk-input-border) bg-(--pk-input-bg) pl-1.5 focus-within:border-(--pk-blue) focus-within:shadow-(--pk-focus-ring)">
                        <PropertyIcon type={property.type} className="text-(--pk-text-secondary)" />
                        <input
                            data-autofocus
                            value={property.name}
                            onChange={(e) => setProperty({ name: e.target.value })}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => e.key === "Enter" && onOpenChange(false)}
                            className="h-7 min-w-0 flex-1 bg-transparent pr-2 text-sm outline-none"
                        />
                    </div>
                </div>
                {property.type !== "title" && (
                    <MenuSection>
                        <div ref={typeRowRef}>
                            <MenuItem
                                icon={<PropertyIcon type={property.type} />}
                                label="Type"
                                active={typeOpen}
                                right={
                                    <span className="flex items-center gap-0.5 text-sm">
                                        {PROPERTY_TYPE_LABELS[property.type]}
                                        <ChevronRight className="size-4" />
                                    </span>
                                }
                                onClick={() => setTypeOpen(true)}
                            />
                        </div>
                        <Popover open={typeOpen} onOpenChange={setTypeOpen} anchor={typeRowRef} side="right" className="w-[220px]">
                            <MenuSection>
                                {PROPERTY_TYPES.map((type) => (
                                    <MenuItem
                                        key={type}
                                        active={type === property.type}
                                        icon={<PropertyIcon type={type} />}
                                        label={PROPERTY_TYPE_LABELS[type]}
                                        onClick={() => changeType(type)}
                                    />
                                ))}
                            </MenuSection>
                        </Popover>
                    </MenuSection>
                )}
                <MenuSeparator />
                <MenuSection>
                    <MenuItem icon={<ListFilter className="size-4" strokeWidth={1.75} />} label="Filter" onClick={onFilter} />
                    <MenuItem icon={<ArrowUp className="size-4" strokeWidth={1.75} />} label="Sort ascending" onClick={() => sortBy("ascending")} />
                    <MenuItem icon={<ArrowDown className="size-4" strokeWidth={1.75} />} label="Sort descending" onClick={() => sortBy("descending")} />
                </MenuSection>
                <MenuSeparator />
                <MenuSection>
                    <MenuItem icon={<ArrowLeftToLine className="size-4" strokeWidth={1.75} />} label="Insert left" onClick={() => onInsert("left")} />
                    <MenuItem icon={<ArrowRightToLine className="size-4" strokeWidth={1.75} />} label="Insert right" onClick={() => onInsert("right")} />
                    <MenuItem icon={<Copy className="size-4" strokeWidth={1.75} />} label="Duplicate property" onClick={duplicate} />
                    {property.type !== "title" && (
                        <MenuItem danger icon={<Trash2 className="size-4" strokeWidth={1.75} />} label="Delete property" onClick={remove} />
                    )}
                </MenuSection>
            </Popover>
        </th>
    )
}

function AddPropertyCell({ onAdd }: { onAdd: (type: PropertyType) => void }) {
    const [open, setOpen] = useState(false)
    return (
        <th className="h-[33px] p-0 font-normal">
            <Popover
                open={open}
                onOpenChange={setOpen}
                className="w-[240px]"
                trigger={
                    <button
                        type="button"
                        aria-label="Add property"
                        className="flex h-[33px] w-full cursor-pointer items-center justify-center text-(--pk-text-tertiary) hover:bg-(--pk-hover)"
                    >
                        <Plus className="size-4" strokeWidth={1.75} />
                    </button>
                }
            >
                <div className="px-3 pt-2.5 pb-1 text-sm font-semibold">New property</div>
                <MenuSection>
                    <div className="px-2 pt-1 pb-1 text-xs text-(--pk-text-secondary)">Type</div>
                    {PROPERTY_TYPES.map((type) => (
                        <MenuItem
                            key={type}
                            icon={<PropertyIcon type={type} />}
                            label={PROPERTY_TYPE_LABELS[type]}
                            onClick={() => {
                                setOpen(false)
                                onAdd(type)
                            }}
                        />
                    ))}
                </MenuSection>
            </Popover>
        </th>
    )
}

function BodyRow({
    row,
    data,
    update,
    editing,
    onEdit,
    onSetCell,
    onSetOptions,
    onInsertBelow,
}: {
    row: Row
    data: DatabaseData
    update: Update
    editing: string | null
    onEdit: (propertyId: string | null) => void
    onSetCell: (propertyId: string, value: CellValue) => void
    onSetOptions: (propertyId: string, options: SelectOption[]) => void
    onInsertBelow: () => void
}) {
    const [menuOpen, setMenuOpen] = useState(false)
    const [dropSide, setDropSide] = useState<"top" | "bottom" | null>(null)
    const gripRef = useRef<HTMLButtonElement>(null)
    const sorted = data.sorts.length > 0

    const duplicate = () => {
        update((d) => {
            const rows = [...d.rows]
            rows.splice(rows.findIndex((r) => r.id === row.id) + 1, 0, { id: nanoid(), cells: { ...row.cells } })
            return { ...d, rows }
        })
        setMenuOpen(false)
    }

    const remove = () => {
        setMenuOpen(false)
        update((d) => ({ ...d, rows: d.rows.filter((r) => r.id !== row.id) }))
    }

    return (
        <tr
            onDragOver={(e) => {
                if (sorted || !e.dataTransfer.types.includes("application/x-pereskia-row")) return
                e.preventDefault()
                e.stopPropagation()
                const rect = e.currentTarget.getBoundingClientRect()
                setDropSide(e.clientY < rect.top + rect.height / 2 ? "top" : "bottom")
            }}
            onDragLeave={() => setDropSide(null)}
            onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const draggedId = e.dataTransfer.getData("application/x-pereskia-row")
                const side = dropSide
                setDropSide(null)
                if (!draggedId || draggedId === row.id) return
                update((d) => {
                    const rows = [...d.rows]
                    const [moved] = rows.splice(rows.findIndex((r) => r.id === draggedId), 1)
                    const at = rows.findIndex((r) => r.id === row.id)
                    rows.splice(side === "top" ? at : at + 1, 0, moved)
                    return { ...d, rows }
                })
            }}
            className={cn(
                "group/row h-[33px] border-b border-(--pk-border)",
                dropSide === "top" && "shadow-[inset_0_2px_0_0_var(--pk-blue)]",
                dropSide === "bottom" && "shadow-[inset_0_-2px_0_0_var(--pk-blue)]",
            )}
        >
            {data.properties.map((property, i) => (
                <Cell
                    key={property.id}
                    property={property}
                    value={row.cells[property.id] ?? emptyValue(property.type)}
                    editing={editing === property.id}
                    onEdit={(on) => onEdit(on ? property.id : null)}
                    onChange={(value) => onSetCell(property.id, value)}
                    onOptionsChange={(options) => onSetOptions(property.id, options)}
                    handles={
                        i === 0 && (
                            <div
                                className={cn(
                                    "absolute top-0 right-full flex h-[33px] items-center pr-1 opacity-0 transition-opacity group-hover/row:opacity-100",
                                    menuOpen && "opacity-100",
                                )}
                            >
                                <button
                                    type="button"
                                    aria-label="Insert row below"
                                    onClick={onInsertBelow}
                                    className="flex h-6 w-[22px] cursor-pointer items-center justify-center rounded-sm text-(--pk-text-tertiary) hover:bg-(--pk-hover)"
                                >
                                    <Plus className="size-4" strokeWidth={1.75} />
                                </button>
                                <button
                                    ref={gripRef}
                                    type="button"
                                    aria-label="Drag to move, click to open menu"
                                    draggable={!sorted}
                                    onDragStart={(e) => {
                                        e.stopPropagation()
                                        e.dataTransfer.setData("application/x-pereskia-row", row.id)
                                        e.dataTransfer.effectAllowed = "move"
                                        const tr = e.currentTarget.closest("tr")
                                        if (tr) e.dataTransfer.setDragImage(tr, 60, 16)
                                    }}
                                    onClick={() => setMenuOpen(true)}
                                    className="flex h-6 w-[18px] cursor-grab items-center justify-center rounded-sm text-(--pk-text-tertiary) hover:bg-(--pk-hover)"
                                >
                                    <GripVertical className="size-4" strokeWidth={1.75} />
                                </button>
                                <Popover open={menuOpen} onOpenChange={setMenuOpen} anchor={gripRef} side="left" align="start" className="w-[220px]">
                                    <MenuSection>
                                        <MenuItem icon={<Copy className="size-4" strokeWidth={1.75} />} label="Duplicate" onClick={duplicate} />
                                        <MenuItem danger icon={<Trash2 className="size-4" strokeWidth={1.75} />} label="Delete" onClick={remove} />
                                    </MenuSection>
                                </Popover>
                            </div>
                        )
                    }
                />
            ))}
            <td />
        </tr>
    )
}

function Cell({
    property,
    value,
    editing,
    onEdit,
    onChange,
    onOptionsChange,
    handles,
}: {
    property: Property
    value: CellValue
    editing: boolean
    onEdit: (editing: boolean) => void
    onChange: (value: CellValue) => void
    onOptionsChange: (options: SelectOption[]) => void
    handles?: React.ReactNode
}) {
    const tdRef = useRef<HTMLTableCellElement>(null)
    const isPopoverType = ["select", "multiSelect", "status", "date"].includes(property.type)
    const isText = property.type === "title" || property.type === "text" || property.type === "number"

    return (
        <td
            ref={tdRef}
            onClick={() => property.type !== "checkbox" && onEdit(true)}
            className={cn(
                "relative h-[33px] border-r border-(--pk-border) p-0 align-top",
                property.type !== "checkbox" && "cursor-pointer",
                editing && isPopoverType && "shadow-(--pk-cell-selected)",
            )}
        >
            {handles}
            <div
                className={cn(
                    "flex min-h-[33px] items-center overflow-hidden px-2 py-[5px]",
                    property.type === "number" && "justify-end",
                )}
            >
                <CellDisplay property={property} value={value} onChange={onChange} />
            </div>

            {editing && isText && (
                <TextCellEditor property={property} value={value} onCommit={onChange} onClose={() => onEdit(false)} />
            )}

            {isPopoverType && (
                <Popover
                    open={editing}
                    onOpenChange={onEdit}
                    anchor={tdRef}
                    sideOffset={({ anchor }) => -anchor.height}
                    className={property.type === "date" ? "" : "w-[max(300px,var(--anchor-width))]"}
                >
                    {property.type === "date" ? (
                        <DatePicker value={(value as string) ?? null} onChange={onChange} />
                    ) : (
                        <OptionPicker
                            property={property}
                            selected={Array.isArray(value) ? value : value ? [value as string] : []}
                            multi={property.type === "multiSelect"}
                            onChange={(ids) => onChange(property.type === "multiSelect" ? ids : (ids[0] ?? null))}
                            onDone={() => onEdit(false)}
                            onOptionsChange={onOptionsChange}
                        />
                    )}
                </Popover>
            )}
        </td>
    )
}

function CellDisplay({
    property,
    value,
    onChange,
}: {
    property: Property
    value: CellValue
    onChange: (value: CellValue) => void
}) {
    switch (property.type) {
        case "title":
            return value ? (
                <span className="truncate leading-[1.5] font-medium">
                    <span className="border-b border-(--pk-text-tertiary)/40">{value as string}</span>
                </span>
            ) : null
        case "text":
            return <span className="truncate whitespace-nowrap">{value as string}</span>
        case "number":
            return <span className="truncate tabular-nums">{value === null ? "" : String(value)}</span>
        case "select":
        case "status": {
            const option = property.options?.find((o) => o.id === value)
            return option ? <OptionChip option={option} isStatus={property.type === "status"} /> : null
        }
        case "multiSelect":
            return (
                <span className="flex min-w-0 gap-1.5 overflow-hidden">
                    {((value as string[]) ?? []).map((id) => {
                        const option = property.options?.find((o) => o.id === id)
                        return option ? <OptionChip key={id} option={option} isStatus={false} /> : null
                    })}
                </span>
            )
        case "date":
            return value ? <span className="truncate whitespace-nowrap">{formatDate(value as string)}</span> : null
        case "checkbox":
            return <Checkbox checked={value === true} onChange={onChange} />
    }
}

function TextCellEditor({
    property,
    value,
    onCommit,
    onClose,
}: {
    property: Property
    value: CellValue
    onCommit: (value: CellValue) => void
    onClose: () => void
}) {
    const [draft, setDraft] = useState(value === null ? "" : String(value))
    const closed = useRef(false)

    const commit = () => {
        if (closed.current) return
        closed.current = true
        if (property.type === "number") {
            const n = parseFloat(draft)
            onCommit(draft.trim() === "" || !Number.isFinite(n) ? null : n)
        } else {
            onCommit(draft)
        }
        onClose()
    }

    return (
        <div
            onClick={(e) => e.stopPropagation()}
            className="absolute -top-px -left-px z-20 min-h-[calc(100%+2px)] w-[calc(100%+2px)] min-w-[240px] rounded-[3px] bg-(--pk-popover) shadow-(--pk-popover-shadow)"
        >
            <textarea
                autoFocus
                value={draft}
                rows={1}
                onFocus={(e) => e.target.setSelectionRange(e.target.value.length, e.target.value.length)}
                onChange={(e) => setDraft(property.type === "number" ? e.target.value.replace(/[^\d.\-e]/g, "") : e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                    if ((e.key === "Enter" && !e.shiftKey) || e.key === "Escape" || e.key === "Tab") {
                        e.preventDefault()
                        commit()
                    }
                }}
                placeholder={property.type === "title" ? "Untitled" : ""}
                className={cn(
                    "field-sizing-content block min-h-[33px] w-full resize-none bg-transparent px-2 py-[6px] text-sm leading-[1.5] outline-none placeholder:text-(--pk-text-tertiary)",
                    property.type === "title" && "font-medium",
                    property.type === "number" && "text-right",
                )}
            />
        </div>
    )
}
