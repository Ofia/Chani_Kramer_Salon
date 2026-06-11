/**
 * ProvidersPage — manage wig companies, repair staff, and colorists.
 *
 * Tabs: All | Wig Companies | Repairs | Outside Color | In-House Color
 * Each row is expandable. Inside: contact info, wig model markups, edit + delete.
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus, X, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '../../lib/api'

// ── Types ──────────────────────────────────────────────────────────────────

type ProviderType = 'wig_company' | 'in_house_repairs' | 'outside_color' | 'in_house_color'

interface WigModelLength {
  length: string
  cost: number
}

interface WigModel {
  name: string
  markup_usd: number
  lengths: WigModelLength[]
}

interface Provider {
  id: string
  name: string
  provider_type: ProviderType
  notes: string | null
  is_active: boolean
  email: string | null
  phone: string | null
  address: string | null
  wig_models: WigModel[]
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
  { key: 'all',              label: 'All' },
  { key: 'wig_company',      label: 'Wig Companies' },
  { key: 'in_house_repairs', label: 'Repairs' },
  { key: 'outside_color',    label: 'Outside Color' },
  { key: 'in_house_color',   label: 'In-House Color' },
]

// ── Main Component ─────────────────────────────────────────────────────────

export default function ProvidersPage() {
  const qc = useQueryClient()
  const [activeTab, setActiveTab]     = useState<FilterTab>('all')
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [showModal, setShowModal]     = useState(false)
  const [editProvider, setEditProvider] = useState<Provider | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Provider | null>(null)

  const { data: providers = [], isLoading } = useQuery<Provider[]>({
    queryKey: ['providers'],
    queryFn: () => api.get('/providers/?active_only=false').then(r => Array.isArray(r.data) ? r.data : []),
  })

  const deleteProvider = useMutation({
    mutationFn: (id: string) => api.delete(`/providers/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['providers'] })
      setDeleteTarget(null)
      if (expandedId === deleteTarget?.id) setExpandedId(null)
    },
  })

  const filtered = activeTab === 'all'
    ? providers
    : providers.filter(p => p.provider_type === activeTab)

  function openEdit(p: Provider, e: React.MouseEvent) {
    e.stopPropagation()
    setEditProvider(p)
    setShowModal(true)
  }

  function openAdd() {
    setEditProvider(null)
    setShowModal(true)
  }

  function toggleRow(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <Building2 size={20} strokeWidth={1.6} color="#212121" />
          <h1 style={s.title}>Providers</h1>
        </div>
        <button style={s.primaryBtn} onClick={openAdd}>
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

      {/* List */}
      {isLoading ? (
        <div style={s.empty}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={s.empty}>No providers yet.</div>
      ) : (
        <div style={s.list}>
          {filtered.map(p => (
            <ProviderRow
              key={p.id}
              provider={p}
              expanded={expandedId === p.id}
              onToggle={() => toggleRow(p.id)}
              onEdit={e => openEdit(p, e)}
              onDelete={() => setDeleteTarget(p)}
              onModelsChange={() => qc.invalidateQueries({ queryKey: ['providers'] })}
            />
          ))}
        </div>
      )}

      {/* Edit / Add modal */}
      {showModal && (
        <ProviderModal
          provider={editProvider}
          onClose={() => { setShowModal(false); setEditProvider(null) }}
          onSaved={() => {
            setShowModal(false)
            setEditProvider(null)
            qc.invalidateQueries({ queryKey: ['providers'] })
          }}
        />
      )}

      {/* Delete confirm dialog */}
      {deleteTarget && (
        <DeleteDialog
          name={deleteTarget.name}
          loading={deleteProvider.isPending}
          onConfirm={() => deleteProvider.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

// ── Provider Row (accordion) ───────────────────────────────────────────────

function ProviderRow({
  provider, expanded, onToggle, onEdit, onDelete, onModelsChange,
}: {
  provider: Provider
  expanded: boolean
  onToggle: () => void
  onEdit: (e: React.MouseEvent) => void
  onDelete: () => void
  onModelsChange: () => void
}) {
  return (
    <div style={{ ...s.rowWrap, opacity: provider.is_active ? 1 : 0.55 }}>
      {/* Collapsed header — click to expand */}
      <div style={s.rowHeader} onClick={onToggle}>
        <div style={s.rowHeaderLeft}>
          <span style={s.chevron}>
            {expanded
              ? <ChevronDown size={15} strokeWidth={2} />
              : <ChevronRight size={15} strokeWidth={2} />}
          </span>
          <span style={s.rowName}>{provider.name}</span>
          <span style={{ ...s.badge, ...TYPE_COLOR[provider.provider_type] }}>
            {TYPE_LABEL[provider.provider_type]}
          </span>
          {!provider.is_active && (
            <span style={s.inactivePill}>Inactive</span>
          )}
        </div>
        {provider.provider_type === 'wig_company' && provider.wig_models.length > 0 && (
          <span style={s.modelCount}>{provider.wig_models.length} model{provider.wig_models.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div style={s.panel}>
          {/* Contact info */}
          <div style={s.contactGrid}>
            <ContactField label="Email"   value={provider.email} />
            <ContactField label="Phone"   value={provider.phone} />
            <ContactField label="Address" value={provider.address} span />
            {provider.notes && <ContactField label="Notes" value={provider.notes} span />}
          </div>

          {/* Wig models — only shown for wig companies */}
          {provider.provider_type === 'wig_company' && (
            <WigModelsEditor
              provider={provider}
              onSaved={onModelsChange}
            />
          )}

          {/* Actions */}
          <div style={s.panelActions}>
            <button style={s.editBtn} onClick={onEdit}>
              <Pencil size={14} />
              Edit
            </button>
            <button style={s.deleteBtn} onClick={onDelete}>
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Contact field display ──────────────────────────────────────────────────

function ContactField({ label, value, span }: { label: string; value: string | null; span?: boolean }) {
  return (
    <div style={{ gridColumn: span ? '1 / -1' : undefined }}>
      <div style={s.contactLabel}>{label}</div>
      <div style={s.contactValue}>{value || '—'}</div>
    </div>
  )
}

// ── Wig Models Inline Editor ───────────────────────────────────────────────

function WigModelsEditor({ provider, onSaved }: { provider: Provider; onSaved: () => void }) {
  const [models, setModels]       = useState<WigModel[]>(provider.wig_models ?? [])
  const [expandedModel, setExpandedModel] = useState<number | null>(null)
  const [saving, setSaving]       = useState(false)
  const [dirty, setDirty]         = useState(false)

  function mark() { setDirty(true) }

  function updateModelField(idx: number, field: 'name' | 'markup_usd', value: string) {
    setModels(prev => prev.map((m, i) =>
      i === idx ? { ...m, [field]: field === 'markup_usd' ? parseFloat(value) || 0 : value } : m
    ))
    mark()
  }

  function addModel() {
    setModels(prev => [...prev, { name: '', markup_usd: 0, lengths: [] }])
    setExpandedModel(models.length)
    mark()
  }

  function removeModel(idx: number) {
    setModels(prev => prev.filter((_, i) => i !== idx))
    if (expandedModel === idx) setExpandedModel(null)
    mark()
  }

  function addLength(modelIdx: number) {
    setModels(prev => prev.map((m, i) =>
      i === modelIdx ? { ...m, lengths: [...(m.lengths ?? []), { length: '', cost: 0 }] } : m
    ))
    mark()
  }

  function updateLength(modelIdx: number, lenIdx: number, field: keyof WigModelLength, value: string) {
    setModels(prev => prev.map((m, i) =>
      i === modelIdx ? {
        ...m,
        lengths: (m.lengths ?? []).map((l, j) =>
          j === lenIdx ? { ...l, [field]: field === 'cost' ? parseFloat(value) || 0 : value } : l
        ),
      } : m
    ))
    mark()
  }

  function removeLength(modelIdx: number, lenIdx: number) {
    setModels(prev => prev.map((m, i) =>
      i === modelIdx ? { ...m, lengths: (m.lengths ?? []).filter((_, j) => j !== lenIdx) } : m
    ))
    mark()
  }

  async function save() {
    setSaving(true)
    try {
      await api.patch(`/providers/${provider.id}`, { wig_models: models })
      setDirty(false)
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0 })

  return (
    <div style={s.modelsSection}>
      <div style={s.modelsSectionHeader}>
        <span style={s.sectionLabel}>Wig Models & Pricing Rules</span>
        <button style={s.addModelBtn} onClick={addModel}>
          <Plus size={12} /> Add Model
        </button>
      </div>

      {models.length === 0 ? (
        <div style={s.modelsEmpty}>No models added yet.</div>
      ) : (
        <div style={s.modelsList}>
          {models.map((m, mi) => (
            <div key={mi} style={s.modelCard}>
              {/* Model header row */}
              <div style={s.modelCardHeader}>
                <div
                  style={s.modelCardToggle}
                  onClick={() => setExpandedModel(expandedModel === mi ? null : mi)}
                >
                  <span style={s.chevron}>
                    {expandedModel === mi
                      ? <ChevronDown size={13} strokeWidth={2} />
                      : <ChevronRight size={13} strokeWidth={2} />}
                  </span>
                  <input
                    style={s.modelNameInput}
                    value={m.name}
                    placeholder="Model name…"
                    onClick={e => e.stopPropagation()}
                    onChange={e => updateModelField(mi, 'name', e.target.value)}
                  />
                </div>
                <div style={s.modelCardRight}>
                  <span style={s.markupLabel}>Markup</span>
                  <div style={s.markupWrap}>
                    <span style={s.dollarSymbol}>$</span>
                    <input
                      style={{ ...s.modelInput, paddingLeft: 22, width: 90, textAlign: 'right' }}
                      type="number" min={0} step={1}
                      value={m.markup_usd}
                      onChange={e => updateModelField(mi, 'markup_usd', e.target.value)}
                    />
                  </div>
                  {(m.lengths?.length ?? 0) > 0 && (
                    <span style={s.lenCount}>{m.lengths.length} length{m.lengths.length !== 1 ? 's' : ''}</span>
                  )}
                  <button style={s.removeModelBtn} onClick={() => removeModel(mi)} title="Remove model">
                    <X size={13} />
                  </button>
                </div>
              </div>

              {/* Lengths table (expanded) */}
              {expandedModel === mi && (
                <div style={s.lengthsPanel}>
                  {(m.lengths?.length ?? 0) > 0 && (
                    <div style={s.lengthsGrid}>
                      <div style={s.lengthsHeader}>
                        <span>Length</span>
                        <span style={{ textAlign: 'right' }}>Cost</span>
                        <span style={{ textAlign: 'right' }}>Retail</span>
                        <span />
                      </div>
                      {(m.lengths ?? []).map((l, li) => (
                        <div key={li} style={s.lengthRow}>
                          <input
                            style={s.modelInput}
                            value={l.length}
                            placeholder='e.g. 11"'
                            onChange={e => updateLength(mi, li, 'length', e.target.value)}
                          />
                          <div style={s.markupWrap}>
                            <span style={s.dollarSymbol}>$</span>
                            <input
                              style={{ ...s.modelInput, paddingLeft: 22, textAlign: 'right' }}
                              type="number" min={0} step={1}
                              value={l.cost}
                              onChange={e => updateLength(mi, li, 'cost', e.target.value)}
                            />
                          </div>
                          <div style={s.retailCell}>{fmt(l.cost + m.markup_usd)}</div>
                          <button style={s.removeModelBtn} onClick={() => removeLength(mi, li)} title="Remove">
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button style={s.addLengthBtn} onClick={() => addLength(mi)}>
                    <Plus size={11} /> Add Length
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {dirty && (
        <div style={{ marginTop: 12 }}>
          <button style={s.saveModelsBtn} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save All Changes'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Provider Modal (add / edit structural info) ────────────────────────────

function ProviderModal({ provider, onClose, onSaved }: {
  provider: Provider | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    name:          provider?.name          ?? '',
    provider_type: provider?.provider_type ?? 'wig_company' as ProviderType,
    email:         provider?.email         ?? '',
    phone:         provider?.phone         ?? '',
    address:       provider?.address       ?? '',
    notes:         provider?.notes         ?? '',
    is_active:     provider?.is_active     ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setErr('')
    try {
      const body = {
        ...form,
        email:   form.email   || null,
        phone:   form.phone   || null,
        address: form.address || null,
        notes:   form.notes   || null,
      }
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
      <div style={{ ...s.modal, maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>{provider ? 'Edit Provider' : 'Add Provider'}</span>
          <button style={s.iconBtnSm} onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={submit} style={s.form}>
          <div style={s.formRow}>
            <Field label="Name *">
              <input required style={s.fi} value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Type *">
              <select required style={s.fi} value={form.provider_type}
                onChange={e => setForm(f => ({ ...f, provider_type: e.target.value as ProviderType }))}>
                {(Object.entries(TYPE_LABEL) as [ProviderType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
          </div>
          <div style={s.formRow}>
            <Field label="Email">
              <input style={s.fi} type="email" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </Field>
            <Field label="Phone">
              <input style={s.fi} type="tel" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </Field>
          </div>
          <Field label="Address">
            <input style={s.fi} value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
          </Field>
          <Field label="Notes">
            <textarea style={{ ...s.fi, minHeight: 56 }} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </Field>
          <label style={s.checkRow}>
            <input type="checkbox" checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
            <span style={{ fontSize: 13 }}>Active</span>
          </label>
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

// ── Delete Confirm Dialog ──────────────────────────────────────────────────

function DeleteDialog({ name, loading, onConfirm, onCancel }: {
  name: string
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div style={s.modalOverlay} onClick={onCancel}>
      <div style={{ ...s.modal, maxWidth: 380 }} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>Delete Provider</span>
          <button style={s.iconBtnSm} onClick={onCancel}><X size={16} /></button>
        </div>
        <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: '#0d0d0d' }}>
            Are you sure you want to delete <strong>{name}</strong>? This cannot be undone.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button style={s.cancelBtn} onClick={onCancel} disabled={loading}>Cancel</button>
            <button style={s.confirmDeleteBtn} onClick={onConfirm} disabled={loading}>
              <Trash2 size={14} />
              {loading ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Field wrapper ──────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
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

  list:       { display: 'flex', flexDirection: 'column', gap: 6 },

  rowWrap:    { border: BORDER, borderRadius: 10, overflow: 'hidden', transition: 'box-shadow 0.15s' },
  rowHeader:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 16px', cursor: 'pointer', background: '#fff', userSelect: 'none' as const },
  rowHeaderLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  chevron:    { display: 'flex', alignItems: 'center', color: 'rgba(13,13,13,0.35)' },
  rowName:    { fontWeight: 500, fontSize: 14 },
  modelCount: { fontSize: 12, color: 'rgba(13,13,13,0.4)', marginLeft: 4 },
  inactivePill: { fontSize: 11, fontWeight: 600, background: '#f3f4f6', color: '#6b7280', borderRadius: 20, padding: '2px 8px' },

  badge:      { display: 'inline-block', padding: '2px 9px', borderRadius: 20, fontSize: 11, fontWeight: 600, letterSpacing: '0.02em' },

  panel:         { borderTop: BORDER, padding: '18px 20px 20px', background: '#fafaf9', display: 'flex', flexDirection: 'column', gap: 18 },

  contactGrid:   { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 20px' },
  contactLabel:  { fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 },
  contactValue:  { fontSize: 13, color: '#0d0d0d' },

  modelsSection:       { display: 'flex', flexDirection: 'column', gap: 10 },
  modelsSectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel:        { fontSize: 11, fontWeight: 600, color: 'rgba(13,13,13,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  modelsEmpty:         { fontSize: 13, color: 'rgba(13,13,13,0.35)', fontStyle: 'italic' },

  modelsList:          { display: 'flex', flexDirection: 'column', gap: 4 },
  modelCard:           { border: BORDER, borderRadius: 8, overflow: 'hidden', background: '#fff' },
  modelCardHeader:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', gap: 8 },
  modelCardToggle:     { display: 'flex', alignItems: 'center', gap: 6, flex: 1, cursor: 'pointer', minWidth: 0 },
  modelCardRight:      { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  markupLabel:         { fontSize: 11, color: 'rgba(13,13,13,0.4)', whiteSpace: 'nowrap' as const },
  lenCount:            { fontSize: 11, color: 'rgba(13,13,13,0.35)', whiteSpace: 'nowrap' as const },
  modelNameInput:      { border: 'none', outline: 'none', fontSize: 13, fontWeight: 500, fontFamily: 'inherit', background: 'transparent', minWidth: 0, flex: 1 },

  lengthsPanel:    { borderTop: BORDER, padding: '10px 12px 12px', background: '#fafaf9', display: 'flex', flexDirection: 'column', gap: 8 },
  lengthsGrid:     { display: 'flex', flexDirection: 'column', gap: 4 },
  lengthsHeader:   { display: 'grid', gridTemplateColumns: '1fr 120px 100px 32px', gap: 8, fontSize: 10, fontWeight: 600, color: 'rgba(13,13,13,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', paddingBottom: 2 },
  lengthRow:       { display: 'grid', gridTemplateColumns: '1fr 120px 100px 32px', gap: 8, alignItems: 'center' },
  retailCell:      { fontSize: 13, fontWeight: 600, color: '#166534', textAlign: 'right' as const, paddingRight: 4 },
  addLengthBtn:    { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: BORDER, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: 'rgba(13,13,13,0.45)', alignSelf: 'flex-start' as const },

  modelInput:       { padding: '7px 10px', border: BORDER, borderRadius: 7, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit', background: '#fff' },
  markupWrap:       { position: 'relative', display: 'flex', alignItems: 'center' },
  dollarSymbol:     { position: 'absolute', left: 9, fontSize: 13, color: 'rgba(13,13,13,0.4)', pointerEvents: 'none' as const, zIndex: 1 },
  removeModelBtn:   { display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: BORDER, borderRadius: 6, cursor: 'pointer', width: 32, height: 32, color: 'rgba(13,13,13,0.4)', flexShrink: 0 },
  addModelBtn:      { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: BORDER, borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', color: 'rgba(13,13,13,0.55)' },
  saveModelsBtn:    { background: '#212121', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer' },

  panelActions:   { display: 'flex', alignItems: 'center', gap: 10, paddingTop: 4, borderTop: BORDER },
  editBtn:        { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: BORDER, borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: '#0d0d0d' },
  deleteBtn:      { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', color: '#dc2626', marginLeft: 'auto' },
  confirmDeleteBtn: { display: 'flex', alignItems: 'center', gap: 6, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 500, cursor: 'pointer' },

  primaryBtn: { display: 'flex', alignItems: 'center', gap: 6, background: '#212121', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  cancelBtn:  { background: 'none', border: BORDER, borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', color: '#0d0d0d' },
  iconBtnSm:  { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6, color: 'rgba(13,13,13,0.45)' },

  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal:        { background: '#fff', borderRadius: 14, width: '100%', maxWidth: 560, boxShadow: '0 8px 32px rgba(0,0,0,0.14)', overflow: 'hidden' },
  modalHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px 14px', borderBottom: BORDER },
  modalTitle:   { fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' },
  modalFooter:  { display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8 },

  form:     { display: 'flex', flexDirection: 'column', gap: 14, padding: '20px 24px 24px' },
  formRow:  { display: 'flex', gap: 12 },
  checkRow: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' },
  label:    { fontSize: 11, fontWeight: 600, color: 'rgba(13,13,13,0.5)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  fi:       { padding: '8px 10px', border: BORDER, borderRadius: 8, fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const, fontFamily: 'inherit' },
  errMsg:   { background: '#fee2e2', color: '#991b1b', borderRadius: 8, padding: '8px 12px', fontSize: 12 },

  empty:    { textAlign: 'center', padding: '60px 20px', color: 'rgba(13,13,13,0.35)', fontSize: 14 },
}
