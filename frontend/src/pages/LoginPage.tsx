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
  const { profile, user } = useAuth()

  // Navigate as soon as auth is confirmed — don't block on profile loading
  useEffect(() => {
    if (profile) {
      navigate(profile.role === 'owner' ? '/bookkeeper/hello' : '/bookkeeper/hello')
    } else if (user) {
      // Auth succeeded but profile still loading — go to Hello Board now,
      // sidebar will update once profile arrives
      navigate('/bookkeeper/hello')
    }
  }, [profile, user, navigate])

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
          <img src="/logo-full.jpeg" alt="Chani Kramer Wigs Salon" style={s.leftLogo} />
          <p style={s.tagline}>Your salon's numbers,<br />always in order.</p>
          <p style={s.address}>1474 60th St · Brooklyn, NY 11219</p>
        </div>
      </div>

      {/* Right — form panel */}
      <div style={s.right}>
        <div style={s.card}>
          <div style={s.cardTop}>
            <img src="/logo-full.jpeg" alt="Chani Kramer Wigs Salon" style={s.cardLogo} />
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
    fontFamily: "'Inter', -apple-system, sans-serif",
    background: '#f7f7f5',
  },

  left: {
    width: '42%',
    background: '#f7f7f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 56px',
    borderRight: '1px solid rgba(13,13,13,0.09)',
  },
  leftInner: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  leftLogo: {
    width: 300,
    objectFit: 'contain' as const,
    borderRadius: 10,
  },
  tagline: {
    fontSize: 18,
    fontWeight: 500,
    color: '#0d0d0d',
    lineHeight: 1.5,
    letterSpacing: '-0.01em',
  },
  address: {
    fontSize: 12,
    color: 'rgba(13,13,13,0.42)',
    letterSpacing: '0.02em',
  },

  right: {
    flex: 1,
    background: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 40px',
  },

  card: {
    background: '#ffffff',
    borderRadius: 14,
    width: '100%',
    maxWidth: 400,
    border: '1px solid rgba(13,13,13,0.09)',
    boxShadow: '0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)',
    padding: '36px 32px',
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
    width: 180,
    objectFit: 'contain' as const,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: '#0d0d0d',
    letterSpacing: '-0.02em',
  },
  cardSub: {
    fontSize: 13,
    color: 'rgba(13,13,13,0.42)',
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
    fontSize: 11,
    fontWeight: 600,
    color: 'rgba(13,13,13,0.42)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  },
  input: {
    padding: '10px 14px',
    border: '1px solid rgba(13,13,13,0.12)',
    borderRadius: 8,
    fontSize: 15,
    color: '#0d0d0d',
    background: '#f7f7f5',
    outline: 'none',
    letterSpacing: '-0.01em',
  },
  errorBox: {
    color: '#dc2626',
    fontSize: 13,
    background: 'rgba(220,38,38,0.06)',
    border: '1px solid rgba(220,38,38,0.15)',
    borderRadius: 8,
    padding: '9px 14px',
  },
  button: {
    background: '#0d0d0d',
    color: '#ffffff',
    border: 'none',
    borderRadius: 9,
    padding: '13px 0',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    letterSpacing: '-0.01em',
    marginTop: 6,
    transition: 'opacity 0.12s',
  },
}
