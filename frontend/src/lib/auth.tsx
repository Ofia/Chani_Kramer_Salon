/**
 * Auth context — the "global state" for who is logged in.
 *
 * Pseudo-code:
 *   AuthProvider wraps the whole app
 *   useAuth() = a hook any component can call to get:
 *     - user      → Supabase user object
 *     - profile   → our User record from the DB (has role)
 *     - loading   → true while we're checking the session
 *     - signOut() → log out
 */

import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User as SupabaseUser, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { api } from './api'

// When Supabase isn't configured yet (local dev), bypass auth entirely
const DEV_BYPASS = !import.meta.env.VITE_SUPABASE_URL

const DEV_PROFILE = {
  id: 'dev-user',
  name: 'Avi (Dev)',
  email: 'dev@salon.com',
  role: 'owner' as const,
}

interface UserProfile {
  id: string
  name: string
  email: string
  role: 'bookkeeper' | 'owner'
}

interface AuthContextType {
  user: SupabaseUser | null
  profile: UserProfile | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(DEV_BYPASS ? DEV_PROFILE : null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(!DEV_BYPASS)

  // Fetch our user profile from the backend (has role info)
  async function fetchProfile() {
    try {
      const res = await api.get('/users/me')
      setProfile(res.data)
    } catch {
      setProfile(null)
    }
  }

  useEffect(() => {
    if (DEV_BYPASS) return

    // Check if there's already a session on mount — await profile before un-blocking routes
    supabase.auth.getSession().then(async ({ data: { session } }: { data: { session: Session | null } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) await fetchProfile()
      setLoading(false)
    })

    // Listen for login / logout events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile()   // fire-and-forget — RequireOwner waits for profile separately
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    if (!DEV_BYPASS) await supabase.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
