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
  }

  return (
    <div style={s.page}>
      {/* Left panel — brand */}
      <div style={s.left}>
        <div style={s.brandBlock}>
          <div style={s.logoMark}>CK</div>
          <h1 style={s.salonName}>Chani Kramer</h1>
          <p style={s.salonSub}>Wigs Salon · Brooklyn</p>
        </div>
        <p style={s.tagline}>Your salon's numbers, always in order.</p>
      </div>

      {/* Right panel — form */}
      <div style={s.right}>
        <div style={s.card}>
          <div style={s.cardHeader}>
            <h2 style={s.cardTitle}>Sign in</h2>
            <p style={s.cardSub}>Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleLogin} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                style={s.input}
                placeholder="you@example.com"
                autoFocus
              />
            </div>

            <div style={s.field}>
              <label style={s.label}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                style={s.input}
                placeholder="••••••••"
              />
            </div>

            {error && <p style={s.error}>{error}</p>}

            <button type="submit" disabled={loading} style={s.button}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },

  /* Left brand panel */
  left: {
    width: '42%',
    background: '#111110',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '60px 56px',
  },
  brandBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  logoMark: {
    width: 44,
    height: 44,
    background: '#2a2927',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    fontWeight: 700,
    color: '#A0917E',
    letterSpacing: '0.06em',
    marginBottom: 8,
  },
  salonName: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: 32,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.92)',
    margin: 0,
    letterSpacing: '0.02em',
    lineHeight: 1.1,
  },
  salonSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    margin: 0,
  },
  tagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.2)',
    margin: 0,
    letterSpacing: '0.02em',
  },

  /* Right form panel */
  right: {
    flex: 1,
    background: '#F5F4F1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 40px',
  },
  card: {
    background: '#fff',
    borderRadius: 12,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 380,
    boxShadow: '0 1px 4px rgba(14,12,9,0.06), 0 0 0 1px rgba(14,12,9,0.06)',
  },
  cardHeader: {
    marginBottom: 28,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: '#0E0C09',
    margin: '0 0 4px',
  },
  cardSub: {
    fontSize: 13,
    color: '#6A6560',
    margin: 0,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
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
    letterSpacing: '0.04em',
  },
  input: {
    padding: '9px 12px',
    border: '1px solid rgba(14,12,9,0.14)',
    borderRadius: 7,
    fontSize: 14,
    color: '#0E0C09',
    background: '#fafaf9',
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  error: {
    color: '#c0392b',
    fontSize: 13,
    margin: 0,
    background: 'rgba(192,57,43,0.06)',
    border: '1px solid rgba(192,57,43,0.15)',
    borderRadius: 6,
    padding: '8px 12px',
  },
  button: {
    background: '#111110',
    color: '#fff',
    border: 'none',
    borderRadius: 7,
    padding: '11px 0',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    letterSpacing: '0.02em',
    marginTop: 4,
    transition: 'background 0.15s',
  },
}
