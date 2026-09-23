import { useEffect } from "react"
import { SidebarProvider } from "@/components/ui/sidebar"
import { ImportDialog } from "@/components/import/import-dialog"
import { EmptyWorkspace, PageView } from "@/components/page/page-view"
import { SettingsDialog } from "@/components/settings/settings-dialog"
import { Spinner } from "@/components/pereskia"
import { useCurrentPageId, usePages } from "@/hooks/use-pages"
import { useCurrentWorkspace } from "@/hooks/use-workspaces"
import { useAppStore } from "@/stores/app-store"
import { AppSidebar } from "./app-sidebar"
import { AppTopbar } from "./app-topbar"
import { SearchDialog } from "./search-dialog"

export function WorkspaceShell() {
    const workspace = useCurrentWorkspace()
    const { data: pages, isLoading } = usePages()
    const currentPageId = useCurrentPageId()
    const { openPage, setWorkspaceId, workspaceId } = useAppStore()

    useEffect(() => {
        if (workspace && workspace.id !== workspaceId) setWorkspaceId(workspace.id)
    }, [workspace, workspaceId, setWorkspaceId])

    useEffect(() => {
        if (!pages) return
        if (!currentPageId || !pages.some((p) => p.id === currentPageId)) {
            const first = pages.find((p) => p.parentId === null)
            if (first) openPage(first.id, { replace: true })
        }
    }, [pages, currentPageId, openPage])

    const current = pages?.find((p) => p.id === currentPageId)

    return (
        <SidebarProvider className="h-svh overflow-hidden">
            <AppSidebar />
            <main className="flex h-svh min-w-0 flex-1 flex-col bg-(--pk-bg)">
                <AppTopbar />
                <div className="pk-scroller min-h-0 flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex justify-center pt-40 text-(--pk-text-tertiary)">
                            <Spinner className="size-5" />
                        </div>
                    ) : current ? (
                        <PageView key={current.id} pageId={current.id} />
                    ) : pages?.length === 0 ? (
                        <EmptyWorkspace />
                    ) : null}
                </div>
            </main>
            <SearchDialog />
            <SettingsDialog />
            <ImportDialog />
        </SidebarProvider>
    )
}
