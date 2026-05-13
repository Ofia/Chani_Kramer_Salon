import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import {
  LayoutDashboard, FlaskConical, ClipboardList, Users, Receipt, Building2,
  LogOut, Search,
} from 'lucide-react'
import EllaChat from '../../components/EllaChat'

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/owner',          label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/owner/simulate', label: 'Simulator', icon: FlaskConical },
    ],
  },
  {
    label: 'Bookkeeping',
    items: [
      { to: '/bookkeeper',          label: 'Daily Summary', icon: LayoutDashboard, end: true },
      { to: '/bookkeeper/daily',    label: 'Daily Entry',   icon: ClipboardList },
      { to: '/bookkeeper/payroll',  label: 'Payroll',       icon: Users },
      { to: '/bookkeeper/expenses', label: 'Expenses',      icon: Receipt },
      { to: '/bookkeeper/deposits', label: 'Deposits',      icon: Building2 },
    ],
  },
]

export default function OwnerLayout() {
  const { profile, signOut } = useAuth()

  return (
    <div style={s.shell}>
      <aside style={s.sidebar}>
        <div style={s.top}>
          <div style={s.logoWrap}>
            <img src="/logo-mark.jpeg" alt="Chani Kramer Wigs Salon" style={s.logoImg} />
          </div>

          <div style={s.utilRow}>
            <button style={s.searchBtn}>
              <Search size={12} color="rgba(13,13,13,0.35)" />
              <span style={s.searchLabel}>Search…</span>
              <kbd style={s.kbd}>⌘K</kbd>
            </button>
          </div>

          <nav style={s.nav}>
            {NAV_SECTIONS.map(section => (
              <div key={section.label} style={s.navSection}>
                <p style={s.sectionLabel}>{section.label}</p>
                {section.items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink key={to} to={to} end={end}
                    style={({ isActive }) => ({ ...s.navLink, ...(isActive ? s.navLinkActive : {}) })}>
                    {({ isActive }) => (
                      <>
                        <Icon size={15} strokeWidth={1.8} color={isActive ? '#212121' : 'rgba(13,13,13,0.35)'} />
                        <span style={{ color: isActive ? '#212121' : 'rgba(13,13,13,0.55)', fontWeight: isActive ? 600 : 400 }}>
                          {label}
                        </span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </div>

        <div style={s.bottom}>
          <div style={s.userRow}>
            <div style={s.avatar}>{profile?.name?.charAt(0).toUpperCase() ?? '?'}</div>
            <div style={s.userText}>
              <span style={s.userName}>{profile?.name}</span>
              <span style={s.userRole}>{profile?.role}</span>
            </div>
            <button onClick={signOut} style={s.signOutBtn} title="Sign out">
              <LogOut size={13} color="rgba(13,13,13,0.35)" />
            </button>
          </div>
        </div>
      </aside>

      <main style={s.main}>
        <Outlet />
      </main>

      <EllaChat />
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', minHeight: '100vh', background: '#ffffff', fontFamily: "'Inter', -apple-system, sans-serif" },
  sidebar: { width: 240, background: '#fafaf9', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh', padding: '12px 0 16px', borderRight: '1px solid rgba(13,13,13,0.08)' },
  top: { display: 'flex', flexDirection: 'column', gap: 4 },
  logoWrap: { padding: '10px 14px 6px', margin: '0 6px 4px' },
  logoImg: { width: '100%', borderRadius: 8, objectFit: 'contain' as const, background: '#fff', border: '1px solid rgba(13,13,13,0.07)' },
  utilRow: { padding: '0 8px', marginBottom: 6 },
  searchBtn: { width: '100%', display: 'flex', alignItems: 'center', gap: 7, background: '#ffffff', border: '1px solid rgba(13,13,13,0.09)', borderRadius: 8, padding: '6px 10px', color: 'rgba(13,13,13,0.35)', fontSize: 12, cursor: 'pointer', textAlign: 'left' as const },
  searchLabel: { flex: 1 },
  kbd: { fontSize: 10, background: '#f0f0ee', border: '1px solid rgba(13,13,13,0.09)', borderRadius: 4, padding: '1px 5px', color: 'rgba(13,13,13,0.35)' },
  nav: { display: 'flex', flexDirection: 'column', padding: '0 6px' },
  navSection: { marginBottom: 18 },
  sectionLabel: { fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 10px 4px', margin: 0 },
  navLink: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, textDecoration: 'none', fontSize: 13, transition: 'background 0.12s', marginBottom: 1 },
  navLinkActive: { background: 'rgba(214,210,203,0.5)' },
  bottom: { display: 'flex', flexDirection: 'column', padding: '0 8px' },
  userRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, background: '#ffffff', border: '1px solid rgba(13,13,13,0.09)' },
  avatar: { width: 26, height: 26, background: '#212121', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 },
  userText: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 },
  userName: { fontSize: 12, fontWeight: 500, color: '#0d0d0d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' },
  userRole: { fontSize: 10, color: 'rgba(13,13,13,0.42)', textTransform: 'capitalize', letterSpacing: '0.04em' },
  signOutBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 5, flexShrink: 0 },
  main: { marginLeft: 240, flex: 1, padding: '36px 40px', minHeight: '100vh' },
}
