<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import { cookbooksApi } from '$lib/api.js'
  import { showToast } from '$lib/stores.js'

  export let recipe

  const dispatch = createEventDispatcher()

  let cookbooks = []
  let selectedCookbookId = null
  let linkMode = 'linked'
  let subrecipeMode = 'single'
  let loading = false

  const hasSubRecipes = recipe?.subRecipes?.length > 0

  onMount(async () => {
    try {
      cookbooks = await cookbooksApi.list()
    } catch (e) {
      showToast(e.message, 'error')
    }
  })

  async function save() {
    if (!selectedCookbookId) return
    loading = true
    try {
      await cookbooksApi.addRecipe(selectedCookbookId, {
        recipeId: recipe.id, linkMode, subrecipeMode
      })
      showToast('Recette ajoutée au cahier !')
      dispatch('close')
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      loading = false
    }
  }
</script>

<div class="modal-overlay" on:click|self={() => dispatch('close')}>
  <div class="modal">
    <div class="modal-handle"></div>
    <h2 class="modal-title">Ajouter au cahier</h2>

    <div class="form-group">
      <label class="form-label">Cahier *</label>
      {#if cookbooks.length}
        <select class="form-select" bind:value={selectedCookbookId}>
          <option value={null}>Sélectionner un cahier...</option>
          {#each cookbooks as cb}
            <option value={cb.id}>{cb.name}</option>
          {/each}
        </select>
      {:else}
        <p style="color:var(--muted); font-size:0.82rem">Aucun cahier — créez-en un dans l'onglet Cahiers</p>
      {/if}
    </div>

    <!-- Choix 1 : mode liaison -->
    <div class="form-group">
      <label class="form-label">Mode de liaison</label>
      <div style="display:flex; flex-direction:column; gap:0.5rem">
        <label style="display:flex; align-items:flex-start; gap:0.5rem; cursor:pointer; font-size:0.82rem">
          <input type="radio" bind:group={linkMode} value="linked" style="margin-top:2px" />
          <div>
            <strong>🔗 Liée dynamique</strong>
            <p style="color:var(--muted); font-size:0.72rem; margin-top:2px">Les modifications de la recette se répercutent automatiquement</p>
          </div>
        </label>
        <label style="display:flex; align-items:flex-start; gap:0.5rem; cursor:pointer; font-size:0.82rem">
          <input type="radio" bind:group={linkMode} value="snapshot" style="margin-top:2px" />
          <div>
            <strong>📌 Figée (snapshot)</strong>
            <p style="color:var(--muted); font-size:0.72rem; margin-top:2px">Copie figée au moment de l'ajout</p>
          </div>
        </label>
      </div>
    </div>

    <!-- Choix 2 : intégration sous-recettes -->
    {#if hasSubRecipes}
      <div class="form-group">
        <label class="form-label">Intégration des sous-recettes</label>
        <div style="display:flex; flex-direction:column; gap:0.5rem">
          <label style="display:flex; align-items:flex-start; gap:0.5rem; cursor:pointer; font-size:0.82rem">
            <input type="radio" bind:group={subrecipeMode} value="single" style="margin-top:2px" />
            <div>
              <strong>📄 Fiche unique</strong>
              <p style="color:var(--muted); font-size:0.72rem; margin-top:2px">Sous-recettes intégrées dans la fiche principale</p>
            </div>
          </label>
          <label style="display:flex; align-items:flex-start; gap:0.5rem; cursor:pointer; font-size:0.82rem">
            <input type="radio" bind:group={subrecipeMode} value="separate" style="margin-top:2px" />
            <div>
              <strong>📚 Recettes séparées</strong>
              <p style="color:var(--muted); font-size:0.72rem; margin-top:2px">Chaque sous-recette devient une fiche distincte</p>
            </div>
          </label>
        </div>
      </div>
    {/if}

    <div style="display:flex; gap:0.75rem; justify-content:flex-end; margin-top:1rem">
      <button class="btn btn-secondary" on:click={() => dispatch('close')}>Annuler</button>
      <button class="btn btn-primary" on:click={save} disabled={!selectedCookbookId || loading}>
        {loading ? 'Ajout...' : 'Ajouter au cahier'}
      </button>
    </div>
  </div>
</div>
