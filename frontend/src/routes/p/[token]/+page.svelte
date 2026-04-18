<script>
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { publicApi } from '$lib/api.js'
  import { formatGrams, totalMass } from '$lib/utils/calc.js'

  $: token = $page.params.token

  let data = null
  let type = null
  let error = null
  let loading = true

  onMount(async () => {
    try {
      const result = await publicApi.get(token)
      type = result.type
      data = result.data
    } catch (e) {
      error = e.message
    } finally {
      loading = false
    }
  })
</script>

<svelte:head>
  <meta name="robots" content="noindex, nofollow">
</svelte:head>

<div style="max-width:700px; margin:0 auto; padding:2rem 1rem">

  {#if loading}
    <div style="text-align:center; padding:4rem; color:var(--muted)">Chargement...</div>

  {:else if error}
    <div style="text-align:center; padding:4rem">
      <div style="font-size:3rem; margin-bottom:1rem">🔒</div>
      <h2 style="color:var(--danger)">Lien introuvable</h2>
      <p style="color:var(--muted); margin-top:0.5rem">{error}</p>
    </div>

  {:else if type === 'recipe' && data}
    <!-- Header -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2rem">
      <span style="font-family:var(--font-serif); font-size:1.2rem; color:var(--accent)">recipe<span style="font-style:italic; color:var(--text)">log</span></span>
      <a href={publicApi.pdfUrl(token, {})} class="btn btn-primary" download>📄 Télécharger PDF</a>
    </div>

    {#if data.photoPath}
      <img src={data.photoPath} alt={data.name} style="width:100%; max-height:300px; object-fit:cover; border-radius:12px; margin-bottom:1.5rem" />
    {/if}

    <h1 style="margin-bottom:0.5rem">{data.name}</h1>

    {#if data.tags?.length}
      <div class="tags" style="margin-bottom:1rem">
        {#each data.tags as tag}<span class="tag">{tag}</span>{/each}
      </div>
    {/if}

    <div class="stat-card" style="margin-bottom:1.5rem; display:inline-flex">
      <div class="stat-label">Masse totale</div>
      <div class="stat-value">{formatGrams(data.masseTotale)}g</div>
    </div>

    {#if data.ingredients?.length}
      <div class="card">
        <div class="card-title">Ingrédients</div>
        <table class="ingredients-table">
          {#each data.ingredients as ing}
            <tr>
              <td class="qty">{formatGrams(ing.quantityG)}</td>
              <td class="unit">g</td>
              <td>{ing.name}</td>
            </tr>
          {/each}
        </table>
      </div>
    {/if}

    {#if data.stepsContent}
      <div class="card">
        <div class="card-title">Étapes</div>
        <div style="font-size:0.85rem; line-height:1.8; white-space:pre-wrap">{data.stepsContent}</div>
      </div>
    {/if}

    {#if data.notes}
      <div class="card">
        <div class="card-title">Notes</div>
        <div style="font-size:0.85rem">{data.notes}</div>
      </div>
    {/if}

    <p style="text-align:center; font-size:0.68rem; color:var(--muted); margin-top:2rem">
      Partagé via <span style="color:var(--accent)">RecipeLog</span> · super-nono.cc
    </p>

  {:else if type === 'cookbook' && data}
    <h1>{data.name}</h1>
    <p style="color:var(--muted)">{data.description || ''}</p>
    <p style="color:var(--muted); margin-top:1rem; font-size:0.82rem">Ce cahier est partagé en lecture seule.</p>
  {/if}
</div>
