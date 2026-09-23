import { Elysia } from 'elysia'
import { cors } from '@elysiajs/cors'
import { join, resolve } from 'node:path'
import { loadConfig } from './config'
import { loadEmailConfig } from './mailer'
import { connectStorage, StorageNotConfigured } from './storage'
import { HttpError } from './auth'
import { setupRoutes } from './routes/setup'
import { authRoutes } from './routes/auth'
import { workspaceRoutes } from './routes/workspaces'
import { memberRoutes } from './routes/members'
import { pageRoutes } from './routes/pages'
import { importRoutes } from './routes/import'
import { instanceRoutes } from './routes/instance'

const config = await loadConfig()
loadEmailConfig(config)
if (config.storage) {
  try {
    await connectStorage(config.storage)
    console.log(`Storage: ${config.storage.provider}`)
  } catch (err) {
    console.error('Could not connect to the configured storage database:', err)
    process.exit(1)
  }
} else {
  console.log('Storage not configured yet — open the app to run setup.')
}

const STATIC_DIR = resolve(process.env.STATIC_DIR ?? join(import.meta.dir, '../../frontend/dist'))
const hasStatic = await Bun.file(join(STATIC_DIR, 'index.html')).exists()

const app = new Elysia()

if (process.env.CORS_ORIGIN) {
  app.use(cors({ origin: process.env.CORS_ORIGIN.split(','), credentials: true }))
}

app
  .onError(({ error, code, set }) => {
    if (error instanceof StorageNotConfigured) {
      set.status = 503
      return { error: error.message, code: 'SETUP_REQUIRED' }
    }
    if (error instanceof HttpError) {
      set.status = error.status
      return { error: error.message }
    }
    if (code === 'VALIDATION') {
      set.status = 422
      return { error: 'Please check the highlighted fields.', details: error.message }
    }
    if (code === 'NOT_FOUND') {
      set.status = 404
      return { error: 'Not found' }
    }
    console.error(error)
    set.status = 500
    return { error: error instanceof Error ? error.message : String(error) }
  })
  .get('/api/health', () => ({ ok: true }))
  .use(setupRoutes)
  .use(authRoutes)
  .use(workspaceRoutes)
  .use(memberRoutes)
  .use(pageRoutes)
  .use(importRoutes)
  .use(instanceRoutes)

if (hasStatic) {
  app.get('/*', async ({ path }) => {
    if (path.startsWith('/api/')) return Response.json({ error: 'Not found' }, { status: 404 })
    const file = Bun.file(join(STATIC_DIR, path))
    if (!path.includes('..') && path !== '/' && (await file.exists())) return file
    return Bun.file(join(STATIC_DIR, 'index.html'))
  })
}

app.listen(Number(process.env.PORT ?? 3000))

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}${hasStatic ? ' (serving frontend)' : ''}`)
