import { useRef, useState } from "react"
import { cn } from "cn"
import { Image, Smile } from "lucide-react"
import type { Page, PagePatch } from "@/api/types"
import { Button, IconButton, Popover } from "@/components/pereskia"
import { DocumentEditor, type Block } from "./document-editor"

const COVERS: Record<string, string> = {
    "gradient:1": "linear-gradient(135deg, #f6d365 0%, #fda085 100%)",
    "gradient:2": "linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)",
    "gradient:3": "linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)",
    "gradient:4": "linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)",
    "gradient:5": "linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)",
    "gradient:6": "linear-gradient(135deg, #434343 0%, #000000 100%)",
    "gradient:7": "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
    "gradient:8": "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
}
const COVER_KEYS = Object.keys(COVERS)

const EMOJIS = "📄 📝 📌 📎 📚 📖 🗂️ 🗒️ 📅 📊 📈 🧭 🎯 🚀 💡 🔥 ⭐ ✅ 🧠 🛠️ ⚙️ 🧪 🐛 💬 📣 🎨 🏠 🌱 🌍 🍒 ☕ 🎉 👋 🙌 💼 🔒 🧾 🗺️ 🏷️ 🧩".split(" ")

const COLUMN = "mx-auto w-full max-w-[900px] px-[max(24px,min(96px,8vw))]"

export function Document({ page, save }: { page: Page; save: (patch: PagePatch) => void }) {
    const editorRef = useRef<{ focusFirst: () => void }>(null)
    const [icon, setIcon] = useState(page.icon)
    const [cover, setCover] = useState(page.cover)
    const [title, setTitle] = useState(page.title)
    const [iconPickerOpen, setIconPickerOpen] = useState(false)
    const iconRef = useRef<HTMLButtonElement>(null)

    const updateIcon = (next: string | null) => {
        setIcon(next)
        save({ icon: next })
        setIconPickerOpen(false)
    }
    const updateCover = (next: string | null) => {
        setCover(next)
        save({ cover: next })
    }

    const initialBlocks = Array.isArray(page.content) ? (page.content as Block[]) : undefined

    return (
        <div className="pk-root pb-[30vh]">
            {cover && (
                <div className="group/cover relative h-[30vh] max-h-[280px] min-h-[120px]" style={{ background: COVERS[cover] ?? cover }}>
                    <div className="absolute right-[max(24px,min(96px,8vw))] bottom-3 flex overflow-hidden rounded-md bg-(--pk-popover) text-xs text-(--pk-text-secondary) opacity-0 shadow-(--pk-popover-shadow) transition-opacity group-hover/cover:opacity-100">
                        <button
                            type="button"
                            onClick={() => updateCover(COVER_KEYS[(COVER_KEYS.indexOf(cover) + 1) % COVER_KEYS.length])}
                            className="h-6 cursor-pointer px-2 hover:bg-(--pk-hover)"
                        >
                            Change cover
                        </button>
                        <span className="w-px bg-(--pk-divider)" />
                        <button type="button" onClick={() => updateCover(null)} className="h-6 cursor-pointer px-2 hover:bg-(--pk-hover)">
                            Remove
                        </button>
                    </div>
                </div>
            )}

            <div className={COLUMN}>
                <div className={cn("group/header relative", cover ? (icon ? "" : "pt-8") : icon ? "pt-20" : "pt-24")}>
                    {icon && (
                        <button
                            ref={iconRef}
                            type="button"
                            onClick={() => setIconPickerOpen(true)}
                            className={cn(
                                "relative z-10 flex size-[78px] cursor-pointer items-center justify-center rounded-md text-[64px] leading-none hover:bg-(--pk-hover)",
                                cover && "-mt-[39px]",
                            )}
                        >
                            {icon}
                        </button>
                    )}

                    <div className="flex h-9 items-center gap-1 pt-2 opacity-0 transition-opacity group-hover/header:opacity-100">
                        {!icon && (
                            <Button variant="ghost" size="sm" className="font-normal text-(--pk-text-tertiary)" onClick={() => updateIcon(EMOJIS[Math.floor(Math.random() * EMOJIS.length)])}>
                                <Smile className="size-4" /> Add icon
                            </Button>
                        )}
                        {!cover && (
                            <Button variant="ghost" size="sm" className="font-normal text-(--pk-text-tertiary)" onClick={() => updateCover(COVER_KEYS[Math.floor(Math.random() * COVER_KEYS.length)])}>
                                <Image className="size-4" /> Add cover
                            </Button>
                        )}
                    </div>

                    <textarea
                        value={title}
                        rows={1}
                        onChange={(e) => {
                            const next = e.target.value.replace(/\n/g, "")
                            setTitle(next)
                            save({ title: next })
                        }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault()
                                editorRef.current?.focusFirst()
                            }
                        }}
                        className="field-sizing-content w-full resize-none bg-transparent text-[40px] leading-[1.2] font-bold text-(--pk-text) outline-none placeholder:text-(--pk-text-tertiary)/50"
                        placeholder="New page"
                    />
                </div>

                <Popover open={iconPickerOpen} onOpenChange={setIconPickerOpen} anchor={iconRef} className="w-83">
                    <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
                        <span className="text-xs font-medium text-(--pk-text-secondary)">Emoji</span>
                        <Button variant="ghost" size="sm" className="h-6 text-xs font-normal" onClick={() => updateIcon(null)}>
                            Remove
                        </Button>
                    </div>
                    <div className="grid grid-cols-10 gap-0.5 p-2 pt-1">
                        {EMOJIS.map((emoji) => (
                            <IconButton key={emoji} label={emoji} className="size-7.5 text-xl" onClick={() => updateIcon(emoji)}>
                                {emoji}
                            </IconButton>
                        ))}
                    </div>
                </Popover>

                <div className="mt-1">
                    <DocumentEditor
                        ref={editorRef}
                        pageId={page.id}
                        initialBlocks={initialBlocks}
                        onChange={(blocks) => save({ content: blocks })}
                    />
                </div>
            </div>
        </div>
    )
}
