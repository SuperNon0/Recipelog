<script>
  import { createEventDispatcher } from 'svelte'
  import { recipesStore, showToast } from '$lib/stores.js'
  import { recipesApi } from '$lib/api.js'

  export let parentId

  const dispatch = createEventDispatcher()

  let label = ''
  let childId = null
  let calcMode = 'coefficient'
  let calcValue = 1
  let pivotIngredientId = null

  $: otherRecipes = $recipesStore.filter(r => r.id !== parentId)

  async function save() {
    if (!label.trim() || !childId) return
    try {
      await recipesApi.addSubRecipe(parentId, { childId: Number(childId), label: label.trim(), calcMode, calcValue: Number(calcValue), pivotIngredientId })
      showToast('Sous-recette ajoutée !')
      dispatch('save')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }
</script>

<div class="modal-overlay" on:click|self={() => dispatch('close')}>
  <div class="modal">
    <div class="modal-handle"></div>
    <h2 class="modal-title">Ajouter une sous-recette</h2>

    <div class="form-group">
      <label class="form-label">Nom de la sous-partie *</label>
      <input class="form-input" bind:value={label} placeholder="ex: Mousse, Biscuit, Glaçage..." />
    </div>

    <div class="form-group">
      <label class="form-label">Recette source *</label>
      <select class="form-select" bind:value={childId}>
        <option value={null}>Sélectionner une recette...</option>
        {#each otherRecipes as r}
          <option value={r.id}>{r.name}</option>
        {/each}
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">Mode de calcul</label>
      <div class="segmented">
        {#each [['coefficient','Coefficient'],['masse_totale','Masse totale'],['ingredient_pivot','Pivot']] as [mode, lbl]}
          <button class="segmented-btn {calcMode === mode ? 'active' : ''}" type="button" on:click={() => { calcMode = mode; calcValue = mode === 'coefficient' ? 1 : 0 }}>
            {lbl}
          </button>
        {/each}
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">{calcMode === 'coefficient' ? 'Coefficient' : 'Masse cible (g)'}</label>
      <input class="form-input" type="number" bind:value={calcValue} min="0" step={calcMode === 'coefficient' ? '0.01' : '1'} />
    </div>

    <div style="display:flex; gap:0.75rem; justify-content:flex-end; margin-top:1rem">
      <button class="btn btn-secondary" on:click={() => dispatch('close')}>Annuler</button>
      <button class="btn btn-primary" on:click={save} disabled={!label.trim() || !childId}>Ajouter</button>
    </div>
  </div>
</div>
