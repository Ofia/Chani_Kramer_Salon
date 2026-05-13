import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const navigate = useNavigate()
  const { profile } = useAuth()

  // If already logged in, redirect
  useEffect(() => {
    if (profile) navigate(profile.role === 'owner' ? '/owner' : '/bookkeeper')
  }, [profile, navigate])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
    // Auth context will handle the redirect via onAuthStateChange
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brand}>
          <h1 style={styles.salonName}>Chani Kramer</h1>
          <p style={styles.salonSub}>Wigs Salon · Brooklyn</p>
        </div>

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={styles.input}
              placeholder="you@example.com"
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={styles.input}
              placeholder="••••••••"
            />
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#F3F1ED',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  card: {
    background: '#fff',
    borderRadius: 2,
    padding: '48px 40px',
    width: '100%',
    maxWidth: 380,
    boxShadow: '0 1px 3px rgba(14,12,9,0.08)',
  },
  brand: {
    textAlign: 'center',
    marginBottom: 36,
  },
  salonName: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: 28,
    fontWeight: 500,
    color: '#0E0C09',
    margin: 0,
    letterSpacing: '0.02em',
  },
  salonSub: {
    color: '#6A6560',
    fontSize: 13,
    marginTop: 4,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: '#6A6560',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },
  input: {
    padding: '10px 12px',
    border: '1px solid rgba(14,12,9,0.14)',
    borderRadius: 2,
    fontSize: 14,
    color: '#0E0C09',
    background: '#fff',
    outline: 'none',
  },
  error: {
    color: '#c0392b',
    fontSize: 13,
    margin: 0,
  },
  button: {
    background: '#0E0C09',
    color: '#fff',
    border: 'none',
    borderRadius: 2,
    padding: '12px 0',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    letterSpacing: '0.04em',
    marginTop: 4,
  },
}
