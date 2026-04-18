<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { recipesStore, recipesLoading, categoriesStore, showToast } from '$lib/stores.js'
  import { recipesApi, settingsApi } from '$lib/api.js'
  import RecipeCard from '$lib/components/RecipeCard.svelte'
  import RecipeModal from '$lib/components/RecipeModal.svelte'

  let search = ''
  let activeTag = ''
  let activeCategoryId = null
  let showFavs = false
  let showCreateModal = false
  let debounceTimer

  $: allTags = [...new Set($recipesStore.flatMap(r => r.tags || []))]

  $: filtered = $recipesStore.filter(r => {
    if (showFavs && !r.favorite) return false
    if (activeTag && !(r.tags || []).includes(activeTag)) return false
    if (activeCategoryId) return true // filtrage côté API lors du reload
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  function onSearch() {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(loadRecipes, 300)
  }

  async function loadRecipes() {
    recipesLoading.set(true)
    try {
      const params = {}
      if (search) params.search = search
      if (activeCategoryId) params.categoryId = activeCategoryId
      const data = await recipesApi.list(params)
      recipesStore.set(data)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      recipesLoading.set(false)
    }
  }

  async function onCreate(recipe) {
    showCreateModal = false
    try {
      const data = await recipesApi.create(recipe)
      showToast('Recette créée !')
      await loadRecipes()
      goto(`/recipes/${data.id}`)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  onMount(loadRecipes)
</script>

<div class="page-content">
  <!-- Barre de recherche -->
  <div class="search-bar">
    <span class="search-icon">🔍</span>
    <input
      placeholder="Rechercher une recette..."
      bind:value={search}
      on:input={onSearch}
    />
  </div>

  <!-- Filtres chips -->
  {#if allTags.length || $categoriesStore.length}
    <div class="filter-chips">
      <button class="chip {!activeTag && !activeCategoryId ? 'active' : ''}"
        on:click={() => { activeTag = ''; activeCategoryId = null; loadRecipes() }}>
        Toutes
      </button>
      {#each allTags as tag}
        <button class="chip {activeTag === tag ? 'active' : ''}"
          on:click={() => { activeTag = activeTag === tag ? '' : tag }}>
          {tag}
        </button>
      {/each}
      {#each $categoriesStore as cat}
        <button class="chip {activeCategoryId === cat.id ? 'active' : ''}"
          on:click={() => { activeCategoryId = activeCategoryId === cat.id ? null : cat.id; loadRecipes() }}>
          {cat.name}
        </button>
      {/each}
    </div>
  {/if}

  <!-- Grille recettes -->
  {#if $recipesLoading}
    <div class="empty-state">
      <div class="empty-state-icon">⏳</div>
      <p class="empty-state-text">Chargement...</p>
    </div>
  {:else if filtered.length === 0}
    <div class="empty-state">
      <div class="empty-state-icon">🥐</div>
      <p class="empty-state-text">Aucune recette trouvée</p>
      <button class="btn btn-primary" on:click={() => showCreateModal = true}>
        Créer ma première recette
      </button>
    </div>
  {:else}
    <div class="recipes-grid">
      {#each filtered as recipe (recipe.id)}
        <RecipeCard {recipe} on:click={() => goto(`/recipes/${recipe.id}`)} />
      {/each}
    </div>
  {/if}
</div>

<!-- FAB -->
<button class="fab" on:click={() => showCreateModal = true} title="Nouvelle recette">+</button>

<!-- Modal création -->
{#if showCreateModal}
  <RecipeModal on:save={e => onCreate(e.detail)} on:close={() => showCreateModal = false} />
{/if}
