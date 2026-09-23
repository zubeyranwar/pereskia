import { useState } from "react"
import { Button, ErrorText, Field, Input, OnboardingLayout, OnboardingTitle, Spinner, TextLink } from "@/components/pereskia"
import { useLogout } from "@/hooks/use-session"
import { useCreateWorkspace } from "@/hooks/use-workspaces"
import { errorMessage } from "@/lib/http"

export function CreateWorkspaceScreen() {
    const [name, setName] = useState("")
    const create = useCreateWorkspace()
    const logout = useLogout()

    return (
        <OnboardingLayout>
            <OnboardingTitle
                title="Create a workspace"
                description="You're not a member of any workspace yet. Create one, or ask an admin to invite you to theirs."
            />
            <form
                onSubmit={(e) => {
                    e.preventDefault()
                    if (name.trim()) create.mutate(name.trim())
                }}
            >
                <Field label="Workspace name">
                    <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc." />
                </Field>
                {create.error && <ErrorText className="mt-4">{errorMessage(create.error)}</ErrorText>}
                <Button type="submit" variant="primary" className="mt-6 w-full" disabled={!name.trim() || create.isPending}>
                    {create.isPending && <Spinner />}
                    Create workspace
                </Button>
            </form>
            <p className="mt-6 text-sm text-(--pk-text-secondary)">
                <TextLink onClick={() => logout.mutate()}>Log out</TextLink>
            </p>
        </OnboardingLayout>
    )
}
