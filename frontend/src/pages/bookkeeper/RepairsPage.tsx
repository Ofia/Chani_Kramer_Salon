/**
 * Repairs Page — /bookkeeper/repairs
 *
 * Haya's workspace for managing repair orders.
 * Each order = one wig. Each task = one service on that wig.
 *
 * Tab 1: Repair Orders — expandable list; tasks managed inline
 * Tab 2: Active Carts  — customers with repair services pending at POS
 *
 * Create order: centered popup modal (not a slide-in panel).
 * Tasks are expandable sub-rows with per-task status, provider, print slip.
 */

import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, X, ChevronDown, ChevronRight,
  Trash2, User, Package, Link, Printer,
} from 'lucide-react'
import { api } from '../../lib/api'

// ── Types ────────────────────────────────────────────────────

type RepairTaskStatus  = 'pending' | 'in_progress' | 'with_external' | 'done'
type RepairOrderStatus = 'pending' | 'in_progress' | 'with_external' | 'ready' | 'completed'

type RepairTask = {
  id: string
  repair_order_id: string
  repair_service_id?: string
  description: string
  price: number
  tax_rate: number
  status: RepairTaskStatus
  assigned_provider_id?: string
  assigned_provider_name?: string
  notes?: string
  video_url?: string
  created_at: string
}

type RepairOrder = {
  id: string
  customer_id?: string
  customer_full_name?: string
  customer_name?: string
  customer_phone?: string
  inventory_item_id?: string
  wig_serial?: string
  wig_description?: string
  notes?: string
  external_provider_id?: string
  external_provider_name?: string
  status: RepairOrderStatus
  tasks: RepairTask[]
  cart_item_count: number
  created_at: string
}

type Customer = {
  id: string
  first_name: string
  last_name: string
  phone?: string
  cell?: string
}

type InventoryItem = {
  id: string
  item_type: string
  name: string
  daysmart_serial?: string
  brand?: string
  color?: string
  length?: string
  customer_id?: string | null
}

type Provider = {
  id: string
  name: string
  is_active: boolean
}

type RepairService = {
  id: string
  name: string
  default_price?: number | null
  is_active: boolean
}

// ── Constants ────────────────────────────────────────────────

const TASK_STATUS_LABEL: Record<RepairTaskStatus, string> = {
  pending:       'Pending',
  in_progress:   'In Progress',
  with_external: 'External',
  done:          'Done',
}

const TASK_STATUS_COLOR: Record<RepairTaskStatus, { bg: string; color: string }> = {
  pending:       { bg: 'rgba(13,13,13,0.07)',    color: 'rgba(13,13,13,0.45)' },
  in_progress:   { bg: 'rgba(151,187,233,0.28)', color: '#2f6499' },
  with_external: { bg: 'rgba(227,205,148,0.4)',  color: '#7a5a00' },
  done:          { bg: 'rgba(80,180,120,0.18)',  color: '#1a6e40' },
}

const ORDER_STATUS_LABEL: Record<RepairOrderStatus, string> = {
  pending:       'Pending',
  in_progress:   'In Progress',
  with_external: 'With External',
  ready:         'Ready for Pickup',
  completed:     'Completed',
}

const ORDER_STATUS_COLOR: Record<RepairOrderStatus, { bg: string; color: string }> = {
  pending:       { bg: 'rgba(13,13,13,0.07)',    color: 'rgba(13,13,13,0.45)' },
  in_progress:   { bg: 'rgba(151,187,233,0.28)', color: '#2f6499' },
  with_external: { bg: 'rgba(227,205,148,0.4)',  color: '#7a5a00' },
  ready:         { bg: 'rgba(80,180,120,0.18)',  color: '#1a6e40' },
  completed:     { bg: 'rgba(13,13,13,0.1)',     color: '#212121' },
}

const TASK_STATUS_CYCLE: RepairTaskStatus[] = ['pending', 'in_progress', 'with_external', 'done']

function nextTaskStatus(s: RepairTaskStatus): RepairTaskStatus {
  const i = TASK_STATUS_CYCLE.indexOf(s)
  return TASK_STATUS_CYCLE[(i + 1) % TASK_STATUS_CYCLE.length]
}

// ── Page ─────────────────────────────────────────────────────

export default function RepairsPage() {
  const [tab, setTab] = useState<'orders' | 'carts'>('orders')
  const [creating, setCreating] = useState(false)
  const qc = useQueryClient()

  return (
    <div>
      <header style={s.header}>
        <div>
          <h1 style={s.title}>Repairs</h1>
          <p style={s.subtitle}>Manage repair orders and track task progress</p>
        </div>
        <button style={s.newBtn} onClick={() => setCreating(true)}>
          <Plus size={14} strokeWidth={2} />
          New Order
        </button>
      </header>

      <div style={s.tabRow}>
        <TabBtn active={tab === 'orders'} onClick={() => setTab('orders')}>Repair Orders</TabBtn>
        <TabBtn active={tab === 'carts'}  onClick={() => setTab('carts')}>Active Carts</TabBtn>
      </div>

      {tab === 'orders' && <RepairOrdersTab />}
      {tab === 'carts'  && <ActiveCartsTab />}

      {creating && (
        <CreateOrderModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            qc.invalidateQueries({ queryKey: ['repair-orders'] })
            qc.invalidateQueries({ queryKey: ['cart-active'] })
          }}
        />
      )}
    </div>
  )
}

// ── Repair Orders Tab ────────────────────────────────────────

function RepairOrdersTab() {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<RepairOrderStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  const { data: orders = [], isLoading } = useQuery<RepairOrder[]>({
    queryKey: ['repair-orders'],
    queryFn: () => api.get('/repair-orders/').then(r => r.data),
    staleTime: 0,
  })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return orders.filter(o => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false
      const text = [o.customer_full_name, o.customer_name, o.wig_serial, o.wig_description].join(' ').toLowerCase()
      return text.includes(q)
    })
  }, [orders, statusFilter, search])

  if (isLoading) return <div style={s.empty}>Loading…</div>

  return (
    <>
      <div style={s.toolbar}>
        <div style={s.searchWrap}>
          <Search size={13} color="rgba(13,13,13,0.35)" />
          <input
            style={s.searchInput}
            placeholder="Search customer, wig serial…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button style={s.clearBtn} onClick={() => setSearch('')}><X size={12} /></button>}
        </div>
        <div style={s.filters}>
          {(['all', 'pending', 'in_progress', 'with_external', 'ready'] as const).map(st => (
            <button
              key={st}
              style={{ ...s.filterBtn, ...(statusFilter === st ? s.filterBtnOn : {}) }}
              onClick={() => setStatusFilter(st)}
            >
              {st === 'all' ? 'All' : ORDER_STATUS_LABEL[st as RepairOrderStatus]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={s.empty}>
          {orders.length === 0 ? 'No repair orders yet. Click "New Order" to start.' : 'No orders match your filters.'}
        </div>
      ) : (
        <div style={s.list}>
          {filtered.map(order => (
            <OrderRow
              key={order.id}
              order={order}
              expanded={expandedId === order.id}
              onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
            />
          ))}
        </div>
      )}
    </>
  )
}

// ── Order Row (collapsed + expanded) ─────────────────────────

function OrderRow({ order, expanded, onToggle }: {
  order: RepairOrder
  expanded: boolean
  onToggle: () => void
}) {
  const qc = useQueryClient()
  const [addingTask, setAddingTask] = useState(false)

  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ['providers'],
    queryFn: () => api.get('/providers/').then(r => r.data),
    enabled: expanded,
  })

  const deleteOrder = useMutation({
    mutationFn: () => api.delete(`/repair-orders/${order.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repair-orders'] })
      qc.invalidateQueries({ queryKey: ['cart-active'] })
    },
  })

  const updateStatus = useMutation({
    mutationFn: (status: RepairOrderStatus) =>
      api.patch(`/repair-orders/${order.id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['repair-orders'] }),
  })

  const name = order.customer_full_name || order.customer_name || 'Walk-in'
  const wig  = order.wig_serial || order.wig_description || '—'
  const date = new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const sc   = ORDER_STATUS_COLOR[order.status]

  return (
    <div style={s.orderCard}>
      {/* ── Collapsed header ── */}
      <button style={s.orderHeader} onClick={onToggle}>
        <span style={{ ...s.statusChip, background: sc.bg, color: sc.color }}>
          {ORDER_STATUS_LABEL[order.status]}
        </span>

        <span style={s.orderName}>{name}</span>
        {(order.customer_phone) && (
          <span style={s.orderPhone}>{order.customer_phone}</span>
        )}

        <span style={s.orderDivider}>·</span>

        <Package size={12} color="rgba(13,13,13,0.3)" style={{ flexShrink: 0 }} />
        <span style={s.orderWig}>{wig}</span>

        <span style={s.orderDivider}>·</span>
        <span style={s.orderCount}>{order.tasks.length} task{order.tasks.length !== 1 ? 's' : ''}</span>

        <span style={{ flex: 1 }} />
        <span style={s.orderDate}>{date}</span>

        <button
          style={s.iconBtn}
          onClick={e => {
            e.stopPropagation()
            if (window.confirm('Delete this repair order and all its tasks?')) deleteOrder.mutate()
          }}
        >
          <Trash2 size={13} color="rgba(13,13,13,0.25)" />
        </button>

        {expanded
          ? <ChevronDown size={15} color="rgba(13,13,13,0.35)" />
          : <ChevronRight size={15} color="rgba(13,13,13,0.35)" />
        }
      </button>

      {/* ── Expanded body ── */}
      {expanded && (
        <div style={s.orderBody}>
          {order.notes && (
            <p style={s.orderNotes}>{order.notes}</p>
          )}

          {/* Task list */}
          {order.tasks.length === 0 && !addingTask && (
            <p style={s.emptyTasks}>No tasks yet — add one below.</p>
          )}

          {order.tasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              providers={providers}
            />
          ))}

          {/* Add task inline form */}
          {addingTask ? (
            <AddTaskForm
              orderId={order.id}
              onDone={() => {
                setAddingTask(false)
                qc.invalidateQueries({ queryKey: ['repair-orders'] })
                qc.invalidateQueries({ queryKey: ['cart-active'] })
              }}
              onCancel={() => setAddingTask(false)}
            />
          ) : (
            <button style={s.addTaskBtn} onClick={() => setAddingTask(true)}>
              <Plus size={12} />
              Add task
            </button>
          )}

          {/* Global status row */}
          <div style={s.globalStatusRow}>
            <span style={s.globalStatusLabel}>Order status:</span>
            {(['pending', 'in_progress', 'with_external', 'ready'] as RepairOrderStatus[]).map(st => {
              const c = ORDER_STATUS_COLOR[st]
              const active = order.status === st
              return (
                <button
                  key={st}
                  style={{
                    ...s.statusOptionBtn,
                    background: active ? c.bg : 'transparent',
                    color: active ? c.color : 'rgba(13,13,13,0.4)',
                    border: active ? `1px solid ${c.color}33` : '1px solid rgba(13,13,13,0.1)',
                  }}
                  onClick={() => updateStatus.mutate(st)}
                >
                  {ORDER_STATUS_LABEL[st]}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Task Row ─────────────────────────────────────────────────

function TaskRow({ task, providers }: { task: RepairTask; providers: Provider[] }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [localNotes, setLocalNotes]     = useState(task.notes ?? '')
  const [localVideo, setLocalVideo]     = useState(task.video_url ?? '')
  const [localProvider, setLocalProvider] = useState(task.assigned_provider_id ?? '')

  const updateTask = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      api.patch(`/repair-tasks/${task.id}`, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['repair-orders'] }),
  })

  const deleteTask = useMutation({
    mutationFn: () => api.delete(`/repair-tasks/${task.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repair-orders'] })
      qc.invalidateQueries({ queryKey: ['cart-active'] })
    },
  })

  function saveDetails() {
    updateTask.mutate({
      assigned_provider_id: localProvider || null,
      notes:    localNotes.trim() || null,
      video_url: localVideo.trim() || null,
    })
    setOpen(false)
  }

  const tc = TASK_STATUS_COLOR[task.status]
  const providerName = task.assigned_provider_name ?? '— In house'

  return (
    <div style={s.taskCard}>
      {/* ── Collapsed row ── */}
      <div style={s.taskRow}>
        <button
          style={{ ...s.taskStatusChip, background: tc.bg, color: tc.color }}
          onClick={() => updateTask.mutate({ status: nextTaskStatus(task.status) })}
          title="Click to advance status"
        >
          {TASK_STATUS_LABEL[task.status]}
        </button>

        <div style={s.taskInfo}>
          <span style={s.taskDesc}>{task.description}</span>
          {!open && (task.assigned_provider_name || task.notes) && (
            <span style={s.taskNotes}>
              {[providerName !== '— In house' ? providerName : null, task.notes].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>

        <span style={s.taskPrice}>${Number(task.price).toFixed(2)}</span>

        {task.video_url && (
          <a href={task.video_url} target="_blank" rel="noreferrer" style={s.linkIcon} title="Open video">
            <Link size={13} color="rgba(13,13,13,0.35)" />
          </a>
        )}

        <button style={s.iconBtn} title="Print task slip" onClick={() => printSlip(task)}>
          <Printer size={13} color="rgba(13,13,13,0.3)" />
        </button>

        <button style={s.iconBtn} title="Edit details" onClick={() => setOpen(o => !o)}>
          {open
            ? <ChevronDown size={13} color="rgba(13,13,13,0.4)" />
            : <ChevronRight size={13} color="rgba(13,13,13,0.4)" />}
        </button>

        <button
          style={s.iconBtn}
          title="Delete task"
          onClick={() => { if (window.confirm('Delete this task?')) deleteTask.mutate() }}
        >
          <Trash2 size={13} color="rgba(13,13,13,0.25)" />
        </button>
      </div>

      {/* ── Expanded edit section ── */}
      {open && (
        <div style={s.taskEditRow}>
          <select
            style={s.taskEditField}
            value={localProvider}
            onChange={e => setLocalProvider(e.target.value)}
          >
            <option value="">— In house</option>
            {providers.filter(p => p.is_active).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <input
            style={{ ...s.taskEditField, flex: 1 }}
            placeholder="Notes…"
            value={localNotes}
            onChange={e => setLocalNotes(e.target.value)}
          />

          <input
            style={{ ...s.taskEditField, flex: '0 0 180px' }}
            placeholder="Drive / video link"
            value={localVideo}
            onChange={e => setLocalVideo(e.target.value)}
          />

          <button style={s.saveTaskBtn} onClick={saveDetails}>Save</button>
          <button style={s.cancelTaskBtn} onClick={() => setOpen(false)}><X size={13} /></button>
        </div>
      )}
    </div>
  )
}

// ── Add Task Form (inline) ────────────────────────────────────

function AddTaskForm({ orderId, onDone, onCancel }: {
  orderId: string
  onDone: () => void
  onCancel: () => void
}) {
  const [serviceId, setServiceId]   = useState('')
  const [serviceName, setServiceName] = useState('')
  const [price, setPrice]           = useState('')
  const [notes, setNotes]           = useState('')
  const [videoUrl, setVideoUrl]     = useState('')
  const [saving, setSaving]         = useState(false)

  const { data: repairServices = [] } = useQuery<RepairService[]>({
    queryKey: ['repair-services'],
    queryFn: () => api.get('/repair-services/').then(r => r.data),
  })

  function handleServiceSelect(id: string) {
    const svc = repairServices.find(s => s.id === id)
    if (!svc) return
    setServiceId(svc.id)
    setServiceName(svc.name)
    if (svc.default_price != null) setPrice(String(svc.default_price))
  }

  async function handleSave() {
    if (!serviceName.trim()) return
    setSaving(true)
    try {
      await api.post('/repair-tasks/', {
        repair_order_id: orderId,
        repair_service_id: serviceId || null,
        description: serviceName.trim(),
        price: parseFloat(price) || 0,
        tax_rate: 0.045,
        notes: notes.trim() || null,
        video_url: videoUrl.trim() || null,
      })
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.addTaskForm}>
      <select
        style={{ ...s.addInput, flex: '0 0 200px' }}
        value={serviceId}
        onChange={e => handleServiceSelect(e.target.value)}
      >
        <option value="">Select service…</option>
        {repairServices.filter(s => s.is_active).map(svc => (
          <option key={svc.id} value={svc.id}>{svc.name}</option>
        ))}
      </select>

      <div style={s.priceWrap}>
        <span style={s.pricePre}>$</span>
        <input
          style={s.priceField}
          placeholder="0.00"
          value={price}
          onChange={e => setPrice(e.target.value)}
        />
      </div>

      <input
        style={{ ...s.addInput, flex: 1 }}
        placeholder="Notes (optional)"
        value={notes}
        onChange={e => setNotes(e.target.value)}
      />

      <input
        style={{ ...s.addInput, flex: '0 0 160px' }}
        placeholder="Drive / video link"
        value={videoUrl}
        onChange={e => setVideoUrl(e.target.value)}
      />

      <button
        style={{ ...s.saveTaskBtn, ...(saving ? { opacity: 0.5 } : {}) }}
        onClick={handleSave}
        disabled={saving || !serviceName.trim()}
      >
        {saving ? '…' : 'Save'}
      </button>
      <button style={s.cancelTaskBtn} onClick={onCancel}>
        <X size={13} />
      </button>
    </div>
  )
}

// ── Create Order Modal ────────────────────────────────────────

type TaskDraft = {
  key: string
  service_id: string
  service_name: string
  price: string
  provider_id: string
  notes: string
  video_url: string
}

function CreateOrderModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  // Customer
  const [custSearch, setCustSearch]           = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [walkinName, setWalkinName]           = useState('')
  const [walkinPhone, setWalkinPhone]         = useState('')
  const [customerMode, setCustomerMode]       = useState<'existing' | 'walkin'>('existing')

  // Wig
  const [wigMode, setWigMode]         = useState<'customer' | 'external'>('customer')
  const [wigSearch, setWigSearch]     = useState('')
  const [selectedWig, setSelectedWig] = useState<InventoryItem | null>(null)
  const [extSerial, setExtSerial]     = useState('')
  const [extBrand, setExtBrand]       = useState('')
  const [extColor, setExtColor]       = useState('')

  // Order meta
  const [orderNotes, setOrderNotes]   = useState('')

  // Tasks
  const [tasks, setTasks] = useState<TaskDraft[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // Data
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: () => api.get('/customers/').then(r => r.data),
  })
  const { data: inventory = [] } = useQuery<InventoryItem[]>({
    queryKey: ['inventory'],
    queryFn: () => api.get('/inventory/').then(r => r.data),
  })
  const { data: repairServices = [] } = useQuery<RepairService[]>({
    queryKey: ['repair-services'],
    queryFn: () => api.get('/repair-services/').then(r => r.data),
  })
  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ['providers'],
    queryFn: () => api.get('/providers/').then(r => r.data),
  })

  const filteredCustomers = useMemo(() => {
    if (!custSearch) return []
    const q = custSearch.toLowerCase()
    return customers.filter(c =>
      `${c.first_name} ${c.last_name} ${c.phone ?? ''} ${c.cell ?? ''}`.toLowerCase().includes(q)
    ).slice(0, 8)
  }, [customers, custSearch])

  const filteredWigs = useMemo(() => {
    if (!selectedCustomer || wigMode !== 'customer') return []
    const mine = inventory.filter(i => i.item_type === 'wig' && i.customer_id === selectedCustomer.id)
    if (!wigSearch) return mine.slice(0, 8)
    const q = wigSearch.toLowerCase()
    return mine.filter(i =>
      [i.daysmart_serial, i.brand, i.color, i.length, i.name].join(' ').toLowerCase().includes(q)
    ).slice(0, 8)
  }, [inventory, wigSearch, selectedCustomer, wigMode])

  function addTask() {
    setTasks(prev => [...prev, { key: crypto.randomUUID(), service_id: '', service_name: '', price: '', provider_id: '', notes: '', video_url: '' }])
  }

  function updateTask(key: string, patch: Partial<TaskDraft>) {
    setTasks(prev => prev.map(t => t.key === key ? { ...t, ...patch } : t))
  }

  function removeTask(key: string) {
    setTasks(prev => prev.filter(t => t.key !== key))
  }

  function handleServiceSelect(key: string, id: string) {
    const svc = repairServices.find(s => s.id === id)
    if (!svc) return
    updateTask(key, {
      service_id:   svc.id,
      service_name: svc.name,
      price: svc.default_price != null ? String(svc.default_price) : '',
    })
  }

  async function handleCreate() {
    setError(null)
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        notes: orderNotes.trim() || null,
        status: 'in_progress',
      }

      if (customerMode === 'existing' && selectedCustomer) {
        payload.customer_id    = selectedCustomer.id
        payload.customer_name  = `${selectedCustomer.first_name} ${selectedCustomer.last_name}`
        payload.customer_phone = selectedCustomer.phone || selectedCustomer.cell || null
      } else {
        payload.customer_name  = walkinName.trim() || null
        payload.customer_phone = walkinPhone.trim() || null
      }

      if (wigMode === 'customer' && selectedWig) {
        payload.inventory_item_id = selectedWig.id
      } else if (wigMode === 'external') {
        const serial = extSerial.trim()
        if (customerMode === 'existing' && selectedCustomer && serial) {
          const { data: newWig } = await api.post('/inventory/', {
            item_type: 'wig',
            name: serial,
            daysmart_serial: serial,
            brand: extBrand.trim() || null,
            color: extColor.trim() || null,
            customer_id: selectedCustomer.id,
            sale_status: 'paid_in_full',
            is_external: true,
          })
          payload.inventory_item_id = newWig.id
        } else {
          payload.wig_description = [extSerial, extBrand, extColor].map(s => s.trim()).filter(Boolean).join(' · ') || null
        }
      }

      const { data: order } = await api.post('/repair-orders/', payload)

      // Create tasks sequentially
      for (const t of tasks) {
        if (!t.service_name.trim()) continue
        await api.post('/repair-tasks/', {
          repair_order_id:  order.id,
          repair_service_id:    t.service_id || null,
          description:          t.service_name.trim(),
          price:                parseFloat(t.price) || 0,
          tax_rate:             0.045,
          assigned_provider_id: t.provider_id || null,
          notes:                t.notes.trim() || null,
          video_url:            t.video_url.trim() || null,
        })
      }

      onCreated()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setSaving(false)
    }
  }

  const canCreate =
    !saving &&
    (customerMode === 'existing' ? !!selectedCustomer : !!walkinName.trim()) &&
    (wigMode === 'customer' ? !!selectedWig : !!(extSerial.trim() || extBrand.trim()))

  return (
    <>
      <div style={s.overlay} onClick={onClose} />
      <div style={s.modal}>
        {/* Header */}
        <div style={s.modalHeader}>
          <div>
            <div style={s.modalTitle}>New Repair Order</div>
            <div style={s.modalSubtitle}>Customer · Wig · Tasks</div>
          </div>
          <button style={s.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>

        {/* Body */}
        <div style={s.modalBody}>

          {/* ── Customer ── */}
          <FieldGroup label="Customer">
            <div style={s.modeRow}>
              <ModeBtn active={customerMode === 'existing'} onClick={() => { setCustomerMode('existing'); setSelectedCustomer(null); setCustSearch('') }}>Existing</ModeBtn>
              <ModeBtn active={customerMode === 'walkin'}   onClick={() => { setCustomerMode('walkin'); setSelectedCustomer(null); setWigMode('external') }}>Walk-in</ModeBtn>
            </div>

            {customerMode === 'existing' ? (
              selectedCustomer ? (
                <Pill
                  label={`${selectedCustomer.first_name} ${selectedCustomer.last_name}`}
                  sub={selectedCustomer.phone || selectedCustomer.cell}
                  onClear={() => setSelectedCustomer(null)}
                />
              ) : (
                <Dropdown
                  placeholder="Search by name or phone…"
                  value={custSearch}
                  onChange={setCustSearch}
                  results={filteredCustomers}
                  renderItem={c => `${c.first_name} ${c.last_name}${(c.phone || c.cell) ? ` · ${c.phone || c.cell}` : ''}`}
                  onSelect={c => { setSelectedCustomer(c); setCustSearch('') }}
                />
              )
            ) : (
              <div style={s.inlineRow}>
                <input style={s.field} placeholder="Customer name" value={walkinName} onChange={e => setWalkinName(e.target.value)} />
                <input style={s.field} placeholder="Phone (optional)" value={walkinPhone} onChange={e => setWalkinPhone(e.target.value)} />
              </div>
            )}
          </FieldGroup>

          {/* ── Wig ── */}
          <FieldGroup label="Wig">
            <div style={s.modeRow}>
              <ModeBtn
                active={wigMode === 'customer'}
                disabled={customerMode === 'walkin'}
                onClick={() => { setWigMode('customer'); setSelectedWig(null); setWigSearch('') }}
              >
                Customer's Wig
              </ModeBtn>
              <ModeBtn active={wigMode === 'external'} onClick={() => { setWigMode('external'); setSelectedWig(null) }}>
                External
              </ModeBtn>
            </div>

            {wigMode === 'customer' ? (
              selectedWig ? (
                <Pill
                  label={selectedWig.daysmart_serial ?? selectedWig.name}
                  sub={[selectedWig.brand, selectedWig.color, selectedWig.length].filter(Boolean).join(' · ')}
                  onClear={() => setSelectedWig(null)}
                />
              ) : selectedCustomer ? (
                <Dropdown
                  placeholder="Search by serial, brand, color…"
                  value={wigSearch}
                  onChange={setWigSearch}
                  results={filteredWigs}
                  renderItem={w => [w.daysmart_serial, w.brand, w.color, w.length].filter(Boolean).join(' · ') || w.name}
                  onSelect={w => { setSelectedWig(w); setWigSearch('') }}
                />
              ) : (
                <p style={s.hint}>Select a customer first.</p>
              )
            ) : (
              <div style={s.inlineRow}>
                <input style={s.field} placeholder="Serial number" value={extSerial} onChange={e => setExtSerial(e.target.value)} />
                <input style={s.field} placeholder="Brand" value={extBrand} onChange={e => setExtBrand(e.target.value)} />
                <input style={s.field} placeholder="Color" value={extColor} onChange={e => setExtColor(e.target.value)} />
              </div>
            )}
          </FieldGroup>

          {/* ── Notes ── */}
          <FieldGroup label="Notes">
            <input
              style={s.field}
              placeholder="General instructions, context… (optional)"
              value={orderNotes}
              onChange={e => setOrderNotes(e.target.value)}
            />
          </FieldGroup>

          {/* ── Tasks ── */}
          <FieldGroup label="Tasks">
            {tasks.map(t => (
              <div key={t.key} style={s.taskDraftRow}>
                {/* Row 1: service + provider + price + delete */}
                <div style={s.taskDraftRow1}>
                  <select
                    style={{ ...s.field, flex: 1 }}
                    value={t.service_id}
                    onChange={e => handleServiceSelect(t.key, e.target.value)}
                  >
                    <option value="">Select service…</option>
                    {repairServices.filter(s => s.is_active).map(svc => (
                      <option key={svc.id} value={svc.id}>{svc.name}</option>
                    ))}
                  </select>

                  <select
                    style={{ ...s.field, flex: '0 0 160px' }}
                    value={t.provider_id}
                    onChange={e => updateTask(t.key, { provider_id: e.target.value })}
                  >
                    <option value="">— In house</option>
                    {providers.filter(p => p.is_active).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>

                  <div style={s.priceWrap}>
                    <span style={s.pricePre}>$</span>
                    <input
                      style={s.priceField}
                      placeholder="0.00"
                      value={t.price}
                      onChange={e => updateTask(t.key, { price: e.target.value })}
                    />
                  </div>

                  <button style={s.iconBtn} onClick={() => removeTask(t.key)}>
                    <X size={13} color="rgba(13,13,13,0.3)" />
                  </button>
                </div>

                {/* Row 2: notes + drive link */}
                <div style={s.taskDraftRow2}>
                  <input
                    style={{ ...s.field, flex: 1 }}
                    placeholder="Notes (optional)"
                    value={t.notes}
                    onChange={e => updateTask(t.key, { notes: e.target.value })}
                  />
                  <input
                    style={{ ...s.field, flex: '0 0 180px' }}
                    placeholder="Drive / video link"
                    value={t.video_url}
                    onChange={e => updateTask(t.key, { video_url: e.target.value })}
                  />
                </div>
              </div>
            ))}

            <button style={s.addTaskDraftBtn} onClick={addTask}>
              <Plus size={13} />
              Add task
            </button>
          </FieldGroup>

          {error && <p style={s.errorMsg}>{error}</p>}
        </div>

        {/* Footer */}
        <div style={s.modalFooter}>
          <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            style={{ ...s.createBtn, ...(!canCreate ? s.createBtnDisabled : {}) }}
            onClick={handleCreate}
            disabled={!canCreate}
          >
            {saving ? 'Creating…' : 'Create Order'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Active Carts Tab ─────────────────────────────────────────

type CartItem = {
  id: string
  customer_id: string
  customer_name?: string
  item_type: string
  description: string
  price: number
  notes?: string
  department: string
  status: string
  repair_order_id?: string
  repair_order_status?: string
  created_at: string
}

function ActiveCartsTab() {
  const [expanded, setExpanded] = useState<string | null>(null)

  const { data: allCart = [], isLoading } = useQuery<CartItem[]>({
    queryKey: ['cart-active'],
    queryFn: () => api.get('/cart/active').then(r => r.data),
    staleTime: 0,
  })

  const grouped = useMemo(() => {
    const repairItems = allCart.filter(i => i.department === 'repairs')
    const map = new Map<string, CartItem[]>()
    for (const item of repairItems) {
      map.set(item.customer_id, [...(map.get(item.customer_id) ?? []), item])
    }
    return Array.from(map.entries())
  }, [allCart])

  if (isLoading) return <div style={s.empty}>Loading…</div>
  if (grouped.length === 0) return <div style={s.empty}>No pending repair carts.</div>

  return (
    <div style={s.list}>
      {grouped.map(([custId, items]) => {
        const name        = items[0].customer_name ?? 'Unknown'
        const total       = items.reduce((sum, i) => sum + Number(i.price), 0)
        const open        = expanded === custId
        const orderStatus = items[0].repair_order_status as RepairOrderStatus | undefined
        const osc         = orderStatus ? ORDER_STATUS_COLOR[orderStatus] : null

        return (
          <div key={custId} style={s.cartGroup}>
            <button style={s.cartHeader} onClick={() => setExpanded(open ? null : custId)}>
              <User size={13} color="rgba(13,13,13,0.35)" />
              <span style={s.cartName}>{name}</span>
              {osc && orderStatus && (
                <span style={{ ...s.statusChip, background: osc.bg, color: osc.color, fontSize: 10 }}>
                  {ORDER_STATUS_LABEL[orderStatus]}
                </span>
              )}
              <span style={s.cartBadge}>{items.length} item{items.length !== 1 ? 's' : ''}</span>
              <span style={{ flex: 1 }} />
              <span style={s.cartTotal}>${total.toFixed(2)}</span>
              {open ? <ChevronDown size={14} color="rgba(13,13,13,0.35)" /> : <ChevronRight size={14} color="rgba(13,13,13,0.35)" />}
            </button>

            {open && (
              <div style={s.cartBody}>
                {items.map(item => (
                  <div key={item.id} style={s.cartItemRow}>
                    <div style={s.cartItemInfo}>
                      <span style={s.cartItemName}>{item.description}</span>
                      {item.notes && <span style={s.cartItemNotes}>{item.notes}</span>}
                    </div>
                    <span style={s.cartItemPrice}>${Number(item.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Print Task Slip ──────────────────────────────────────────

function printSlip(task: RepairTask) {
  const w = window.open('', '_blank', `width=${screen.width},height=${screen.height},left=0,top=0`)
  if (!w) return
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  w.document.write(`<!DOCTYPE html><html><head><title>Task Slip</title>
  <style>
    body { font-family: 'Courier New', monospace; padding: 24px; font-size: 13px; color: #111; }
    h2 { font-size: 15px; margin: 0 0 4px; }
    .divider { border-top: 1px dashed #999; margin: 10px 0; }
    .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #666; margin-bottom: 2px; }
    .value { font-size: 13px; margin-bottom: 10px; }
    .status { font-weight: bold; }
  </style>
  </head><body>
  <h2>Repair Task Slip</h2>
  <div class="label">Date</div><div class="value">${date}</div>
  <div class="divider"></div>
  <div class="label">Service</div><div class="value">${task.description}</div>
  <div class="label">Provider</div><div class="value">${task.assigned_provider_name ?? '— In house'}</div>
  ${task.notes ? `<div class="label">Instructions</div><div class="value">${task.notes}</div>` : ''}
  ${task.video_url ? `<div class="label">Reference Video</div><div class="value">${task.video_url}</div>` : ''}
  <div class="divider"></div>
  <div class="label">Status</div><div class="value status">${TASK_STATUS_LABEL[task.status]}</div>
  </body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 250)
}

// ── Small helpers ─────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ ...s.tabBtn, ...(active ? s.tabBtnActive : {}) }}>
      {children}
    </button>
  )
}

function ModeBtn({ active, onClick, disabled, children }: { active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...s.modeBtn, ...(active ? s.modeBtnActive : {}), ...(disabled ? { opacity: 0.35, cursor: 'not-allowed' } : {}) }}
    >
      {children}
    </button>
  )
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={s.fieldGroup}>
      <div style={s.fieldLabel}>{label}</div>
      <div style={s.fieldContent}>{children}</div>
    </div>
  )
}

function Pill({ label, sub, onClear }: { label: string; sub?: string | null; onClear: () => void }) {
  return (
    <div style={s.pill}>
      <div style={{ flex: 1 }}>
        <span style={s.pillLabel}>{label}</span>
        {sub && <span style={s.pillSub}> · {sub}</span>}
      </div>
      <button style={s.iconBtn} onClick={onClear}><X size={12} /></button>
    </div>
  )
}

function Dropdown<T>({ placeholder, value, onChange, results, renderItem, onSelect }: {
  placeholder: string; value: string; onChange: (v: string) => void
  results: T[]; renderItem: (item: T) => string; onSelect: (item: T) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <div style={s.searchWrap}>
        <Search size={13} color="rgba(13,13,13,0.3)" />
        <input
          style={s.searchInput}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete="off"
        />
        {value && <button style={s.clearBtn} onClick={() => onChange('')}><X size={12} /></button>}
      </div>
      {results.length > 0 && (
        <div style={s.dropdown}>
          {results.map((item, i) => (
            <button key={i} style={s.dropdownItem} onMouseDown={e => { e.preventDefault(); onSelect(item) }}>
              {renderItem(item)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────

const BORDER = '1px solid rgba(13,13,13,0.08)'

const s: Record<string, React.CSSProperties> = {
  // Page
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  title:       { fontSize: 22, fontWeight: 600, color: '#0d0d0d', letterSpacing: '-0.03em', margin: 0 },
  subtitle:    { fontSize: 13, color: 'rgba(13,13,13,0.45)', marginTop: 4 },
  newBtn:      { display: 'flex', alignItems: 'center', gap: 6, background: '#0d0d0d', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer' },

  tabRow:      { display: 'flex', gap: 4, marginBottom: 24, borderBottom: BORDER },
  tabBtn:      { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, color: 'rgba(13,13,13,0.45)', padding: '8px 14px', borderBottom: '2px solid transparent', marginBottom: -1, borderRadius: 0 },
  tabBtnActive:{ color: '#0d0d0d', borderBottomColor: '#0d0d0d' },

  toolbar:     { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' as const },
  searchWrap:  { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: BORDER, borderRadius: 8, padding: '7px 12px', flex: '1 1 200px', minWidth: 200 },
  searchInput: { border: 'none', outline: 'none', fontSize: 13, color: '#0d0d0d', background: 'transparent', flex: 1 },
  clearBtn:    { background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(13,13,13,0.35)', display: 'flex', alignItems: 'center', padding: 2 },
  filters:     { display: 'flex', gap: 4, flexWrap: 'wrap' as const },
  filterBtn:   { background: '#fff', border: BORDER, borderRadius: 7, padding: '6px 11px', fontSize: 12, fontWeight: 500, cursor: 'pointer', color: 'rgba(13,13,13,0.5)' },
  filterBtnOn: { background: '#0d0d0d', color: '#fff', borderColor: '#0d0d0d' },

  list:        { display: 'flex', flexDirection: 'column', gap: 8 },
  empty:       { textAlign: 'center' as const, color: 'rgba(13,13,13,0.35)', fontSize: 13, padding: '48px 0' },

  // Order card
  orderCard:   { background: '#fff', border: BORDER, borderRadius: 12, overflow: 'hidden' },
  orderHeader: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const },
  statusChip:  { fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, flexShrink: 0, letterSpacing: '0.01em' },
  orderName:   { fontSize: 13, fontWeight: 600, color: '#0d0d0d', letterSpacing: '-0.01em', flexShrink: 0 },
  orderPhone:  { fontSize: 11, color: 'rgba(13,13,13,0.4)', flexShrink: 0 },
  orderDivider:{ fontSize: 13, color: 'rgba(13,13,13,0.2)', flexShrink: 0 },
  orderWig:    { fontSize: 12, color: 'rgba(13,13,13,0.55)', flexShrink: 0 },
  orderCount:  { fontSize: 12, color: 'rgba(13,13,13,0.4)', flexShrink: 0 },
  orderDate:   { fontSize: 11, color: 'rgba(13,13,13,0.3)', flexShrink: 0 },
  iconBtn:     { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 5, borderRadius: 5 },

  orderBody:   { borderTop: BORDER, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 },
  orderNotes:  { fontSize: 12, color: 'rgba(13,13,13,0.5)', margin: '0 0 6px', fontStyle: 'italic' },
  emptyTasks:  { fontSize: 12, color: 'rgba(13,13,13,0.35)', margin: '4px 0' },

  // Task row
  taskCard:        { background: '#fafaf9', border: BORDER, borderRadius: 8, overflow: 'hidden' },
  taskRow:         { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px' },
  taskStatusChip:  { fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap' as const, letterSpacing: '0.01em', border: 'none' },
  taskInfo:        { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  taskDesc:        { fontSize: 13, color: '#0d0d0d', fontWeight: 500, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },
  taskNotes:       { fontSize: 11, color: 'rgba(13,13,13,0.45)', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },
  taskPrice:       { fontSize: 13, fontWeight: 600, color: '#0d0d0d', flexShrink: 0 },
  linkIcon:        { display: 'flex', alignItems: 'center', flexShrink: 0 },
  taskEditRow:     { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderTop: BORDER, background: '#fff' },
  taskEditField:   { border: BORDER, borderRadius: 7, padding: '6px 10px', fontSize: 12, outline: 'none', background: '#fff', flexShrink: 0 },

  // Add task inline form
  addTaskBtn:   { display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px dashed rgba(13,13,13,0.18)', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', color: 'rgba(13,13,13,0.5)', marginTop: 4 },
  addTaskForm:  { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(13,13,13,0.02)', border: BORDER, borderRadius: 8, marginTop: 4 },
  addInput:     { border: BORDER, borderRadius: 7, padding: '6px 10px', fontSize: 12, outline: 'none', background: '#fff' },
  priceWrap:    { display: 'flex', alignItems: 'center', border: BORDER, borderRadius: 7, background: '#fff', overflow: 'hidden', flexShrink: 0 },
  pricePre:     { padding: '0 6px', fontSize: 12, color: 'rgba(13,13,13,0.4)', background: 'rgba(13,13,13,0.04)', borderRight: BORDER },
  priceField:   { border: 'none', outline: 'none', padding: '6px 8px', fontSize: 12, width: 64, background: 'transparent' },
  saveTaskBtn:  { background: '#0d0d0d', color: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px', fontSize: 12, cursor: 'pointer', flexShrink: 0 },
  cancelTaskBtn:{ background: 'none', border: BORDER, borderRadius: 7, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', flexShrink: 0 },

  // Global status row
  globalStatusRow:  { display: 'flex', alignItems: 'center', gap: 6, paddingTop: 10, marginTop: 4, borderTop: BORDER, flexWrap: 'wrap' as const },
  globalStatusLabel:{ fontSize: 11, color: 'rgba(13,13,13,0.4)', fontWeight: 500, marginRight: 4, textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  statusOptionBtn:  { fontSize: 11, fontWeight: 500, padding: '4px 10px', borderRadius: 8, cursor: 'pointer', transition: 'all 0.1s' },

  // Create order modal
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 200 },
  modal:       { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 'clamp(560px,56vw,720px)', maxHeight: '86vh', background: '#fff', borderRadius: 16, zIndex: 201, display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.14)' },
  modalHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: BORDER, flexShrink: 0 },
  modalTitle:  { fontSize: 16, fontWeight: 600, color: '#0d0d0d', letterSpacing: '-0.02em' },
  modalSubtitle:{ fontSize: 12, color: 'rgba(13,13,13,0.4)', marginTop: 2 },
  closeBtn:    { background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(13,13,13,0.4)', display: 'flex', padding: 4 },
  modalBody:   { flex: 1, overflowY: 'auto' as const, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 16 },
  modalFooter: { padding: '16px 24px', borderTop: BORDER, display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 },
  cancelBtn:   { background: '#fff', border: BORDER, borderRadius: 8, padding: '9px 18px', fontSize: 13, cursor: 'pointer', color: 'rgba(13,13,13,0.55)' },
  createBtn:   { background: '#0d0d0d', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer' },
  createBtnDisabled: { background: 'rgba(13,13,13,0.2)', cursor: 'not-allowed' },

  // Field groups inside modal
  fieldGroup:   { display: 'flex', flexDirection: 'column', gap: 8 },
  fieldLabel:   { fontSize: 11, fontWeight: 600, color: 'rgba(13,13,13,0.5)', textTransform: 'uppercase' as const, letterSpacing: '0.07em' },
  fieldContent: { display: 'flex', flexDirection: 'column', gap: 6 },
  field:        { border: BORDER, borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none', background: '#fff', flex: 1 },
  inlineRow:    { display: 'flex', gap: 8 },

  modeRow:      { display: 'flex', gap: 6 },
  modeBtn:      { background: '#fff', border: BORDER, borderRadius: 7, padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: 'rgba(13,13,13,0.55)', fontWeight: 500 },
  modeBtnActive:{ background: '#0d0d0d', color: '#fff', borderColor: '#0d0d0d' },

  hint:         { fontSize: 12, color: 'rgba(13,13,13,0.35)', margin: 0 },
  errorMsg:     { fontSize: 12, color: '#c0392b', background: 'rgba(192,57,43,0.06)', borderRadius: 6, padding: '8px 12px' },

  // Task draft rows (inside modal)
  taskDraftRow:    { display: 'flex', flexDirection: 'column', gap: 6, background: '#fafaf9', border: BORDER, borderRadius: 8, padding: '10px 12px' },
  taskDraftRow1:   { display: 'flex', alignItems: 'center', gap: 8 },
  taskDraftRow2:   { display: 'flex', alignItems: 'center', gap: 8 },
  addTaskDraftBtn: { display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px dashed rgba(13,13,13,0.18)', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer', color: 'rgba(13,13,13,0.5)' },

  // Pill
  pill:      { display: 'flex', alignItems: 'center', background: 'rgba(13,13,13,0.04)', border: BORDER, borderRadius: 8, padding: '8px 12px', gap: 10 },
  pillLabel: { fontSize: 13, fontWeight: 500, color: '#0d0d0d' },
  pillSub:   { fontSize: 12, color: 'rgba(13,13,13,0.4)' },

  // Dropdown
  dropdown:     { position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: BORDER, borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', zIndex: 10, maxHeight: 210, overflowY: 'auto' as const, marginTop: 4 },
  dropdownItem: { display: 'block', width: '100%', textAlign: 'left' as const, padding: '9px 14px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: '#0d0d0d' },

  // Active Carts
  cartGroup:  { background: '#fff', border: BORDER, borderRadius: 10, overflow: 'hidden' },
  cartHeader: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' as const },
  cartName:   { fontSize: 13, fontWeight: 600, color: '#0d0d0d', flex: 1 },
  cartBadge:  { fontSize: 11, background: 'rgba(13,13,13,0.07)', borderRadius: 20, padding: '2px 8px', color: 'rgba(13,13,13,0.5)' },
  cartTotal:  { fontSize: 13, fontWeight: 600, color: '#0d0d0d', marginRight: 4 },
  cartBody:   { borderTop: BORDER, padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 6 },
  cartItemRow:  { display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0' },
  cartItemInfo: { flex: 1, display: 'flex', flexDirection: 'column' },
  cartItemName: { fontSize: 13, color: '#0d0d0d', fontWeight: 500 },
  cartItemNotes:{ fontSize: 11, color: 'rgba(13,13,13,0.4)', marginTop: 1 },
  cartItemPrice:{ fontSize: 13, fontWeight: 600, color: '#0d0d0d', flexShrink: 0 },
}
