import type { ReactNode } from "react"
import { cn } from "cn"
import { Check } from "lucide-react"
import { BlocksMockup, DatabaseMockup, MembersMockup, WizardMockup } from "./mockups"

function Section({
    id,
    eyebrow,
    title,
    description,
    points,
    mockup,
    flip,
}: {
    id?: string
    eyebrow: string
    title: string
    description: string
    points: string[]
    mockup: ReactNode
    flip?: boolean
}) {
    return (
        <section id={id} className="mx-auto w-full max-w-280 px-6 py-14 sm:py-20">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                <div className={cn("min-w-0", flip && "lg:order-2")}>
                    <div className="text-xs font-semibold tracking-wide text-(--pk-blue) uppercase">{eyebrow}</div>
                    <h2 className="mt-3 text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.15] font-bold tracking-[-0.015em] text-balance text-(--pk-text)">
                        {title}
                    </h2>
                    <p className="mt-4 text-[16px] leading-relaxed text-pretty text-(--pk-text-secondary)">{description}</p>

                    <ul className="mt-6 space-y-2.5">
                        {points.map((point) => (
                            <li key={point} className="flex items-start gap-2.5 text-[15px] text-(--pk-text)">
                                <span className="mt-0.5 flex size-4.5 shrink-0 items-center justify-center rounded-full bg-(--pk-blue-soft)">
                                    <Check className="size-3 text-(--pk-blue)" strokeWidth={3} />
                                </span>
                                {point}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className={cn("min-w-0", flip && "lg:order-1")}>{mockup}</div>
            </div>
        </section>
    )
}

export function FeatureSections() {
    return (
        <>
            <Section
                id="features"
                eyebrow="Setup"
                title="Pick where your data lives, in three steps."
                description="The first time you open Pereskia it asks one question: which database. SQLite needs nothing at all; Postgres, MySQL and Supabase take a host and a password. Tables are created for you on startup."
                points={[
                    "SQLite, PostgreSQL, MySQL or Supabase",
                    "Test the connection before you commit to it",
                    "Skip the wizard entirely with DATABASE_URL",
                ]}
                mockup={<WizardMockup />}
            />

            <Section
                eyebrow="Databases"
                title="Databases that live inside your pages."
                description="Not a separate tool bolted on — a table is a block. Drop one into any page, give it the properties you need, then filter and sort it without leaving the document."
                points={[
                    "Text, number, select, status, date and checkbox properties",
                    "Filter and sort per view",
                    "Import existing tables from any Postgres, MySQL or SQLite database",
                ]}
                mockup={<DatabaseMockup />}
                flip
            />

            <Section
                eyebrow="Editor"
                title="Every block you'd expect, and nothing to learn."
                description="Headings, paragraphs, to-dos, inline databases and full sub-pages. Type slash, pick a block, keep writing — the same muscle memory your team already has."
                points={[
                    "Slash menu for every block type",
                    "Nested pages and inline databases",
                    "Autosaves as you type, with an explicit saved state",
                ]}
                mockup={<BlocksMockup />}
            />

            <Section
                id="teams"
                eyebrow="Teams"
                title="Invite the team. Keep the roles straight."
                description="Owners, admins and members, with invitations by email or a link you share yourself. Turn signup off entirely and the instance becomes invite-only."
                points={[
                    "Owner, admin and member roles",
                    "Email invites via Resend or any SMTP server",
                    "ALLOW_SIGNUP=false makes it invite-only",
                ]}
                mockup={<MembersMockup />}
                flip
            />
        </>
    )
}

const COMMANDS = [
    { prompt: "git clone git@github.com:zubeyranwar/pereskia.git", comment: null },
    { prompt: "docker compose up -d", comment: "→ http://localhost:3000" },
]

export function SelfHosting() {
    return (
        <section id="self-hosting" className="mx-auto w-full max-w-280 px-6 py-14 sm:py-20">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                <div className="min-w-0">
                    <div className="text-xs font-semibold tracking-wide text-(--pk-blue) uppercase">Self-hosting</div>
                    <h2 className="mt-3 text-[clamp(1.75rem,3.5vw,2.5rem)] leading-[1.15] font-bold tracking-[-0.015em] text-balance text-(--pk-text)">
                        Two commands on a box you already own.
                    </h2>
                    <p className="mt-4 text-[16px] leading-relaxed text-pretty text-(--pk-text-secondary)">
                        One container serves the API and the built frontend. Without Docker it's a Bun process behind
                        nginx — no queue, no worker, no Redis to keep alive.
                    </p>
                    <p className="mt-4 text-[15px] text-(--pk-text-secondary)">
                        Your pages never leave your server, and backing them up is whatever you already do for that
                        database.
                    </p>
                </div>

                <div className="min-w-0">
                    <div className="overflow-hidden rounded-xl bg-[rgb(25,25,25)] shadow-(--pk-popover-shadow)">
                        <div className="flex h-9 items-center gap-1.5 border-b border-white/8 px-3.5">
                            <span className="size-2.5 rounded-full bg-white/15" />
                            <span className="size-2.5 rounded-full bg-white/15" />
                            <span className="size-2.5 rounded-full bg-white/15" />
                        </div>
                        <div className="overflow-x-auto px-4 py-4 font-mono text-[13px] leading-[1.9]">
                            {COMMANDS.map((command) => (
                                <div key={command.prompt} className="whitespace-nowrap">
                                    <span className="text-white/35 select-none">$ </span>
                                    <span className="text-white/90">{command.prompt}</span>
                                    {command.comment && <span className="text-white/35">  {command.comment}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}
