import { useRef, useState, useEffect } from 'react'
import { ChevronRight, Check } from 'lucide-react'
import { useViewingAs } from '../lib/viewingAs'
import type { ViewingAs } from '../lib/viewingAs'

const ROLES: { key: ViewingAs; label: string; desc: string }[] = [
  { key: 'sales',      label: 'Sales',       desc: 'Wig orders only' },
  { key: 'front_desk', label: 'Front Desk',  desc: 'Entry + deposits' },
  { key: 'bookkeeper', label: 'Bookkeeper',  desc: 'Full bookkeeping' },
  { key: 'owner',      label: 'Owner',       desc: 'All access' },
]

export default function RoleSwitcher() {
  const { viewingAs, setViewingAs } = useViewingAs()
  const [open, setOpen] = useState(false)
  const [menuTop, setMenuTop] = useState(0)
  const btnRef = useRef<HTMLButtonElement>(null)

  function toggle() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setMenuTop(rect.top)
    }
    setOpen(o => !o)
  }

  function select(role: ViewingAs) {
    setViewingAs(role)
    setOpen(false)
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const current = ROLES.find(r => r.key === viewingAs)

  return (
    <>
      <button ref={btnRef} onClick={toggle} style={s.trigger}>
        <span style={s.triggerLabel}>
          <span style={s.triggerMeta}>Viewing as</span>
          <span style={s.triggerRole}>{current?.label}</span>
        </span>
        <ChevronRight size={12} color="rgba(13,13,13,0.35)"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      {open && (
        <div style={{ ...s.menu, top: menuTop }} onMouseDown={e => e.stopPropagation()}>
          <p style={s.menuHeader}>Switch view</p>
          {ROLES.map(r => (
            <button key={r.key} onClick={() => select(r.key)}
              style={{ ...s.option, ...(viewingAs === r.key ? s.optionActive : {}) }}>
              <span style={s.optionText}>
                <span style={s.optionLabel}>{r.label}</span>
                <span style={s.optionDesc}>{r.desc}</span>
              </span>
              {viewingAs === r.key && <Check size={12} color="#212121" strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

const s: Record<string, React.CSSProperties> = {
  trigger: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: '#ffffff', border: '1px solid rgba(13,13,13,0.09)', borderRadius: 8,
    padding: '7px 10px', cursor: 'pointer', textAlign: 'left' as const,
  },
  triggerLabel: { display: 'flex', flexDirection: 'column', gap: 1 },
  triggerMeta:  { fontSize: 9, fontWeight: 600, color: 'rgba(13,13,13,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase' as const },
  triggerRole:  { fontSize: 12, fontWeight: 500, color: '#0d0d0d' },

  menu: {
    position: 'fixed', left: 248, zIndex: 999,
    background: '#ffffff', border: '1px solid rgba(13,13,13,0.09)',
    borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)',
    padding: '6px', minWidth: 180,
    transform: 'translateY(-100%)',
  },
  menuHeader: {
    fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.3)',
    letterSpacing: '0.08em', textTransform: 'uppercase' as const,
    margin: '2px 6px 6px', padding: 0,
  },
  option: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 10px', borderRadius: 7, border: 'none', background: 'transparent',
    cursor: 'pointer', textAlign: 'left' as const, transition: 'background 0.1s',
  },
  optionActive: { background: 'rgba(214,210,203,0.5)' },
  optionText:   { display: 'flex', flexDirection: 'column', gap: 1 },
  optionLabel:  { fontSize: 13, fontWeight: 500, color: '#0d0d0d' },
  optionDesc:   { fontSize: 11, color: 'rgba(13,13,13,0.4)' },
}
