<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { shoppingApi } from '$lib/api.js'
  import { showToast } from '$lib/stores.js'

  let lists = []
  let loading = true
  let showCreate = false
  let newName = ''

  onMount(async () => {
    try {
      lists = await shoppingApi.list()
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      loading = false
    }
  })

  async function create() {
    if (!newName.trim()) return
    try {
      const list = await shoppingApi.create({ name: newName.trim() })
      lists = [list, ...lists]
      newName = ''
      showCreate = false
      showToast('Liste créée !')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function deleteList(id) {
    if (!confirm('Supprimer cette liste ?')) return
    try {
      await shoppingApi.delete(id)
      lists = lists.filter(l => l.id !== id)
      showToast('Liste supprimée')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }
</script>

<div class="page-content">
  <h2 style="margin-bottom:1.2rem">🛒 Listes de courses</h2>

  {#if loading}
    <div class="empty-state"><div class="empty-state-icon">⏳</div></div>
  {:else if lists.length === 0 && !showCreate}
    <div class="empty-state">
      <div class="empty-state-icon">🛒</div>
      <p class="empty-state-text">Aucune liste de courses</p>
      <button class="btn btn-primary" on:click={() => showCreate = true}>Créer une liste</button>
    </div>
  {:else}
    <div style="display:flex; flex-direction:column; gap:0.8rem">
      {#each lists as list (list.id)}
        <div class="card" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer"
          on:click={() => goto(`/shopping/${list.id}`)}>
          <div>
            <div class="card-title" style="margin-bottom:0.1rem">{list.name}</div>
            <p style="font-size:0.68rem; color:var(--muted)">
              Créée le {new Date(list.createdAt).toLocaleDateString('fr-FR')}
            </p>
          </div>
          <button class="btn btn-danger" style="flex-shrink:0"
            on:click|stopPropagation={() => deleteList(list.id)}>Supprimer</button>
        </div>
      {/each}
    </div>
  {/if}
</div>

<button class="fab" on:click={() => showCreate = true} title="Nouvelle liste">+</button>

{#if showCreate}
  <div class="modal-overlay" on:click|self={() => showCreate = false}>
    <div class="modal">
      <div class="modal-handle"></div>
      <h2 class="modal-title">Nouvelle liste de courses</h2>
      <div class="form-group">
        <label class="form-label">Nom *</label>
        <input class="form-input" bind:value={newName} placeholder="Ex : Carrefour, Marché..." on:keydown={e => e.key === 'Enter' && create()} />
      </div>
      <div style="display:flex; gap:0.75rem; justify-content:flex-end; margin-top:1rem">
        <button class="btn btn-secondary" on:click={() => showCreate = false}>Annuler</button>
        <button class="btn btn-primary" on:click={create} disabled={!newName.trim()}>Créer</button>
      </div>
    </div>
  </div>
{/if}
