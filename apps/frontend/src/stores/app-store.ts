import { create } from "zustand"
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware"

export type SaveState = "idle" | "saving" | "saved" | "error"
export type AppDialog = "search" | "settings" | "import" | "notionImport" | null
export type SettingsTab = "general" | "members" | "storage" | "email"

type AppState = {
    path: string
    workspaceId: string | null
    saveState: SaveState
    dialog: AppDialog
    settingsTab: SettingsTab
    navigate: (path: string, options?: { replace?: boolean }) => void
    openPage: (id: string | null, options?: { replace?: boolean }) => void
    setWorkspaceId: (id: string | null) => void
    setSaveState: (state: SaveState) => void
    openDialog: (dialog: Exclude<AppDialog, null>, tab?: SettingsTab) => void
    closeDialog: () => void
}

const safeLocalStorage: StateStorage = {
    getItem: (name) => {
        try {
            return localStorage.getItem(name)
        } catch {
            return null
        }
    },
    setItem: (name, value) => {
        try {
            localStorage.setItem(name, value)
        } catch {
            return
        }
    },
    removeItem: (name) => {
        try {
            localStorage.removeItem(name)
        } catch {
            return
        }
    },
}

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            path: window.location.pathname,
            workspaceId: null,
            saveState: "idle",
            dialog: null,
            settingsTab: "general",
            navigate: (path, options) => {
                if (window.location.pathname !== path) {
                    if (options?.replace) window.history.replaceState(null, "", path)
                    else window.history.pushState(null, "", path)
                }
                set({ path })
            },
            openPage: (id, options) => get().navigate(id ? `/${id}` : "/", options),
            setWorkspaceId: (workspaceId) => set({ workspaceId }),
            setSaveState: (saveState) => set({ saveState }),
            openDialog: (dialog, tab) => set({ dialog, ...(tab ? { settingsTab: tab } : {}) }),
            closeDialog: () => set({ dialog: null }),
        }),
        {
            name: "pereskia:app",
            storage: createJSONStorage(() => safeLocalStorage),
            partialize: (state) => ({ workspaceId: state.workspaceId }),
        },
    ),
)

window.addEventListener("popstate", () => useAppStore.setState({ path: window.location.pathname }))

const INVITE_PREFIX = "/invite/"

/* Paths that show the auth screen instead of the landing page or a workspace page. */
const AUTH_ROUTES = { "/login": "login", "/signup": "signup" } as const

export type AuthRoute = (typeof AUTH_ROUTES)[keyof typeof AUTH_ROUTES]

export const selectInviteToken = (state: AppState) =>
    state.path.startsWith(INVITE_PREFIX) ? decodeURIComponent(state.path.slice(INVITE_PREFIX.length)) : null

export const selectAuthRoute = (state: AppState): AuthRoute | null =>
    AUTH_ROUTES[state.path as keyof typeof AUTH_ROUTES] ?? null

export const selectPageId = (state: AppState) =>
    state.path.startsWith(INVITE_PREFIX) || selectAuthRoute(state) ? null : decodeURIComponent(state.path.slice(1)) || null
