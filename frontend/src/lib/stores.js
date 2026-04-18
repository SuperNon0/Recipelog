import { writable, derived } from 'svelte/store'

// Toast
export const toast = writable(null)

export function showToast(message, type = 'success') {
  toast.set({ message, type, id: Date.now() })
  setTimeout(() => toast.set(null), 2700)
}

// Recettes
export const recipesStore = writable([])
export const recipesLoading = writable(false)

// Cahiers
export const cookbooksStore = writable([])

// Listes de courses
export const shoppingStore = writable([])

// Catégories
export const categoriesStore = writable([])

// Settings
export const settingsStore = writable({})

// Recette courante (fiche détaillée)
export const currentRecipe = writable(null)

// Multiplication en cours
export const multiplyState = writable({
  mode: 'coefficient',  // 'coefficient' | 'masse_totale' | 'ingredient_pivot'
  value: 1,
  pivotIngredientId: null,
  coefficient: 1
})
