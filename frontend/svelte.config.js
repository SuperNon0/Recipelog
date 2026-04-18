import adapter from '@sveltejs/adapter-node'

export default {
  kit: {
    adapter: adapter({ out: 'build' }),
    alias: {
      $lib: 'src/lib'
    }
  }
}
