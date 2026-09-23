import { useState } from "react"
import { cn } from "cn"
import { Check } from "lucide-react"
import type { ConnectionInput, Provider } from "@/api/types"
import { CheckboxLabel, Field, Input, Segmented } from "@/components/pereskia"
import { PROVIDER_INFO } from "./connection-info"

export function ProviderMark({ provider, size = 28 }: { provider: Provider; size?: number }) {
    const { icon: Icon, color } = PROVIDER_INFO[provider]
    return (
        <span className="flex shrink-0 items-center justify-center rounded-md text-white" style={{ background: color, width: size, height: size }}>
            <Icon style={{ width: size * 0.55, height: size * 0.55 }} strokeWidth={2} />
        </span>
    )
}

const PLACEHOLDER_URL: Record<Exclude<Provider, "sqlite">, string> = {
    postgres: "postgres://user:password@localhost:5432/database",
    mysql: "mysql://user:password@localhost:3306/database",
    supabase: "postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres",
}

export function ConnectionForm({
    value,
    onChange,
    sqlitePlaceholder,
}: {
    value: ConnectionInput
    onChange: (value: ConnectionInput) => void
    sqlitePlaceholder: string
}) {
    const [mode, setMode] = useState<"fields" | "url">(value.provider === "supabase" || value.url ? "url" : "fields")
    const set = (patch: Partial<ConnectionInput>) => onChange({ ...value, ...patch })
    const info = PROVIDER_INFO[value.provider]

    const pickProvider = (provider: Provider) => {
        setMode(provider === "supabase" ? "url" : "fields")
        onChange({
            provider,
            port: PROVIDER_INFO[provider].defaultPort,
            host: provider === "sqlite" ? undefined : "localhost",
            ssl: provider === "supabase",
        })
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2">
                {(Object.keys(PROVIDER_INFO) as Provider[]).map((id) => {
                    const p = PROVIDER_INFO[id]
                    const selected = value.provider === id
                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => pickProvider(id)}
                            className={cn(
                                "relative flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                                selected
                                    ? "border-(--pk-blue) bg-(--pk-blue-soft) shadow-[0_0_0_1px_var(--pk-blue)]"
                                    : "border-(--pk-input-border) hover:bg-(--pk-hover)",
                            )}
                        >
                            <ProviderMark provider={id} />
                            <span className="min-w-0">
                                <span className="block text-sm font-medium">{p.name}</span>
                                <span className="block truncate text-xs text-(--pk-text-secondary)">{p.description}</span>
                            </span>
                            {selected && <Check className="absolute top-2 right-2 size-3.5 text-(--pk-blue)" strokeWidth={3} />}
                        </button>
                    )
                })}
            </div>

            {value.provider === "sqlite" ? (
                <Field label="Database file" hint="Absolute path on the server running the backend.">
                    <Input value={value.filename ?? ""} onChange={(e) => set({ filename: e.target.value })} placeholder={sqlitePlaceholder} />
                </Field>
            ) : (
                <div className="flex flex-col gap-3">
                    <Segmented
                        value={mode}
                        options={[
                            { value: "fields", label: "Parameters" },
                            { value: "url", label: "Connection string" },
                        ]}
                        onChange={(m) => {
                            setMode(m)
                            set(m === "url" ? { host: undefined } : { url: undefined, host: value.host ?? "localhost" })
                        }}
                    />

                    {mode === "url" ? (
                        <Field
                            label="Connection string"
                            hint={
                                value.provider === "supabase"
                                    ? "Supabase dashboard → Connect → Session pooler URI. Replace [password] with your database password."
                                    : undefined
                            }
                        >
                            <Input
                                value={value.url ?? ""}
                                onChange={(e) => set({ url: e.target.value })}
                                placeholder={PLACEHOLDER_URL[value.provider]}
                                spellCheck={false}
                            />
                        </Field>
                    ) : (
                        <div className="grid grid-cols-[1fr_96px] gap-3">
                            <Field label="Host">
                                <Input
                                    value={value.host ?? ""}
                                    onChange={(e) => set({ host: e.target.value })}
                                    placeholder={value.provider === "supabase" ? "db.[project-ref].supabase.co" : "localhost"}
                                />
                            </Field>
                            <Field label="Port">
                                <Input
                                    type="number"
                                    value={value.port ?? ""}
                                    onChange={(e) => set({ port: e.target.value ? Number(e.target.value) : undefined })}
                                    placeholder={String(info.defaultPort)}
                                />
                            </Field>
                            <Field label="Database" className="col-span-2">
                                <Input
                                    value={value.database ?? ""}
                                    onChange={(e) => set({ database: e.target.value })}
                                    placeholder={value.provider === "supabase" ? "postgres" : "pereskia"}
                                />
                            </Field>
                            <Field label="User">
                                <Input value={value.user ?? ""} onChange={(e) => set({ user: e.target.value })} autoComplete="off" />
                            </Field>
                            <span />
                            <Field label="Password" className="col-span-2">
                                <Input
                                    type="password"
                                    value={value.password ?? ""}
                                    onChange={(e) => set({ password: e.target.value })}
                                    autoComplete="new-password"
                                />
                            </Field>
                        </div>
                    )}

                    {value.provider !== "supabase" && (
                        <CheckboxLabel checked={!!value.ssl} onChange={(ssl) => set({ ssl })}>
                            Require SSL/TLS
                        </CheckboxLabel>
                    )}
                </div>
            )}
        </div>
    )
}
