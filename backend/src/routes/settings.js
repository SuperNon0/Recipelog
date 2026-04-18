import { db } from '../db/index.js'
import { settings, categories, ingredientsBase, pdfTemplates, recipes, ingredients, stepsBlock, subRecipes, comments, cookbooks, cookbooksRecipes, shoppingLists, shoppingListItems, shoppingListRecipes, shareTokens } from '../db/schema.js'
import { eq } from 'drizzle-orm'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export async function settingsRoutes(app) {

  // ─── GET /api/settings ───────────────────────────────────────────────────────
  app.get('/api/settings', async () => {
    const rows = await db.select().from(settings)
    return Object.fromEntries(rows.map(r => [r.key, r.value]))
  })

  // ─── PATCH /api/settings ─────────────────────────────────────────────────────
  app.patch('/api/settings', async (req, reply) => {
    const updates = req.body
    for (const [key, value] of Object.entries(updates)) {
      await db.insert(settings).values({ key, value: String(value) })
        .onConflictDoUpdate({ target: settings.key, set: { value: String(value) } })
    }
    const rows = await db.select().from(settings)
    return Object.fromEntries(rows.map(r => [r.key, r.value]))
  })

  // ─── Catégories ──────────────────────────────────────────────────────────────

  app.get('/api/categories', async () => {
    return db.select().from(categories).orderBy(categories.name)
  })

  app.post('/api/categories', async (req, reply) => {
    const { name, color, icon } = req.body
    if (!name) return reply.code(400).send({ error: 'Nom requis' })
    const [cat] = await db.insert(categories).values({ name, color: color || '#e8c547', icon }).returning()
    return reply.code(201).send(cat)
  })

  app.patch('/api/categories/:id', async (req, reply) => {
    const id = Number(req.params.id)
    const { name, color, icon } = req.body
    const updates = {}
    if (name !== undefined)  updates.name = name
    if (color !== undefined) updates.color = color
    if (icon !== undefined)  updates.icon = icon
    const [updated] = await db.update(categories).set(updates).where(eq(categories.id, id)).returning()
    return updated
  })

  app.delete('/api/categories/:id', async (req, reply) => {
    const id = Number(req.params.id)
    await db.delete(categories).where(eq(categories.id, id))
    return reply.code(204).send()
  })

  // ─── Base d'ingrédients ───────────────────────────────────────────────────────

  app.get('/api/ingredients-base', async () => {
    return db.select().from(ingredientsBase).orderBy(ingredientsBase.name)
  })

  app.post('/api/ingredients-base', async (req, reply) => {
    const { name, defaultUnit } = req.body
    if (!name) return reply.code(400).send({ error: 'Nom requis' })
    const [ing] = await db.insert(ingredientsBase).values({ name, defaultUnit: defaultUnit || 'g' }).returning()
    return reply.code(201).send(ing)
  })

  app.delete('/api/ingredients-base/:id', async (req, reply) => {
    const id = Number(req.params.id)
    await db.delete(ingredientsBase).where(eq(ingredientsBase.id, id))
    return reply.code(204).send()
  })

  // ─── Templates PDF ────────────────────────────────────────────────────────────

  app.get('/api/pdf-templates', async () => {
    return db.select().from(pdfTemplates).orderBy(pdfTemplates.id)
  })

  // ─── Export JSON ──────────────────────────────────────────────────────────────

  app.get('/api/export', async () => {
    const allRecipes = await db.select().from(recipes)
    const allIngredients = await db.select().from(ingredients)
    const allSteps = await db.select().from(stepsBlock)
    const allSubRecipes = await db.select().from(subRecipes)
    const allCategories = await db.select().from(categories)
    const allCookbooks = await db.select().from(cookbooks)
    const allCookbooksRecipes = await db.select().from(cookbooksRecipes)
    const allShoppingLists = await db.select().from(shoppingLists)
    const allShoppingItems = await db.select().from(shoppingListItems)
    const allSettings = await db.select().from(settings)

    return {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      data: {
        recipes: allRecipes,
        ingredients: allIngredients,
        stepsBlock: allSteps,
        subRecipes: allSubRecipes,
        categories: allCategories,
        cookbooks: allCookbooks,
        cookbooksRecipes: allCookbooksRecipes,
        shoppingLists: allShoppingLists,
        shoppingListItems: allShoppingItems,
        settings: allSettings
      }
    }
  })

  // ─── Import JSON ──────────────────────────────────────────────────────────────
  // Import basique : ajoute les données sans écraser les existantes
  app.post('/api/import', async (req, reply) => {
    const { data } = req.body

    if (!data) return reply.code(400).send({ error: 'Données manquantes' })

    // Import simplifié — pour la production, un import plus robuste est requis
    if (data.categories?.length) {
      await db.insert(categories).values(data.categories.map(c => ({
        name: c.name, color: c.color, icon: c.icon
      }))).onConflictDoNothing()
    }

    if (data.recipes?.length) {
      for (const r of data.recipes) {
        await db.insert(recipes).values({
          name: r.name, source: r.source, notes: r.notes,
          favorite: r.favorite, rating: r.rating, tags: r.tags
        }).onConflictDoNothing()
      }
    }

    return { imported: true }
  })

  // ─── Healthcheck ──────────────────────────────────────────────────────────────

  app.get('/api/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() }
  })
}
