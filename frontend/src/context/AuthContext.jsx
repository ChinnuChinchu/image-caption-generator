/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getMe, login as apiLogin, register as apiRegister, tokenStore } from '../api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  // true while we check a token saved from an earlier visit
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()))

  useEffect(() => {
    if (!tokenStore.get()) return
    getMe()
      .then(setUser)
      .catch(() => {}) // a 401 already cleared the token inside api.js
      .finally(() => setLoading(false))
  }, [])

  // api.js announces this when the server rejects our token (e.g. it expired)
  useEffect(() => {
    const onExpired = () => setUser(null)
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [])

  const login = useCallback(async (email, password) => {
    const { access_token } = await apiLogin(email, password)
    tokenStore.set(access_token)
    try {
      setUser(await getMe())
    } catch (error) {
      tokenStore.clear()
      throw error
    }
  }, [])

  const register = useCallback(
    async (username, email, password) => {
      await apiRegister(username, email, password)
      await login(email, password) // sign the new user straight in
    },
    [login],
  )

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}