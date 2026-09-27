import { useEffect } from "react"
import { AuthScreen } from "@/components/auth/auth-screen"
import { CreateWorkspaceScreen } from "@/components/auth/create-workspace-screen"
import { InviteScreen } from "@/components/auth/invite-screen"
import { WorkspaceShell } from "@/components/layout/workspace-shell"
import { Button, FullScreen, Spinner } from "@/components/pereskia"
import { LandingPage } from "@/components/landing/landing-page"
import { SetupWizard } from "@/components/setup/setup-wizard"
import { useMe, useSetupStatus } from "@/hooks/use-session"
import { useWorkspaces } from "@/hooks/use-workspaces"
import { errorMessage } from "@/lib/http"
import { selectAuthRoute, selectInviteToken, useAppStore } from "@/stores/app-store"

function Loading() {
    return (
        <FullScreen>
            <Spinner className="size-5 text-(--pk-text-tertiary)" />
        </FullScreen>
    )
}

export function App() {
    const setup = useSetupStatus()
    const configured = setup.data?.configured === true
    const me = useMe()
    const inviteToken = useAppStore(selectInviteToken)
    const authRoute = useAppStore(selectAuthRoute)
    const navigate = useAppStore((s) => s.navigate)
    const signedIn = configured && !!me.data
    const workspaces = useWorkspaces(signedIn)

    // /login and /signup are only meaningful while signed out; once the session
    // exists, drop back to the workspace so the path names a real page again.
    useEffect(() => {
        if (signedIn && authRoute) navigate("/", { replace: true })
    }, [signedIn, authRoute, navigate])

    const failed = setup.error ?? (configured ? me.error : null)
    if (failed) {
        return (
            <FullScreen>
                <span>Can't reach the server: {errorMessage(failed)}</span>
                <Button onClick={() => window.location.reload()}>Try again</Button>
            </FullScreen>
        )
    }

    if (setup.isLoading) return <Loading />
    if (!configured) return <SetupWizard />
    if (me.isLoading) return <Loading />
    if (inviteToken) return <InviteScreen token={inviteToken} />
    if (!me.data) return authRoute ? <AuthScreen initialMode={authRoute} /> : <LandingPage />
    if (workspaces.isLoading) return <Loading />
    if (!workspaces.data?.length) return <CreateWorkspaceScreen />
    return <WorkspaceShell />
}

export default App
