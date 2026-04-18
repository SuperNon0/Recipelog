import {
  pgTable, serial, text, integer, boolean, timestamp, real,
  jsonb, varchar, index, uniqueIndex
} from 'drizzle-orm/pg-core'

// ─── Catégories ────────────────────────────────────────────────────────────────

export const categories = pgTable('categories', {
  id:    serial('id').primaryKey(),
  name:  varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 20 }).default('#e8c547'),
  icon:  varchar('icon', { length: 10 }),
  createdAt: timestamp('created_at').defaultNow()
})

// ─── Base d'ingrédients réutilisables (mode B) ─────────────────────────────────

export const ingredientsBase = pgTable('ingredients_base', {
  id:          serial('id').primaryKey(),
  name:        varchar('name', { length: 200 }).notNull(),
  defaultUnit: varchar('default_unit', { length: 10 }).default('g'),
  createdAt:   timestamp('created_at').defaultNow()
})

// ─── Templates PDF ─────────────────────────────────────────────────────────────

export const pdfTemplates = pgTable('pdf_templates', {
  id:          serial('id').primaryKey(),
  name:        varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  slug:        varchar('slug', { length: 50 }).notNull().unique(),
  previewPath: text('preview_path'),
  isCustom:    boolean('is_custom').default(false),
  createdAt:   timestamp('created_at').defaultNow()
})

// ─── Recettes ──────────────────────────────────────────────────────────────────

export const recipes = pgTable('recipes', {
  id:          serial('id').primaryKey(),
  name:        varchar('name', { length: 200 }).notNull(),
  photoPath:   text('photo_path'),
  source:      text('source'),
  notes:       text('notes'),
  favorite:    boolean('favorite').default(false),
  rating:      integer('rating').default(0),  // 0-5
  tags:        jsonb('tags').default([]),      // string[]
  createdAt:   timestamp('created_at').defaultNow(),
  updatedAt:   timestamp('updated_at').defaultNow()
}, (t) => [
  index('recipes_name_idx').on(t.name),
  index('recipes_updated_idx').on(t.updatedAt),
  index('recipes_favorite_idx').on(t.favorite)
])

// ─── Ingrédients d'une recette ─────────────────────────────────────────────────

export const ingredients = pgTable('ingredients', {
  id:             serial('id').primaryKey(),
  recipeId:       integer('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  name:           varchar('name', { length: 200 }),          // mode A : texte libre
  ingredientBaseId: integer('ingredient_base_id').references(() => ingredientsBase.id), // mode B
  quantityG:      real('quantity_g').notNull().default(0),
  position:       integer('position').notNull().default(0)
}, (t) => [
  index('ingredients_recipe_id_idx').on(t.recipeId)
])

// ─── Étapes (bloc texte libre) ─────────────────────────────────────────────────

export const stepsBlock = pgTable('steps_block', {
  id:       serial('id').primaryKey(),
  recipeId: integer('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }).unique(),
  content:  text('content').default('')
})

// ─── Sous-recettes ─────────────────────────────────────────────────────────────

export const subRecipes = pgTable('sub_recipes', {
  id:        serial('id').primaryKey(),
  parentId:  integer('parent_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  childId:   integer('child_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  label:     varchar('label', { length: 200 }).notNull(),  // ex: "Mousse", "Biscuit"
  calcMode:  varchar('calc_mode', { length: 20 }).notNull().default('coefficient'), // 'coefficient' | 'masse_totale' | 'ingredient_pivot'
  calcValue: real('calc_value').notNull().default(1),
  pivotIngredientId: integer('pivot_ingredient_id'),       // si calcMode = 'ingredient_pivot'
  isLocked:  boolean('is_locked').default(false),
  position:  integer('position').notNull().default(0)
}, (t) => [
  index('sub_recipes_parent_idx').on(t.parentId)
])

// ─── Variantes d'une recette ────────────────────────────────────────────────────

export const variants = pgTable('variants', {
  id:               serial('id').primaryKey(),
  sourceRecipeId:   integer('source_recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  variantRecipeId:  integer('variant_recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  note:             text('note'),
  createdAt:        timestamp('created_at').defaultNow()
})

// ─── Recettes ↔ Catégories (N-N) ───────────────────────────────────────────────

export const recipesCategories = pgTable('recipes_categories', {
  recipeId:   integer('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' })
}, (t) => [
  uniqueIndex('recipes_categories_pk').on(t.recipeId, t.categoryId)
])

// ─── Commentaires datés ────────────────────────────────────────────────────────

export const comments = pgTable('comments', {
  id:        serial('id').primaryKey(),
  recipeId:  integer('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  content:   text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
}, (t) => [
  index('comments_recipe_id_idx').on(t.recipeId)
])

// ─── Cahiers de recettes ────────────────────────────────────────────────────────

export const cookbooks = pgTable('cookbooks', {
  id:                   serial('id').primaryKey(),
  name:                 varchar('name', { length: 200 }).notNull(),
  description:          text('description'),
  format:               varchar('format', { length: 5 }).default('A4'),  // 'A4' | 'A5'
  templateId:           integer('template_id').references(() => pdfTemplates.id),
  hasToc:               boolean('has_toc').default(true),
  hasCover:             boolean('has_cover').default(true),
  coverConfig:          jsonb('cover_config').default({}),
  hasLogo:              boolean('has_logo').default(false),
  pageNumberingConfig:  jsonb('page_numbering_config').default({}),
  footer:               text('footer'),
  createdAt:            timestamp('created_at').defaultNow(),
  updatedAt:            timestamp('updated_at').defaultNow()
})

// ─── Cahiers ↔ Recettes ─────────────────────────────────────────────────────────

export const cookbooksRecipes = pgTable('cookbooks_recipes', {
  id:              serial('id').primaryKey(),
  cookbookId:      integer('cookbook_id').notNull().references(() => cookbooks.id, { onDelete: 'cascade' }),
  recipeId:        integer('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  position:        integer('position').notNull().default(0),
  linkMode:        varchar('link_mode', { length: 20 }).notNull().default('linked'),  // 'linked' | 'snapshot'
  snapshotData:    jsonb('snapshot_data'),
  snapshotDate:    timestamp('snapshot_date'),
  subrecipeMode:   varchar('subrecipe_mode', { length: 20 }).default('single'),  // 'single' | 'separate'
  addedAt:         timestamp('added_at').defaultNow()
}, (t) => [
  index('cookbooks_recipes_cookbook_idx').on(t.cookbookId, t.position)
])

// ─── Listes de courses ─────────────────────────────────────────────────────────

export const shoppingLists = pgTable('shopping_lists', {
  id:        serial('id').primaryKey(),
  name:      varchar('name', { length: 200 }).notNull(),
  type:      varchar('type', { length: 20 }).notNull().default('mixed'),  // 'recipes' | 'free' | 'mixed'
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
})

// ─── Recettes liées à une liste de courses ─────────────────────────────────────

export const shoppingListRecipes = pgTable('shopping_list_recipes', {
  id:             serial('id').primaryKey(),
  shoppingListId: integer('shopping_list_id').notNull().references(() => shoppingLists.id, { onDelete: 'cascade' }),
  recipeId:       integer('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
  coefficient:    real('coefficient').notNull().default(1)
})

// ─── Articles d'une liste de courses ───────────────────────────────────────────

export const shoppingListItems = pgTable('shopping_list_items', {
  id:             serial('id').primaryKey(),
  shoppingListId: integer('shopping_list_id').notNull().references(() => shoppingLists.id, { onDelete: 'cascade' }),
  name:           varchar('name', { length: 200 }).notNull(),
  quantityG:      real('quantity_g'),
  recipeId:       integer('recipe_id').references(() => recipes.id),  // null = article libre
  checked:        boolean('checked').default(false),
  position:       integer('position').notNull().default(0)
}, (t) => [
  index('shopping_list_items_list_idx').on(t.shoppingListId)
])

// ─── Tokens de partage public ───────────────────────────────────────────────────

export const shareTokens = pgTable('share_tokens', {
  id:          serial('id').primaryKey(),
  token:       varchar('token', { length: 64 }).notNull(),
  entityType:  varchar('entity_type', { length: 20 }).notNull(),  // 'recipe' | 'cookbook'
  entityId:    integer('entity_id').notNull(),
  createdAt:   timestamp('created_at').defaultNow(),
  revokedAt:   timestamp('revoked_at')
}, (t) => [
  uniqueIndex('share_tokens_token_idx').on(t.token)
])

// ─── Paramètres globaux ────────────────────────────────────────────────────────

export const settings = pgTable('settings', {
  key:   varchar('key', { length: 100 }).primaryKey(),
  value: text('value')
})
