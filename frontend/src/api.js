// All communication with the FastAPI backend goes through this file.

const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
const TOKEN_KEY = 'caption_token'

// localStorage can be unavailable (private mode, blocked), so never let it crash the app
export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      /* ignore */
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
  },
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

// FastAPI sends errors as {detail: "text"} or {detail: [{msg: ...}, ...]}
function messageFrom(data, fallback) {
  const detail = data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const text = detail
      .map((e) => (e.msg || '').replace(/^Value error, /, ''))
      .filter(Boolean)
      .join('. ')
    return text || fallback
  }
  return fallback
}

async function request(path, { method = 'GET', body, form, auth = true } = {}) {
  const headers = {}
  if (auth) {
    const token = tokenStore.get()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let payload
  if (form) {
    payload = new URLSearchParams(form) // the login endpoint expects form data
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
  } else if (body instanceof FormData) {
    payload = body // the browser sets the multipart header itself
  } else if (body !== undefined) {
    payload = JSON.stringify(body)
    headers['Content-Type'] = 'application/json'
  }

  let response
  try {
    response = await fetch(`${API_URL}${path}`, { method, headers, body: payload })
  } catch {
    throw new ApiError('Cannot reach the server. Is the backend running?', 0)
  }

  // An expired or invalid token: forget it and tell the app to go back to login
  if (response.status === 401 && auth) {
    tokenStore.clear()
    window.dispatchEvent(new Event('auth:expired'))
  }

  if (!response.ok) {
    let data = null
    try {
      data = await response.json()
    } catch {
      /* no JSON body */
    }
    throw new ApiError(messageFrom(data, `Request failed (${response.status})`), response.status)
  }
  return response
}

export const api = {
  async json(path, options) {
    const response = await request(path, options)
    return response.status === 204 ? null : response.json()
  },
  async blob(path, options) {
    const response = await request(path, options)
    return response.blob()
  },
}

export const login = (email, password) =>
  api.json('/auth/login', { method: 'POST', form: { username: email, password }, auth: false })

export const register = (username, email, password) =>
  api.json('/auth/register', { method: 'POST', body: { username, email, password }, auth: false })

export const getMe = () => api.json('/auth/me')



// ---- Images ----
export const listImages = (skip = 0, limit = 12) => api.json(`/images?skip=${skip}&limit=${limit}`)

export const uploadImage = (file) => {
  const body = new FormData()
  body.append('file', file)
  return api.json('/images/upload', { method: 'POST', body })
}

export const generateCaption = (id) => api.json(`/images/${id}/caption`, { method: 'POST' })

// text = your own caption, or null to go back to the AI caption
export const updateCaption = (id, text) =>
  api.json(`/images/${id}/caption`, { method: 'PATCH', body: { edited_caption: text } })

export const deleteImage = (id) => api.json(`/images/${id}`, { method: 'DELETE' })

export const getCaptionAudio = (id, lang = 'en') =>
  api.blob(`/images/${id}/audio?lang=${encodeURIComponent(lang)}`)