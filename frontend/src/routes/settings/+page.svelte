<script>
  import { onMount } from 'svelte'
  import { settingsApi } from '$lib/api.js'
  import { showToast, settingsStore, categoriesStore } from '$lib/stores.js'

  let settings = {}
  let categories = []
  let ingredientsBase = []
  let loading = true

  let newCatName = ''
  let newCatColor = '#e8c547'
  let newIngName = ''

  onMount(async () => {
    try {
      [settings, categories, ingredientsBase] = await Promise.all([
        settingsApi.get(),
        settingsApi.categories.list(),
        settingsApi.ingredientsBase.list()
      ])
      settingsStore.set(settings)
      categoriesStore.set(categories)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      loading = false
    }
  })

  async function saveSettings(updates) {
    try {
      settings = await settingsApi.update(updates)
      settingsStore.set(settings)
      showToast('Paramètres sauvegardés !')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function addCategory() {
    if (!newCatName.trim()) return
    try {
      const cat = await settingsApi.categories.create({ name: newCatName.trim(), color: newCatColor })
      categories = [...categories, cat]
      categoriesStore.set(categories)
      newCatName = ''
      showToast('Catégorie créée !')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function deleteCategory(id) {
    if (!confirm('Supprimer cette catégorie ?')) return
    try {
      await settingsApi.categories.delete(id)
      categories = categories.filter(c => c.id !== id)
      categoriesStore.set(categories)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function addIngredientBase() {
    if (!newIngName.trim()) return
    try {
      const ing = await settingsApi.ingredientsBase.create({ name: newIngName.trim() })
      ingredientsBase = [...ingredientsBase, ing]
      newIngName = ''
      showToast('Ingrédient ajouté !')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function deleteIngredientBase(id) {
    try {
      await settingsApi.ingredientsBase.delete(id)
      ingredientsBase = ingredientsBase.filter(i => i.id !== id)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function exportData() {
    const data = await settingsApi.export()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `recipelog-export-${new Date().toISOString().slice(0,10)}.json`
    a.click()
    showToast('Export téléchargé !')
  }

  async function importData(e) {
    const file = e.target.files[0]
    if (!file) return
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      await settingsApi.import(json)
      showToast('Import effectué !')
    } catch (e) {
      showToast('Erreur lors de l\'import : ' + e.message, 'error')
    }
  }
</script>

<div class="page-content">
  <h2 style="margin-bottom:1.5rem">⚙️ Paramètres</h2>

  {#if loading}
    <div class="empty-state"><div class="empty-state-icon">⏳</div></div>
  {:else}

    <!-- Mode ingrédients -->
    <div class="card">
      <div class="card-title">Mode de saisie des ingrédients</div>
      <div class="segmented" style="max-width:300px">
        <button class="segmented-btn {settings.ingredient_mode === 'A' ? 'active' : ''}"
          on:click={() => saveSettings({ ingredient_mode: 'A' })}>
          Mode A — Texte libre
        </button>
        <button class="segmented-btn {settings.ingredient_mode === 'B' ? 'active' : ''}"
          on:click={() => saveSettings({ ingredient_mode: 'B' })}>
          Mode B — Base réutilisable
        </button>
      </div>
      <p style="color:var(--muted); font-size:0.72rem; margin-top:0.6rem">
        Mode A : saisie libre à chaque recette · Mode B : sélection depuis une base centralisée
      </p>
    </div>

    <!-- Catégories -->
    <div class="card">
      <div class="card-title">Catégories</div>
      <div style="display:flex; flex-direction:column; gap:0.4rem; margin-bottom:1rem">
        {#each categories as cat (cat.id)}
          <div style="display:flex; align-items:center; gap:0.6rem; padding:0.4rem 0; border-bottom:1px solid var(--border)">
            <span style="width:12px; height:12px; border-radius:50%; background:{cat.color}; flex-shrink:0"></span>
            <span style="flex:1; font-size:0.85rem">{cat.name}</span>
            <button class="btn btn-danger" style="padding:0.2rem 0.6rem; font-size:0.65rem"
              on:click={() => deleteCategory(cat.id)}>Supprimer</button>
          </div>
        {/each}
      </div>
      <div style="display:flex; gap:0.5rem; align-items:center">
        <input type="color" bind:value={newCatColor} style="width:36px;height:36px;border:none;border-radius:6px;cursor:pointer;background:none;padding:0" />
        <input class="form-input" bind:value={newCatName} placeholder="Nom de la catégorie" on:keydown={e => e.key === 'Enter' && addCategory()} style="flex:1" />
        <button class="btn btn-primary" on:click={addCategory} disabled={!newCatName.trim()}>Ajouter</button>
      </div>
    </div>

    <!-- Base d'ingrédients (mode B) -->
    {#if settings.ingredient_mode === 'B'}
      <div class="card">
        <div class="card-title">Base d'ingrédients</div>
        <div style="max-height:200px; overflow-y:auto; margin-bottom:0.8rem">
          {#each ingredientsBase as ing (ing.id)}
            <div style="display:flex; justify-content:space-between; align-items:center; padding:0.3rem 0; border-bottom:1px solid var(--border)">
              <span style="font-size:0.85rem">{ing.name}</span>
              <button style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:0.8rem"
                on:click={() => deleteIngredientBase(ing.id)}>✕</button>
            </div>
          {/each}
        </div>
        <div style="display:flex; gap:0.5rem">
          <input class="form-input" bind:value={newIngName} placeholder="Nom de l'ingrédient" style="flex:1" on:keydown={e => e.key === 'Enter' && addIngredientBase()} />
          <button class="btn btn-primary" on:click={addIngredientBase} disabled={!newIngName.trim()}>Ajouter</button>
        </div>
      </div>
    {/if}

    <!-- Export / Import -->
    <div class="card">
      <div class="card-title">Export / Import JSON</div>
      <p style="color:var(--muted); font-size:0.78rem; margin-bottom:1rem">
        Sauvegardez ou restaurez toutes vos données au format JSON.
      </p>
      <div style="display:flex; gap:0.75rem; flex-wrap:wrap">
        <button class="btn btn-edit" on:click={exportData}>📥 Exporter</button>
        <label class="btn btn-secondary" style="cursor:pointer">
          📤 Importer
          <input type="file" accept=".json" on:change={importData} style="display:none" />
        </label>
      </div>
    </div>

    <!-- À propos -->
    <div class="card">
      <div class="card-title">À propos</div>
      <p style="font-size:0.82rem; color:var(--muted)">RecipeLog V1 — Gestionnaire de recettes de pâtisserie</p>
      <p style="font-size:0.72rem; color:var(--muted); margin-top:0.3rem">Partie de l'écosystème <span style="color:var(--accent)">super-nono.cc</span></p>
    </div>

  {/if}
</div>
