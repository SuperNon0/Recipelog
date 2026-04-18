<script>
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { cookbooksApi, settingsApi } from '$lib/api.js'
  import { showToast } from '$lib/stores.js'

  $: id = Number($page.params.id)

  let cookbook = null
  let templates = []
  let loading = true

  onMount(async () => {
    try {
      [cookbook, templates] = await Promise.all([cookbooksApi.get(id), settingsApi.pdfTemplates()])
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      loading = false
    }
  })

  async function updateCookbook(updates) {
    try {
      cookbook = await cookbooksApi.update(id, updates)
      showToast('Cahier mis à jour !')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function removeEntry(entryId) {
    try {
      await cookbooksApi.removeEntry(id, entryId)
      cookbook = { ...cookbook, entries: cookbook.entries.filter(e => e.id !== entryId) }
      showToast('Recette retirée')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function switchLinkMode(entry, mode) {
    try {
      await cookbooksApi.updateEntry(id, entry.id, { linkMode: mode })
      await reload()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function reload() {
    cookbook = await cookbooksApi.get(id)
  }

  function downloadPDF() {
    window.open(cookbooksApi.pdf(id))
  }

  async function shareCookbook() {
    try {
      const { url } = await cookbooksApi.share(id)
      const fullUrl = window.location.origin + url
      await navigator.clipboard.writeText(fullUrl)
      showToast('Lien copié dans le presse-papiers !')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }
</script>

{#if loading}
  <div class="page-content empty-state"><div class="empty-state-icon">⏳</div></div>
{:else if cookbook}
  <div class="page-content">
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem">
      <button class="btn btn-secondary" on:click={() => goto('/cookbooks')}>← Retour</button>
      <div style="display:flex; gap:0.5rem">
        <button class="btn btn-violet" on:click={shareCookbook}>🔗 Partager</button>
        <button class="btn btn-primary" on:click={downloadPDF}>📄 Télécharger PDF</button>
      </div>
    </div>

    <h1 style="margin-bottom:0.5rem">{cookbook.name}</h1>
    {#if cookbook.description}<p style="color:var(--muted); margin-bottom:1.5rem">{cookbook.description}</p>{/if}

    <!-- Configuration -->
    <div class="card">
      <div class="card-title">Configuration</div>

      <!-- Format -->
      <div class="form-group">
        <label class="form-label">Format</label>
        <div class="segmented">
          {#each ['A4','A5'] as f}
            <button class="segmented-btn {cookbook.format === f ? 'active' : ''}"
              on:click={() => updateCookbook({ format: f })}>{f}</button>
          {/each}
        </div>
      </div>

      <!-- Template -->
      {#if templates.length}
        <div class="form-group">
          <label class="form-label">Template PDF</label>
          <select class="form-select" value={cookbook.templateId}
            on:change={e => updateCookbook({ templateId: Number(e.target.value) })}>
            {#each templates as t}
              <option value={t.id}>{t.name} — {t.description}</option>
            {/each}
          </select>
        </div>
      {/if}

      <!-- Options -->
      <div style="display:flex; flex-wrap:wrap; gap:1rem">
        {#each [
          ['hasToc', 'Sommaire'],
          ['hasCover', 'Page de garde'],
          ['hasLogo', 'Logo']
        ] as [key, label]}
          <label style="display:flex; align-items:center; gap:0.4rem; cursor:pointer; font-size:0.82rem">
            <input type="checkbox" checked={cookbook[key]} on:change={e => updateCookbook({ [key]: e.target.checked })} />
            {label}
          </label>
        {/each}
      </div>

      <!-- Pied de page -->
      <div class="form-group" style="margin-top:1rem">
        <label class="form-label">Pied de page</label>
        <input class="form-input" value={cookbook.footer || ''} placeholder="Texte optionnel en bas de chaque page"
          on:blur={e => updateCookbook({ footer: e.target.value })} />
      </div>
    </div>

    <!-- Recettes du cahier -->
    <div class="card">
      <div class="card-title">Recettes ({cookbook.entries?.length ?? 0})</div>

      {#if !cookbook.entries?.length}
        <p style="color:var(--muted); font-size:0.82rem">Aucune recette — ajoutez des recettes depuis leurs fiches (menu ⋯ → Ajouter au cahier)</p>
      {:else}
        <div style="display:flex; flex-direction:column; gap:0.5rem">
          {#each cookbook.entries as entry (entry.id)}
            <div style="display:flex; align-items:center; gap:0.75rem; padding:0.6rem 0; border-bottom:1px solid var(--border)">
              <span style="color:var(--muted); font-size:0.72rem; min-width:20px">{entry.position + 1}.</span>
              <div style="flex:1">
                <a href="/recipes/{entry.recipeId}" style="font-size:0.88rem">{entry.recipe?.name ?? '?'}</a>
                <div style="font-size:0.68rem; color:var(--muted); margin-top:2px">
                  {entry.linkMode === 'linked' ? '🔗 Liée' : '📌 Figée'}
                  {#if entry.snapshotDate} — figée le {new Date(entry.snapshotDate).toLocaleDateString('fr-FR')}{/if}
                </div>
              </div>
              <div style="display:flex; gap:0.35rem">
                {#if entry.linkMode === 'linked'}
                  <button class="btn btn-secondary" style="font-size:0.65rem;padding:0.3rem 0.6rem"
                    on:click={() => switchLinkMode(entry, 'snapshot')}>📌 Figer</button>
                {:else}
                  <button class="btn btn-secondary" style="font-size:0.65rem;padding:0.3rem 0.6rem"
                    on:click={() => switchLinkMode(entry, 'linked')}>🔗 Relier</button>
                {/if}
                <button class="btn btn-danger" style="font-size:0.65rem;padding:0.3rem 0.6rem"
                  on:click={() => removeEntry(entry.id)}>Retirer</button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}
