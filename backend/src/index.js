import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdir } from 'fs/promises'

import { recipesRoutes } from './routes/recipes.js'
import { cookbooksRoutes } from './routes/cookbooks.js'
import { shoppingRoutes } from './routes/shopping.js'
import { settingsRoutes } from './routes/settings.js'
import { publicRoutes } from './routes/public.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined
  }
})

// ─── Plugins ───────────────────────────────────────────────────────────────────

await app.register(cors, {
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.PUBLIC_URL]
    : true
})

await app.register(multipart, {
  limits: { fileSize: (Number(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024 }
})

// Serveur de fichiers statiques (uploads)
const uploadDir = process.env.UPLOAD_DIR || join(__dirname, '../../uploads')
await mkdir(uploadDir, { recursive: true })

await app.register(fastifyStatic, {
  root: uploadDir,
  prefix: '/uploads/',
  decorateReply: false
})

// ─── Upload d'image ─────────────────────────────────────────────────────────────

app.post('/api/upload', async (req, reply) => {
  const data = await req.file()
  if (!data) return reply.code(400).send({ error: 'Aucun fichier reçu' })

  const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!allowedMime.includes(data.mimetype)) {
    return reply.code(400).send({ error: 'Format de fichier non supporté' })
  }

  const ext = data.filename.split('.').pop()
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const filepath = join(uploadDir, filename)

  const { writeFile } = await import('fs/promises')
  await writeFile(filepath, await data.toBuffer())

  return { path: `/uploads/${filename}` }
})

// ─── Routes ────────────────────────────────────────────────────────────────────

await app.register(recipesRoutes)
await app.register(cookbooksRoutes)
await app.register(shoppingRoutes)
await app.register(settingsRoutes)
await app.register(publicRoutes)

// ─── Démarrage ─────────────────────────────────────────────────────────────────

const port = Number(process.env.PORT) || 3001
const host = process.env.HOST || '0.0.0.0'

try {
  await app.listen({ port, host })
  console.log(`RecipeLog backend démarré sur http://${host}:${port}`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
