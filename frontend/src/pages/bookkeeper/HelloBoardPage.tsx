import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Trash2, Pin, PinOff, Plus, LogIn, LogOut, CalendarDays, Cloud, Send, Clock } from 'lucide-react'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'

// ── Types ────────────────────────────────────────────────────

interface BoardPost {
  id: string
  author_id: string | null
  author_name: string | null
  content: string
  created_at: string
}

interface Notification {
  id: string
  title: string
  body: string | null
  scheduled_date: string | null
  is_pinned: boolean
  created_by: string | null
  created_at: string
}

interface Checkin {
  id: string
  user_id: string
  user_name: string
  date: string
  checked_in_at: string
}

interface Employee {
  id: string
  first_name: string
  last_name: string
  job_title: string
  is_active: boolean
}

interface TimeLog {
  id: string
  employee_id: string
  employee_name: string
  clock_in: string
  clock_out: string | null
  date: string
  hours: number | null
}

interface Weather {
  temp_F: string
  weatherDesc: { value: string }[]
  humidity: string
}

// ── Palette ──────────────────────────────────────────────────

const PALETTE = ['#DF5198', '#5581B1', '#E3CD94', '#97BBE9', '#EDCADB']
const PALETTE_TEXT = ['#fff',    '#fff',    '#0d0d0d', '#0d0d0d', '#0d0d0d']

function avatarColor(name: string | null): string {
  if (!name) return '#212121'
  const code = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return PALETTE[code % PALETTE.length]
}

function avatarText(name: string | null): string {
  if (!name) return '#fff'
  const code = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return PALETTE_TEXT[code % PALETTE.length]
}

// ── Helpers ──────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map(ww => ww[0]).join('').toUpperCase().slice(0, 2)
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function checkinTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// ── Analog Clock ─────────────────────────────────────────────

function AnalogClock({ now, size = 140 }: { now: Date; size?: number }) {
  const cx = size / 2
  const cy = size / 2
  const r  = size / 2 - 6

  const sec  = now.getSeconds()
  const min  = now.getMinutes()
  const hr   = now.getHours() % 12

  const secDeg  = (sec / 60) * 360
  const minDeg  = (min / 60) * 360 + (sec / 60) * 6
  const hourDeg = (hr  / 12) * 360 + (min / 60) * 30

  function handEnd(deg: number, length: number) {
    const rad = (deg - 90) * (Math.PI / 180)
    return { x: cx + length * Math.cos(rad), y: cy + length * Math.sin(rad) }
  }

  // tail: small opposite stub for balance
  function handTail(deg: number, tailLen: number) {
    const rad = (deg + 90) * (Math.PI / 180)
    return { x: cx + tailLen * Math.cos(rad), y: cy + tailLen * Math.sin(rad) }
  }

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const isHour = i % 5 === 0
    const rad    = (i / 60) * 2 * Math.PI - Math.PI / 2
    const outer  = r
    const inner  = isHour ? r - 9 : r - 4
    return (
      <line
        key={i}
        x1={cx + inner * Math.cos(rad)} y1={cy + inner * Math.sin(rad)}
        x2={cx + outer * Math.cos(rad)} y2={cy + outer * Math.sin(rad)}
        stroke={isHour ? 'rgba(13,13,13,0.28)' : 'rgba(13,13,13,0.1)'}
        strokeWidth={isHour ? 1.8 : 0.8}
        strokeLinecap="round"
      />
    )
  })

  const hEnd = handEnd(hourDeg, r * 0.48)
  const mEnd = handEnd(minDeg,  r * 0.68)
  const sEnd = handEnd(secDeg,  r * 0.74)
  const sTail = handTail(secDeg, r * 0.18)

  return (
    <svg width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
      {/* Face */}
      <circle cx={cx} cy={cy} r={r} fill="#ffffff" stroke="rgba(13,13,13,0.09)" strokeWidth={1.5} />
      {/* Subtle inner ring */}
      <circle cx={cx} cy={cy} r={r - 2} fill="none" stroke="rgba(151,187,233,0.15)" strokeWidth={1} />

      {/* Tick marks */}
      {ticks}

      {/* Hour hand — short, thick */}
      <line x1={cx} y1={cy} x2={hEnd.x} y2={hEnd.y}
        stroke="#0d0d0d" strokeWidth={3.5} strokeLinecap="round" />

      {/* Minute hand — longer, medium */}
      <line x1={cx} y1={cy} x2={mEnd.x} y2={mEnd.y}
        stroke="#0d0d0d" strokeWidth={2.5} strokeLinecap="round" />

      {/* Second hand — thin, blue accent + tail */}
      <line x1={sTail.x} y1={sTail.y} x2={sEnd.x} y2={sEnd.y}
        stroke="#97BBE9" strokeWidth={1.2} strokeLinecap="round" />

      {/* Center cap */}
      <circle cx={cx} cy={cy} r={4}   fill="#0d0d0d" />
      <circle cx={cx} cy={cy} r={2}   fill="#97BBE9" />
    </svg>
  )
}

// ── Clock / Weather Widget ────────────────────────────────────

function ClockWeatherWidget() {
  const [now, setNow] = useState(new Date())
  const [weather, setWeather] = useState<Weather | null>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    fetch('https://wttr.in/Brooklyn,NY?format=j1')
      .then(r => r.json())
      .then(d => setWeather(d.current_condition?.[0] ?? null))
      .catch(() => {/* weather is optional */})
  }, [])

  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div style={{ ...w.card, borderTop: `3px solid #97BBE9`, alignItems: 'center' }}>
      <AnalogClock now={now} size={140} />
      <div style={w.clockDate}>{dateStr}</div>
      {weather && (
        <div style={w.weatherRow}>
          <Cloud size={14} color="#97BBE9" />
          <span style={w.weatherText}>
            {weather.weatherDesc?.[0]?.value} · {weather.temp_F}°F · {weather.humidity}% humidity · Brooklyn, NY
          </span>
        </div>
      )}
    </div>
  )
}

// ── Thread Widget ─────────────────────────────────────────────

function ThreadWidget() {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const textRef = useRef<HTMLTextAreaElement>(null)

  const { data: posts = [] } = useQuery<BoardPost[]>({
    queryKey: ['board-posts'],
    queryFn: () => api.get('/board-posts/').then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
  })

  const postMutation = useMutation({
    mutationFn: (content: string) => api.post('/board-posts/', { content }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['board-posts'] }); setText('') },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/board-posts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['board-posts'] }),
  })

  function handlePost() {
    const trimmed = text.trim()
    if (!trimmed) return
    postMutation.mutate(trimmed)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePost()
  }

  const myBg = avatarColor(profile?.name ?? null)
  const myFg = avatarText(profile?.name ?? null)

  return (
    <div style={{ ...w.card, borderTop: '3px solid #DF5198' }}>
      <div style={w.widgetHeader}>
        <span style={w.widgetTitle}>Thread</span>
        <span style={w.widgetSub}>{posts.length} posts</span>
      </div>

      {/* Compose */}
      <div style={w.composeBox}>
        <div style={{ ...w.avatar, background: myBg, color: myFg, flexShrink: 0 }}>
          {initials(profile?.name ?? null)}
        </div>
        <div style={w.composeRight}>
          <textarea
            ref={textRef}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Share something with the team…"
            rows={2}
            style={w.composeInput}
          />
          <div style={w.composeFooter}>
            <span style={w.composeHint}>⌘↵ to post</span>
            <button
              onClick={handlePost}
              disabled={!text.trim() || postMutation.isPending}
              style={{ ...w.postBtn, opacity: !text.trim() ? 0.4 : 1 }}
            >
              <Send size={12} />
              Post
            </button>
          </div>
        </div>
      </div>

      {/* Feed */}
      <div style={w.feed}>
        {posts.length === 0 && (
          <div style={w.emptyFeed}>No posts yet — be the first!</div>
        )}
        {posts.map(post => {
          const bg = avatarColor(post.author_name)
          const fg = avatarText(post.author_name)
          return (
            <div key={post.id} style={w.postRow}>
              <div style={{ ...w.avatar, background: bg, color: fg, flexShrink: 0 }}>
                {initials(post.author_name)}
              </div>
              <div style={w.postBody}>
                <div style={w.postMeta}>
                  <span style={{ ...w.postAuthor, color: bg === '#E3CD94' || bg === '#97BBE9' || bg === '#EDCADB' ? '#0d0d0d' : bg }}>
                    {post.author_name ?? 'Unknown'}
                  </span>
                  <span style={w.postTime}>{timeAgo(post.created_at)}</span>
                </div>
                <div style={w.postContent}>{post.content}</div>
              </div>
              {(post.author_id === profile?.id || profile?.role === 'owner') && (
                <button
                  onClick={() => deleteMutation.mutate(post.id)}
                  style={w.iconBtn}
                  title="Delete"
                >
                  <Trash2 size={13} color="rgba(13,13,13,0.25)" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Notifications Widget ──────────────────────────────────────

function NotificationsWidget() {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const isOwner = profile?.role === 'owner'
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', body: '', scheduled_date: '', is_pinned: false })

  const { data: notifs = [] } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => api.get('/notifications/').then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof form) => api.post('/notifications/', {
      title: data.title,
      body: data.body || null,
      scheduled_date: data.scheduled_date || null,
      is_pinned: data.is_pinned,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
      setShowForm(false)
      setForm({ title: '', body: '', scheduled_date: '', is_pinned: false })
    },
  })

  const pinMutation = useMutation({
    mutationFn: ({ id, is_pinned }: { id: string; is_pinned: boolean }) =>
      api.patch(`/notifications/${id}`, { is_pinned }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  return (
    <div style={{ ...w.card, borderTop: '3px solid #E3CD94' }}>
      <div style={w.widgetHeader}>
        <span style={w.widgetTitle}>Notices</span>
        {isOwner && (
          <button onClick={() => setShowForm(v => !v)} style={w.iconBtn} title="Add notice">
            <Plus size={14} color="#212121" />
          </button>
        )}
      </div>

      {showForm && isOwner && (
        <div style={w.notifForm}>
          <input
            placeholder="Title *"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            style={w.input}
          />
          <input
            placeholder="Details (optional)"
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            style={w.input}
          />
          <input
            type="date"
            value={form.scheduled_date}
            onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
            style={w.input}
          />
          <label style={w.checkLabel}>
            <input
              type="checkbox"
              checked={form.is_pinned}
              onChange={e => setForm(f => ({ ...f, is_pinned: e.target.checked }))}
            />
            Pin to top
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.title.trim()}
              style={{ ...w.postBtn, opacity: !form.title.trim() ? 0.4 : 1 }}
            >
              Save
            </button>
            <button onClick={() => setShowForm(false)} style={w.cancelBtn}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {notifs.length === 0 && <div style={w.emptyFeed}>No upcoming notices</div>}
        {notifs.map(n => (
          <div key={n.id} style={{ ...w.notifRow, ...(n.is_pinned ? w.notifPinned : {}) }}>
            <div style={{ flex: 1 }}>
              <div style={w.notifTitle}>{n.title}</div>
              {n.body && <div style={w.notifBody}>{n.body}</div>}
              {n.scheduled_date && (
                <span style={w.notifDateBadge}>{fmtDate(n.scheduled_date)}</span>
              )}
            </div>
            {isOwner && (
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => pinMutation.mutate({ id: n.id, is_pinned: !n.is_pinned })}
                  style={w.iconBtn}
                  title={n.is_pinned ? 'Unpin' : 'Pin'}
                >
                  {n.is_pinned
                    ? <PinOff size={12} color="#DF5198" />
                    : <Pin size={12} color="rgba(13,13,13,0.3)" />
                  }
                </button>
                <button
                  onClick={() => deleteMutation.mutate(n.id)}
                  style={w.iconBtn}
                  title="Delete"
                >
                  <Trash2 size={12} color="rgba(13,13,13,0.3)" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Employee Clock-In Widget ──────────────────────────────────

function CheckinWidget() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState('')
  const [error, setError] = useState('')

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['employees-active'],
    queryFn: () => api.get('/employees/?active_only=true').then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
  })

  const { data: logs = [] } = useQuery<TimeLog[]>({
    queryKey: ['time-logs-today'],
    queryFn: () => api.get('/time-logs/today').then(r => Array.isArray(r.data) ? r.data : []).catch(() => []),
    refetchInterval: 60000,
  })

  const clockInMutation = useMutation({
    mutationFn: (employee_id: string) => api.post('/time-logs/clock-in', { employee_id }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['time-logs-today'] }); setSelectedId(''); setError('') },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Clock-in failed'),
  })

  const clockOutMutation = useMutation({
    mutationFn: (employee_id: string) => api.post(`/time-logs/clock-out/${employee_id}`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['time-logs-today'] }); setError('') },
    onError: (e: any) => setError(e?.response?.data?.detail ?? 'Clock-out failed'),
  })

  // employees currently clocked in (open log = no clock_out)
  const openLogs = logs.filter(l => !l.clock_out)
  const openIds  = new Set(openLogs.map(l => l.employee_id))

  const selectedIsIn = selectedId ? openIds.has(selectedId) : false

  function handleAction() {
    if (!selectedId) return
    setError('')
    if (selectedIsIn) {
      clockOutMutation.mutate(selectedId)
    } else {
      clockInMutation.mutate(selectedId)
    }
  }

  return (
    <div style={{ ...w.card, borderTop: '3px solid #5581B1' }}>
      <div style={w.widgetHeader}>
        <span style={w.widgetTitle}>Who's In</span>
        <span style={w.widgetSub}>{openLogs.length} clocked in</span>
      </div>

      {/* Dropdown + action */}
      <div style={w.clockRow}>
        <select
          value={selectedId}
          onChange={e => { setSelectedId(e.target.value); setError('') }}
          style={w.empSelect}
        >
          <option value="">Select employee…</option>
          {[...employees]
            .sort((a, b) => a.first_name.localeCompare(b.first_name))
            .map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.first_name} {emp.last_name}
                {openIds.has(emp.id) ? ' ✓' : ''}
              </option>
            ))
          }
        </select>
        <button
          onClick={handleAction}
          disabled={!selectedId || clockInMutation.isPending || clockOutMutation.isPending}
          style={{
            ...(selectedIsIn ? w.checkOutBtn : w.checkInBtn),
            opacity: !selectedId ? 0.45 : 1,
          }}
        >
          {selectedIsIn ? <><LogOut size={12} /> Clock Out</> : <><LogIn size={12} /> Clock In</>}
        </button>
      </div>

      {error && <div style={w.clockError}>{error}</div>}

      {/* Grid of who's currently in */}
      {openLogs.length > 0 && (
        <div style={w.checkinGrid}>
          {openLogs.map(l => {
            const bg = avatarColor(l.employee_name)
            const fg = avatarText(l.employee_name)
            return (
              <div key={l.id} style={w.checkinPerson}>
                <div style={{ ...w.checkinAvatar, background: bg, color: fg }}>{initials(l.employee_name)}</div>
                <div style={w.checkinName}>{l.employee_name.split(' ')[0]}</div>
                <div style={w.checkinTime}>{checkinTime(l.clock_in)}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Compact list of clocked-out employees (left today) */}
      {logs.filter(l => l.clock_out).length > 0 && (
        <div style={w.doneSection}>
          <div style={w.doneSectionLabel}><Clock size={10} color="rgba(13,13,13,0.35)" /> Left today</div>
          <div style={w.doneList}>
            {logs.filter(l => l.clock_out).map(l => (
              <span key={l.id} style={w.doneChip}>
                {l.employee_name.split(' ')[0]} · {l.hours != null ? `${l.hours}h` : '—'}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Calendar Placeholder ──────────────────────────────────────

function CalendarPlaceholder() {
  return (
    <div style={{ ...w.card, borderTop: '3px solid #EDCADB', opacity: 0.65 }}>
      <div style={w.widgetHeader}>
        <span style={w.widgetTitle}>Today's Appointments</span>
      </div>
      <div style={w.calPlaceholder}>
        <CalendarDays size={28} color="#EDCADB" />
        <span style={w.calPlaceholderText}>DaySmart integration coming soon</span>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────

function greeting(name: string | undefined): { salutation: string; firstName: string } {
  const h = new Date().getHours()
  const salutation = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return { salutation, firstName: name ? name.split(' ')[0] : '' }
}

export default function HelloBoardPage() {
  const { profile } = useAuth()
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  const { salutation, firstName } = greeting(profile?.name)

  return (
    <div style={p.page}>
      <div style={p.header}>
        <h1 style={p.title}>
          {salutation}{firstName && <>, <span style={p.titleName}>{firstName}</span></>}
        </h1>
        <p style={p.sub}>{today}</p>
      </div>

      <div style={p.grid}>
        <div style={p.leftCol}>
          <ThreadWidget />
        </div>
        <div style={p.rightCol}>
          <ClockWeatherWidget />
          <NotificationsWidget />
          <CheckinWidget />
          <CalendarPlaceholder />
        </div>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────

const BORDER = '1px solid rgba(13,13,13,0.08)'

const p: Record<string, React.CSSProperties> = {
  page:      { fontFamily: "'Inter', -apple-system, sans-serif" },
  header:    { marginBottom: 28 },
  title:     { fontSize: 26, fontWeight: 700, color: '#0d0d0d', letterSpacing: '-0.03em', margin: 0 },
  titleName: { color: '#DF5198' },
  sub:       { fontSize: 13, color: 'rgba(13,13,13,0.45)', marginTop: 4 },
  grid:      { display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' },
  leftCol:   { display: 'flex', flexDirection: 'column' },
  rightCol:  { display: 'flex', flexDirection: 'column', gap: 16 },
}

const w: Record<string, React.CSSProperties> = {
  // Card shell
  card:         { background: '#ffffff', border: BORDER, borderRadius: 14, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 },

  // Widget header
  widgetHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  widgetTitle:  { fontSize: 13, fontWeight: 600, color: '#0d0d0d', letterSpacing: '-0.01em' },
  widgetSub:    { fontSize: 11, color: 'rgba(13,13,13,0.4)' },

  // Clock
  clockDate:    { fontSize: 13, color: 'rgba(13,13,13,0.5)', marginTop: 2 },
  weatherRow:   { display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 },
  weatherText:  { fontSize: 11, color: 'rgba(13,13,13,0.45)' },

  // Thread compose
  composeBox:   { display: 'flex', gap: 10, alignItems: 'flex-start' },
  composeRight: { flex: 1, display: 'flex', flexDirection: 'column', gap: 6 },
  composeInput: { width: '100%', border: BORDER, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#0d0d0d', resize: 'none', outline: 'none', fontFamily: 'inherit', background: '#fafaf9', boxSizing: 'border-box' as const },
  composeFooter:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  composeHint:  { fontSize: 10, color: 'rgba(13,13,13,0.3)' },

  // Thread feed
  feed:         { display: 'flex', flexDirection: 'column', maxHeight: 500, overflowY: 'auto' as const },
  emptyFeed:    { fontSize: 12, color: 'rgba(13,13,13,0.4)', textAlign: 'center' as const, padding: '20px 0' },
  postRow:      { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 0', borderTop: BORDER },
  postBody:     { flex: 1 },
  postMeta:     { display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 },
  postAuthor:   { fontSize: 12, fontWeight: 600 },
  postTime:     { fontSize: 10, color: 'rgba(13,13,13,0.4)' },
  postContent:  { fontSize: 13, color: '#0d0d0d', lineHeight: 1.5, whiteSpace: 'pre-wrap' as const },

  // Notifications
  notifForm:       { display: 'flex', flexDirection: 'column', gap: 8, padding: '12px', background: '#fafaf9', borderRadius: 8, border: BORDER },
  notifRow:        { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 8, background: '#fafaf9' },
  notifPinned:     { background: 'rgba(223,81,152,0.06)', border: '1px solid rgba(223,81,152,0.18)' },
  notifTitle:      { fontSize: 12, fontWeight: 600, color: '#0d0d0d' },
  notifBody:       { fontSize: 11, color: 'rgba(13,13,13,0.6)', marginTop: 2 },
  notifDateBadge:  { display: 'inline-block', marginTop: 5, fontSize: 10, fontWeight: 500, color: '#fff', background: '#5581B1', borderRadius: 4, padding: '2px 7px' },

  // Check-in (legacy — kept for reference)
  checkinStatus: { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 8 },
  statusDot:     { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  statusText:    { fontSize: 11, color: 'rgba(13,13,13,0.6)', flex: 1 },
  checkinGrid:   { display: 'flex', flexWrap: 'wrap' as const, gap: 10 },
  checkinPerson: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: 52 },
  checkinAvatar: { width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 },
  checkinName:   { fontSize: 10, fontWeight: 500, color: '#0d0d0d', textAlign: 'center' as const },
  checkinTime:   { fontSize: 9, color: 'rgba(13,13,13,0.4)', textAlign: 'center' as const },
  // Employee clock widget
  clockRow:      { display: 'flex', gap: 8, alignItems: 'center' },
  empSelect:     { flex: 1, border: BORDER, borderRadius: 7, padding: '7px 10px', fontSize: 12, outline: 'none', fontFamily: 'inherit', background: '#fafaf9', color: '#0d0d0d', cursor: 'pointer' },
  clockError:    { fontSize: 11, color: '#DF5198', padding: '4px 0' },
  doneSection:   { borderTop: BORDER, paddingTop: 10, display: 'flex', flexDirection: 'column' as const, gap: 6 },
  doneSectionLabel: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'rgba(13,13,13,0.4)', fontWeight: 500 },
  doneList:      { display: 'flex', flexWrap: 'wrap' as const, gap: 5 },
  doneChip:      { fontSize: 10, color: 'rgba(13,13,13,0.55)', background: '#f5f4f2', borderRadius: 5, padding: '3px 8px' },

  // Calendar placeholder
  calPlaceholder:     { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '24px 0' },
  calPlaceholderText: { fontSize: 12, color: 'rgba(13,13,13,0.35)' },

  // Shared
  avatar:      { width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 },
  iconBtn:     { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 5 },
  postBtn:     { display: 'flex', alignItems: 'center', gap: 5, background: '#DF5198', color: '#fff', border: 'none', borderRadius: 7, padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: 'pointer' },
  cancelBtn:   { background: 'none', border: BORDER, borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: 'rgba(13,13,13,0.6)' },
  checkInBtn:  { display: 'flex', alignItems: 'center', gap: 5, background: '#5581B1', color: '#fff', border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' as const },
  checkOutBtn: { display: 'flex', alignItems: 'center', gap: 5, background: '#f0f0ee', color: '#0d0d0d', border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' as const },
  input:       { border: BORDER, borderRadius: 7, padding: '7px 10px', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit' },
  checkLabel:  { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(13,13,13,0.7)', cursor: 'pointer' },
}
