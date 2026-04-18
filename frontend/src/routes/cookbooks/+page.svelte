<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { cookbooksApi, settingsApi } from '$lib/api.js'
  import { showToast } from '$lib/stores.js'

  let cookbooks = []
  let templates = []
  let loading = true
  let showCreate = false
  let newName = ''
  let newDesc = ''
  let newFormat = 'A4'

  onMount(async () => {
    try {
      [cookbooks, templates] = await Promise.all([cookbooksApi.list(), settingsApi.pdfTemplates()])
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      loading = false
    }
  })

  async function createCookbook() {
    if (!newName.trim()) return
    try {
      const cb = await cookbooksApi.create({ name: newName.trim(), description: newDesc, format: newFormat })
      showToast('Cahier créé !')
      cookbooks = [cb, ...cookbooks]
      showCreate = false
      newName = ''
      newDesc = ''
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function deleteCookbook(id) {
    if (!confirm('Supprimer ce cahier ?')) return
    try {
      await cookbooksApi.delete(id)
      cookbooks = cookbooks.filter(c => c.id !== id)
      showToast('Cahier supprimé')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }
</script>

<div class="page-content">
  <h2 style="margin-bottom:1.2rem">📖 Cahiers</h2>

  {#if loading}
    <div class="empty-state"><div class="empty-state-icon">⏳</div></div>
  {:else if cookbooks.length === 0 && !showCreate}
    <div class="empty-state">
      <div class="empty-state-icon">📖</div>
      <p class="empty-state-text">Aucun cahier</p>
      <button class="btn btn-primary" on:click={() => showCreate = true}>Créer un cahier</button>
    </div>
  {:else}
    <div style="display:flex; flex-direction:column; gap:0.8rem">
      {#each cookbooks as cb (cb.id)}
        <div class="card" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer"
          on:click={() => goto(`/cookbooks/${cb.id}`)}>
          <div>
            <div class="card-title" style="margin-bottom:0.25rem">{cb.name}</div>
            {#if cb.description}<p style="font-size:0.78rem; color:var(--muted)">{cb.description}</p>{/if}
            <p style="font-size:0.68rem; color:var(--muted); margin-top:0.3rem">{cb.format} · {cb.recipesCount ?? 0} recettes</p>
          </div>
          <button class="btn btn-danger" style="flex-shrink:0"
            on:click|stopPropagation={() => deleteCookbook(cb.id)}>Supprimer</button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- FAB -->
<button class="fab" on:click={() => showCreate = true} title="Nouveau cahier">+</button>

<!-- Modal création -->
{#if showCreate}
  <div class="modal-overlay" on:click|self={() => showCreate = false}>
    <div class="modal">
      <div class="modal-handle"></div>
      <h2 class="modal-title">Nouveau cahier</h2>

      <div class="form-group">
        <label class="form-label">Nom *</label>
        <input class="form-input" bind:value={newName} placeholder="Ex : Bases pâtisserie" />
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <input class="form-input" bind:value={newDesc} placeholder="Optionnel" />
      </div>
      <div class="form-group">
        <label class="form-label">Format</label>
        <div class="segmented">
          {#each ['A4','A5'] as f}
            <button class="segmented-btn {newFormat === f ? 'active' : ''}" on:click={() => newFormat = f}>{f}</button>
          {/each}
        </div>
      </div>

      <div style="display:flex; gap:0.75rem; justify-content:flex-end; margin-top:1rem">
        <button class="btn btn-secondary" on:click={() => showCreate = false}>Annuler</button>
        <button class="btn btn-primary" on:click={createCookbook} disabled={!newName.trim()}>Créer</button>
      </div>
    </div>
  </div>
{/if}
