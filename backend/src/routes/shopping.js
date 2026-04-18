import { db } from '../db/index.js'
import { shoppingLists, shoppingListItems, shoppingListRecipes, recipes, ingredients } from '../db/schema.js'
import { eq, asc } from 'drizzle-orm'
import { applyCoefficient } from '../utils/calc.js'

export async function shoppingRoutes(app) {

  // ─── GET /api/shopping ───────────────────────────────────────────────────────
  app.get('/api/shopping', async () => {
    return db.select().from(shoppingLists).orderBy(shoppingLists.id)
  })

  // ─── GET /api/shopping/:id ───────────────────────────────────────────────────
  app.get('/api/shopping/:id', async (req, reply) => {
    const id = Number(req.params.id)
    const [list] = await db.select().from(shoppingLists).where(eq(shoppingLists.id, id))
    if (!list) return reply.code(404).send({ error: 'Liste introuvable' })

    const items = await db.select().from(shoppingListItems)
      .where(eq(shoppingListItems.shoppingListId, id))
      .orderBy(asc(shoppingListItems.position))

    const linkedRecipes = await db.select().from(shoppingListRecipes)
      .where(eq(shoppingListRecipes.shoppingListId, id))

    return { ...list, items, linkedRecipes }
  })

  // ─── POST /api/shopping ──────────────────────────────────────────────────────
  app.post('/api/shopping', async (req, reply) => {
    const { name, type = 'mixed' } = req.body
    if (!name) return reply.code(400).send({ error: 'Nom requis' })
    const [list] = await db.insert(shoppingLists).values({ name, type }).returning()
    return reply.code(201).send(list)
  })

  // ─── PATCH /api/shopping/:id ─────────────────────────────────────────────────
  app.patch('/api/shopping/:id', async (req, reply) => {
    const id = Number(req.params.id)
    const { name } = req.body
    const [updated] = await db.update(shoppingLists).set({ name, updatedAt: new Date() }).where(eq(shoppingLists.id, id)).returning()
    return updated
  })

  // ─── DELETE /api/shopping/:id ────────────────────────────────────────────────
  app.delete('/api/shopping/:id', async (req, reply) => {
    const id = Number(req.params.id)
    await db.delete(shoppingLists).where(eq(shoppingLists.id, id))
    return reply.code(204).send()
  })

  // ─── POST /api/shopping/:id/generate ────────────────────────────────────────
  // Génère les articles depuis les recettes liées (fusion automatique)
  app.post('/api/shopping/:id/generate', async (req, reply) => {
    const listId = Number(req.params.id)
    const { recipeEntries } = req.body // [{ recipeId, coefficient }]

    // Fusionner les ingrédients par nom
    const fusioned = new Map()

    for (const entry of (recipeEntries || [])) {
      const ingList = await db.select().from(ingredients).where(eq(ingredients.recipeId, entry.recipeId))
      const scaled = applyCoefficient(ingList, entry.coefficient || 1)

      for (const ing of scaled) {
        const key = ing.name?.toLowerCase().trim()
        if (!key) continue
        if (fusioned.has(key)) {
          fusioned.get(key).quantityG += ing.quantityG
        } else {
          fusioned.set(key, { name: ing.name, quantityG: ing.quantityG, recipeId: entry.recipeId })
        }
      }

      // Enregistrer la liaison recette ↔ liste
      await db.insert(shoppingListRecipes).values({
        shoppingListId: listId,
        recipeId: entry.recipeId,
        coefficient: entry.coefficient || 1
      }).onConflictDoNothing()
    }

    // Supprimer les anciens articles auto-générés (avec recipeId) et réinsérer
    await db.delete(shoppingListItems)
      .where(eq(shoppingListItems.shoppingListId, listId))

    const newItems = []
    let position = 0
    for (const [, item] of fusioned) {
      newItems.push({ shoppingListId: listId, name: item.name, quantityG: item.quantityG, recipeId: item.recipeId, position: position++ })
    }

    if (newItems.length) {
      await db.insert(shoppingListItems).values(newItems)
    }

    const items = await db.select().from(shoppingListItems)
      .where(eq(shoppingListItems.shoppingListId, listId))
      .orderBy(asc(shoppingListItems.position))

    return items
  })

  // ─── POST /api/shopping/:id/items ────────────────────────────────────────────
  app.post('/api/shopping/:id/items', async (req, reply) => {
    const shoppingListId = Number(req.params.id)
    const { name, quantityG } = req.body
    if (!name) return reply.code(400).send({ error: 'Nom requis' })

    const existing = await db.select().from(shoppingListItems).where(eq(shoppingListItems.shoppingListId, shoppingListId))
    const position = existing.length

    const [item] = await db.insert(shoppingListItems).values({ shoppingListId, name, quantityG: quantityG ?? null, position }).returning()
    return reply.code(201).send(item)
  })

  // ─── PATCH /api/shopping/:id/items/:itemId ───────────────────────────────────
  app.patch('/api/shopping/:id/items/:itemId', async (req, reply) => {
    const itemId = Number(req.params.itemId)
    const { name, quantityG, checked, position } = req.body

    const updates = {}
    if (name !== undefined)      updates.name = name
    if (quantityG !== undefined) updates.quantityG = quantityG
    if (checked !== undefined)   updates.checked = checked
    if (position !== undefined)  updates.position = position

    const [updated] = await db.update(shoppingListItems).set(updates).where(eq(shoppingListItems.id, itemId)).returning()
    return updated
  })

  // ─── DELETE /api/shopping/:id/items/:itemId ──────────────────────────────────
  app.delete('/api/shopping/:id/items/:itemId', async (req, reply) => {
    const itemId = Number(req.params.itemId)
    await db.delete(shoppingListItems).where(eq(shoppingListItems.id, itemId))
    return reply.code(204).send()
  })

  // ─── DELETE /api/shopping/:id/items/checked ──────────────────────────────────
  app.delete('/api/shopping/:id/items/checked', async (req, reply) => {
    const shoppingListId = Number(req.params.id)
    await db.delete(shoppingListItems)
      .where(eq(shoppingListItems.shoppingListId, shoppingListId))
    return reply.code(204).send()
  })
}
