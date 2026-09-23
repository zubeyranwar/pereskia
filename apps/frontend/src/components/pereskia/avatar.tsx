import { cn } from "cn"
import type { TagColor } from "./tag"

const AVATAR_COLORS: TagColor[] = ["blue", "green", "purple", "orange", "pink", "brown", "red", "yellow"]

function colorFor(seed: string): TagColor {
    let hash = 0
    for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function Avatar({ name, seed, size = 24, className }: { name: string; seed?: string; size?: number; className?: string }) {
    const color = colorFor(seed ?? name)
    return (
        <span
            className={cn("flex shrink-0 items-center justify-center rounded-full font-medium select-none", className)}
            style={{
                width: size,
                height: size,
                fontSize: size * 0.45,
                background: `var(--tag-${color}-bg)`,
                color: `var(--tag-${color}-text)`,
            }}
        >
            {name.trim().charAt(0).toUpperCase() || "?"}
        </span>
    )
}

export function WorkspaceMark({ name, size = 22 }: { name: string; size?: number }) {
    return (
        <span
            className="flex shrink-0 items-center justify-center rounded-[4px] bg-(--pk-active) font-medium text-(--pk-text-secondary) select-none"
            style={{ width: size, height: size, fontSize: size * 0.55 }}
        >
            {name.charAt(0).toUpperCase() || "W"}
        </span>
    )
}

// The logo is used as a mask so it takes the current text colour in light and dark themes.
const LOGO_ASPECT = 638 / 869

export function BrandMark({ size = 32 }: { size?: number }) {
    return (
        <span
            role="img"
            aria-label="Pereskia"
            className="block shrink-0 bg-current select-none"
            style={{
                width: size * LOGO_ASPECT,
                height: size,
                mask: "url(/pereskia.svg) center / contain no-repeat",
                WebkitMask: "url(/pereskia.svg) center / contain no-repeat",
            }}
        />
    )
}
