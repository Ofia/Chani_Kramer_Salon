import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { useViewingAs } from '../../lib/viewingAs'
import type { ViewingAs } from '../../lib/viewingAs'
import {
  LayoutDashboard, ClipboardList, Users, Receipt, Building2,
  LogOut, Search, Sparkles, BarChart2, UserCog,
} from 'lucide-react'
import EllaChat from '../../components/EllaChat'
import RoleSwitcher from '../../components/RoleSwitcher'

type NavItem =
  | { to: string; label: string; icon: React.ElementType; end: boolean; roles: ViewingAs[]; divider?: never }
  | { divider: true; roles: ViewingAs[]; to?: never; label?: never; icon?: never; end?: never }

const BOOKKEEPING_TABS: NavItem[] = [
  { to: '/bookkeeper/wigs',      label: 'Wig Orders',    icon: Sparkles,        end: false, roles: ['sales','front_desk','bookkeeper','owner'] as ViewingAs[] },
  { to: '/bookkeeper/daily',     label: 'Daily Entry',   icon: ClipboardList,   end: false, roles: ['front_desk','bookkeeper','owner'] as ViewingAs[] },
  { to: '/bookkeeper/deposits',  label: 'Deposits',      icon: Building2,       end: false, roles: ['front_desk','bookkeeper','owner'] as ViewingAs[] },
  { to: '/bookkeeper',           label: 'Daily Summary', icon: LayoutDashboard, end: true,  roles: ['bookkeeper','owner'] as ViewingAs[] },
  { to: '/bookkeeper/payroll',   label: 'Payroll',       icon: Users,           end: false, roles: ['bookkeeper','owner'] as ViewingAs[] },
  { to: '/bookkeeper/expenses',  label: 'Expenses',      icon: Receipt,         end: false, roles: ['bookkeeper','owner'] as ViewingAs[] },
  { to: '/bookkeeper/main-board',label: 'Main Board',    icon: BarChart2,       end: false, roles: ['owner'] as ViewingAs[] },
  { divider: true, roles: ['owner'] as ViewingAs[] },
  { to: '/bookkeeper/employees', label: 'Employees',     icon: UserCog,         end: false, roles: ['bookkeeper','owner'] as ViewingAs[] },
]

export default function BookkeeperLayout() {
  const { profile, signOut } = useAuth()
  const { viewingAs } = useViewingAs()

  const effectiveRole: ViewingAs = profile?.role === 'owner' ? viewingAs : 'bookkeeper'
  const visibleTabs = BOOKKEEPING_TABS.filter(t => t.roles.includes(effectiveRole))

  return (
    <div style={s.shell}>

      {/* ── Top bar ── */}
      <header style={s.topBar}>
        <div style={s.topBarLogo}>
          <img src="/logo-mark.jpeg" alt="Chani Kramer Wigs Salon" style={s.topBarLogoImg} />
        </div>
        <div style={s.topBarRight} />
      </header>

      {/* ── Sidebar ── */}
      <aside style={s.sidebar}>
        <div style={s.top}>
          <div style={s.utilRow}>
            <button style={s.searchBtn}>
              <Search size={12} color="rgba(13,13,13,0.35)" />
              <span style={s.searchLabel}>Search…</span>
              <kbd style={s.kbd}>⌘K</kbd>
            </button>
          </div>

          <nav style={s.nav}>
            {visibleTabs.map((item, i) => {
              if ('divider' in item && item.divider) {
                return <div key={`divider-${i}`} style={s.navDivider} />
              }
              const { to, label, icon: Icon, end } = item
              return (
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
              )
            })}
          </nav>
        </div>

        <div style={s.bottom}>
          {profile?.role === 'owner' && <RoleSwitcher />}
          <div style={s.userRow}>
            <div style={s.avatar}>
              {profile?.name?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <div style={s.userText}>
              <span style={s.userName}>{profile?.name}</span>
              <span style={s.userRole}>
                {profile?.role === 'owner' ? viewingAs.replace('_', ' ') : profile?.role}
              </span>
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

const BORDER = '1px solid rgba(13,13,13,0.08)'

const s: Record<string, React.CSSProperties> = {
  shell:          { display: 'flex', minHeight: '100vh', background: '#ffffff', fontFamily: "'Inter', -apple-system, sans-serif" },

  // Top bar
  topBar:         { position: 'fixed', top: 0, left: 0, right: 0, height: 44, background: '#ffffff', borderBottom: BORDER, display: 'flex', alignItems: 'stretch', zIndex: 100 },
  topBarLogo:     { width: 240, flexShrink: 0, background: '#fafaf9', borderRight: BORDER, display: 'flex', alignItems: 'center', padding: '0 14px' },
  topBarLogoImg:  { width: '100%', height: 'auto', maxHeight: 30, objectFit: 'contain' as const },
  topBarRight:    { flex: 1, background: '#ffffff' },

  // Sidebar
  sidebar:        { width: 240, background: '#fafaf9', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexShrink: 0, position: 'fixed', top: 44, left: 0, height: 'calc(100vh - 44px)', padding: '10px 0 16px', borderRight: BORDER },
  top:            { display: 'flex', flexDirection: 'column', gap: 4 },
  utilRow:        { padding: '0 8px', marginBottom: 6 },
  searchBtn:      { width: '100%', display: 'flex', alignItems: 'center', gap: 7, background: '#ffffff', border: '1px solid rgba(13,13,13,0.09)', borderRadius: 8, padding: '6px 10px', color: 'rgba(13,13,13,0.35)', fontSize: 12, cursor: 'pointer', textAlign: 'left' as const },
  searchLabel:    { flex: 1 },
  kbd:            { fontSize: 10, background: '#f0f0ee', border: '1px solid rgba(13,13,13,0.09)', borderRadius: 4, padding: '1px 5px', color: 'rgba(13,13,13,0.35)' },
  nav:            { display: 'flex', flexDirection: 'column', padding: '0 6px', gap: 1 },
  navDivider:     { height: 1, background: 'rgba(13,13,13,0.08)', margin: '6px 4px' },
  navLink:        { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8, textDecoration: 'none', fontSize: 13, transition: 'background 0.12s' },
  navLinkActive:  { background: 'rgba(214,210,203,0.5)' },
  bottom:         { display: 'flex', flexDirection: 'column', gap: 6, padding: '0 8px' },
  userRow:        { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, background: '#ffffff', border: '1px solid rgba(13,13,13,0.09)' },
  avatar:         { width: 26, height: 26, background: '#212121', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 },
  userText:       { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 },
  userName:       { fontSize: 12, fontWeight: 500, color: '#0d0d0d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.01em' },
  userRole:       { fontSize: 10, color: 'rgba(13,13,13,0.42)', textTransform: 'capitalize', letterSpacing: '0.04em' },
  signOutBtn:     { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 5, flexShrink: 0 },

  // Main
  main:           { marginLeft: 240, marginTop: 44, flex: 1, padding: '36px 40px', minHeight: 'calc(100vh - 44px)' },
}
