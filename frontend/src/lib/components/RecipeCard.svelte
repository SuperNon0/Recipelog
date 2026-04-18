<script>
  import { createEventDispatcher } from 'svelte'
  import { formatGrams } from '$lib/utils/calc.js'

  export let recipe

  const dispatch = createEventDispatcher()
</script>

<article class="recipe-card" on:click={() => dispatch('click')} role="button" tabindex="0"
  on:keydown={e => e.key === 'Enter' && dispatch('click')}>

  {#if recipe.photoPath}
    <img class="recipe-card-photo" src={recipe.photoPath} alt={recipe.name} loading="lazy" />
  {:else}
    <div class="recipe-card-photo">🥐</div>
  {/if}

  <div class="recipe-card-body">
    <div class="recipe-card-name">{recipe.name}</div>

    {#if recipe.tags?.length}
      <div class="tags">
        {#each recipe.tags.slice(0, 3) as tag}
          <span class="tag">{tag}</span>
        {/each}
      </div>
    {/if}

    <div class="recipe-card-meta">
      <span class="recipe-card-mass">{formatGrams(recipe.masseTotale)}g</span>
      <span>
        {#if recipe.favorite}⭐{/if}
        {#if recipe.rating > 0}{'★'.repeat(recipe.rating)}{/if}
      </span>
    </div>
  </div>
</article>
