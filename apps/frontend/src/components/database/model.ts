import { nanoid } from "nanoid"
import type { PropertyKind, TagColor } from "@/components/pereskia"

export type PropertyType = PropertyKind
export type { TagColor }

export type StatusGroup = "todo" | "inProgress" | "complete"

export type SelectOption = {
    id: string
    name: string
    color: TagColor
    group?: StatusGroup
}

export type Property = {
    id: string
    name: string
    type: PropertyType
    width: number
    options?: SelectOption[]
}

export type CellValue = string | number | boolean | string[] | null

export type Row = {
    id: string
    cells: Record<string, CellValue>
}

export type FilterOperator =
    | "is"
    | "isNot"
    | "contains"
    | "doesNotContain"
    | "startsWith"
    | "endsWith"
    | "isEmpty"
    | "isNotEmpty"
    | "eq"
    | "neq"
    | "gt"
    | "lt"
    | "gte"
    | "lte"
    | "isBefore"
    | "isAfter"
    | "isOnOrBefore"
    | "isOnOrAfter"

export type Filter = {
    id: string
    propertyId: string
    operator: FilterOperator
    value: CellValue
}

export type AdvancedFilter = {
    conjunction: "and" | "or"
    rules: Filter[]
}

export type SortDirection = "ascending" | "descending"

export type Sort = {
    id: string
    propertyId: string
    direction: SortDirection
}

export type DatabaseData = {
    title: string
    properties: Property[]
    rows: Row[]
    filters: Filter[]
    advancedFilter: AdvancedFilter | null
    sorts: Sort[]
}

export const TAG_COLORS: TagColor[] = [
    "default",
    "gray",
    "brown",
    "orange",
    "yellow",
    "green",
    "blue",
    "purple",
    "pink",
    "red",
]

export const TAG_COLOR_LABELS: Record<TagColor, string> = {
    default: "Default",
    gray: "Gray",
    brown: "Brown",
    orange: "Orange",
    yellow: "Yellow",
    green: "Green",
    blue: "Blue",
    purple: "Purple",
    pink: "Pink",
    red: "Red",
}

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
    title: "Title",
    text: "Text",
    number: "Number",
    select: "Select",
    multiSelect: "Multi-select",
    status: "Status",
    date: "Date",
    checkbox: "Checkbox",
}

export const STATUS_GROUP_LABELS: Record<StatusGroup, string> = {
    todo: "To-do",
    inProgress: "In progress",
    complete: "Complete",
}

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
    is: "Is",
    isNot: "Is not",
    contains: "Contains",
    doesNotContain: "Does not contain",
    startsWith: "Starts with",
    endsWith: "Ends with",
    isEmpty: "Is empty",
    isNotEmpty: "Is not empty",
    eq: "=",
    neq: "≠",
    gt: ">",
    lt: "<",
    gte: "≥",
    lte: "≤",
    isBefore: "Is before",
    isAfter: "Is after",
    isOnOrBefore: "Is on or before",
    isOnOrAfter: "Is on or after",
}

export const OPERATORS_BY_TYPE: Record<PropertyType, FilterOperator[]> = {
    title: ["is", "isNot", "contains", "doesNotContain", "startsWith", "endsWith", "isEmpty", "isNotEmpty"],
    text: ["is", "isNot", "contains", "doesNotContain", "startsWith", "endsWith", "isEmpty", "isNotEmpty"],
    number: ["eq", "neq", "gt", "lt", "gte", "lte", "isEmpty", "isNotEmpty"],
    select: ["is", "isNot", "isEmpty", "isNotEmpty"],
    status: ["is", "isNot", "isEmpty", "isNotEmpty"],
    multiSelect: ["contains", "doesNotContain", "isEmpty", "isNotEmpty"],
    date: ["is", "isBefore", "isAfter", "isOnOrBefore", "isOnOrAfter", "isEmpty", "isNotEmpty"],
    checkbox: ["is", "isNot"],
}

export const DEFAULT_OPERATOR: Record<Property["type"], FilterOperator> = {
    title: "contains",
    text: "contains",
    number: "eq",
    select: "is",
    status: "is",
    multiSelect: "contains",
    date: "is",
    checkbox: "is",
}

export function newFilter(property: Property): Filter {
    return {
        id: nanoid(),
        propertyId: property.id,
        operator: DEFAULT_OPERATOR[property.type],
        value: defaultFilterValue(property.type),
    }
}

export const operatorNeedsValue = (op: FilterOperator) => op !== "isEmpty" && op !== "isNotEmpty"

export const randomTagColor = (): TagColor =>
    TAG_COLORS[1 + Math.floor(Math.random() * (TAG_COLORS.length - 1))]

export function defaultStatusOptions(): SelectOption[] {
    return [
        { id: nanoid(), name: "Not started", color: "default", group: "todo" },
        { id: nanoid(), name: "In progress", color: "blue", group: "inProgress" },
        { id: nanoid(), name: "Done", color: "green", group: "complete" },
    ]
}

export function createProperty(type: PropertyType, name?: string): Property {
    return {
        id: nanoid(),
        name: name ?? PROPERTY_TYPE_LABELS[type],
        type,
        width: type === "checkbox" ? 100 : type === "title" ? 280 : 200,
        options: type === "status" ? defaultStatusOptions() : type === "select" || type === "multiSelect" ? [] : undefined,
    }
}

export function emptyValue(type: PropertyType): CellValue {
    switch (type) {
        case "multiSelect":
            return []
        case "checkbox":
            return false
        case "title":
        case "text":
            return ""
        default:
            return null
    }
}

export function defaultFilterValue(type: PropertyType): CellValue {
    if (type === "select" || type === "status" || type === "multiSelect") return []
    if (type === "checkbox") return true
    return null
}

export function isEmptyValue(value: CellValue): boolean {
    if (value === null || value === undefined) return true
    if (typeof value === "string") return value.trim() === ""
    if (Array.isArray(value)) return value.length === 0
    return false
}

export function convertValue(value: CellValue, from: Property, to: Property): CellValue {
    const text = valueToText(value, from)
    switch (to.type) {
        case "title":
        case "text":
            return text
        case "number": {
            const n = parseFloat(text)
            return Number.isFinite(n) ? n : null
        }
        case "checkbox":
            return value === true || ["true", "yes", "checked", "1"].includes(text.toLowerCase())
        case "date":
            return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null
        case "select":
        case "status": {
            const first = text.split(",")[0]?.trim()
            return to.options?.find((o) => o.name === first)?.id ?? null
        }
        case "multiSelect": {
            const names = text.split(",").map((s) => s.trim())
            return to.options?.filter((o) => names.includes(o.name)).map((o) => o.id) ?? []
        }
    }
}

export function optionsFromValues(rows: Row[], from: Property, to: PropertyType): SelectOption[] {
    if (to === "status") return from.type === "status" ? from.options ?? [] : defaultStatusOptions()
    if (from.options && (from.type === "select" || from.type === "multiSelect" || from.type === "status")) {
        return from.options.map((o) => ({ id: o.id, name: o.name, color: o.color }))
    }
    const names = new Set<string>()
    for (const row of rows) {
        const text = valueToText(row.cells[from.id] ?? null, from)
        for (const part of to === "multiSelect" ? text.split(",") : [text]) {
            if (part.trim()) names.add(part.trim())
        }
    }
    return [...names].map((name) => ({ id: nanoid(), name, color: randomTagColor() }))
}

export function valueToText(value: CellValue, property: Property): string {
    if (value === null || value === undefined) return ""
    if (property.type === "checkbox") return value ? "true" : ""
    if (property.type === "select" || property.type === "status") {
        return property.options?.find((o) => o.id === value)?.name ?? ""
    }
    if (property.type === "multiSelect" && Array.isArray(value)) {
        return value
            .map((id) => property.options?.find((o) => o.id === id)?.name)
            .filter(Boolean)
            .join(", ")
    }
    return String(value)
}

export function formatDate(value: string) {
    const [y, m, d] = value.split("-").map(Number)
    return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

export function toISODate(date: Date) {
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${date.getFullYear()}-${m}-${d}`
}

export function matchesFilter(row: Row, filter: Filter, property: Property | undefined): boolean {
    if (!property) return true
    const cell = row.cells[property.id] ?? emptyValue(property.type)
    const { operator, value } = filter

    if (operator === "isEmpty") return property.type === "checkbox" ? cell !== true : isEmptyValue(cell)
    if (operator === "isNotEmpty") return property.type === "checkbox" ? cell === true : !isEmptyValue(cell)

    if (property.type !== "checkbox" && isEmptyValue(value)) return true

    switch (property.type) {
        case "title":
        case "text": {
            const a = String(cell ?? "").toLowerCase()
            const b = String(value).toLowerCase()
            if (operator === "is") return a === b
            if (operator === "isNot") return a !== b
            if (operator === "contains") return a.includes(b)
            if (operator === "doesNotContain") return !a.includes(b)
            if (operator === "startsWith") return a.startsWith(b)
            if (operator === "endsWith") return a.endsWith(b)
            return true
        }
        case "number": {
            if (cell === null) return operator === "neq"
            const a = Number(cell)
            const b = Number(value)
            if (operator === "eq") return a === b
            if (operator === "neq") return a !== b
            if (operator === "gt") return a > b
            if (operator === "lt") return a < b
            if (operator === "gte") return a >= b
            if (operator === "lte") return a <= b
            return true
        }
        case "select":
        case "status": {
            const ids = value as string[]
            const hit = ids.includes(cell as string)
            return operator === "isNot" ? !hit : hit
        }
        case "multiSelect": {
            const ids = value as string[]
            const cellIds = (cell as string[]) ?? []
            const hit = ids.some((id) => cellIds.includes(id))
            return operator === "doesNotContain" ? !hit : hit
        }
        case "date": {
            if (!cell) return false
            const a = cell as string
            const b = value as string
            if (operator === "is") return a === b
            if (operator === "isBefore") return a < b
            if (operator === "isAfter") return a > b
            if (operator === "isOnOrBefore") return a <= b
            if (operator === "isOnOrAfter") return a >= b
            return true
        }
        case "checkbox": {
            const checked = cell === true
            return operator === "isNot" ? checked !== value : checked === value
        }
    }
}

export function applyFilters(data: DatabaseData, rows: Row[]): Row[] {
    const byId = new Map(data.properties.map((p) => [p.id, p]))
    return rows.filter((row) => {
        const simple = data.filters.every((f) => matchesFilter(row, f, byId.get(f.propertyId)))
        if (!simple) return false
        const adv = data.advancedFilter
        if (!adv || adv.rules.length === 0) return true
        const results = adv.rules.map((f) => matchesFilter(row, f, byId.get(f.propertyId)))
        return adv.conjunction === "and" ? results.every(Boolean) : results.some(Boolean)
    })
}

function compareCells(a: CellValue, b: CellValue, property: Property): number {
    switch (property.type) {
        case "number":
            return (a as number) - (b as number)
        case "checkbox":
            return Number(a === true) - Number(b === true)
        case "select":
        case "status": {
            const order = property.options?.map((o) => o.id) ?? []
            return order.indexOf(a as string) - order.indexOf(b as string)
        }
        case "multiSelect": {
            const order = property.options?.map((o) => o.id) ?? []
            const ai = (a as string[]).map((id) => order.indexOf(id))
            const bi = (b as string[]).map((id) => order.indexOf(id))
            for (let i = 0; i < Math.min(ai.length, bi.length); i++) {
                if (ai[i] !== bi[i]) return ai[i] - bi[i]
            }
            return ai.length - bi.length
        }
        default:
            return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" })
    }
}

export function applySorts(data: DatabaseData, rows: Row[]): Row[] {
    if (data.sorts.length === 0) return rows
    const byId = new Map(data.properties.map((p) => [p.id, p]))
    return [...rows].sort((ra, rb) => {
        for (const sort of data.sorts) {
            const property = byId.get(sort.propertyId)
            if (!property) continue
            const a = ra.cells[property.id] ?? emptyValue(property.type)
            const b = rb.cells[property.id] ?? emptyValue(property.type)
            const aEmpty = property.type !== "checkbox" && isEmptyValue(a)
            const bEmpty = property.type !== "checkbox" && isEmptyValue(b)
            if (aEmpty || bEmpty) {
                if (aEmpty && bEmpty) continue
                return aEmpty ? 1 : -1
            }
            const result = compareCells(a, b, property)
            if (result !== 0) return sort.direction === "ascending" ? result : -result
        }
        return 0
    })
}

export function searchRows(data: DatabaseData, rows: Row[], query: string): Row[] {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) =>
        data.properties.some((p) => valueToText(row.cells[p.id] ?? null, p).toLowerCase().includes(q)),
    )
}

export function createDatabase(): DatabaseData {
    const name = createProperty("title", "Name")
    const status = createProperty("status", "Status")
    const priority: Property = {
        ...createProperty("select", "Priority"),
        width: 140,
        options: [
            { id: nanoid(), name: "High", color: "red" },
            { id: nanoid(), name: "Medium", color: "yellow" },
            { id: nanoid(), name: "Low", color: "green" },
        ],
    }
    const tags: Property = {
        ...createProperty("multiSelect", "Tags"),
        options: [
            { id: nanoid(), name: "Design", color: "purple" },
            { id: nanoid(), name: "Engineering", color: "blue" },
            { id: nanoid(), name: "Marketing", color: "orange" },
            { id: nanoid(), name: "Research", color: "pink" },
        ],
    }
    const due = { ...createProperty("date", "Due date"), width: 180 }
    const estimate = { ...createProperty("number", "Estimate"), width: 120 }
    const reviewed = { ...createProperty("checkbox", "Reviewed"), width: 110 }

    const [notStarted, inProgress, done] = status.options!
    const [high, medium, low] = priority.options!
    const [design, eng, marketing, research] = tags.options!

    const row = (
        title: string,
        s: SelectOption,
        p: SelectOption | null,
        t: SelectOption[],
        date: string | null,
        est: number | null,
        rev: boolean,
    ): Row => ({
        id: nanoid(),
        cells: {
            [name.id]: title,
            [status.id]: s.id,
            [priority.id]: p?.id ?? null,
            [tags.id]: t.map((o) => o.id),
            [due.id]: date,
            [estimate.id]: est,
            [reviewed.id]: rev,
        },
    })

    return {
        title: "Tasks",
        properties: [name, status, priority, tags, due, estimate, reviewed],
        rows: [
            row("Draft onboarding flow", inProgress, high, [design], "2026-09-24", 5, false),
            row("Set up CI pipeline", done, medium, [eng], "2026-09-18", 3, true),
            row("Write launch blog post", notStarted, low, [marketing], "2026-10-02", 2, false),
            row("User interviews", inProgress, medium, [research, design], "2026-09-29", 8, false),
            row("Fix sidebar collapse bug", notStarted, high, [eng], null, 1, false),
        ],
        filters: [],
        advancedFilter: null,
        sorts: [],
    }
}
