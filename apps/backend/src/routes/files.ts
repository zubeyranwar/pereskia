import { Elysia, t } from "elysia"
import { HttpError, authPlugin, requirePageAccess, requireRole } from "../auth"

const MAX_SIZE = 25 * 1024 * 1024
const PREFIX = "pereskia"

let client: Bun.S3Client | null = null

function s3() {
    const { OBJECT_STORE_URL, OBJECT_STORE_ACCESS_KEY, OBJECT_STORE_SECRET_KEY, OBJECT_STORE_BUCKET } = process.env
    if (!OBJECT_STORE_URL || !OBJECT_STORE_ACCESS_KEY || !OBJECT_STORE_SECRET_KEY || !OBJECT_STORE_BUCKET) {
        throw new HttpError(503, "File uploads aren't configured on this server.")
    }
    client ??= new Bun.S3Client({
        endpoint: OBJECT_STORE_URL,
        accessKeyId: OBJECT_STORE_ACCESS_KEY,
        secretAccessKey: OBJECT_STORE_SECRET_KEY,
        bucket: OBJECT_STORE_BUCKET,
    })
    return client
}

const sanitize = (name: string) =>
    name.trim().replace(/\s+/g, "_").replace(/[^\w.-]/g, "").slice(-100) || "file"

const asciiName = (name: string) => name.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "")

export const fileRoutes = new Elysia({ prefix: "/api" })
    .use(authPlugin)
    .post(
        "/pages/:id/files",
        async ({ params, body, user }) => {
            const workspaceId = await requirePageAccess(user.id, params.id)
            const { file } = body
            if (file.size > MAX_SIZE) throw new HttpError(413, "Files can be at most 25 MB.")
            const key = `${PREFIX}/${workspaceId}/${params.id}/${crypto.randomUUID()}/${sanitize(file.name)}`
            const type = file.type || "application/octet-stream"
            await s3().write(key, file, { type })
            return { key, name: file.name, size: file.size, type }
        },
        {
            auth: true,
            body: t.Object({ file: t.File() }),
        },
    )
    .get(
        "/files",
        async ({ query, user, redirect }) => {
            const parts = query.key.split("/")
            if (parts[0] !== PREFIX || parts.length < 5 || parts.includes("..")) throw new HttpError(404, "File not found")
            await requireRole(user.id, parts[1])
            const name = query.name ?? parts[parts.length - 1]
            const disposition = query.download
                ? `attachment; filename="${asciiName(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`
                : "inline"
            const url = s3().presign(query.key, { expiresIn: 60 * 60, contentDisposition: disposition })
            return redirect(url, 302)
        },
        {
            auth: true,
            query: t.Object({
                key: t.String(),
                name: t.Optional(t.String()),
                download: t.Optional(t.BooleanString()),
            }),
        },
    )
