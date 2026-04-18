import { db } from '../db/index.js'
import { recipes, ingredients, stepsBlock, subRecipes, recipesCategories, comments, categories, variants, shareTokens } from '../db/schema.js'
import { eq, desc, ilike, inArray, and, or } from 'drizzle-orm'
import { resolveSubRecipe, totalMass } from '../utils/calc.js'
import { generateRecipePDF } from '../utils/pdf.js'
import { nanoid } from 'nanoid'

export async function recipesRoutes(app) {

  // ─── GET /api/recipes ────────────────────────────────────────────────────────
  app.get('/api/recipes', async (req, reply) => {
    const { search, tag, categoryId, favorite } = req.query

    let query = db.select().from(recipes)

    const conditions = []
    if (search)     conditions.push(ilike(recipes.name, `%${search}%`))
    if (favorite === 'true') conditions.push(eq(recipes.favorite, true))

    const rows = await db.select().from(recipes)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(recipes.updatedAt))

    // Filtrage par tag (jsonb array)
    let result = rows
    if (tag) {
      result = result.filter(r => Array.isArray(r.tags) && r.tags.includes(tag))
    }

    // Filtrage par catégorie
    if (categoryId) {
      const catRecipes = await db.select({ recipeId: recipesCategories.recipeId })
        .from(recipesCategories)
        .where(eq(recipesCategories.categoryId, Number(categoryId)))
      const ids = catRecipes.map(r => r.recipeId)
      result = result.filter(r => ids.includes(r.id))
    }

    // Ajouter masse totale
    for (const recipe of result) {
      const ingList = await db.select().from(ingredients).where(eq(ingredients.recipeId, recipe.id))
      recipe.masseTotale = totalMass(ingList)
      recipe.ingredientsCount = ingList.length
    }

    return result
  })

  // ─── GET /api/recipes/:id ────────────────────────────────────────────────────
  app.get('/api/recipes/:id', async (req, reply) => {
    const id = Number(req.params.id)

    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id))
    if (!recipe) return reply.code(404).send({ error: 'Recette introuvable' })

    const [steps] = await db.select().from(stepsBlock).where(eq(stepsBlock.recipeId, id))
    const ingList  = await db.select().from(ingredients).where(eq(ingredients.recipeId, id)).orderBy(ingredients.position)
    const cats     = await db.select({ category: categories })
      .from(recipesCategories)
      .leftJoin(categories, eq(recipesCategories.categoryId, categories.id))
      .where(eq(recipesCategories.recipeId, id))
    const comList  = await db.select().from(comments).where(eq(comments.recipeId, id)).orderBy(desc(comments.createdAt))
    const varList  = await db.select().from(variants).where(eq(variants.sourceRecipeId, id))

    // Sous-recettes
    const subList = await db.select().from(subRecipes).where(eq(subRecipes.parentId, id)).orderBy(subRecipes.position)
    const resolvedSubRecipes = []
    for (const sub of subList) {
      const [child] = await db.select().from(recipes).where(eq(recipes.id, sub.childId))
      const childIngs = await db.select().from(ingredients).where(eq(ingredients.recipeId, sub.childId)).orderBy(ingredients.position)
      const [childSteps] = await db.select().from(stepsBlock).where(eq(stepsBlock.recipeId, sub.childId))
      child.ingredients = childIngs
      child.stepsContent = childSteps?.content || ''
      resolvedSubRecipes.push({ ...resolveSubRecipe(sub, child, 1), subRecipeRelId: sub.id })
    }

    return {
      ...recipe,
      stepsContent: steps?.content || '',
      ingredients: ingList,
      categories: cats.map(c => c.category),
      comments: comList,
      variants: varList,
      subRecipes: resolvedSubRecipes,
      masseTotale: totalMass(ingList)
    }
  })

  // ─── POST /api/recipes ───────────────────────────────────────────────────────
  app.post('/api/recipes', async (req, reply) => {
    const { name, source, notes, favorite, rating, tags, categoryIds, stepsContent, ingredientsList } = req.body

    if (!name || name.trim().length === 0) {
      return reply.code(400).send({ error: 'Le nom de la recette est obligatoire' })
    }

    const [recipe] = await db.insert(recipes).values({
      name: name.trim(),
      source, notes,
      favorite: favorite ?? false,
      rating: rating ?? 0,
      tags: tags ?? []
    }).returning()

    // Étapes
    await db.insert(stepsBlock).values({ recipeId: recipe.id, content: stepsContent || '' })

    // Ingrédients
    if (ingredientsList?.length) {
      await db.insert(ingredients).values(
        ingredientsList.map((ing, pos) => ({
          recipeId: recipe.id,
          name: ing.name,
          ingredientBaseId: ing.ingredientBaseId ?? null,
          quantityG: ing.quantityG ?? 0,
          position: pos
        }))
      )
    }

    // Catégories
    if (categoryIds?.length) {
      await db.insert(recipesCategories).values(
        categoryIds.map(catId => ({ recipeId: recipe.id, categoryId: catId }))
      )
    }

    return reply.code(201).send(recipe)
  })

  // ─── PATCH /api/recipes/:id ──────────────────────────────────────────────────
  app.patch('/api/recipes/:id', async (req, reply) => {
    const id = Number(req.params.id)
    const { name, source, notes, favorite, rating, tags, categoryIds, stepsContent, ingredientsList } = req.body

    const [existing] = await db.select().from(recipes).where(eq(recipes.id, id))
    if (!existing) return reply.code(404).send({ error: 'Recette introuvable' })

    const updates = { updatedAt: new Date() }
    if (name !== undefined)     updates.name = name.trim()
    if (source !== undefined)   updates.source = source
    if (notes !== undefined)    updates.notes = notes
    if (favorite !== undefined) updates.favorite = favorite
    if (rating !== undefined)   updates.rating = rating
    if (tags !== undefined)     updates.tags = tags

    const [updated] = await db.update(recipes).set(updates).where(eq(recipes.id, id)).returning()

    if (stepsContent !== undefined) {
      await db.update(stepsBlock).set({ content: stepsContent }).where(eq(stepsBlock.recipeId, id))
    }

    if (ingredientsList !== undefined) {
      await db.delete(ingredients).where(eq(ingredients.recipeId, id))
      if (ingredientsList.length) {
        await db.insert(ingredients).values(
          ingredientsList.map((ing, pos) => ({
            recipeId: id,
            name: ing.name,
            ingredientBaseId: ing.ingredientBaseId ?? null,
            quantityG: ing.quantityG ?? 0,
            position: pos
          }))
        )
      }
    }

    if (categoryIds !== undefined) {
      await db.delete(recipesCategories).where(eq(recipesCategories.recipeId, id))
      if (categoryIds.length) {
        await db.insert(recipesCategories).values(
          categoryIds.map(catId => ({ recipeId: id, categoryId: catId }))
        )
      }
    }

    return updated
  })

  // ─── DELETE /api/recipes/:id ─────────────────────────────────────────────────
  app.delete('/api/recipes/:id', async (req, reply) => {
    const id = Number(req.params.id)
    await db.delete(recipes).where(eq(recipes.id, id))
    return reply.code(204).send()
  })

  // ─── POST /api/recipes/:id/duplicate ────────────────────────────────────────
  app.post('/api/recipes/:id/duplicate', async (req, reply) => {
    const id = Number(req.params.id)
    const [source] = await db.select().from(recipes).where(eq(recipes.id, id))
    if (!source) return reply.code(404).send({ error: 'Recette introuvable' })

    const [newRecipe] = await db.insert(recipes).values({
      name: `${source.name} (copie)`,
      source: source.source,
      notes: source.notes,
      tags: source.tags,
      favorite: false,
      rating: source.rating
    }).returning()

    const srcSteps = await db.select().from(stepsBlock).where(eq(stepsBlock.recipeId, id))
    await db.insert(stepsBlock).values({ recipeId: newRecipe.id, content: srcSteps[0]?.content || '' })

    const srcIngs = await db.select().from(ingredients).where(eq(ingredients.recipeId, id))
    if (srcIngs.length) {
      await db.insert(ingredients).values(srcIngs.map(i => ({
        recipeId: newRecipe.id, name: i.name,
        ingredientBaseId: i.ingredientBaseId, quantityG: i.quantityG, position: i.position
      })))
    }

    return reply.code(201).send(newRecipe)
  })

  // ─── POST /api/recipes/:id/variant ──────────────────────────────────────────
  app.post('/api/recipes/:id/variant', async (req, reply) => {
    const sourceId = Number(req.params.id)
    const { note } = req.body

    const [source] = await db.select().from(recipes).where(eq(recipes.id, sourceId))
    if (!source) return reply.code(404).send({ error: 'Recette introuvable' })

    const [newRecipe] = await db.insert(recipes).values({
      name: `${source.name} (variante)`,
      source: source.source,
      notes: source.notes,
      tags: source.tags
    }).returning()

    const srcSteps = await db.select().from(stepsBlock).where(eq(stepsBlock.recipeId, sourceId))
    await db.insert(stepsBlock).values({ recipeId: newRecipe.id, content: srcSteps[0]?.content || '' })

    const srcIngs = await db.select().from(ingredients).where(eq(ingredients.recipeId, sourceId))
    if (srcIngs.length) {
      await db.insert(ingredients).values(srcIngs.map(i => ({
        recipeId: newRecipe.id, name: i.name,
        ingredientBaseId: i.ingredientBaseId, quantityG: i.quantityG, position: i.position
      })))
    }

    await db.insert(variants).values({ sourceRecipeId: sourceId, variantRecipeId: newRecipe.id, note: note || null })

    return reply.code(201).send(newRecipe)
  })

  // ─── Sous-recettes ───────────────────────────────────────────────────────────

  // POST /api/recipes/:id/sub-recipes
  app.post('/api/recipes/:id/sub-recipes', async (req, reply) => {
    const parentId = Number(req.params.id)
    const { childId, label, calcMode, calcValue, pivotIngredientId } = req.body

    if (!label || !childId) return reply.code(400).send({ error: 'label et childId requis' })

    const maxPos = await db.select({ pos: subRecipes.position })
      .from(subRecipes).where(eq(subRecipes.parentId, parentId))
    const position = maxPos.length ? Math.max(...maxPos.map(r => r.pos)) + 1 : 0

    const [sub] = await db.insert(subRecipes).values({
      parentId, childId,
      label, calcMode: calcMode || 'coefficient',
      calcValue: calcValue ?? 1,
      pivotIngredientId: pivotIngredientId ?? null,
      position
    }).returning()

    return reply.code(201).send(sub)
  })

  // PATCH /api/recipes/:id/sub-recipes/:subId
  app.patch('/api/recipes/:id/sub-recipes/:subId', async (req, reply) => {
    const subId = Number(req.params.subId)
    const { label, calcMode, calcValue, pivotIngredientId, isLocked } = req.body

    const updates = {}
    if (label !== undefined)             updates.label = label
    if (calcMode !== undefined)          updates.calcMode = calcMode
    if (calcValue !== undefined)         updates.calcValue = calcValue
    if (pivotIngredientId !== undefined) updates.pivotIngredientId = pivotIngredientId
    if (isLocked !== undefined)          updates.isLocked = isLocked

    const [updated] = await db.update(subRecipes).set(updates).where(eq(subRecipes.id, subId)).returning()
    return updated
  })

  // DELETE /api/recipes/:id/sub-recipes/:subId
  app.delete('/api/recipes/:id/sub-recipes/:subId', async (req, reply) => {
    const subId = Number(req.params.subId)
    await db.delete(subRecipes).where(eq(subRecipes.id, subId))
    return reply.code(204).send()
  })

  // ─── Commentaires ────────────────────────────────────────────────────────────

  app.post('/api/recipes/:id/comments', async (req, reply) => {
    const recipeId = Number(req.params.id)
    const { content } = req.body
    if (!content) return reply.code(400).send({ error: 'Contenu requis' })
    const [comment] = await db.insert(comments).values({ recipeId, content }).returning()
    return reply.code(201).send(comment)
  })

  app.patch('/api/recipes/:id/comments/:commentId', async (req, reply) => {
    const commentId = Number(req.params.commentId)
    const { content } = req.body
    const [updated] = await db.update(comments)
      .set({ content, updatedAt: new Date() })
      .where(eq(comments.id, commentId)).returning()
    return updated
  })

  app.delete('/api/recipes/:id/comments/:commentId', async (req, reply) => {
    const commentId = Number(req.params.commentId)
    await db.delete(comments).where(eq(comments.id, commentId))
    return reply.code(204).send()
  })

  // ─── PDF ─────────────────────────────────────────────────────────────────────

  app.get('/api/recipes/:id/pdf', async (req, reply) => {
    const id = Number(req.params.id)
    const { template = 'classique', format = 'A4' } = req.query

    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, id))
    if (!recipe) return reply.code(404).send({ error: 'Recette introuvable' })

    const ingList = await db.select().from(ingredients).where(eq(ingredients.recipeId, id))
    const [steps] = await db.select().from(stepsBlock).where(eq(stepsBlock.recipeId, id))
    recipe.ingredients = ingList
    recipe.stepsContent = steps?.content || ''

    const pdf = await generateRecipePDF(recipe, template, format)

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${recipe.name}.pdf"`)
      .send(pdf)
  })

  // ─── Partage public ───────────────────────────────────────────────────────────

  app.post('/api/recipes/:id/share', async (req, reply) => {
    const entityId = Number(req.params.id)
    const token = nanoid(12)
    const [share] = await db.insert(shareTokens).values({ token, entityType: 'recipe', entityId }).returning()
    return { token: share.token, url: `/p/${share.token}` }
  })

  app.delete('/api/recipes/:id/share', async (req, reply) => {
    const entityId = Number(req.params.id)
    await db.update(shareTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(shareTokens.entityId, entityId), eq(shareTokens.entityType, 'recipe')))
    return reply.code(204).send()
  })
}
