import { useViewingAs, ViewingAs } from '../lib/viewingAs'

const ROLES: { key: ViewingAs; label: string }[] = [
  { key: 'sales',      label: 'Sales' },
  { key: 'front_desk', label: 'Front Desk' },
  { key: 'bookkeeper', label: 'Bookkeeper' },
  { key: 'owner',      label: 'Owner' },
]

export default function RoleSwitcher() {
  const { viewingAs, setViewingAs } = useViewingAs()

  return (
    <div style={s.wrap}>
      <p style={s.label}>Viewing as</p>
      <div style={s.grid}>
        {ROLES.map(r => (
          <button
            key={r.key}
            onClick={() => setViewingAs(r.key)}
            style={{ ...s.chip, ...(viewingAs === r.key ? s.active : {}) }}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  wrap:   { marginBottom: 4 },
  label:  { fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 5px 2px' },
  grid:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 },
  chip:   { padding: '5px 4px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', border: '1px solid rgba(13,13,13,0.09)', background: '#ffffff', color: 'rgba(13,13,13,0.45)', transition: 'all 0.12s', textAlign: 'center' as const },
  active: { background: '#212121', color: '#ffffff', border: '1px solid #212121' },
}
