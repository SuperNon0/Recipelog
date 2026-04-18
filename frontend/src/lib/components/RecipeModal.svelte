<script>
  import { createEventDispatcher } from 'svelte'
  import { categoriesStore } from '$lib/stores.js'

  export let recipe = null  // null = création, object = édition

  const dispatch = createEventDispatcher()

  let name = recipe?.name ?? ''
  let source = recipe?.source ?? ''
  let notes = recipe?.notes ?? ''
  let stepsContent = recipe?.stepsContent ?? ''
  let tagsInput = (recipe?.tags ?? []).join(', ')
  let favorite = recipe?.favorite ?? false
  let rating = recipe?.rating ?? 0
  let categoryIds = recipe?.categories?.map(c => c.id) ?? []
  let ingredientsList = recipe?.ingredients?.map(i => ({ ...i })) ?? []

  function addIngredient() {
    ingredientsList = [...ingredientsList, { name: '', quantityG: 0 }]
  }

  function removeIngredient(i) {
    ingredientsList = ingredientsList.filter((_, idx) => idx !== i)
  }

  function save() {
    if (!name.trim()) return
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean)
    dispatch('save', {
      name: name.trim(), source, notes, stepsContent,
      tags, favorite, rating, categoryIds,
      ingredientsList: ingredientsList.map((ing, pos) => ({ ...ing, position: pos }))
    })
  }

  function toggleCategory(id) {
    categoryIds = categoryIds.includes(id)
      ? categoryIds.filter(c => c !== id)
      : [...categoryIds, id]
  }
</script>

<div class="modal-overlay" on:click|self={() => dispatch('close')}>
  <div class="modal">
    <div class="modal-handle"></div>
    <h2 class="modal-title">{recipe ? 'Modifier la recette' : 'Nouvelle recette'}</h2>

    <!-- Nom -->
    <div class="form-group">
      <label class="form-label">Nom *</label>
      <input class="form-input" bind:value={name} placeholder="Nom de la recette" maxlength="200" />
    </div>

    <!-- Catégories -->
    {#if $categoriesStore.length}
      <div class="form-group">
        <label class="form-label">Catégories</label>
        <div class="tags">
          {#each $categoriesStore as cat}
            <button class="chip {categoryIds.includes(cat.id) ? 'active' : ''}"
              on:click={() => toggleCategory(cat.id)} type="button">
              {cat.name}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Tags -->
    <div class="form-group">
      <label class="form-label">Tags (séparés par virgule)</label>
      <input class="form-input" bind:value={tagsInput} placeholder="entremet, chocolat, mousse..." />
    </div>

    <!-- Ingrédients -->
    <div class="form-group">
      <label class="form-label">Ingrédients</label>
      {#each ingredientsList as ing, i}
        <div style="display:flex; gap:0.5rem; margin-bottom:0.4rem; align-items:center">
          <input class="form-input" style="flex:1" bind:value={ing.name} placeholder="Nom de l'ingrédient" />
          <input class="form-input" style="width:90px" type="number" bind:value={ing.quantityG} min="0" step="0.1" placeholder="g" />
          <span style="color:var(--muted); font-size:0.75rem">g</span>
          <button type="button" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:1rem"
            on:click={() => removeIngredient(i)}>✕</button>
        </div>
      {/each}
      <button class="btn btn-secondary" type="button" on:click={addIngredient} style="margin-top:0.3rem">
        + Ajouter un ingrédient
      </button>
    </div>

    <!-- Étapes -->
    <div class="form-group">
      <label class="form-label">Étapes</label>
      <textarea class="form-textarea" bind:value={stepsContent} placeholder="Décrivez librement les étapes de la recette..." style="min-height:160px"></textarea>
    </div>

    <!-- Source -->
    <div class="form-group">
      <label class="form-label">Source (livre, site, chef...)</label>
      <input class="form-input" bind:value={source} placeholder="Optionnel" />
    </div>

    <!-- Notes -->
    <div class="form-group">
      <label class="form-label">Notes / astuces</label>
      <textarea class="form-textarea" bind:value={notes} placeholder="Astuces, conservation, notes personnelles..." style="min-height:80px"></textarea>
    </div>

    <!-- Favori + Note -->
    <div style="display:flex; align-items:center; gap:1.5rem; margin-bottom:1rem">
      <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer; font-size:0.82rem; color:var(--text)">
        <input type="checkbox" bind:checked={favorite} />
        ⭐ Favori
      </label>
      <div>
        <span class="form-label" style="display:inline">Note : </span>
        <div class="stars" style="display:inline-flex; margin-left:0.4rem">
          {#each [1,2,3,4,5] as n}
            <button type="button" class="star {rating >= n ? 'filled' : ''}" on:click={() => rating = rating === n ? 0 : n}>★</button>
          {/each}
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div style="display:flex; gap:0.75rem; justify-content:flex-end; margin-top:1rem">
      <button class="btn btn-secondary" type="button" on:click={() => dispatch('close')}>Annuler</button>
      <button class="btn btn-primary" type="button" on:click={save} disabled={!name.trim()}>
        {recipe ? 'Enregistrer' : 'Créer la recette'}
      </button>
    </div>
  </div>
</div>
