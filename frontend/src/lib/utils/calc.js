/**
 * Calcule le coefficient selon le mode de multiplication (côté client)
 */
export function computeCoefficient(mode, value, recipe, pivotIngredientId = null) {
  if (!recipe || !recipe.ingredients) return 1

  if (mode === 'coefficient') return Number(value) || 1

  if (mode === 'masse_totale') {
    const total = recipe.ingredients.reduce((s, i) => s + (i.quantityG || 0), 0)
    return total ? (Number(value) || 0) / total : 1
  }

  if (mode === 'ingredient_pivot' && pivotIngredientId) {
    const pivot = recipe.ingredients.find(i => i.id === pivotIngredientId)
    return pivot?.quantityG ? (Number(value) || 0) / pivot.quantityG : 1
  }

  return 1
}

/**
 * Applique un coefficient à une liste d'ingrédients
 */
export function applyCoeff(ingredients, coef) {
  return ingredients.map(i => ({
    ...i,
    quantityG: Math.round(i.quantityG * coef * 100) / 100
  }))
}

/**
 * Masse totale d'une liste d'ingrédients
 */
export function totalMass(ingredients) {
  return ingredients?.reduce((s, i) => s + (i.quantityG || 0), 0) ?? 0
}

/**
 * Formate un nombre en grammes avec arrondi propre
 */
export function formatGrams(g) {
  if (g === null || g === undefined) return '—'
  return Number.isInteger(g) ? `${g}` : g.toFixed(1).replace('.0', '')
}
