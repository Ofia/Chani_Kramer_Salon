import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const navigate  = useNavigate()
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
      {/* Left — brand panel */}
      <div style={s.left}>
        <div style={s.leftInner}>
          <div style={s.logoMark}>CK</div>
          <h1 style={s.brandName}>Chani Kramer</h1>
          <p style={s.brandSub}>Wigs Salon · Brooklyn, NY</p>
          <p style={s.tagline}>Your salon's numbers,<br />always in order.</p>
        </div>
      </div>

      {/* Right — form panel */}
      <div style={s.right}>
        <div style={s.card}>
          {/* Header */}
          <div style={s.cardTop}>
            <div style={s.cardLogo}>CK</div>
            <h2 style={s.cardTitle}>Welcome back</h2>
            <p style={s.cardSub}>Sign in to your account</p>
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

            {error && <div style={s.errorBox}>{error}</div>}

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
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', sans-serif",
    letterSpacing: '-0.01em',
  },

  /* ── Left brand panel ── */
  left: {
    width: '40%',
    background: '#1c1c1e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 48px',
  },
  leftInner: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  logoMark: {
    width: 48,
    height: 48,
    background: 'linear-gradient(135deg, #3a3a3c 0%, #2c2c2e 100%)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.75)',
    letterSpacing: '0.04em',
    marginBottom: 8,
  },
  brandName: {
    fontSize: 28,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.9)',
    margin: 0,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
  },
  brandSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    margin: 0,
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.18)',
    margin: '24px 0 0',
    lineHeight: 1.5,
  },

  /* ── Right form panel ── */
  right: {
    flex: 1,
    background: '#fafafa',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 40px',
  },

  /* iOS-style card */
  card: {
    background: '#ffffff',
    borderRadius: 20,
    padding: '36px 32px',
    width: '100%',
    maxWidth: 380,
    boxShadow: '0 2px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.05)',
  },
  cardTop: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: 28,
    gap: 8,
  },
  cardLogo: {
    width: 44,
    height: 44,
    background: '#1c1c1e',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    fontWeight: 700,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: '0.04em',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 600,
    color: '#18181b',
    letterSpacing: '-0.02em',
    margin: 0,
  },
  cardSub: {
    fontSize: 13,
    color: '#71717a',
    margin: 0,
  },

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: '#71717a',
    letterSpacing: '-0.01em',
  },
  input: {
    padding: '10px 14px',
    border: '1px solid rgba(0,0,0,0.12)',
    borderRadius: 10,
    fontSize: 15,
    color: '#18181b',
    background: '#f9f9f9',
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    letterSpacing: '-0.01em',
  },
  errorBox: {
    color: '#ff3b30',
    fontSize: 13,
    background: 'rgba(255,59,48,0.06)',
    border: '1px solid rgba(255,59,48,0.15)',
    borderRadius: 10,
    padding: '9px 14px',
  },
  button: {
    background: '#1c1c1e',
    color: '#ffffff',
    border: 'none',
    borderRadius: 12,
    padding: '13px 0',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '-0.01em',
    marginTop: 6,
    transition: 'opacity 0.15s',
  },
}
