# pereskia

Pereskia is a self-hostable team workspace: pages, inline and full-page databases,
with filtering and sorting. Your data lives in SQLite, PostgreSQL, MySQL or
Supabase.

## Development

```bash
bun install
bun run dev          # backend on :3000, frontend on :5173 (proxies /api)
```

Open the frontend; on first run a setup wizard asks where to store data and
creates the admin account.

## Self-hosting

### Docker

```bash
docker compose up -d   # http://localhost:3000
```

### Without Docker

```bash
bun install
bun run build
bun run start          # serves the API and the built frontend on :3000
```

### Choosing a database

Either pick one in the setup wizard on first visit (saved to
`apps/backend/data/config.json`, or `$DATA_DIR/config.json`), or configure it
with environment variables, which skips the wizard:

| Variable            | Example                                         |
| ------------------- | ----------------------------------------------- |
| `DATABASE_URL`      | `postgres://user:pass@host:5432/pereskia`       |
|                     | `mysql://user:pass@host:3306/pereskia`          |
|                     | `sqlite:///data/pereskia.db`                    |
| `DATABASE_PROVIDER` | Optional: `postgres`, `mysql`, `sqlite`, `supabase` |
| `DATABASE_SSL`      | `true` to require TLS                           |
| `DATA_DIR`          | Where SQLite files and `config.json` live       |
| `PORT`              | HTTP port (default `3000`)                      |

Tables are created automatically on startup.

### Importing existing data

Sidebar → **Import** connects to any PostgreSQL, MySQL, SQLite or Supabase
database, lists its tables, previews one, and imports it (up to 5,000 rows) as a
database page. Column types become Pereskia property types (numbers, dates,
checkboxes, selects).

### Accounts and teams

The first account is created during setup and owns the first workspace.
Anyone can then create their own account from the login screen and start
their own workspaces. To bring people into a workspace, owners and admins
invite them from **Settings → Members**. If email is set up (in the setup
wizard, in **Settings → Email** for the server owner, or with the variables
below) the invitation is emailed; the link is also shown so it can be shared directly (valid once,
for 7 days, for that email address only). Set `ALLOW_SIGNUP=false` to
make sign-up invite-only.

| Role   | Can                                                             |
| ------ | --------------------------------------------------------------- |
| Owner  | Everything; can't be removed                                    |
| Admin  | Invite and remove members, change roles, import, rename         |
| Member | View, create and edit pages                                     |

| Variable        | Purpose                                                      |
| --------------- | ------------------------------------------------------------ |
| `ALLOW_SIGNUP`  | `false` makes sign-up invite-only (default: open)            |
| `APP_URL`       | Public URL used in emailed links, e.g. `https://notes.example.com` (default: the inviting admin's browser origin) |
| `RESEND_API_KEY` | [Resend](https://resend.com) API key; enables invitation emails |
| `SMTP_URL`      | Instead of Resend: `smtps://user:pass@smtp.example.com:465`   |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_SECURE` | Alternative to `SMTP_URL` (port defaults to 587; TLS on 465) |
| `MAIL_FROM`     | Sender, e.g. `Pereskia <invites@example.com>` (with Resend, on a verified domain) |
| `COOKIE_SECURE` | `true` forces the `Secure` cookie flag (auto-detected on HTTPS) |
| `CORS_ORIGIN`   | Comma-separated origins, only if the frontend is served elsewhere |

Passwords are hashed with argon2id; sessions are httpOnly cookies that last
30 days.
