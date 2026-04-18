<script>
  export let message = ''
  export let type = 'success'
</script>

<div class="toast {type === 'error' ? 'error' : ''}">
  {message}
</div>
