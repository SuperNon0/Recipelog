<script>
  import { onMount, onDestroy } from 'svelte'
  export let show = false

  function handleOutside(e) {
    if (show && !e.target.closest('.menu-3pts')) show = false
  }

  onMount(() => document.addEventListener('click', handleOutside))
  onDestroy(() => document.removeEventListener('click', handleOutside))
</script>

<div class="menu-3pts">
  <button class="menu-3pts-btn" on:click|stopPropagation={() => show = !show}>⋯</button>
  {#if show}
    <div class="menu-3pts-dropdown">
      <slot />
    </div>
  {/if}
</div>
