import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import {
  LayoutDashboard,
  FlaskConical,
  ClipboardList,
  Users,
  Receipt,
  Building2,
  LogOut,
  Search,
  Zap,
  ChevronRight,
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
        {/* ── Top ── */}
        <div style={s.top}>
          {/* Workspace block */}
          <div style={s.workspace}>
            <div style={s.wsIcon}>CK</div>
            <div style={s.wsText}>
              <span style={s.wsName}>Chani Kramer</span>
              <span style={s.wsSub}>Wigs Salon</span>
            </div>
            <ChevronRight size={14} color="rgba(255,255,255,0.25)" />
          </div>

          {/* Quick Actions + Search */}
          <div style={s.utilRow}>
            <button style={s.utilBtn}>
              <Zap size={13} />
              <span>Quick Actions</span>
              <span style={s.kbd}>⌘K</span>
            </button>
            <button style={s.utilIconBtn} title="Search">
              <Search size={14} />
            </button>
          </div>

          {/* Nav sections */}
          <nav style={s.nav}>
            {NAV_SECTIONS.map(section => (
              <div key={section.label} style={s.navSection}>
                <p style={s.sectionLabel}>{section.label}</p>
                {section.items.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    style={({ isActive }) => ({
                      ...s.navLink,
                      ...(isActive ? s.navLinkActive : {}),
                    })}
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={15} color={isActive ? '#fff' : 'rgba(255,255,255,0.45)'} strokeWidth={1.6} />
                        <span style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.55)' }}>{label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
        </div>

        {/* ── Bottom ── */}
        <div style={s.bottom}>
          <div style={s.userRow}>
            <div style={s.avatar}>
              {profile?.name?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div style={s.userText}>
              <span style={s.userName}>{profile?.name}</span>
              <span style={s.userRole}>{profile?.role}</span>
            </div>
            <button onClick={signOut} style={s.signOutBtn} title="Sign out">
              <LogOut size={13} color="rgba(255,255,255,0.3)" />
            </button>
          </div>
        </div>
      </aside>

      <main style={s.main}>
        <Outlet />
      </main>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  shell: {
    display: 'flex',
    minHeight: '100vh',
    background: '#F5F4F1',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },

  /* ── Sidebar ── */
  sidebar: {
    width: 240,
    background: '#111110',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    flexShrink: 0,
    position: 'fixed',
    top: 0,
    left: 0,
    height: '100vh',
    padding: '12px 0 16px',
    borderRight: '1px solid rgba(255,255,255,0.04)',
  },

  top: { display: 'flex', flexDirection: 'column', gap: 4 },

  workspace: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 14px 8px',
    margin: '0 8px 4px',
    borderRadius: 7,
    cursor: 'pointer',
  },
  wsIcon: {
    width: 30,
    height: 30,
    background: '#2a2927',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 7,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 600,
    color: '#A0917E',
    letterSpacing: '0.04em',
    flexShrink: 0,
  },
  wsText: { display: 'flex', flexDirection: 'column', flex: 1 },
  wsName: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontSize: 14,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 1.2,
  },
  wsSub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
  },

  utilRow: {
    display: 'flex',
    gap: 4,
    padding: '0 10px',
    marginBottom: 6,
  },
  utilBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 6,
    padding: '6px 10px',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  kbd: {
    marginLeft: 'auto',
    fontSize: 10,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 4,
    padding: '1px 5px',
    color: 'rgba(255,255,255,0.3)',
    fontFamily: 'monospace',
  },
  utilIconBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 6,
    width: 32,
    height: 32,
    color: 'rgba(255,255,255,0.4)',
    cursor: 'pointer',
    flexShrink: 0,
  },

  nav: { display: 'flex', flexDirection: 'column', padding: '0 8px' },
  navSection: { marginBottom: 16 },
  sectionLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.22)',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    padding: '0 10px 4px',
    margin: 0,
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    padding: '7px 10px',
    borderRadius: 7,
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 400,
    transition: 'background 0.1s',
    marginBottom: 1,
  },
  navLinkActive: {
    background: 'rgba(255,255,255,0.08)',
  },

  bottom: {
    display: 'flex',
    flexDirection: 'column',
    padding: '0 10px',
  },
  userRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    padding: '6px 6px',
    borderRadius: 7,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  avatar: {
    width: 28,
    height: 28,
    background: '#2a2927',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 600,
    color: '#A0917E',
    flexShrink: 0,
  },
  userText: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 },
  userName: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  userRole: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    textTransform: 'capitalize',
    letterSpacing: '0.05em',
  },
  signOutBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: 4,
    borderRadius: 4,
    flexShrink: 0,
  },

  main: {
    marginLeft: 240,
    flex: 1,
    padding: '40px 52px',
  },
}
