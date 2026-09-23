import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type ChangeEvent, type ComponentType, type DragEvent, type KeyboardEvent } from "react"
import { nanoid } from "nanoid"
import { cn } from "cn"
import {
    ArrowDown,
    ArrowUp,
    GripVertical,
    Heading1,
    Heading2,
    Plus,
    SquareCheck,
    Table2,
    TableProperties,
    Trash2,
    Type,
    type LucideProps,
} from "lucide-react"
import { DatabaseView } from "@/components/database/database-view"
import { createDatabase, type DatabaseData } from "@/components/database/model"
import { Checkbox, IconButton, MenuItem, MenuLabel, MenuSection, MenuSeparator, PageIcon, Popover } from "@/components/pereskia"
import { pageTitle, useCreatePage, usePages } from "@/hooks/use-pages"
import { useAppStore } from "@/stores/app-store"

type BlockType = "paragraph" | "heading1" | "heading2" | "todo" | "database" | "databasePage"

const isTextBlock = (block: Block) => block.type !== "database" && block.type !== "databasePage"

export type Block = {
    id: string
    type: BlockType
    content: string
    checked?: boolean
    database?: DatabaseData
    pageId?: string
}

type Command = {
    type: BlockType
    label: string
    description: string
    icon: ComponentType<LucideProps>
}

const typeStyles: Partial<Record<BlockType, string>> = {
    paragraph: "text-base leading-normal",
    heading1: "mt-6 text-[30px] leading-tight font-bold",
    heading2: "mt-4 text-2xl leading-tight font-semibold",
    todo: "text-base leading-normal",
}

const typePlaceholders: Partial<Record<BlockType, string>> = {
    paragraph: "Type '/' for commands...",
    heading1: "Heading 1",
    heading2: "Heading 2",
    todo: "To-do",
}

const COMMANDS: Command[] = [
    { type: "paragraph", label: "Text", description: "Just start writing with plain text.", icon: Type },
    { type: "heading1", label: "Heading 1", description: "Big section heading.", icon: Heading1 },
    { type: "heading2", label: "Heading 2", description: "Medium section heading.", icon: Heading2 },
    { type: "todo", label: "To-do list", description: "Track tasks with a to-do list.", icon: SquareCheck },
    { type: "database", label: "Database - Inline", description: "Add a table inside this page.", icon: Table2 },
    { type: "databasePage", label: "Database - Full page", description: "Add a table on its own page.", icon: TableProperties },
]

const filterCommands = (query: string) => COMMANDS.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))

function CommandMenu({
    query,
    onSelect,
    activeIndex,
    onHover,
}: {
    query: string
    onSelect: (type: BlockType) => void
    activeIndex: number
    onHover: (index: number) => void
}) {
    const filtered = filterCommands(query)
    if (filtered.length === 0) return null

    return (
        <div className="pk-root pk-scroller absolute top-full left-0 z-50 mt-1 max-h-80 w-81 overflow-y-auto rounded-[10px] bg-(--pk-popover) shadow-(--pk-popover-shadow)">
            <MenuSection>
                <MenuLabel>Basic blocks</MenuLabel>
                {filtered.map((cmd, i) => {
                    const Icon = cmd.icon
                    return (
                        <button
                            key={cmd.type}
                            type="button"
                            onMouseEnter={() => onHover(i)}
                            onMouseDown={(e) => {
                                e.preventDefault()
                                onSelect(cmd.type)
                            }}
                            className={cn(
                                "flex w-full cursor-pointer items-center gap-2.5 rounded-md p-1 text-left",
                                activeIndex === i && "bg-(--pk-hover)",
                            )}
                        >
                            <span className="flex size-11.5 shrink-0 items-center justify-center rounded-md border border-(--pk-divider) bg-(--pk-bg)">
                                <Icon className="size-6 text-(--pk-text-secondary)" strokeWidth={1.5} />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-sm">{cmd.label}</span>
                                <span className="block truncate text-xs text-(--pk-text-tertiary)">{cmd.description}</span>
                            </span>
                        </button>
                    )
                })}
            </MenuSection>
        </div>
    )
}

function BlockEditor({
    block,
    isActive,
    onChange,
    onEnter,
    onBackspaceEmpty,
    onFocus,
    onArrowUp,
    onArrowDown,
    onTypeChange,
    onCheckboxChange,
    onResetBlockType,
    inputRef,
}: {
    block: Block
    isActive: boolean
    onChange: (id: string, content: string) => void
    onEnter: (id: string) => void
    onBackspaceEmpty: (id: string) => void
    onFocus: (id: string) => void
    onArrowUp: (id: string) => void
    onArrowDown: (id: string) => void
    onTypeChange: (id: string, type: BlockType) => void
    onCheckboxChange: (id: string, checked: boolean) => void
    onResetBlockType: (id: string) => void
    inputRef: (el: HTMLTextAreaElement | null) => void
}) {
    const [showMenu, setShowMenu] = useState(false)
    const [menuQuery, setMenuQuery] = useState("")
    const [activeIndex, setActiveIndex] = useState(0)

    const handleTypeSelect = (type: BlockType) => {
        onTypeChange(block.id, type)
        setShowMenu(false)
        setMenuQuery("")
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (showMenu) {
            const filtered = filterCommands(menuQuery)
            if (e.key === "ArrowUp") {
                e.preventDefault()
                setActiveIndex((i) => Math.max(0, i - 1))
                return
            }
            if (e.key === "ArrowDown") {
                e.preventDefault()
                setActiveIndex((i) => Math.min(filtered.length - 1, i + 1))
                return
            }
            if (e.key === "Enter" && filtered[activeIndex]) {
                e.preventDefault()
                handleTypeSelect(filtered[activeIndex].type)
                return
            }
            if (e.key === "Escape") {
                e.preventDefault()
                setShowMenu(false)
                return
            }
        }

        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            onEnter(block.id)
        }
        if (e.key === "Backspace" && block.content === "") {
            e.preventDefault()
            if (block.type !== "paragraph") onResetBlockType(block.id)
            else onBackspaceEmpty(block.id)
        }
        if (e.key === "ArrowUp") {
            e.preventDefault()
            onArrowUp(block.id)
        }
        if (e.key === "ArrowDown") {
            e.preventDefault()
            onArrowDown(block.id)
        }
    }

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value
        onChange(block.id, value)
        const slashIndex = value.lastIndexOf("/")
        if (slashIndex !== -1) {
            setShowMenu(true)
            setMenuQuery(value.slice(slashIndex + 1))
            setActiveIndex(0)
        } else {
            setShowMenu(false)
            setMenuQuery("")
        }
    }

    return (
        <div className="group/block flex items-start">
            <div className="-ml-14 flex h-7.5 w-14 shrink-0 items-center justify-end gap-0.5 pr-1 opacity-0 transition-opacity group-hover/block:opacity-100">
                <IconButton label="Add block" size="sm" tone="tertiary" onClick={() => setShowMenu(true)}>
                    <Plus className="size-4" />
                </IconButton>
                <IconButton label="Drag to move" size="sm" tone="tertiary" className="w-4.5 cursor-grab">
                    <GripVertical className="size-4" />
                </IconButton>
            </div>
            <div className="relative flex min-w-0 flex-1 items-start gap-2 py-0.75">
                {block.type === "todo" && (
                    <span className="flex h-6 items-center">
                        <Checkbox checked={block.checked ?? false} onChange={(checked) => onCheckboxChange(block.id, checked)} />
                    </span>
                )}
                <textarea
                    ref={inputRef}
                    value={block.content}
                    onKeyDown={handleKeyDown}
                    placeholder={isActive ? typePlaceholders[block.type] : ""}
                    onChange={handleChange}
                    onFocus={() => onFocus(block.id)}
                    onBlur={() => setShowMenu(false)}
                    rows={1}
                    className={cn(
                        "field-sizing-content w-full resize-none overflow-hidden bg-transparent text-(--pk-text) outline-none placeholder:text-(--pk-text-tertiary)",
                        typeStyles[block.type],
                        block.type === "todo" && block.checked && "text-(--pk-text-tertiary) line-through",
                    )}
                />
                {showMenu && isActive && (
                    <CommandMenu query={menuQuery} onSelect={handleTypeSelect} activeIndex={activeIndex} onHover={setActiveIndex} />
                )}
            </div>
        </div>
    )
}

type DocumentEditorProps = {
    pageId: string
    initialBlocks?: Block[]
    onChange: (blocks: Block[]) => void
}

export const DocumentEditor = forwardRef<{ focusFirst: () => void }, DocumentEditorProps>(({ pageId, initialBlocks, onChange }, ref) => {
    const refs = useRef<Record<string, HTMLTextAreaElement | null>>({})
    const createPage = useCreatePage()

    const [blocks, setBlocks] = useState<Block[]>(() =>
        initialBlocks?.length ? initialBlocks : [{ id: nanoid(), type: "paragraph", content: "" }]
    )

    const lastReported = useRef(blocks)
    useEffect(() => {
        if (lastReported.current === blocks) return
        lastReported.current = blocks
        onChange(blocks)
    }, [blocks, onChange])
    const [activeId, setActiveId] = useState<string>(blocks[0].id)
    const [dragId, setDragId] = useState<string | null>(null)
    const [dragOverId, setDragOverId] = useState<string | null>(null)

    const pendingFocus = useRef<string | null>(null)
    const focusBlock = (id: string) => {
        pendingFocus.current = id
        setTimeout(() => refs.current[id]?.focus(), 0)
    }
    useLayoutEffect(() => {
        const id = pendingFocus.current
        if (id && refs.current[id]) {
            refs.current[id]?.focus()
            pendingFocus.current = null
        }
    })

    useImperativeHandle(ref, () => ({
        focusFirst: () => focusBlock(blocks[0].id)
    }))

    const handleChange = (id: string, content: string) => {
        setBlocks((prev) =>
            prev.map(item => item.id === id ? { ...item, content } : item)
        )
    }
    const handleEnter = (id: string) => {
        const currentBlock = blocks.find(b => b.id === id)
        const nextBlockType: BlockType = currentBlock?.type === "todo" ? "todo" : "paragraph"
        const newBlock: Block = { id: nanoid(), type: nextBlockType, content: "" }

        setBlocks((prev) => {
            const currentIndex = prev.findIndex((b) => b.id === id)
            const next = [...prev]
            next.splice(currentIndex + 1, 0, newBlock)
            return next
        })

        setActiveId(newBlock.id);
        focusBlock(newBlock.id);
    }

    const nearestTextBlock = (id: string, direction: -1 | 1) => {
        const index = blocks.findIndex(b => b.id === id)
        for (let i = index + direction; i >= 0 && i < blocks.length; i += direction) {
            if (isTextBlock(blocks[i])) return blocks[i]
        }
        return undefined
    }

    const handleBackspaceEmpty = (id: string) => {
        const target = nearestTextBlock(id, -1)
        if (!target) return
        setBlocks((prev) => prev.filter((b) => b.id !== id))
        setActiveId(target.id)
        focusBlock(target.id)
    }

    const handleResetBlockType = (id: string) => {
        setBlocks((prev) =>
            prev.map(b => b.id === id ? { ...b, type: "paragraph" } : b)
        )
        focusBlock(id)
    }

    const handleArrowUp = (id: string) => {
        const target = nearestTextBlock(id, -1)
        if (!target) return
        setActiveId(target.id)
        focusBlock(target.id)
    }

    const handleArrowDown = (id: string) => {
        const target = nearestTextBlock(id, 1)
        if (!target) return
        setActiveId(target.id)
        focusBlock(target.id)
    }

    const createDatabasePageFor = () => {
        return createPage({ kind: "database", parentId: pageId, content: { ...createDatabase(), title: "" }, open: false }) ?? undefined
    }

    const handleTypeChange = (id: string, type: BlockType) => {
        const stripSlash = (content: string) => content.replace(/\/\S*$/, '').replace(/\/$/, '')

        if (type === "database" || type === "databasePage") {
            const extra: Partial<Block> = type === "database"
                ? { database: createDatabase() }
                : { pageId: createDatabasePageFor() }
            const after: Block = { id: nanoid(), type: "paragraph", content: "" }

            setBlocks((prev) => {
                const index = prev.findIndex(b => b.id === id)
                const current = prev[index]
                const remaining = stripSlash(current.content)
                const dbBlock: Block = remaining.trim()
                    ? { id: nanoid(), type, content: "", ...extra }
                    : { ...current, type, content: "", ...extra }
                const next = [...prev]
                if (remaining.trim()) {
                    next[index] = { ...current, content: remaining }
                    next.splice(index + 1, 0, dbBlock, after)
                } else {
                    next.splice(index, 1, dbBlock, after)
                }
                return next
            })
            setActiveId(after.id)
            focusBlock(after.id)
            return
        }

        setBlocks((prev) => prev.map(b => b.id === id ? { ...b, type, content: stripSlash(b.content) } : b))
        focusBlock(id)
    }

    const insertParagraph = (id: string, position: "above" | "below") => {
        const block: Block = { id: nanoid(), type: "paragraph", content: "" }
        setBlocks((prev) => {
            const index = prev.findIndex(b => b.id === id)
            const next = [...prev]
            next.splice(position === "above" ? index : index + 1, 0, block)
            return next
        })
        setActiveId(block.id)
        focusBlock(block.id)
    }

    const deleteBlock = (id: string) => {
        setBlocks((prev) => {
            const next = prev.filter(b => b.id !== id)
            return next.length ? next : [{ id: nanoid(), type: "paragraph", content: "" }]
        })
    }

    const handleClickBelow = () => {
        const last = blocks[blocks.length - 1]
        if (last && last.type === "paragraph" && last.content === "") {
            setActiveId(last.id)
            focusBlock(last.id)
        } else {
            insertParagraph(last.id, "below")
        }
    }

    const handleDatabaseChange = (id: string, fn: (data: DatabaseData) => DatabaseData) => {
        setBlocks((prev) => prev.map((b) => b.id === id && b.database ? { ...b, database: fn(b.database) } : b))
    }

    const handleCheckboxChange = (id: string, checked: boolean) => {
        setBlocks((prev) => prev.map((b) => b.id === id ? { ...b, checked } : b))
        focusBlock(id)
    }
    const handleDragOver = (e: DragEvent<HTMLDivElement>, id: string) => {
        e.preventDefault()
        setDragOverId(id)
    }
    const handleDrop = () => {
        if (!dragId || !dragOverId || dragId === dragOverId) return
        setBlocks((prev) => {
            const next = [...prev]
            const fromIndex = next.findIndex(b => b.id === dragId)
            const toIndex = next.findIndex(b => b.id === dragOverId)
            const [removed] = next.splice(fromIndex, 1)
            next.splice(toIndex, 0, removed)
            return next
        })

        setDragId(null)
        setDragOverId(null)
    }
    const handleDragEnd = () => {
        setDragId(null)
        setDragOverId(null)
    }

    return (
        <div>
            {blocks.map((block) => (
                <div
                    key={block.id}
                    draggable={block.type !== "database"}
                    onDragStart={() => setDragId(block.id)}
                    onDragOver={(e) => handleDragOver(e, block.id)}
                    onDrop={handleDrop}
                    onDragEnd={handleDragEnd}
                    className={cn(dragOverId === block.id && dragId !== block.id && "border-t-2 border-blue-400")}
                >
                    {!isTextBlock(block) ? (
                        <NonTextBlock
                            block={block}
                            onDatabaseChange={(fn) => handleDatabaseChange(block.id, fn)}
                            onInsert={(position) => insertParagraph(block.id, position)}
                            onDelete={() => deleteBlock(block.id)}
                        />
                    ) : (
                    <BlockEditor
                        block={block}
                        isActive={block.id === activeId}
                        onChange={handleChange}
                        onEnter={handleEnter}
                        onBackspaceEmpty={handleBackspaceEmpty}
                        onFocus={setActiveId}
                        onArrowUp={handleArrowUp}
                        onArrowDown={handleArrowDown}
                        onTypeChange={handleTypeChange}
                        onCheckboxChange={handleCheckboxChange}
                        onResetBlockType={handleResetBlockType}
                        inputRef={(el) => { refs.current[block.id] = el }}
                    />
                    )}
                </div>
            ))}
            <div onClick={handleClickBelow} className="min-h-32 cursor-text" />
        </div>
    )
})

function NonTextBlock({
    block,
    onDatabaseChange,
    onInsert,
    onDelete,
}: {
    block: Block
    onDatabaseChange: (fn: (data: DatabaseData) => DatabaseData) => void
    onInsert: (position: "above" | "below") => void
    onDelete: () => void
}) {
    const [menuOpen, setMenuOpen] = useState(false)
    const gripRef = useRef<HTMLButtonElement>(null)

    return (
        <div className="group/block relative">
            <div
                className={cn(
                    "absolute top-1.5 -left-14 z-10 flex w-14 justify-end gap-0.5 pr-1 opacity-0 transition-opacity group-hover/block:opacity-100",
                    menuOpen && "opacity-100",
                )}
            >
                <IconButton label="Add block below" size="sm" tone="tertiary" onClick={(e) => onInsert(e.altKey ? "above" : "below")}>
                    <Plus className="size-4" />
                </IconButton>
                <IconButton ref={gripRef} label="Block menu" size="sm" tone="tertiary" className="w-4.5" onClick={() => setMenuOpen(true)}>
                    <GripVertical className="size-4" />
                </IconButton>
                <Popover open={menuOpen} onOpenChange={setMenuOpen} anchor={gripRef} side="left" className="w-55">
                    <MenuSection>
                        <MenuItem
                            icon={<ArrowUp className="size-4" strokeWidth={1.75} />}
                            label="Add block above"
                            onClick={() => {
                                setMenuOpen(false)
                                onInsert("above")
                            }}
                        />
                        <MenuItem
                            icon={<ArrowDown className="size-4" strokeWidth={1.75} />}
                            label="Add block below"
                            onClick={() => {
                                setMenuOpen(false)
                                onInsert("below")
                            }}
                        />
                    </MenuSection>
                    <MenuSeparator />
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
                </Popover>
            </div>

            {block.type === "database" && block.database && <DatabaseView data={block.database} onChange={onDatabaseChange} />}
            {block.type === "databasePage" && block.pageId && <DatabasePageLink pageId={block.pageId} />}
        </div>
    )
}

function DatabasePageLink({ pageId }: { pageId: string }) {
    const { data: pages } = usePages()
    const openPage = useAppStore((s) => s.openPage)
    const page = pages?.find((p) => p.id === pageId)
    if (!page) return null
    return (
        <button
            type="button"
            onClick={() => openPage(pageId)}
            className="pk-root my-0.5 flex h-7.5 w-full cursor-pointer items-center gap-1.5 rounded-sm px-0.5 text-left hover:bg-(--pk-hover)"
        >
            <span className="flex shrink-0 text-(--pk-text-secondary)">
                <PageIcon icon={page.icon} kind={page.kind} />
            </span>
            <span className="truncate border-b border-(--pk-text-tertiary)/40 text-base leading-tight font-medium">{pageTitle(page)}</span>
        </button>
    )
}
