import type { ReactNode } from "react"
import { BrandMark } from "./avatar"

export function OnboardingLayout({ aside, children }: { aside?: ReactNode; children: ReactNode }) {
    return (
        <div className="pk-root pk-scroller flex h-svh justify-center overflow-y-auto bg-(--pk-bg) px-4">
            <div className="w-full max-w-120 py-[10vh]">
                <div className="mb-8 flex items-center gap-2.5">
                    <BrandMark />
                    <span className="text-sm font-semibold">Pereskia</span>
                    {aside && <span className="ml-auto text-xs text-(--pk-text-tertiary)">{aside}</span>}
                </div>
                {children}
            </div>
        </div>
    )
}

export function OnboardingTitle({ title, description }: { title: ReactNode; description?: ReactNode }) {
    return (
        <div className="mb-6">
            <h1 className="text-[28px] leading-tight font-bold">{title}</h1>
            {description && <p className="mt-2 text-sm text-(--pk-text-secondary)">{description}</p>}
        </div>
    )
}

export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} className="cursor-pointer text-(--pk-blue) hover:underline">
            {children}
        </button>
    )
}
