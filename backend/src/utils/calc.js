/**
 * Calcule le coefficient à appliquer selon le mode de multiplication
 *
 * @param {'coefficient'|'masse_totale'|'ingredient_pivot'} mode
 * @param {number} value - valeur saisie par l'utilisateur
 * @param {object} recipe - recette avec ses ingrédients
 * @param {number|null} pivotIngredientId - id de l'ingrédient pivot (mode pivot)
 * @returns {number} coefficient calculé
 */
export function computeCoefficient(mode, value, recipe, pivotIngredientId = null) {
  if (mode === 'coefficient') {
    return value

  } else if (mode === 'masse_totale') {
    const totalBase = recipe.ingredients.reduce((s, i) => s + (i.quantityG || 0), 0)
    if (totalBase === 0) return 1
    return value / totalBase

  } else if (mode === 'ingredient_pivot') {
    const pivot = recipe.ingredients.find(i => i.id === pivotIngredientId)
    if (!pivot || pivot.quantityG === 0) return 1
    return value / pivot.quantityG
  }

  return 1
}

/**
 * Applique un coefficient à tous les ingrédients d'une recette
 * @param {Array} ingredients
 * @param {number} coef
 * @returns {Array} ingrédients avec quantités recalculées
 */
export function applyCoefficient(ingredients, coef) {
  return ingredients.map(i => ({
    ...i,
    quantityG: Math.round(i.quantityG * coef * 100) / 100
  }))
}

/**
 * Calcule la masse totale d'une liste d'ingrédients
 * @param {Array} ingredients
 * @returns {number}
 */
export function totalMass(ingredients) {
  return ingredients.reduce((s, i) => s + (i.quantityG || 0), 0)
}

/**
 * Résout une sous-recette selon son mode et le coefficient global de la recette parente
 * @param {object} subRecipe - relation sub_recipe
 * @param {object} childRecipe - recette enfant avec ses ingrédients
 * @param {number} globalCoef - coefficient global de la recette parente
 * @returns {object} - sous-recette avec ingrédients recalculés
 */
export function resolveSubRecipe(subRecipe, childRecipe, globalCoef) {
  // Calcul du coefficient local de la sous-recette
  const localCoef = computeCoefficient(subRecipe.calcMode, subRecipe.calcValue, childRecipe, subRecipe.pivotIngredientId)

  // Propagation du coefficient global si non verrouillé
  const effectiveCoef = subRecipe.isLocked ? localCoef : localCoef * globalCoef

  const resolvedIngredients = applyCoefficient(childRecipe.ingredients, effectiveCoef)

  return {
    ...childRecipe,
    subRecipeLabel: subRecipe.label,
    isLocked: subRecipe.isLocked,
    position: subRecipe.position,
    subRecipeId: subRecipe.id,
    effectiveCoef,
    ingredients: resolvedIngredients,
    masseTotale: totalMass(resolvedIngredients)
  }
}
