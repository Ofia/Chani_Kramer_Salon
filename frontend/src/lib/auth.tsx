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

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User as SupabaseUser, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { api } from './api'

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
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

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
    // Check if there's already a session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile()
      setLoading(false)
    })

    // Listen for login / logout events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile()
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
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
