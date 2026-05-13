import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../../lib/auth'

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/owner',          label: 'Dashboard', end: true },
      { to: '/owner/simulate', label: 'Simulator' },
    ],
  },
  {
    label: 'Bookkeeping',
    items: [
      { to: '/bookkeeper',          label: 'Daily Summary', end: true },
      { to: '/bookkeeper/daily',    label: 'Daily Entry' },
      { to: '/bookkeeper/payroll',  label: 'Payroll' },
      { to: '/bookkeeper/expenses', label: 'Expenses' },
      { to: '/bookkeeper/deposits', label: 'Deposits' },
    ],
  },
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
            <span style={styles.brandSub}>Management</span>
          </div>
          <nav style={styles.nav}>
            {NAV_SECTIONS.map(section => (
              <div key={section.label}>
                <p style={styles.navSection}>{section.label}</p>
                {section.items.map(item => (
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
              </div>
            ))}
          </nav>
        </div>

        <div style={styles.bottom}>
          <div style={styles.userInfo}>
            <span style={styles.userName}>{profile?.name}</span>
            <span style={styles.userRole}>{profile?.role}</span>
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
  navSection: { fontSize: 10, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '16px 20px 4px', margin: 0 },
  navLink: { display: 'block', padding: '10px 20px', color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: 13, borderLeft: '2px solid transparent' },
  navLinkActive: { color: '#fff', borderLeftColor: '#A0917E' },
  userInfo: { display: 'flex', flexDirection: 'column', gap: 2 },
  userName: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 500 },
  userRole: { fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'capitalize', letterSpacing: '0.06em' },
  signOutBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 12, cursor: 'pointer', textAlign: 'left', padding: 0 },
  main: { marginLeft: 220, flex: 1, padding: '40px 48px' },
}
