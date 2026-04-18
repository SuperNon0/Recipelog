<script>
  import { createEventDispatcher } from 'svelte'
  import { applyCoeff, totalMass, formatGrams } from '$lib/utils/calc.js'
  import { recipesApi } from '$lib/api.js'
  import { showToast } from '$lib/stores.js'

  export let sub
  export let globalCoef = 1

  const dispatch = createEventDispatcher()

  let open = false

  // Recalcul selon verrouillage
  $: effectiveCoef = sub.isLocked ? sub.effectiveCoef : sub.effectiveCoef * (sub.isLocked ? 1 : globalCoef / 1)
  $: scaledIngredients = sub.ingredients ? applyCoeff(sub.ingredients, sub.isLocked ? 1 : globalCoef) : []
  $: masse = totalMass(scaledIngredients)

  async function toggleLock() {
    dispatch('toggleLock', { subId: sub.subRecipeRelId, isLocked: sub.isLocked })
  }

  async function deleteSubRecipe() {
    if (!confirm(`Retirer la sous-recette "${sub.subRecipeLabel}" ?`)) return
    try {
      await recipesApi.deleteSubRecipe(sub.parentId, sub.subRecipeRelId)
      dispatch('delete')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }
</script>

<div class="accordion {open ? 'open' : ''}">
  <div class="accordion-header" on:click={() => open = !open}>
    <span class="accordion-arrow">›</span>
    <div style="flex:1">
      <div class="accordion-label">{sub.subRecipeLabel}</div>
      <div style="font-size:0.68rem; color:var(--muted)">{sub.name}</div>
    </div>
    <span class="accordion-mass">{formatGrams(masse)}g</span>
    <button class="accordion-lock {sub.isLocked ? 'locked' : ''}"
      on:click|stopPropagation={toggleLock}
      title={sub.isLocked ? 'Verrouillé — cliquer pour déverrouiller' : 'Déverrouillé — cliquer pour verrouiller'}>
      {sub.isLocked ? '🔒' : '🔓'}
    </button>
    <button on:click|stopPropagation={deleteSubRecipe}
      style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:0.85rem;padding:0.2rem 0.3rem">
      ✕
    </button>
  </div>

  {#if open}
    <div class="accordion-body">
      <a href="/recipes/{sub.id}" style="font-size:0.72rem; color:var(--accent); margin-bottom:0.8rem; display:inline-block">
        🔗 Voir la fiche complète
      </a>

      {#if scaledIngredients.length}
        <table class="ingredients-table">
          {#each scaledIngredients as ing}
            <tr>
              <td class="qty">{formatGrams(ing.quantityG)}</td>
              <td class="unit">g</td>
              <td>{ing.name}</td>
            </tr>
          {/each}
        </table>
        <div class="ingredients-total">Total : {formatGrams(masse)}g</div>
      {/if}

      {#if sub.stepsContent}
        <div style="margin-top:0.8rem; font-size:0.82rem; white-space:pre-wrap; color:var(--text)">{sub.stepsContent}</div>
      {/if}
    </div>
  {/if}
</div>
