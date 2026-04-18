const BASE = '/api'

async function request(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  }
  if (body !== undefined) opts.body = JSON.stringify(body)

  const res = await fetch(BASE + path, opts)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `Erreur ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// ─── Recettes ────────────────────────────────────────────────────────────────

export const recipesApi = {
  list:      (params = {}) => request('GET', '/recipes?' + new URLSearchParams(params)),
  get:       (id)          => request('GET', `/recipes/${id}`),
  create:    (data)        => request('POST', '/recipes', data),
  update:    (id, data)    => request('PATCH', `/recipes/${id}`, data),
  delete:    (id)          => request('DELETE', `/recipes/${id}`),
  duplicate: (id)          => request('POST', `/recipes/${id}/duplicate`),
  variant:   (id, data)    => request('POST', `/recipes/${id}/variant`, data),

  pdf: (id, params = {}) => `/api/recipes/${id}/pdf?${new URLSearchParams(params)}`,

  share:       (id)  => request('POST', `/recipes/${id}/share`),
  unshare:     (id)  => request('DELETE', `/recipes/${id}/share`),

  addSubRecipe:    (id, data)          => request('POST', `/recipes/${id}/sub-recipes`, data),
  updateSubRecipe: (id, subId, data)   => request('PATCH', `/recipes/${id}/sub-recipes/${subId}`, data),
  deleteSubRecipe: (id, subId)         => request('DELETE', `/recipes/${id}/sub-recipes/${subId}`),

  addComment:    (id, data)            => request('POST', `/recipes/${id}/comments`, data),
  updateComment: (id, commentId, data) => request('PATCH', `/recipes/${id}/comments/${commentId}`, data),
  deleteComment: (id, commentId)       => request('DELETE', `/recipes/${id}/comments/${commentId}`)
}

// ─── Cahiers ─────────────────────────────────────────────────────────────────

export const cookbooksApi = {
  list:   ()       => request('GET', '/cookbooks'),
  get:    (id)     => request('GET', `/cookbooks/${id}`),
  create: (data)   => request('POST', '/cookbooks', data),
  update: (id, d)  => request('PATCH', `/cookbooks/${id}`, d),
  delete: (id)     => request('DELETE', `/cookbooks/${id}`),

  addRecipe:    (id, data)          => request('POST', `/cookbooks/${id}/recipes`, data),
  updateEntry:  (id, eId, data)     => request('PATCH', `/cookbooks/${id}/recipes/${eId}`, data),
  removeEntry:  (id, eId)           => request('DELETE', `/cookbooks/${id}/recipes/${eId}`),

  pdf:   (id, params = {}) => `/api/cookbooks/${id}/pdf?${new URLSearchParams(params)}`,
  share: (id)              => request('POST', `/cookbooks/${id}/share`)
}

// ─── Listes de courses ────────────────────────────────────────────────────────

export const shoppingApi = {
  list:     ()          => request('GET', '/shopping'),
  get:      (id)        => request('GET', `/shopping/${id}`),
  create:   (data)      => request('POST', '/shopping', data),
  update:   (id, d)     => request('PATCH', `/shopping/${id}`, d),
  delete:   (id)        => request('DELETE', `/shopping/${id}`),
  generate: (id, data)  => request('POST', `/shopping/${id}/generate`, data),

  addItem:    (id, data)        => request('POST', `/shopping/${id}/items`, data),
  updateItem: (id, iId, data)   => request('PATCH', `/shopping/${id}/items/${iId}`, data),
  deleteItem: (id, iId)         => request('DELETE', `/shopping/${id}/items/${iId}`)
}

// ─── Paramètres ───────────────────────────────────────────────────────────────

export const settingsApi = {
  get:      ()      => request('GET', '/settings'),
  update:   (data)  => request('PATCH', '/settings', data),

  categories: {
    list:   ()          => request('GET', '/categories'),
    create: (data)      => request('POST', '/categories', data),
    update: (id, data)  => request('PATCH', `/categories/${id}`, data),
    delete: (id)        => request('DELETE', `/categories/${id}`)
  },

  ingredientsBase: {
    list:   ()      => request('GET', '/ingredients-base'),
    create: (data)  => request('POST', '/ingredients-base', data),
    delete: (id)    => request('DELETE', `/ingredients-base/${id}`)
  },

  pdfTemplates: () => request('GET', '/pdf-templates'),
  export:       ()     => request('GET', '/export'),
  import:       (data) => request('POST', '/import', data)
}

// ─── Public ───────────────────────────────────────────────────────────────────

export const publicApi = {
  get:    (token)          => request('GET', `/p/${token}`),
  pdfUrl: (token, params)  => `/p/${token}/pdf?${new URLSearchParams(params)}`
}
