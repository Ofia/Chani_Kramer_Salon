/**
 * ProvidersPage — manage wig companies, repair staff, and colorists.
 *
 * Tabs: All | Wig Companies | Repairs | Outside Color | In-House Color
 * Actions: Add, Edit, Toggle Active, Delete
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus, X, Pencil } from 'lucide-react'
import { api } from '../../lib/api'

// ── Types ──────────────────────────────────────────────────────────────────

type ProviderType = 'wig_company' | 'in_house_repairs' | 'outside_color' | 'in_house_color'

interface Provider {
  id: string
  name: string
  provider_type: ProviderType
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ── Constants ──────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<ProviderType, string> = {
  wig_company:      'Wig Company',
  in_house_repairs: 'In-House Repairs',
  outside_color:    'Outside Color',
  in_house_color:   'In-House Color',
}

const TYPE_COLOR: Record<ProviderType, { bg: string; color: string }> = {
  wig_company:      { bg: '#dbeafe', color: '#1e3a8a' },
  in_house_repairs: { bg: '#dcfce7', color: '#166534' },
  outside_color:    { bg: '#fef3c7', color: '#92400e' },
  in_house_color:   { bg: '#ede9fe', color: '#5b21b6' },
}

type FilterTab = 'all' | ProviderType

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',             label: 'All' },
  { key: 'wig_company',     label: 'Wig Companies' },
  { key: 'in_house_repairs',label: 'Repairs' },
  { key: 'outside_color',   label: 'Outside Color' },
  { key: 'in_house_color',  label: 'In-House Color' },
]

// ── Main Component ─────────────────────────────────────────────────────────

export default function ProvidersPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [showModal, setShowModal] = useState(false)
  const [editProvider, setEditProvider] = useState<Provider | null>(null)

  const { data: providers = [], isLoading } = useQuery<Provider[]>({
    queryKey: ['providers'],
    queryFn: () => api.get('/providers/?active_only=false').then(r => Array.isArray(r.data) ? r.data : []),
  })

  const deleteProvider = useMutation({
    mutationFn: (id: string) => api.delete(`/providers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers'] }),
  })

  const toggleActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/providers/${id}`, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['providers'] }),
  })

  const filtered = activeTab === 'all'
    ? providers
    : providers.filter(p => p.provider_type === activeTab)

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <Building2 size={20} strokeWidth={1.6} color="#212121" />
          <h1 style={s.title}>Providers</h1>
        </div>
        <button style={s.primaryBtn} onClick={() => { setEditProvider(null); setShowModal(true) }}>
          <Plus size={14} />
          Add Provider
        </button>
      </div>

      {/* Tabs */}
      <div style={s.tabBar}>
        {FILTER_TABS.map(({ key, label }) => (
          <button
            key={key}
            style={{ ...s.tab, ...(activeTab === key ? s.tabActive : {}) }}
            onClick={() => setActiveTab(key)}
          >
            {label}
            {key !== 'all' && (
              <span style={s.tabCount}>
                {providers.filter(p => p.provider_type === key).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={s.empty}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={s.empty}>No providers yet.</div>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {['Name', 'Type', 'Notes', 'Status', ''].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr key={p.id} style={{ ...s.tr, opacity: p.is_active ? 1 : 0.5 }}>
                  <td style={s.td}><span style={s.name}>{p.name}</span></td>
                  <td style={s.td}>
                    <span style={{ ...s.badge, ...TYPE_COLOR[p.provider_type] }}>
                      {TYPE_LABEL[p.provider_type]}
                    </span>
                  </td>
                  <td style={{ ...s.td, color: 'rgba(13,13,13,0.5)' }}>{p.notes ?? '—'}</td>
                  <td style={s.td}>
                    <span style={{ ...s.statusPill, ...(p.is_active ? s.activeStyle : s.inactiveStyle) }}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button style={s.rowBtn} onClick={() => { setEditProvider(p); setShowModal(true) }} title="Edit">
                        <Pencil size={13} />
                      </button>
                      <button
                        style={{ ...s.rowBtn, fontSize: 12 }}
                        onClick={() => toggleActive.mutate({ id: p.id, is_active: !p.is_active })}
                      >
                        {p.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        style={{ ...s.rowBtn, color: '#ef4444' }}
                        onClick={() => { if (confirm(`Delete ${p.name}?`)) deleteProvider.mutate(p.id) }}
                        title="Delete"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ProviderModal
          provider={editProvider}
          onClose={() => { setShowModal(false); setEditProvider(null) }}
          onSaved={() => { setShowModal(false); setEditProvider(null); qc.invalidateQueries({ queryKey: ['providers'] }) }}
        />
      )}
    </div>
  )
}

// ── Provider Modal ─────────────────────────────────────────────────────────

function ProviderModal({ provider, onClose, onSaved }: {
  provider: Provider | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name:          provider?.name          ?? '',
    provider_type: provider?.provider_type ?? 'wig_company' as ProviderType,
    notes:         provider?.notes         ?? '',
    is_active:     provider?.is_active     ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErr('')
    try {
      const body = { ...form, notes: form.notes || null }
      if (provider) {
        await api.patch(`/providers/${provider.id}`, body)
      } else {
        await api.post('/providers/', body)
      }
      onSaved()
    } catch (e: any) {
      setErr(e.response?.data?.detail ?? e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={{ ...s.modal, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>{provider ? 'Edit Provider' : 'Add Provider'}</span>
          <button style={s.iconBtnSm} onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit} style={s.form}>
          <Field label="Name *">
            <input required style={s.fi} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Type *">
            <select
              required
              style={s.fi}
              value={form.provider_type}
              onChange={e => setForm(f => ({ ...f, provider_type: e.target.value as ProviderType }))}
            >
              {(Object.entries(TYPE_LABEL) as [ProviderType, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
          <Field label="Notes">
            <textarea
              style={{ ...s.fi, minHeight: 60 }}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </Field>
          {err && <div style={s.errMsg}>{err}</div>}
          <div style={s.modalFooter}>
            <button type="button" style={s.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" style={s.primaryBtn} disabled={saving}>
              {saving ? 'Saving…' : provider ? 'Save' : 'Add Provider'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Field wrapper ──────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────

const BORDER = '1px solid rgba(13,13,13,0.08)'

const s: Record<string, React.CSSProperties> = {
  page:       { fontFamily: "'Inter', -apple-system, sans-serif", color: '#0d0d0d' },
  header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  title:      { fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', margin: 0 },

  tabBar:    { display: 'flex', gap: 0, borderBottom: BORDER, marginBottom: 20 },
  tab:       { background: 'none', border: 'none', borderBottom: '2px solid transparent', padding: '8px 16px', fontSize: 13, fontWeight: 500, color: 'rgba(13,13,13,0.45)', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6 },
  tabActive: { borderBottomColor: '#212121', color: '#212121' },
  tabCount:  { fontSize: 11, background: '#f0f0ee', borderRadius: 10, padding: '1px 6px', color: 'rgba(13,13,13,0.55)' },

  tableWrap: { overflowX: 'auto' },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th:        { textAlign: 'left', padding: '10px 12px', borderBottom: BORDER, fontWeight: 500, fontSize: 11, color: 'rgba(13,13,13,0.45)', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' },
  tr:        { borderBottom: BORDER, transition: 'background 0.1s' },
  td:        { padding: '11px 12px', verticalAlign: 'middle' },
  name:      { fontWeight: 500 },

  badge:        { display: 'inline-block', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, letterSpacing: '0.02em' },
  statusPill:   { display: 'inline-block', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 },
  activeStyle:  { background: '#dcfce7', color: '#166534' },
  inactiveStyle:{ background: '#f3f4f6', color: '#6b7280' },

  primaryBtn: { display: 'flex', alignItems: 'center', gap: 6, background: '#212121', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  cancelBtn:  { background: 'none', border: BORDER, borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: '#0d0d0d' },
  iconBtnSm:  { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6, color: 'rgba(13,13,13,0.45)' },
  rowBtn:     { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 6px', borderRadius: 6, fontSize: 12, color: 'rgba(13,13,13,0.55)' },

  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal:        { background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', overflow: 'hidden' },
  modalHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px 14px', borderBottom: BORDER },
  modalTitle:   { fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' },
  modalFooter:  { display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8 },

  form:   { display: 'flex', flexDirection: 'column', gap: 14, padding: '20px 24px 24px' },
  label:  { fontSize: 11, fontWeight: 600, color: 'rgba(13,13,13,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  fi:     { padding: '8px 10px', border: BORDER, borderRadius: 8, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit' },
  errMsg: { background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '8px 12px', fontSize: 12 },

  empty:  { textAlign: 'center', padding: '60px 20px', color: 'rgba(13,13,13,0.35)', fontSize: 14 },
}
