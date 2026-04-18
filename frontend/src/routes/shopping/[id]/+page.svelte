<script>
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { shoppingApi, recipesApi } from '$lib/api.js'
  import { showToast, recipesStore } from '$lib/stores.js'

  $: id = Number($page.params.id)

  let list = null
  let loading = true
  let newItem = ''
  let newItemQty = null
  let showGenerateModal = false
  let recipeEntries = []

  onMount(async () => {
    try {
      list = await shoppingApi.get(id)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      loading = false
    }
  })

  async function toggleItem(item) {
    try {
      const updated = await shoppingApi.updateItem(id, item.id, { checked: !item.checked })
      list = { ...list, items: list.items.map(i => i.id === item.id ? updated : i) }
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function addItem() {
    if (!newItem.trim()) return
    try {
      const item = await shoppingApi.addItem(id, { name: newItem.trim(), quantityG: newItemQty || null })
      list = { ...list, items: [...list.items, item] }
      newItem = ''
      newItemQty = null
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function deleteItem(itemId) {
    try {
      await shoppingApi.deleteItem(id, itemId)
      list = { ...list, items: list.items.filter(i => i.id !== itemId) }
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function generateFromRecipes() {
    try {
      const items = await shoppingApi.generate(id, { recipeEntries })
      list = { ...list, items }
      showGenerateModal = false
      showToast('Liste générée !')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  function addRecipeEntry() {
    recipeEntries = [...recipeEntries, { recipeId: null, coefficient: 1 }]
  }

  $: unchecked = list?.items.filter(i => !i.checked) ?? []
  $: checked = list?.items.filter(i => i.checked) ?? []
</script>

{#if loading}
  <div class="page-content empty-state"><div class="empty-state-icon">⏳</div></div>
{:else if list}
  <div class="page-content">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem">
      <button class="btn btn-secondary" on:click={() => goto('/shopping')}>← Retour</button>
      <button class="btn btn-violet" on:click={() => showGenerateModal = true}>⚡ Générer depuis recettes</button>
    </div>

    <h1 style="margin-bottom:1.2rem">{list.name}</h1>

    <!-- Ajout manuel -->
    <div style="display:flex; gap:0.5rem; margin-bottom:1.5rem">
      <input class="form-input" bind:value={newItem} placeholder="Ajouter un article..." on:keydown={e => e.key === 'Enter' && addItem()} style="flex:1" />
      <input class="form-input" type="number" bind:value={newItemQty} placeholder="g" style="width:80px" min="0" />
      <button class="btn btn-primary" on:click={addItem}>+</button>
    </div>

    <!-- Articles non cochés -->
    {#each unchecked as item (item.id)}
      <div style="display:flex; align-items:center; gap:0.75rem; padding:0.65rem 0; border-bottom:1px solid var(--border)">
        <input type="checkbox" checked={item.checked} on:change={() => toggleItem(item)} style="width:18px;height:18px;cursor:pointer" />
        <span style="flex:1; font-size:0.88rem">{item.name}</span>
        {#if item.quantityG}<span style="color:var(--accent); font-family:var(--font-serif)">{item.quantityG}g</span>{/if}
        <button style="background:none;border:none;color:var(--danger);cursor:pointer" on:click={() => deleteItem(item.id)}>✕</button>
      </div>
    {/each}

    <!-- Articles cochés -->
    {#if checked.length}
      <div style="margin-top:1.5rem">
        <p style="font-size:0.68rem; text-transform:uppercase; letter-spacing:0.07em; color:var(--muted); margin-bottom:0.5rem">Faits ({checked.length})</p>
        {#each checked as item (item.id)}
          <div style="display:flex; align-items:center; gap:0.75rem; padding:0.5rem 0; opacity:0.5">
            <input type="checkbox" checked={item.checked} on:change={() => toggleItem(item)} style="width:18px;height:18px;cursor:pointer" />
            <span style="flex:1; font-size:0.85rem; text-decoration:line-through; color:var(--muted)">{item.name}</span>
            <button style="background:none;border:none;color:var(--danger);cursor:pointer" on:click={() => deleteItem(item.id)}>✕</button>
          </div>
        {/each}
      </div>
    {/if}

    {#if !list.items.length}
      <div class="empty-state" style="padding:2rem 0">
        <p class="empty-state-text">Liste vide — ajoutez des articles ou générez depuis des recettes</p>
      </div>
    {/if}
  </div>

  <!-- Modal génération depuis recettes -->
  {#if showGenerateModal}
    <div class="modal-overlay" on:click|self={() => showGenerateModal = false}>
      <div class="modal">
        <div class="modal-handle"></div>
        <h2 class="modal-title">Générer depuis des recettes</h2>
        <p style="font-size:0.78rem; color:var(--muted); margin-bottom:1rem">
          Sélectionnez les recettes et coefficients, les ingrédients seront fusionnés automatiquement.
        </p>

        {#each recipeEntries as entry, i}
          <div style="display:flex; gap:0.5rem; margin-bottom:0.5rem; align-items:center">
            <select class="form-select" style="flex:1" bind:value={entry.recipeId}>
              <option value={null}>Choisir une recette...</option>
              {#each $recipesStore as r}
                <option value={r.id}>{r.name}</option>
              {/each}
            </select>
            <span style="color:var(--muted); font-size:0.75rem">×</span>
            <input class="form-input" style="width:70px" type="number" bind:value={entry.coefficient} min="0.1" step="0.1" />
            <button style="background:none;border:none;color:var(--danger);cursor:pointer"
              on:click={() => recipeEntries = recipeEntries.filter((_, idx) => idx !== i)}>✕</button>
          </div>
        {/each}

        <button class="btn btn-secondary" on:click={addRecipeEntry} style="margin-bottom:1rem">+ Ajouter une recette</button>

        <div style="display:flex; gap:0.75rem; justify-content:flex-end; margin-top:0.5rem">
          <button class="btn btn-secondary" on:click={() => showGenerateModal = false}>Annuler</button>
          <button class="btn btn-primary" on:click={generateFromRecipes}
            disabled={!recipeEntries.some(e => e.recipeId)}>Générer</button>
        </div>
      </div>
    </div>
  {/if}
{/if}
