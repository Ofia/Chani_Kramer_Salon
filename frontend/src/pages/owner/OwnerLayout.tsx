import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

const NAV_ITEMS = [
  { to: '/owner',          label: 'Dashboard', end: true },
  { to: '/owner/simulate', label: 'Simulator' },
]

export default function OwnerLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.top}>
          <div style={styles.brand}>
            <span style={styles.brandName}>Chani Kramer</span>
            <span style={styles.brandSub}>Owner View</span>
          </div>
          <nav style={styles.nav}>
            {NAV_ITEMS.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                style={({ isActive }) => ({
                  ...styles.navLink,
                  ...(isActive ? styles.navLinkActive : {}),
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div style={styles.bottom}>
          <button onClick={() => navigate('/bookkeeper')} style={styles.switchBtn}>
            ← Bookkeeper View
          </button>
          <div style={styles.userInfo}>
            <span style={styles.userName}>{profile?.name}</span>
          </div>
          <button onClick={signOut} style={styles.signOutBtn}>Sign out</button>
        </div>
      </aside>

      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', minHeight: '100vh', background: '#F3F1ED', fontFamily: "'DM Sans', system-ui, sans-serif" },
  sidebar: { width: 220, background: '#0E0C09', color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '28px 0', flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh' },
  top: { display: 'flex', flexDirection: 'column', gap: 32 },
  bottom: { display: 'flex', flexDirection: 'column', gap: 12, padding: '0 20px' },
  brand: { padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 2 },
  brandName: { fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 17, fontWeight: 500, letterSpacing: '0.02em' },
  brandSub: { fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase' },
  nav: { display: 'flex', flexDirection: 'column' },
  navLink: { padding: '10px 20px', color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: 13, borderLeft: '2px solid transparent' },
  navLinkActive: { color: '#fff', borderLeftColor: '#A0917E' },
  switchBtn: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', borderRadius: 2, padding: '7px 12px', fontSize: 12, cursor: 'pointer', textAlign: 'left' },
  userInfo: { display: 'flex', flexDirection: 'column', gap: 2 },
  userName: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 },
  signOutBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 12, cursor: 'pointer', textAlign: 'left', padding: 0 },
  main: { marginLeft: 220, flex: 1, padding: '40px 48px' },
}
