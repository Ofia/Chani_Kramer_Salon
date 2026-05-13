import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import {
  LayoutDashboard, FlaskConical, ClipboardList, Users, Receipt, Building2,
  LogOut, Search, ChevronRight,
} from 'lucide-react'

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
          <div style={s.workspace}>
            <div style={s.wsIcon}>CK</div>
            <div style={s.wsText}>
              <span style={s.wsName}>Chani Kramer</span>
              <span style={s.wsSub}>Wigs Salon · Brooklyn</span>
            </div>
            <ChevronRight size={13} color="rgba(228,228,231,0.3)" />
          </div>

          <div style={s.utilRow}>
            <button style={s.searchBtn}>
              <Search size={12} color="#a1a1aa" />
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
                        <Icon size={15} strokeWidth={1.8} color={isActive ? '#ec4899' : 'rgba(228,228,231,0.45)'} />
                        <span style={{ color: isActive ? '#ec4899' : 'rgba(228,228,231,0.7)', fontWeight: isActive ? 600 : 400 }}>
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
              <LogOut size={13} color="rgba(228,228,231,0.4)" />
            </button>
          </div>
        </div>
      </aside>

      <main style={s.main}><Outlet /></main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', minHeight: '100vh', background: '#fafafa', fontFamily: "'Inter', -apple-system, sans-serif" },
  sidebar: { width: 240, background: '#1a1a1d', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexShrink: 0, position: 'fixed', top: 0, left: 0, height: '100vh', padding: '12px 0 16px', borderRight: '1px solid #27272a' },
  top: { display: 'flex', flexDirection: 'column', gap: 4 },
  workspace: { display: 'flex', alignItems: 'center', gap: 9, padding: '7px 12px', margin: '0 6px 4px', borderRadius: 8, cursor: 'pointer' },
  wsIcon: { width: 30, height: 30, background: '#ec4899', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.04em', flexShrink: 0 },
  wsText: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 },
  wsName: { fontSize: 13, fontWeight: 600, color: '#e4e4e7', letterSpacing: '-0.01em', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  wsSub: { fontSize: 10, color: 'rgba(228,228,231,0.45)', whiteSpace: 'nowrap' },
  utilRow: { padding: '0 8px', marginBottom: 6 },
  searchBtn: { width: '100%', display: 'flex', alignItems: 'center', gap: 7, background: '#27272a', border: '1px solid #27272a', borderRadius: 8, padding: '6px 10px', color: 'rgba(228,228,231,0.5)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' },
  searchLabel: { flex: 1 },
  kbd: { fontSize: 10, background: '#18181b', border: '1px solid #3f3f46', borderRadius: 4, padding: '1px 5px', color: 'rgba(228,228,231,0.4)', fontFamily: 'inherit' },
  nav: { display: 'flex', flexDirection: 'column', padding: '0 6px' },
  navSection: { marginBottom: 18 },
  sectionLabel: { fontSize: 10, fontWeight: 600, color: 'rgba(228,228,231,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 10px 4px', margin: 0 },
  navLink: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, textDecoration: 'none', fontSize: 13, transition: 'background 0.12s', marginBottom: 1 },
  navLinkActive: { background: '#27272a' },
  bottom: { display: 'flex', flexDirection: 'column', padding: '0 8px' },
  userRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, background: '#27272a', border: '1px solid #27272a' },
  avatar: { width: 26, height: 26, background: '#ec4899', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 },
  userText: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 },
  userName: { fontSize: 12, fontWeight: 500, color: '#e4e4e7', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' },
  userRole: { fontSize: 10, color: 'rgba(228,228,231,0.45)', textTransform: 'capitalize' },
  signOutBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 5, flexShrink: 0 },
  main: { marginLeft: 240, flex: 1, padding: '36px 40px', minHeight: '100vh' },
}
