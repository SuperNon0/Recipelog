<script>
  import '../app.css'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { toast, recipesStore, categoriesStore } from '$lib/stores.js'
  import { recipesApi as rApi, settingsApi as sApi } from '$lib/api.js'
  import { onMount } from 'svelte'
  import Toast from '$lib/components/Toast.svelte'

  const navTabs = [
    { label: 'Recettes',       href: '/' },
    { label: 'Favoris',        href: '/favorites' },
    { label: 'Cahiers',        href: '/cookbooks' },
    { label: 'Courses',        href: '/shopping' },
    { label: 'Paramètres',     href: '/settings' }
  ]

  onMount(async () => {
    try {
      const [recipes, cats] = await Promise.all([
        rApi.list(),
        sApi.categories.list()
      ])
      recipesStore.set(recipes)
      categoriesStore.set(cats)
    } catch (e) {
      console.error(e)
    }
  })

  $: currentPath = $page.url.pathname
  $: activeTab = navTabs.find(t => t.href === currentPath)?.href ?? '/'
</script>

<header class="header">
  <span class="header-logo">recipe<span>log</span></span>
  <span class="header-count">{$recipesStore.length} recettes</span>
</header>

<nav class="nav">
  {#each navTabs as tab}
    <button
      class="nav-tab {activeTab === tab.href ? 'active' : ''}"
      on:click={() => goto(tab.href)}
    >
      {tab.label}
    </button>
  {/each}
</nav>

<slot />

{#if $toast}
  <Toast message={$toast.message} type={$toast.type} />
{/if}
