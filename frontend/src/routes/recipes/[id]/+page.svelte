<script>
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { recipesApi, cookbooksApi } from '$lib/api.js'
  import { showToast, currentRecipe, recipesStore } from '$lib/stores.js'
  import { computeCoefficient, applyCoeff, totalMass, formatGrams } from '$lib/utils/calc.js'
  import RecipeModal from '$lib/components/RecipeModal.svelte'
  import SubRecipeAccordion from '$lib/components/SubRecipeAccordion.svelte'
  import AddToCookbookModal from '$lib/components/AddToCookbookModal.svelte'
  import AddSubRecipeModal from '$lib/components/AddSubRecipeModal.svelte'
  import Menu3pts from '$lib/components/Menu3pts.svelte'

  $: id = Number($page.params.id)

  let recipe = null
  let loading = true
  let showEditModal = false
  let showAddToCookbookModal = false
  let showAddSubRecipeModal = false
  let showMenu = false

  // Multiplication
  let multiMode = 'coefficient'
  let multiValue = 1
  let pivotIngredientId = null
  $: coef = computeCoefficient(multiMode, multiValue, recipe, pivotIngredientId)
  $: scaledIngredients = recipe ? applyCoeff(recipe.ingredients, coef) : []
  $: scaledTotal = totalMass(scaledIngredients)

  // Commentaire
  let newComment = ''

  async function load() {
    loading = true
    try {
      recipe = await recipesApi.get(id)
      currentRecipe.set(recipe)
    } catch (e) {
      showToast(e.message, 'error')
    } finally {
      loading = false
    }
  }

  async function handleEdit(event) {
    showEditModal = false
    try {
      await recipesApi.update(id, event.detail)
      showToast('Recette mise à jour !')
      await load()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function handleDelete() {
    if (!confirm('Supprimer cette recette ? Cette action est irréversible.')) return
    try {
      await recipesApi.delete(id)
      showToast('Recette supprimée')
      goto('/')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function handleDuplicate() {
    try {
      const dup = await recipesApi.duplicate(id)
      showToast('Recette dupliquée !')
      goto(`/recipes/${dup.id}`)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function handleVariant() {
    try {
      const v = await recipesApi.variant(id, { note: '' })
      showToast('Variante créée !')
      goto(`/recipes/${v.id}`)
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function toggleFavorite() {
    try {
      await recipesApi.update(id, { favorite: !recipe.favorite })
      recipe = { ...recipe, favorite: !recipe.favorite }
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function setRating(n) {
    const newRating = recipe.rating === n ? 0 : n
    try {
      await recipesApi.update(id, { rating: newRating })
      recipe = { ...recipe, rating: newRating }
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function addComment() {
    if (!newComment.trim()) return
    try {
      const comment = await recipesApi.addComment(id, { content: newComment.trim() })
      recipe = { ...recipe, comments: [comment, ...(recipe.comments || [])] }
      newComment = ''
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function deleteComment(commentId) {
    try {
      await recipesApi.deleteComment(id, commentId)
      recipe = { ...recipe, comments: recipe.comments.filter(c => c.id !== commentId) }
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function handleShare() {
    try {
      const { url } = await recipesApi.share(id)
      const fullUrl = window.location.origin + url
      await navigator.clipboard.writeText(fullUrl)
      showToast('Lien copié dans le presse-papiers !')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  async function handleSubRecipeAdded() {
    showAddSubRecipeModal = false
    await load()
  }

  async function toggleSubRecipeLock(subId, isLocked) {
    try {
      await recipesApi.updateSubRecipe(id, subId, { isLocked: !isLocked })
      await load()
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  function resetMultiply() {
    multiMode = 'coefficient'
    multiValue = 1
    pivotIngredientId = null
  }

  onMount(load)
</script>

{#if loading}
  <div class="page-content empty-state">
    <div class="empty-state-icon">⏳</div>
    <p class="empty-state-text">Chargement...</p>
  </div>
{:else if recipe}
  <div class="page-content">

    <!-- En-tête -->
    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1rem">
      <button class="btn btn-secondary" on:click={() => goto('/')}>← Retour</button>
      <Menu3pts bind:show={showMenu}>
        <button class="menu-3pts-item" on:click={() => { showEditModal = true; showMenu = false }}>✏️ Modifier</button>
        <button class="menu-3pts-item" on:click={() => { handleDuplicate(); showMenu = false }}>📋 Dupliquer</button>
        <button class="menu-3pts-item" on:click={() => { handleVariant(); showMenu = false }}>🔀 Créer une variante</button>
        <button class="menu-3pts-item" on:click={() => { showAddSubRecipeModal = true; showMenu = false }}>🔗 Ajouter une sous-recette</button>
        <button class="menu-3pts-item" on:click={() => { showAddToCookbookModal = true; showMenu = false }}>📖 Ajouter au cahier</button>
        <button class="menu-3pts-item" on:click={() => { window.open(recipesApi.pdf(id, {template:'classique'})); showMenu = false }}>📄 Télécharger PDF</button>
        <button class="menu-3pts-item" on:click={() => { handleShare(); showMenu = false }}>🔗 Partager</button>
        <button class="menu-3pts-item danger" on:click={() => { handleDelete(); showMenu = false }}>🗑️ Supprimer</button>
      </Menu3pts>
    </div>

    <!-- Photo -->
    {#if recipe.photoPath}
      <img src={recipe.photoPath} alt={recipe.name}
        style="width:100%; max-height:320px; object-fit:cover; border-radius:12px; margin-bottom:1.2rem" />
    {:else}
      <div style="width:100%; height:180px; background:var(--surface); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:4rem; margin-bottom:1.2rem; border:1px solid var(--border)">🥐</div>
    {/if}

    <!-- Titre + métadonnées -->
    <h1 style="margin-bottom:0.5rem">{recipe.name}</h1>

    {#if recipe.tags?.length}
      <div class="tags" style="margin-bottom:0.8rem">
        {#each recipe.tags as tag}<span class="tag">{tag}</span>{/each}
      </div>
    {/if}

    <!-- Favori + Note -->
    <div style="display:flex; align-items:center; gap:1rem; margin-bottom:1.2rem">
      <button style="background:none;border:none;cursor:pointer;font-size:1.4rem" on:click={toggleFavorite}>
        {recipe.favorite ? '⭐' : '☆'}
      </button>
      <div class="stars">
        {#each [1,2,3,4,5] as n}
          <button type="button" class="star {recipe.rating >= n ? 'filled' : ''}" on:click={() => setRating(n)}>★</button>
        {/each}
      </div>
    </div>

    <!-- Stat masse totale -->
    <div style="display:flex; gap:1rem; margin-bottom:1.5rem">
      <div class="stat-card" style="flex:1">
        <div class="stat-label">Masse totale</div>
        <div class="stat-value">{formatGrams(scaledTotal)}g</div>
      </div>
      {#if coef !== 1}
        <div class="stat-card" style="flex:1">
          <div class="stat-label">Coefficient appliqué</div>
          <div class="stat-value">×{coef.toFixed(2)}</div>
        </div>
      {/if}
    </div>

    <!-- Zone multiplication -->
    <div class="multiply-block">
      <div class="segmented">
        {#each [['coefficient','Coefficient'],['masse_totale','Masse totale'],['ingredient_pivot','Ingrédient pivot']] as [mode, label]}
          <button class="segmented-btn {multiMode === mode ? 'active' : ''}"
            on:click={() => { multiMode = mode; multiValue = mode === 'coefficient' ? 1 : 0 }}>
            {label}
          </button>
        {/each}
      </div>

      <div style="display:flex; align-items:center; gap:0.75rem">
        {#if multiMode === 'ingredient_pivot'}
          <select class="form-select" style="flex:1" bind:value={pivotIngredientId}>
            <option value={null}>Choisir un ingrédient...</option>
            {#each recipe.ingredients as ing}
              <option value={ing.id}>{ing.name} ({formatGrams(ing.quantityG)}g)</option>
            {/each}
          </select>
        {/if}
        <input class="form-input" type="number" bind:value={multiValue}
          step={multiMode === 'coefficient' ? '0.01' : '1'}
          min="0"
          placeholder={multiMode === 'coefficient' ? '1' : 'grammes'}
          style="max-width:160px"
        />
        {#if multiMode !== 'coefficient'}<span style="color:var(--muted);font-size:0.8rem">g</span>{/if}
        <button class="btn btn-secondary" on:click={resetMultiply}>Réinitialiser</button>
      </div>
    </div>

    <!-- Ingrédients -->
    <div class="card">
      <div class="card-title">Ingrédients</div>
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
        <div class="ingredients-total">Total : {formatGrams(scaledTotal)}g</div>
      {:else}
        <p style="color:var(--muted);font-size:0.82rem">Aucun ingrédient</p>
      {/if}
    </div>

    <!-- Étapes -->
    {#if recipe.stepsContent}
      <div class="card">
        <div class="card-title">Étapes</div>
        <div style="font-size:0.85rem; line-height:1.8; white-space:pre-wrap">{recipe.stepsContent}</div>
      </div>
    {/if}

    <!-- Sous-recettes -->
    {#if recipe.subRecipes?.length}
      <div class="card">
        <div class="card-title">Sous-recettes</div>
        {#each recipe.subRecipes as sub (sub.subRecipeId)}
          <SubRecipeAccordion
            {sub}
            globalCoef={coef}
            on:toggleLock={e => toggleSubRecipeLock(e.detail.subId, e.detail.isLocked)}
            on:edit={load}
            on:delete={load}
          />
        {/each}
      </div>
    {/if}

    <!-- Métadonnées -->
    <div class="card">
      <div class="card-title">Informations</div>
      {#if recipe.source}<p style="font-size:0.82rem; color:var(--muted)">Source : <span style="color:var(--text)">{recipe.source}</span></p>{/if}
      {#if recipe.categories?.length}
        <p style="font-size:0.82rem; color:var(--muted); margin-top:0.4rem">Catégories : <span style="color:var(--text)">{recipe.categories.map(c => c.name).join(', ')}</span></p>
      {/if}
      <p style="font-size:0.7rem; color:var(--muted); margin-top:0.8rem">
        Créée le {new Date(recipe.createdAt).toLocaleDateString('fr-FR')}
        — Modifiée le {new Date(recipe.updatedAt).toLocaleDateString('fr-FR')}
      </p>
    </div>

    <!-- Notes -->
    {#if recipe.notes}
      <div class="card">
        <div class="card-title">Notes & astuces</div>
        <div style="font-size:0.85rem; white-space:pre-wrap">{recipe.notes}</div>
      </div>
    {/if}

    <!-- Commentaires -->
    <div class="card">
      <div class="card-title">Journal des essais</div>
      <div style="display:flex; gap:0.5rem; margin-bottom:1rem">
        <input class="form-input" bind:value={newComment} placeholder="Ajouter une note..." on:keydown={e => e.key === 'Enter' && addComment()} />
        <button class="btn btn-primary" on:click={addComment}>Ajouter</button>
      </div>
      {#if recipe.comments?.length}
        {#each recipe.comments as comment (comment.id)}
          <div style="padding:0.6rem 0; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:flex-start">
            <div>
              <p style="font-size:0.85rem">{comment.content}</p>
              <p style="font-size:0.68rem; color:var(--muted); margin-top:0.2rem">{new Date(comment.createdAt).toLocaleDateString('fr-FR')}</p>
            </div>
            <button style="background:none;border:none;color:var(--danger);cursor:pointer" on:click={() => deleteComment(comment.id)}>✕</button>
          </div>
        {/each}
      {:else}
        <p style="color:var(--muted); font-size:0.82rem">Aucun commentaire</p>
      {/if}
    </div>

  </div>
{/if}

<!-- Modals -->
{#if showEditModal}
  <RecipeModal {recipe} on:save={handleEdit} on:close={() => showEditModal = false} />
{/if}

{#if showAddToCookbookModal}
  <AddToCookbookModal {recipe} on:close={() => showAddToCookbookModal = false} />
{/if}

{#if showAddSubRecipeModal}
  <AddSubRecipeModal parentId={id} on:save={handleSubRecipeAdded} on:close={() => showAddSubRecipeModal = false} />
{/if}
