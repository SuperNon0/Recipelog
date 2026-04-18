# RecipeLog — Documentation API

> API REST — Base URL : `https://recipe.super-nono.cc/api`

---

## Authentification

L'API est protégée par Cloudflare Zero Trust. Le header `Cf-Access-Authenticated-User-Email` est transmis par Cloudflare pour toutes les requêtes authentifiées.

Les routes sous `/p/:token` sont publiques (pas d'auth requise).

---

## Recettes

### `GET /api/recipes`

Liste toutes les recettes.

**Paramètres query :**
| Paramètre | Type | Description |
|---|---|---|
| `search` | string | Recherche sur le nom |
| `tag` | string | Filtrer par tag |
| `categoryId` | number | Filtrer par catégorie |
| `favorite` | boolean | Filtrer les favoris |

**Réponse :** `Recipe[]`

---

### `GET /api/recipes/:id`

Récupère une recette complète avec ingrédients, étapes, sous-recettes et commentaires.

**Réponse :** `RecipeDetail`

---

### `POST /api/recipes`

Crée une nouvelle recette.

**Corps :**
```json
{
  "name": "Tarte citron",
  "source": "Livre Hermé",
  "notes": "Cuire à 180°C",
  "favorite": false,
  "rating": 4,
  "tags": ["tarte", "citron"],
  "categoryIds": [1, 3],
  "stepsContent": "1. Préparer la pâte...",
  "ingredientsList": [
    { "name": "Farine", "quantityG": 250 },
    { "name": "Beurre", "quantityG": 125 }
  ]
}
```

**Réponse :** `201 Recipe`

---

### `PATCH /api/recipes/:id`

Modifie partiellement une recette (tous les champs sont optionnels).

---

### `DELETE /api/recipes/:id`

Supprime une recette. `204 No Content`

---

### `POST /api/recipes/:id/duplicate`

Duplique une recette. **Réponse :** `201 Recipe`

---

### `POST /api/recipes/:id/variant`

Crée une variante. **Corps :** `{ "note": "..." }` **Réponse :** `201 Recipe`

---

### Sous-recettes

#### `POST /api/recipes/:id/sub-recipes`
```json
{
  "childId": 5,
  "label": "Mousse framboise",
  "calcMode": "masse_totale",
  "calcValue": 450
}
```
`calcMode` : `coefficient` | `masse_totale` | `ingredient_pivot`

#### `PATCH /api/recipes/:id/sub-recipes/:subId`

Modifie une sous-recette (label, calcMode, calcValue, isLocked).

#### `DELETE /api/recipes/:id/sub-recipes/:subId`

---

### Commentaires

#### `POST /api/recipes/:id/comments`
```json
{ "content": "Excellent résultat le 15/01" }
```

#### `PATCH /api/recipes/:id/comments/:commentId`
#### `DELETE /api/recipes/:id/comments/:commentId`

---

### PDF & Partage

#### `GET /api/recipes/:id/pdf?template=classique&format=A4`

Génère et télécharge le PDF d'une recette.

`template` : `classique` | `moderne` | `fiche-technique` | `magazine`
`format` : `A4` | `A5`

#### `POST /api/recipes/:id/share`

Génère un token de partage. **Réponse :** `{ "token": "abc123", "url": "/p/abc123" }`

#### `DELETE /api/recipes/:id/share`

Révoque le token de partage.

---

## Cahiers

### `GET /api/cookbooks` — Liste des cahiers
### `GET /api/cookbooks/:id` — Cahier détaillé avec ses recettes
### `POST /api/cookbooks` — Créer un cahier
```json
{ "name": "Bases pâtisserie", "description": "...", "format": "A4" }
```
### `PATCH /api/cookbooks/:id` — Modifier un cahier
### `DELETE /api/cookbooks/:id`

### `POST /api/cookbooks/:id/recipes` — Ajouter une recette
```json
{
  "recipeId": 3,
  "linkMode": "linked",
  "subrecipeMode": "single"
}
```
`linkMode` : `linked` | `snapshot`
`subrecipeMode` : `single` | `separate`

### `PATCH /api/cookbooks/:id/recipes/:entryId` — Modifier une entrée
### `DELETE /api/cookbooks/:id/recipes/:entryId` — Retirer une recette

### `GET /api/cookbooks/:id/pdf?format=A4` — Générer le PDF du cahier
### `POST /api/cookbooks/:id/share` — Partager le cahier

---

## Listes de courses

### `GET /api/shopping` — Liste des listes
### `GET /api/shopping/:id` — Détail avec items
### `POST /api/shopping` — Créer une liste
### `PATCH /api/shopping/:id`
### `DELETE /api/shopping/:id`

### `POST /api/shopping/:id/generate` — Générer depuis des recettes
```json
{
  "recipeEntries": [
    { "recipeId": 1, "coefficient": 2 },
    { "recipeId": 3, "coefficient": 1 }
  ]
}
```

### `POST /api/shopping/:id/items` — Ajouter un article
```json
{ "name": "Beurre", "quantityG": 500 }
```
### `PATCH /api/shopping/:id/items/:itemId` — Modifier (checked, name, quantityG, position)
### `DELETE /api/shopping/:id/items/:itemId`

---

## Paramètres

### `GET /api/settings` — Récupérer tous les paramètres
### `PATCH /api/settings` — Modifier des paramètres
```json
{ "ingredient_mode": "B", "logo_enabled": "true" }
```

### `GET /api/categories`
### `POST /api/categories` — `{ "name": "Entremets", "color": "#e8c547" }`
### `PATCH /api/categories/:id`
### `DELETE /api/categories/:id`

### `GET /api/ingredients-base`
### `POST /api/ingredients-base` — `{ "name": "Beurre doux" }`
### `DELETE /api/ingredients-base/:id`

### `GET /api/pdf-templates` — Liste des templates disponibles

### `GET /api/export` — Export JSON complet
### `POST /api/import` — Import JSON `{ "data": { ... } }`

---

## Upload

### `POST /api/upload`

Multipart/form-data. Retourne `{ "path": "/uploads/filename.jpg" }`

Formats acceptés : JPEG, PNG, WebP, GIF. Limite : 10 Mo.

---

## Public (sans authentification)

### `GET /p/:token`

Récupère les données d'un lien de partage (recette ou cahier).

**Réponse :**
```json
{
  "type": "recipe",
  "data": { ...recipe }
}
```

### `GET /p/:token/pdf?template=classique&format=A4`

Télécharge le PDF via lien de partage.

---

## Healthcheck

### `GET /api/health`

```json
{ "status": "ok", "timestamp": "2025-01-01T12:00:00.000Z" }
```

---

## Types de données

### Recipe
```typescript
{
  id: number
  name: string
  photoPath: string | null
  source: string | null
  notes: string | null
  favorite: boolean
  rating: number          // 0-5
  tags: string[]
  masseTotale: number     // calculé
  createdAt: string       // ISO 8601
  updatedAt: string
}
```

### RecipeDetail extends Recipe
```typescript
{
  stepsContent: string
  ingredients: Ingredient[]
  categories: Category[]
  comments: Comment[]
  subRecipes: SubRecipeResolved[]
  variants: Variant[]
}
```

### Ingredient
```typescript
{
  id: number
  name: string | null
  ingredientBaseId: number | null
  quantityG: number
  position: number
}
```
