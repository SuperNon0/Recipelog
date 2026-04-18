import { db } from '../db/index.js'
import { shareTokens, recipes, ingredients, stepsBlock, cookbooks, cookbooksRecipes, pdfTemplates } from '../db/schema.js'
import { eq, and, isNull } from 'drizzle-orm'
import { generateRecipePDF, generateCookbookPDF } from '../utils/pdf.js'
import { totalMass } from '../utils/calc.js'

export async function publicRoutes(app) {

  // ─── GET /p/:token — vue publique ─────────────────────────────────────────────
  app.get('/p/:token', async (req, reply) => {
    const { token } = req.params

    const [share] = await db.select().from(shareTokens)
      .where(and(eq(shareTokens.token, token), isNull(shareTokens.revokedAt)))

    if (!share) return reply.code(404).send({ error: 'Lien introuvable ou révoqué' })

    if (share.entityType === 'recipe') {
      const [recipe] = await db.select().from(recipes).where(eq(recipes.id, share.entityId))
      if (!recipe) return reply.code(404).send({ error: 'Recette introuvable' })

      const ingList = await db.select().from(ingredients).where(eq(ingredients.recipeId, recipe.id))
      const [steps] = await db.select().from(stepsBlock).where(eq(stepsBlock.recipeId, recipe.id))

      return {
        type: 'recipe',
        data: {
          ...recipe,
          ingredients: ingList,
          stepsContent: steps?.content || '',
          masseTotale: totalMass(ingList)
        }
      }
    }

    if (share.entityType === 'cookbook') {
      const [cb] = await db.select().from(cookbooks).where(eq(cookbooks.id, share.entityId))
      if (!cb) return reply.code(404).send({ error: 'Cahier introuvable' })

      return { type: 'cookbook', data: cb }
    }

    return reply.code(404).send({ error: 'Type inconnu' })
  })

  // ─── GET /p/:token/pdf ────────────────────────────────────────────────────────
  app.get('/p/:token/pdf', async (req, reply) => {
    const { token } = req.params
    const { template = 'classique', format = 'A4' } = req.query

    const [share] = await db.select().from(shareTokens)
      .where(and(eq(shareTokens.token, token), isNull(shareTokens.revokedAt)))

    if (!share) return reply.code(404).send({ error: 'Lien introuvable ou révoqué' })

    if (share.entityType === 'recipe') {
      const [recipe] = await db.select().from(recipes).where(eq(recipes.id, share.entityId))
      if (!recipe) return reply.code(404).send({ error: 'Recette introuvable' })

      const ingList = await db.select().from(ingredients).where(eq(ingredients.recipeId, recipe.id))
      const [steps] = await db.select().from(stepsBlock).where(eq(stepsBlock.recipeId, recipe.id))
      recipe.ingredients = ingList
      recipe.stepsContent = steps?.content || ''

      const pdf = await generateRecipePDF(recipe, template, format)
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${recipe.name}.pdf"`)
        .send(pdf)
    }

    return reply.code(400).send({ error: 'PDF de cahier non supporté via lien public' })
  })
}
