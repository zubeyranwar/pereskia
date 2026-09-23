import { Avatar, Button, ErrorText, FullScreen, OnboardingLayout, OnboardingTitle, Spinner, TextLink } from "@/components/pereskia"
import { useAcceptInvitation, useInvitation, useLogout, useMe } from "@/hooks/use-session"
import { errorMessage } from "@/lib/http"
import { useAppStore } from "@/stores/app-store"
import { LoginForm, SignupForm } from "./auth-form"

export function InviteScreen({ token }: { token: string }) {
    const { data: me } = useMe()
    const { data: invite, error, isLoading } = useInvitation(token)
    const accept = useAcceptInvitation()
    const logout = useLogout()
    const navigate = useAppStore((s) => s.navigate)

    if (isLoading) {
        return (
            <FullScreen>
                <Spinner className="size-5" />
            </FullScreen>
        )
    }

    if (error || !invite || invite.status !== "pending") {
        return (
            <OnboardingLayout>
                <OnboardingTitle
                    title="This invite link can't be used"
                    description={
                        error
                            ? errorMessage(error)
                            : invite?.status === "accepted"
                              ? "It has already been accepted."
                              : "It has expired. Ask a workspace admin for a new one."
                    }
                />
                <Button onClick={() => navigate("/", { replace: true })}>Go to Pereskia</Button>
            </OnboardingLayout>
        )
    }

    const intro = (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-(--pk-divider) p-3">
            <Avatar name={invite.invitedBy} size={32} />
            <p className="text-sm text-(--pk-text-secondary)">
                <span className="font-medium text-(--pk-text)">{invite.invitedBy}</span> invited you to join{" "}
                <span className="font-medium text-(--pk-text)">{invite.workspaceName}</span> as {invite.role === "admin" ? "an admin" : "a member"}.
            </p>
        </div>
    )

    if (!me) {
        return (
            <OnboardingLayout>
                <OnboardingTitle title={`Join ${invite.workspaceName}`} />
                {intro}
                {invite.hasAccount ? (
                    <LoginForm email={invite.email} onSuccess={() => accept.mutate(token)} />
                ) : (
                    <SignupForm
                        email={invite.email}
                        inviteToken={token}
                        submitLabel="Create account and join"
                        onSuccess={() => navigate("/", { replace: true })}
                    />
                )}
                {accept.error && <ErrorText className="mt-4">{errorMessage(accept.error)}</ErrorText>}
            </OnboardingLayout>
        )
    }

    const wrongAccount = me.email !== invite.email

    return (
        <OnboardingLayout>
            <OnboardingTitle title={`Join ${invite.workspaceName}`} />
            {intro}
            {wrongAccount ? (
                <>
                    <ErrorText>
                        This invite was sent to {invite.email}, but you're signed in as {me.email}.
                    </ErrorText>
                    <p className="mt-4 text-sm text-(--pk-text-secondary)">
                        <TextLink onClick={() => logout.mutate(undefined, { onSuccess: () => navigate(`/invite/${token}`, { replace: true }) })}>
                            Log out
                        </TextLink>{" "}
                        and continue as {invite.email}.
                    </p>
                </>
            ) : (
                <>
                    <Button variant="primary" className="w-full" disabled={accept.isPending} onClick={() => accept.mutate(token)}>
                        {accept.isPending && <Spinner />}
                        Join workspace
                    </Button>
                    {accept.error && <ErrorText className="mt-4">{errorMessage(accept.error)}</ErrorText>}
                </>
            )}
        </OnboardingLayout>
    )
}
