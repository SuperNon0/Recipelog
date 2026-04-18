-- ============================================================
-- RecipeLog — Migration initiale V1
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── Catégories ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  color      VARCHAR(20) DEFAULT '#e8c547',
  icon       VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Base d'ingrédients réutilisables (mode B) ───────────────────────────────

CREATE TABLE IF NOT EXISTS ingredients_base (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(200) NOT NULL,
  default_unit VARCHAR(10) DEFAULT 'g',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Templates PDF ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pdf_templates (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  description  TEXT,
  slug         VARCHAR(50) NOT NULL UNIQUE,
  preview_path TEXT,
  is_custom    BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Recettes ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recipes (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  photo_path TEXT,
  source     TEXT,
  notes      TEXT,
  favorite   BOOLEAN DEFAULT FALSE,
  rating     INTEGER DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  tags       JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS recipes_name_idx     ON recipes USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS recipes_updated_idx  ON recipes (updated_at DESC);
CREATE INDEX IF NOT EXISTS recipes_favorite_idx ON recipes (favorite) WHERE favorite = TRUE;

-- ─── Ingrédients d'une recette ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ingredients (
  id                   SERIAL PRIMARY KEY,
  recipe_id            INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name                 VARCHAR(200),
  ingredient_base_id   INTEGER REFERENCES ingredients_base(id),
  quantity_g           REAL NOT NULL DEFAULT 0,
  position             INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS ingredients_recipe_id_idx ON ingredients (recipe_id);

-- ─── Étapes (bloc texte libre) ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS steps_block (
  id        SERIAL PRIMARY KEY,
  recipe_id INTEGER NOT NULL UNIQUE REFERENCES recipes(id) ON DELETE CASCADE,
  content   TEXT DEFAULT ''
);

-- ─── Sous-recettes ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sub_recipes (
  id                  SERIAL PRIMARY KEY,
  parent_id           INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  child_id            INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  label               VARCHAR(200) NOT NULL,
  calc_mode           VARCHAR(20) NOT NULL DEFAULT 'coefficient',
  calc_value          REAL NOT NULL DEFAULT 1,
  pivot_ingredient_id INTEGER,
  is_locked           BOOLEAN DEFAULT FALSE,
  position            INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS sub_recipes_parent_idx ON sub_recipes (parent_id);

-- ─── Variantes ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS variants (
  id                SERIAL PRIMARY KEY,
  source_recipe_id  INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  variant_recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  note              TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Recettes ↔ Catégories (N-N) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recipes_categories (
  recipe_id   INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, category_id)
);

-- ─── Commentaires datés ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS comments (
  id         SERIAL PRIMARY KEY,
  recipe_id  INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comments_recipe_id_idx ON comments (recipe_id);

-- ─── Cahiers de recettes ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cookbooks (
  id                    SERIAL PRIMARY KEY,
  name                  VARCHAR(200) NOT NULL,
  description           TEXT,
  format                VARCHAR(5) DEFAULT 'A4',
  template_id           INTEGER REFERENCES pdf_templates(id),
  has_toc               BOOLEAN DEFAULT TRUE,
  has_cover             BOOLEAN DEFAULT TRUE,
  cover_config          JSONB DEFAULT '{}',
  has_logo              BOOLEAN DEFAULT FALSE,
  page_numbering_config JSONB DEFAULT '{}',
  footer                TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Cahiers ↔ Recettes ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS cookbooks_recipes (
  id             SERIAL PRIMARY KEY,
  cookbook_id    INTEGER NOT NULL REFERENCES cookbooks(id) ON DELETE CASCADE,
  recipe_id      INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position       INTEGER NOT NULL DEFAULT 0,
  link_mode      VARCHAR(20) NOT NULL DEFAULT 'linked',
  snapshot_data  JSONB,
  snapshot_date  TIMESTAMPTZ,
  subrecipe_mode VARCHAR(20) DEFAULT 'single',
  added_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cookbooks_recipes_cookbook_idx ON cookbooks_recipes (cookbook_id, position);

-- ─── Listes de courses ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shopping_lists (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  type       VARCHAR(20) NOT NULL DEFAULT 'mixed',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shopping_list_recipes (
  id               SERIAL PRIMARY KEY,
  shopping_list_id INTEGER NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  recipe_id        INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  coefficient      REAL NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id               SERIAL PRIMARY KEY,
  shopping_list_id INTEGER NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name             VARCHAR(200) NOT NULL,
  quantity_g       REAL,
  recipe_id        INTEGER REFERENCES recipes(id),
  checked          BOOLEAN DEFAULT FALSE,
  position         INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS shopping_list_items_list_idx ON shopping_list_items (shopping_list_id);

-- ─── Tokens de partage public ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS share_tokens (
  id          SERIAL PRIMARY KEY,
  token       VARCHAR(64) NOT NULL,
  entity_type VARCHAR(20) NOT NULL,
  entity_id   INTEGER NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ,
  CONSTRAINT share_tokens_token_unique UNIQUE (token)
);

-- ─── Paramètres globaux ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settings (
  key   VARCHAR(100) PRIMARY KEY,
  value TEXT
);

-- ─── Trigger updated_at auto ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER cookbooks_updated_at
  BEFORE UPDATE ON cookbooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER shopping_lists_updated_at
  BEFORE UPDATE ON shopping_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
