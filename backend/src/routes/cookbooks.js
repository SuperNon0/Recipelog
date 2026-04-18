import { db } from '../db/index.js'
import { cookbooks, cookbooksRecipes, recipes, ingredients, stepsBlock, subRecipes, pdfTemplates, shareTokens } from '../db/schema.js'
import { eq, asc, desc } from 'drizzle-orm'
import { generateCookbookPDF } from '../utils/pdf.js'
import { totalMass, resolveSubRecipe } from '../utils/calc.js'
import { nanoid } from 'nanoid'

export async function cookbooksRoutes(app) {

  // ─── GET /api/cookbooks ──────────────────────────────────────────────────────
  app.get('/api/cookbooks', async () => {
    const list = await db.select().from(cookbooks).orderBy(desc(cookbooks.updatedAt))
    for (const cb of list) {
      const rows = await db.select().from(cookbooksRecipes).where(eq(cookbooksRecipes.cookbookId, cb.id))
      cb.recipesCount = rows.length
    }
    return list
  })

  // ─── GET /api/cookbooks/:id ──────────────────────────────────────────────────
  app.get('/api/cookbooks/:id', async (req, reply) => {
    const id = Number(req.params.id)
    const [cb] = await db.select().from(cookbooks).where(eq(cookbooks.id, id))
    if (!cb) return reply.code(404).send({ error: 'Cahier introuvable' })

    const [template] = cb.templateId
      ? await db.select().from(pdfTemplates).where(eq(pdfTemplates.id, cb.templateId))
      : [null]

    const entries = await db.select().from(cookbooksRecipes)
      .where(eq(cookbooksRecipes.cookbookId, id))
      .orderBy(asc(cookbooksRecipes.position))

    const enrichedEntries = []
    for (const entry of entries) {
      const [recipe] = await db.select().from(recipes).where(eq(recipes.id, entry.recipeId))
      if (!recipe) continue
      enrichedEntries.push({
        ...entry,
        recipe: { id: recipe.id, name: recipe.name, photoPath: recipe.photoPath }
      })
    }

    return { ...cb, template, entries: enrichedEntries }
  })

  // ─── POST /api/cookbooks ─────────────────────────────────────────────────────
  app.post('/api/cookbooks', async (req, reply) => {
    const { name, description, format, templateId } = req.body
    if (!name) return reply.code(400).send({ error: 'Nom requis' })

    const [cb] = await db.insert(cookbooks).values({
      name, description, format: format || 'A4', templateId: templateId || null
    }).returning()

    return reply.code(201).send(cb)
  })

  // ─── PATCH /api/cookbooks/:id ────────────────────────────────────────────────
  app.patch('/api/cookbooks/:id', async (req, reply) => {
    const id = Number(req.params.id)
    const { name, description, format, templateId, hasToc, hasCover, coverConfig, hasLogo, pageNumberingConfig, footer } = req.body

    const updates = { updatedAt: new Date() }
    if (name !== undefined)               updates.name = name
    if (description !== undefined)        updates.description = description
    if (format !== undefined)             updates.format = format
    if (templateId !== undefined)         updates.templateId = templateId
    if (hasToc !== undefined)             updates.hasToc = hasToc
    if (hasCover !== undefined)           updates.hasCover = hasCover
    if (coverConfig !== undefined)        updates.coverConfig = coverConfig
    if (hasLogo !== undefined)            updates.hasLogo = hasLogo
    if (pageNumberingConfig !== undefined) updates.pageNumberingConfig = pageNumberingConfig
    if (footer !== undefined)             updates.footer = footer

    const [updated] = await db.update(cookbooks).set(updates).where(eq(cookbooks.id, id)).returning()
    return updated
  })

  // ─── DELETE /api/cookbooks/:id ───────────────────────────────────────────────
  app.delete('/api/cookbooks/:id', async (req, reply) => {
    const id = Number(req.params.id)
    await db.delete(cookbooks).where(eq(cookbooks.id, id))
    return reply.code(204).send()
  })

  // ─── POST /api/cookbooks/:id/recipes ─────────────────────────────────────────
  // Ajouter une recette à un cahier
  app.post('/api/cookbooks/:id/recipes', async (req, reply) => {
    const cookbookId = Number(req.params.id)
    const { recipeId, linkMode = 'linked', subrecipeMode = 'single' } = req.body

    if (!recipeId) return reply.code(400).send({ error: 'recipeId requis' })

    // Prochaine position
    const entries = await db.select({ pos: cookbooksRecipes.position })
      .from(cookbooksRecipes).where(eq(cookbooksRecipes.cookbookId, cookbookId))
    const position = entries.length ? Math.max(...entries.map(e => e.pos)) + 1 : 0

    let snapshotData = null
    let snapshotDate = null

    if (linkMode === 'snapshot') {
      // Créer un snapshot de la recette
      const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId))
      const ingList = await db.select().from(ingredients).where(eq(ingredients.recipeId, recipeId))
      const [steps] = await db.select().from(stepsBlock).where(eq(stepsBlock.recipeId, recipeId))
      const subList = await db.select().from(subRecipes).where(eq(subRecipes.parentId, recipeId))

      const resolvedSubs = []
      for (const sub of subList) {
        const [child] = await db.select().from(recipes).where(eq(recipes.id, sub.childId))
        const childIngs = await db.select().from(ingredients).where(eq(ingredients.recipeId, sub.childId))
        const [childSteps] = await db.select().from(stepsBlock).where(eq(stepsBlock.recipeId, sub.childId))
        child.ingredients = childIngs
        child.stepsContent = childSteps?.content || ''
        resolvedSubs.push(resolveSubRecipe(sub, child, 1))
      }

      snapshotData = {
        ...recipe,
        ingredients: ingList,
        stepsContent: steps?.content || '',
        subRecipes: resolvedSubs
      }
      snapshotDate = new Date()
    }

    const [entry] = await db.insert(cookbooksRecipes).values({
      cookbookId, recipeId, position, linkMode, subrecipeMode, snapshotData, snapshotDate
    }).returning()

    return reply.code(201).send(entry)
  })

  // ─── PATCH /api/cookbooks/:id/recipes/:entryId ───────────────────────────────
  app.patch('/api/cookbooks/:id/recipes/:entryId', async (req, reply) => {
    const entryId = Number(req.params.entryId)
    const { position, linkMode, subrecipeMode } = req.body

    const updates = {}
    if (position !== undefined)     updates.position = position
    if (linkMode !== undefined)     updates.linkMode = linkMode
    if (subrecipeMode !== undefined) updates.subrecipeMode = subrecipeMode

    // Si on passe de snapshot à linked, supprimer les données figées
    if (linkMode === 'linked') {
      updates.snapshotData = null
      updates.snapshotDate = null
    }
    // Si on passe à snapshot, créer un nouveau snapshot
    if (linkMode === 'snapshot') {
      const [cbr] = await db.select().from(cookbooksRecipes).where(eq(cookbooksRecipes.id, entryId))
      const [recipe] = await db.select().from(recipes).where(eq(recipes.id, cbr.recipeId))
      const ingList = await db.select().from(ingredients).where(eq(ingredients.recipeId, cbr.recipeId))
      const [steps] = await db.select().from(stepsBlock).where(eq(stepsBlock.recipeId, cbr.recipeId))
      updates.snapshotData = { ...recipe, ingredients: ingList, stepsContent: steps?.content || '' }
      updates.snapshotDate = new Date()
    }

    const [updated] = await db.update(cookbooksRecipes).set(updates).where(eq(cookbooksRecipes.id, entryId)).returning()
    return updated
  })

  // ─── DELETE /api/cookbooks/:id/recipes/:entryId ──────────────────────────────
  app.delete('/api/cookbooks/:id/recipes/:entryId', async (req, reply) => {
    const entryId = Number(req.params.entryId)
    await db.delete(cookbooksRecipes).where(eq(cookbooksRecipes.id, entryId))
    return reply.code(204).send()
  })

  // ─── GET /api/cookbooks/:id/pdf ──────────────────────────────────────────────
  app.get('/api/cookbooks/:id/pdf', async (req, reply) => {
    const id = Number(req.params.id)

    const [cb] = await db.select().from(cookbooks).where(eq(cookbooks.id, id))
    if (!cb) return reply.code(404).send({ error: 'Cahier introuvable' })

    const [template] = cb.templateId
      ? await db.select().from(pdfTemplates).where(eq(pdfTemplates.id, cb.templateId))
      : [null]

    const entries = await db.select().from(cookbooksRecipes)
      .where(eq(cookbooksRecipes.cookbookId, id))
      .orderBy(asc(cookbooksRecipes.position))

    const recipesData = []
    for (const entry of entries) {
      if (entry.linkMode === 'snapshot' && entry.snapshotData) {
        recipesData.push(entry.snapshotData)
      } else {
        const [recipe] = await db.select().from(recipes).where(eq(recipes.id, entry.recipeId))
        if (!recipe) continue
        const ingList = await db.select().from(ingredients).where(eq(ingredients.recipeId, entry.recipeId))
        const [steps] = await db.select().from(stepsBlock).where(eq(stepsBlock.recipeId, entry.recipeId))
        recipe.ingredients = ingList
        recipe.stepsContent = steps?.content || ''
        recipesData.push(recipe)
      }
    }

    const pdf = await generateCookbookPDF({ ...cb, template }, recipesData, cb.format)

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${cb.name}.pdf"`)
      .send(pdf)
  })

  // ─── Partage public ───────────────────────────────────────────────────────────
  app.post('/api/cookbooks/:id/share', async (req, reply) => {
    const entityId = Number(req.params.id)
    const token = nanoid(12)
    const [share] = await db.insert(shareTokens).values({ token, entityType: 'cookbook', entityId }).returning()
    return { token: share.token, url: `/p/${share.token}` }
  })
}
