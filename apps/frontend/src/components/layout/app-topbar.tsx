import { Fragment } from "react"
import type { PageMeta } from "@/api/types"
import { HumburgerMenu } from "@/components/icons"
import { PageIcon } from "@/components/pereskia"
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { pageTitle, useCurrentPageId, usePages } from "@/hooks/use-pages"
import { useAppStore } from "@/stores/app-store"

const SAVE_LABEL = { idle: "", saving: "Saving…", saved: "Saved", error: "Couldn't save" } as const

export function AppTopbar() {
    const { open, isMobile } = useSidebar()
    const { data: pages = [] } = usePages()
    const currentPageId = useCurrentPageId()
    const openPage = useAppStore((s) => s.openPage)
    const saveState = useAppStore((s) => s.saveState)

    const trail: PageMeta[] = []
    for (let page = pages.find((p) => p.id === currentPageId); page && trail.length < 20; page = pages.find((p) => p.id === page!.parentId)) {
        trail.unshift(page)
    }

    return (
        <header className="pk-root flex h-11 shrink-0 items-center gap-1 bg-(--pk-bg) px-3">
            {(!open || isMobile) && <SidebarTrigger icon={HumburgerMenu} className="-ml-1" />}
            <nav className="flex min-w-0 flex-1 items-center">
                {trail.map((page, i) => (
                    <Fragment key={page.id}>
                        {i > 0 && <span className="px-0.5 text-sm text-(--pk-text-tertiary)">/</span>}
                        <button
                            type="button"
                            onClick={() => openPage(page.id)}
                            className="flex h-6 min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-sm hover:bg-(--pk-hover)"
                        >
                            <span className="flex shrink-0 text-(--pk-text-secondary)">
                                <PageIcon icon={page.icon} kind={page.kind} className="size-4 text-sm" />
                            </span>
                            <span className="max-w-50 truncate">{pageTitle(page)}</span>
                        </button>
                    </Fragment>
                ))}
            </nav>
            <span className={saveState === "error" ? "shrink-0 px-2 text-sm text-(--pk-red)" : "shrink-0 px-2 text-sm text-(--pk-text-tertiary)"}>
                {SAVE_LABEL[saveState]}
            </span>
        </header>
    )
}
