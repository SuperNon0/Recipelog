<script>
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { recipesApi } from '$lib/api.js'
  import { showToast } from '$lib/stores.js'
  import RecipeCard from '$lib/components/RecipeCard.svelte'

  let favorites = []
  let loading = true

  onMount(async () => {
    try {
      favorites = await recipesApi.list({ favorite: true })
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      loading = false
    }
  })
</script>

<div class="page-content">
  <h2 style="margin-bottom:1.2rem">⭐ Favoris</h2>

  {#if loading}
    <div class="empty-state">
      <div class="empty-state-icon">⏳</div>
      <p class="empty-state-text">Chargement...</p>
    </div>
  {:else if favorites.length === 0}
    <div class="empty-state">
      <div class="empty-state-icon">☆</div>
      <p class="empty-state-text">Aucune recette en favoris</p>
      <p style="color:var(--muted); font-size:0.78rem">Ajoutez l'étoile ⭐ sur une recette pour la retrouver ici</p>
    </div>
  {:else}
    <div class="recipes-grid">
      {#each favorites as recipe (recipe.id)}
        <RecipeCard {recipe} on:click={() => goto(`/recipes/${recipe.id}`)} />
      {/each}
    </div>
  {/if}
</div>
