import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, X, Clock, User as UserIcon, Tag, FileText } from 'lucide-react'
import { api } from '../../lib/api'

// ── Types ─────────────────────────────────────────────────────

type Department = 'sales' | 'repairs' | 'wash_set' | 'front_desk'
type ApptStatus = 'scheduled' | 'arrived' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'

interface Appointment {
  id: string
  customer_id: string | null
  customer_name: string
  customer_phone: string | null
  appointment_date: string   // ISO datetime from API
  duration_minutes: number
  department: Department
  employee_id: string | null
  employee_name: string | null
  services_requested: string | null
  status: ApptStatus
  notes: string | null
  created_by: string | null
  created_at: string
}

interface EmployeeOption {
  id: string
  first_name: string
  last_name: string
}

interface ServiceOption {
  id: string
  name: string
}

interface CustomerSearchResult {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  cell: string | null
}

// ── Constants ─────────────────────────────────────────────────

const HOUR_PX = 64   // pixels per hour in day/week grid
const DAY_START = 8  // 8 AM
const DAY_END = 20   // 8 PM (exclusive — last label is 8pm)
const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => i + DAY_START)

const DEPT_COLOR: Record<Department, string> = {
  sales:      '#DF5198',
  repairs:    '#E3CD94',
  wash_set:   '#97BBE9',
  front_desk: '#5581B1',
}
const DEPT_TEXT: Record<Department, string> = {
  sales:      '#fff',
  repairs:    '#4a3a10',
  wash_set:   '#1a2d4a',
  front_desk: '#fff',
}
const DEPT_LABEL: Record<Department, string> = {
  sales:      'Sales',
  repairs:    'Repairs',
  wash_set:   'Wash & Set',
  front_desk: 'Front Desk',
}

const STATUS_COLOR: Record<ApptStatus, string> = {
  scheduled:   '#5581B1',
  arrived:     '#4caf50',
  in_progress: '#DF5198',
  completed:   '#9e9e9e',
  cancelled:   '#e53935',
  no_show:     '#ff9800',
}
const STATUS_LABEL: Record<ApptStatus, string> = {
  scheduled:   'Scheduled',
  arrived:     'Arrived',
  in_progress: 'In Progress',
  completed:   'Completed',
  cancelled:   'Cancelled',
  no_show:     'No Show',
}

const DURATION_OPTIONS = [30, 45, 60, 90, 120]
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ── Helpers ───────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function getWeekStart(d: Date): Date {
  const nd = new Date(d)
  nd.setDate(d.getDate() - d.getDay())
  nd.setHours(0,0,0,0)
  return nd
}

function getWeekDates(d: Date): Date[] {
  const start = getWeekStart(d)
  return Array.from({length:7}, (_,i) => {
    const nd = new Date(start)
    nd.setDate(start.getDate()+i)
    return nd
  })
}

function getMonthGrid(d: Date): Date[] {
  const year = d.getFullYear()
  const month = d.getMonth()
  const firstDay = new Date(year, month, 1)
  const startDate = new Date(firstDay)
  startDate.setDate(firstDay.getDate() - firstDay.getDay())
  const dates: Date[] = []
  const cur = new Date(startDate)
  for (let i = 0; i < 42; i++) {
    dates.push(new Date(cur))
    cur.setDate(cur.getDate()+1)
  }
  return dates
}

function apptTop(appt: Appointment): number {
  const d = new Date(appt.appointment_date)
  const minutesFromStart = (d.getHours() + d.getMinutes()/60 - DAY_START) * 60
  return (minutesFromStart / 60) * HOUR_PX
}

function apptHeight(appt: Appointment): number {
  return (appt.duration_minutes / 60) * HOUR_PX
}

function formatTime(isoStr: string): string {
  const d = new Date(isoStr)
  const h = d.getHours()
  const m = d.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2,'0')} ${ampm}`
}

function formatHourLabel(h: number): string {
  if (h === 12) return '12 PM'
  return h < 12 ? `${h} AM` : `${h-12} PM`
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

function apptOnDay(appt: Appointment, day: Date): boolean {
  return isSameDay(new Date(appt.appointment_date), day)
}

// ── Main Page ─────────────────────────────────────────────────

export default function CalendarPage() {
  const qc = useQueryClient()
  const [view, setView] = useState<'day' | 'week' | 'month'>('week')
  const [current, setCurrent] = useState(() => { const d = new Date(); d.setHours(0,0,0,0); return d })
  const [newModal, setNewModal] = useState<{open:boolean; date?:Date; hour?:number}>({open:false})
  const [detailAppt, setDetailAppt] = useState<Appointment | null>(null)

  // Date range for query
  const { start, end } = useMemo(() => {
    if (view === 'day') {
      const s = new Date(current); s.setHours(0,0,0,0)
      const e = new Date(current); e.setHours(23,59,59,999)
      return { start: s, end: e }
    }
    if (view === 'week') {
      const s = getWeekStart(current)
      const e = new Date(s); e.setDate(s.getDate()+7)
      return { start: s, end: e }
    }
    // month
    const s = new Date(current.getFullYear(), current.getMonth(), 1)
    const e = new Date(current.getFullYear(), current.getMonth()+1, 1)
    return { start: s, end: e }
  }, [view, current])

  const { data: appointments = [] } = useQuery<Appointment[]>({
    queryKey: ['appointments', start.toISOString(), end.toISOString()],
    queryFn: () => api.get('/appointments/', { params: { start: start.toISOString(), end: end.toISOString() } }).then(r => r.data),
  })

  const navigate = (dir: -1|1) => {
    setCurrent(prev => {
      const d = new Date(prev)
      if (view === 'day')   d.setDate(d.getDate()+dir)
      if (view === 'week')  d.setDate(d.getDate()+dir*7)
      if (view === 'month') d.setMonth(d.getMonth()+dir)
      return d
    })
  }

  const titleLabel = useMemo(() => {
    if (view === 'day') return `${DAY_NAMES[current.getDay()]}, ${MONTH_NAMES[current.getMonth()]} ${current.getDate()}, ${current.getFullYear()}`
    if (view === 'week') {
      const dates = getWeekDates(current)
      const s = dates[0], e = dates[6]
      if (s.getMonth() === e.getMonth()) return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`
      return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()} – ${MONTH_NAMES[e.getMonth()]} ${e.getDate()}, ${s.getFullYear()}`
    }
    return `${MONTH_NAMES[current.getMonth()]} ${current.getFullYear()}`
  }, [view, current])

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])

  return (
    <div style={s.page}>
      {/* ── Header ── */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <h1 style={s.title}>Calendar</h1>
          <button style={s.todayBtn} onClick={() => setCurrent(new Date())}>Today</button>
          <div style={s.navBtns}>
            <button style={s.navBtn} onClick={() => navigate(-1)}><ChevronLeft size={16}/></button>
            <button style={s.navBtn} onClick={() => navigate(1)}><ChevronRight size={16}/></button>
          </div>
          <span style={s.dateLabel}>{titleLabel}</span>
        </div>
        <div style={s.headerRight}>
          <div style={s.viewTabs}>
            {(['day','week','month'] as const).map(v => (
              <button key={v} style={{...s.viewTab, ...(view===v ? s.viewTabActive : {})}} onClick={() => setView(v)}>
                {v.charAt(0).toUpperCase()+v.slice(1)}
              </button>
            ))}
          </div>
          <button style={s.newBtn} onClick={() => setNewModal({open:true, date:current})}>
            <Plus size={14}/> New Appointment
          </button>
        </div>
      </div>

      {/* ── Views ── */}
      {view === 'day'   && <DayView   appointments={appointments} date={current}                    today={today} onSlotClick={(h)=>setNewModal({open:true,date:current,hour:h})} onApptClick={setDetailAppt}/>}
      {view === 'week'  && <WeekView  appointments={appointments} weekDates={getWeekDates(current)} today={today} onSlotClick={(d,h)=>setNewModal({open:true,date:d,hour:h})}    onApptClick={setDetailAppt}/>}
      {view === 'month' && <MonthView appointments={appointments} currentDate={current}              today={today} onDayClick={(d)=>{setCurrent(d);setView('day')}}               onApptClick={setDetailAppt}/>}

      {/* ── Modals ── */}
      {newModal.open && (
        <NewAppointmentModal
          date={newModal.date}
          hour={newModal.hour}
          onClose={() => setNewModal({open:false})}
          onSaved={() => { setNewModal({open:false}); qc.invalidateQueries({queryKey:['appointments']}) }}
        />
      )}
      {detailAppt && (
        <AppointmentDrawer
          appt={detailAppt}
          onClose={() => setDetailAppt(null)}
          onUpdated={(updated) => { setDetailAppt(updated); qc.invalidateQueries({queryKey:['appointments']}) }}
          onDeleted={() => { setDetailAppt(null); qc.invalidateQueries({queryKey:['appointments']}) }}
        />
      )}
    </div>
  )
}

// ── Time Grid (shared by Day and Week) ────────────────────────

function TimeGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={s.gridWrapper}>
      {/* Time labels */}
      <div style={s.timeCol}>
        {HOURS.map(h => (
          <div key={h} style={s.timeCell}>{formatHourLabel(h)}</div>
        ))}
      </div>
      {children}
    </div>
  )
}

// ── Day View ──────────────────────────────────────────────────

function DayView({ appointments, date, today, onSlotClick, onApptClick }: {
  appointments: Appointment[]
  date: Date
  today: Date
  onSlotClick: (hour: number) => void
  onApptClick: (a: Appointment) => void
}) {
  const dayAppts = appointments.filter(a => apptOnDay(a, date))
  const isToday = isSameDay(date, today)

  return (
    <TimeGrid>
      <div style={{...s.dayCol, flex:1}}>
        {/* Hour slot backgrounds */}
        {HOURS.map(h => (
          <div key={h} style={s.hourSlot} onClick={() => onSlotClick(h)} />
        ))}
        {/* Appointment blocks */}
        {dayAppts.map(a => <ApptBlock key={a.id} appt={a} onClick={onApptClick} wide />)}
        {/* Current time line */}
        {isToday && <CurrentTimeLine />}
      </div>
    </TimeGrid>
  )
}

// ── Week View ─────────────────────────────────────────────────

function WeekView({ appointments, weekDates, today, onSlotClick, onApptClick }: {
  appointments: Appointment[]
  weekDates: Date[]
  today: Date
  onSlotClick: (date: Date, hour: number) => void
  onApptClick: (a: Appointment) => void
}) {
  return (
    <div>
      {/* Day headers */}
      <div style={s.weekHeader}>
        <div style={{width:52, flexShrink:0}}/>
        {weekDates.map((d,i) => {
          const isToday = isSameDay(d, today)
          return (
            <div key={i} style={{...s.weekDayHeader, ...(isToday ? s.weekDayHeaderToday:{})}}>
              <span style={s.weekDayName}>{DAY_NAMES[d.getDay()]}</span>
              <span style={{...s.weekDayNum, ...(isToday ? s.weekDayNumToday:{})}}>{d.getDate()}</span>
            </div>
          )
        })}
      </div>
      <TimeGrid>
        {weekDates.map((d,i) => {
          const dayAppts = appointments.filter(a => apptOnDay(a, d))
          const isToday = isSameDay(d, today)
          return (
            <div key={i} style={{...s.dayCol, flex:1, borderLeft:'1px solid rgba(13,13,13,0.06)'}}>
              {HOURS.map(h => (
                <div key={h} style={s.hourSlot} onClick={() => onSlotClick(d, h)} />
              ))}
              {dayAppts.map(a => <ApptBlock key={a.id} appt={a} onClick={onApptClick} />)}
              {isToday && <CurrentTimeLine />}
            </div>
          )
        })}
      </TimeGrid>
    </div>
  )
}

// ── Month View ────────────────────────────────────────────────

function MonthView({ appointments, currentDate, today, onDayClick, onApptClick }: {
  appointments: Appointment[]
  currentDate: Date
  today: Date
  onDayClick: (d: Date) => void
  onApptClick: (a: Appointment) => void
}) {
  const grid = useMemo(() => getMonthGrid(currentDate), [currentDate])
  const currentMonth = currentDate.getMonth()

  return (
    <div style={s.monthWrapper}>
      <div style={s.monthDayNames}>
        {DAY_NAMES.map(n => <div key={n} style={s.monthDayName}>{n}</div>)}
      </div>
      <div style={s.monthGrid}>
        {grid.map((d,i) => {
          const dayAppts = appointments.filter(a => apptOnDay(a, d))
          const isToday = isSameDay(d, today)
          const isCurrentMonth = d.getMonth() === currentMonth
          return (
            <div key={i} style={{...s.monthCell, ...(isToday ? s.monthCellToday:{}), ...(!isCurrentMonth ? s.monthCellOtherMonth:{})}}
              onClick={() => onDayClick(d)}>
              <span style={{...s.monthCellNum, ...(isToday ? s.monthCellNumToday:{})}}>{d.getDate()}</span>
              <div style={s.monthAppts}>
                {dayAppts.slice(0,3).map(a => (
                  <div key={a.id} style={{...s.monthApptChip, background:DEPT_COLOR[a.department], color:DEPT_TEXT[a.department]}}
                    onClick={e => { e.stopPropagation(); onApptClick(a) }}>
                    {formatTime(a.appointment_date)} {a.customer_name.split(' ')[0]}
                  </div>
                ))}
                {dayAppts.length > 3 && <div style={s.monthMore}>+{dayAppts.length-3} more</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Appointment Block ─────────────────────────────────────────

function ApptBlock({ appt, onClick, wide=false }: { appt:Appointment; onClick:(a:Appointment)=>void; wide?:boolean }) {
  const top = apptTop(appt)
  const height = Math.max(apptHeight(appt), 24)
  const bg = DEPT_COLOR[appt.department]
  const color = DEPT_TEXT[appt.department]

  return (
    <div
      style={{...s.apptBlock, top, height, background:bg, color, ...(wide ? {left:4, right:4} : {left:2, right:2})}}
      onClick={e => { e.stopPropagation(); onClick(appt) }}
    >
      <div style={s.apptTime}>{formatTime(appt.appointment_date)}</div>
      <div style={s.apptName}>{appt.customer_name}</div>
      {height > 44 && appt.services_requested && (
        <div style={s.apptService}>{appt.services_requested}</div>
      )}
    </div>
  )
}

// ── Current Time Line ─────────────────────────────────────────

function CurrentTimeLine() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])
  const top = ((now.getHours() + now.getMinutes()/60 - DAY_START)) * HOUR_PX
  if (top < 0 || top > HOUR_PX * HOURS.length) return null
  return (
    <div style={{...s.nowLine, top}}>
      <div style={s.nowDot}/>
    </div>
  )
}

// ── New Appointment Modal ─────────────────────────────────────

function NewAppointmentModal({ date, hour, onClose, onSaved }: {
  date?: Date
  hour?: number
  onClose: () => void
  onSaved: () => void
}) {
  const defaultDate = date ? toDateStr(date) : toDateStr(new Date())
  const defaultHour = hour ?? 10
  const defaultTime = `${String(defaultHour).padStart(2,'0')}:00`

  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    customer_id: '' as string | null,
    date: defaultDate,
    time: defaultTime,
    duration_minutes: 60,
    department: 'sales' as Department,
    employee_id: '' as string | null,
    services_requested: '',
    notes: '',
  })

  const { data: employees = [] } = useQuery<EmployeeOption[]>({
    queryKey: ['employees-list'],
    queryFn: () => api.get('/employees/?active_only=true').then(r => r.data),
  })

  const { data: repairServices = [] } = useQuery<ServiceOption[]>({
    queryKey: ['repair-services'],
    queryFn: () => api.get('/repair-services/').then(r => r.data),
  })

  const { data: washSetServices = [] } = useQuery<ServiceOption[]>({
    queryKey: ['wash-set-services'],
    queryFn: () => api.get('/wash-set-services/').then(r => r.data),
  })

  const FRONT_DESK_SERVICES: ServiceOption[] = [
    { id: 'fd1', name: '2 Wash and sets' },
    { id: 'fd2', name: '3 Wash and sets' },
    { id: 'fd3', name: 'Buy Fall Consultation' },
    { id: 'fd4', name: 'Buy Wig Consultation' },
    { id: 'fd5', name: 'Closed (30 min)' },
  ]

  const allServices = useMemo(() => {
    if (form.department === 'repairs')    return repairServices
    if (form.department === 'wash_set')   return washSetServices
    if (form.department === 'front_desk') return FRONT_DESK_SERVICES
    return [...washSetServices, ...repairServices]
  }, [form.department, repairServices, washSetServices])
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onSearchChange = (val: string) => {
    setSearch(val)
    setForm(f => ({...f, customer_name: val, customer_id: null}))
    if (searchRef.current) clearTimeout(searchRef.current)
    if (val.length < 2) { setSearchResults([]); setShowDropdown(false); return }
    searchRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/customers/', { params: { search: val, limit: 8 } })
        setSearchResults(res.data)
        setShowDropdown(true)
      } catch { setSearchResults([]) }
    }, 280)
  }

  const selectCustomer = (c: CustomerSearchResult) => {
    setForm(f => ({
      ...f,
      customer_id: c.id,
      customer_name: `${c.first_name} ${c.last_name}`,
      customer_phone: c.phone || c.cell || '',
    }))
    setSearch(`${c.first_name} ${c.last_name}`)
    setShowDropdown(false)
  }

  const mutation = useMutation({
    mutationFn: (data: object) => api.post('/appointments/', data),
    onSuccess: onSaved,
  })

  const submit = () => {
    if (!form.customer_name.trim()) return
    const [y,mo,d] = form.date.split('-').map(Number)
    const [h,m] = form.time.split(':').map(Number)
    const dt = new Date(y, mo-1, d, h, m)
    mutation.mutate({
      customer_id: form.customer_id || null,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone || null,
      appointment_date: dt.toISOString(),
      duration_minutes: form.duration_minutes,
      department: form.department,
      employee_id: form.employee_id || null,
      services_requested: form.services_requested || null,
      notes: form.notes || null,
    })
  }

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={e => e.stopPropagation()}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>New Appointment</span>
          <button style={s.closeBtn} onClick={onClose}><X size={16}/></button>
        </div>

        <div style={s.modalBody}>
          {/* Customer search */}
          <div style={s.field}>
            <label style={s.label}>Customer</label>
            <div style={{position:'relative'}}>
              <input style={s.input} placeholder="Search by name or phone…" value={search} onChange={e => onSearchChange(e.target.value)}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)} />
              {showDropdown && searchResults.length > 0 && (
                <div style={s.dropdown}>
                  {searchResults.map(c => (
                    <div key={c.id} style={s.dropdownItem} onClick={() => selectCustomer(c)}>
                      <span style={{fontWeight:500}}>{c.first_name} {c.last_name}</span>
                      {(c.phone || c.cell) && <span style={{color:'rgba(13,13,13,0.4)', fontSize:12, marginLeft:8}}>{c.phone || c.cell}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!form.customer_id && search.length > 0 && (
              <p style={s.hint}>New customer — will be saved by name only. Add them to Customers later for full profile.</p>
            )}
          </div>

          {/* Phone */}
          <div style={s.field}>
            <label style={s.label}>Phone</label>
            <input style={s.input} placeholder="Optional" value={form.customer_phone} onChange={e => setForm(f=>({...f,customer_phone:e.target.value}))} />
          </div>

          {/* Date + Time row */}
          <div style={s.row}>
            <div style={{...s.field, flex:1}}>
              <label style={s.label}>Date</label>
              <input type="date" style={s.input} value={form.date} onChange={e => setForm(f=>({...f,date:e.target.value}))} />
            </div>
            <div style={{...s.field, flex:1}}>
              <label style={s.label}>Time</label>
              <input type="time" style={s.input} value={form.time} onChange={e => setForm(f=>({...f,time:e.target.value}))} />
            </div>
          </div>

          {/* Duration + Department row */}
          <div style={s.row}>
            <div style={{...s.field, flex:1}}>
              <label style={s.label}>Duration</label>
              <select style={s.input} value={form.duration_minutes} onChange={e => setForm(f=>({...f,duration_minutes:Number(e.target.value)}))}>
                {DURATION_OPTIONS.map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
            <div style={{...s.field, flex:1}}>
              <label style={s.label}>Department</label>
              <select style={s.input} value={form.department} onChange={e => setForm(f=>({...f,department:e.target.value as Department, services_requested:''}))}>
                {(Object.keys(DEPT_LABEL) as Department[]).map(d => (
                  <option key={d} value={d}>{DEPT_LABEL[d]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Employee + Service row */}
          <div style={s.row}>
            <div style={{...s.field, flex:1}}>
              <label style={s.label}>Employee</label>
              <select style={s.input} value={form.employee_id || ''} onChange={e => setForm(f=>({...f,employee_id:e.target.value||null}))}>
                <option value="">Any / Unassigned</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
              </select>
            </div>
            <div style={{...s.field, flex:1}}>
              <label style={s.label}>Service</label>
              <select style={s.input} value={form.services_requested} onChange={e => setForm(f=>({...f,services_requested:e.target.value}))}>
                <option value="">— Select service —</option>
                {allServices.map(sv => <option key={sv.id} value={sv.name}>{sv.name}</option>)}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div style={s.field}>
            <label style={s.label}>Notes</label>
            <textarea style={{...s.input, height:70, resize:'none'}} placeholder="Optional" value={form.notes}
              onChange={e => setForm(f=>({...f,notes:e.target.value}))} />
          </div>
        </div>

        <div style={s.modalFooter}>
          <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={{...s.saveBtn, opacity: mutation.isPending ? 0.6 : 1}}
            onClick={submit} disabled={mutation.isPending || !form.customer_name.trim()}>
            {mutation.isPending ? 'Saving…' : 'Save Appointment'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Appointment Drawer ────────────────────────────────────────

function AppointmentDrawer({ appt, onClose, onUpdated, onDeleted }: {
  appt: Appointment
  onClose: () => void
  onUpdated: (a: Appointment) => void
  onDeleted: () => void
}) {
  const updateMutation = useMutation({
    mutationFn: (data: Partial<Appointment>) => api.patch(`/appointments/${appt.id}`, data).then(r => r.data),
    onSuccess: onUpdated,
  })
  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/appointments/${appt.id}`),
    onSuccess: onDeleted,
  })

  const setStatus = (status: ApptStatus) => updateMutation.mutate({ status })

  const apptDate = new Date(appt.appointment_date)
  const endTime = new Date(apptDate.getTime() + appt.duration_minutes * 60000)

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.drawer} onClick={e => e.stopPropagation()}>
        {/* Dept color bar */}
        <div style={{...s.deptBar, background: DEPT_COLOR[appt.department]}} />

        <div style={s.drawerContent}>
          <div style={s.drawerHeader}>
            <div>
              <div style={s.drawerDept}>{DEPT_LABEL[appt.department]}</div>
              <div style={s.drawerName}>{appt.customer_name}</div>
            </div>
            <button style={s.closeBtn} onClick={onClose}><X size={16}/></button>
          </div>

          {/* Meta */}
          <div style={s.drawerMeta}>
            <div style={s.metaRow}><Clock size={14} color="rgba(13,13,13,0.4)"/>
              <span>{apptDate.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})} · {formatTime(appt.appointment_date)} – {formatTime(endTime.toISOString())} ({appt.duration_minutes}min)</span>
            </div>
            {appt.customer_phone && (
              <div style={s.metaRow}><UserIcon size={14} color="rgba(13,13,13,0.4)"/><span>{appt.customer_phone}</span></div>
            )}
            {appt.employee_name && (
              <div style={s.metaRow}><UserIcon size={14} color="rgba(13,13,13,0.4)"/><span>Employee: {appt.employee_name}</span></div>
            )}
            {appt.services_requested && (
              <div style={s.metaRow}><Tag size={14} color="rgba(13,13,13,0.4)"/><span>{appt.services_requested}</span></div>
            )}
            {appt.notes && (
              <div style={s.metaRow}><FileText size={14} color="rgba(13,13,13,0.4)"/><span>{appt.notes}</span></div>
            )}
          </div>

          {/* Status */}
          <div style={s.drawerSection}>
            <div style={s.sectionLabel}>Status</div>
            <div style={s.statusGrid}>
              {(Object.keys(STATUS_LABEL) as ApptStatus[]).map(st => (
                <button key={st}
                  style={{...s.statusBtn, ...(appt.status===st ? {background: STATUS_COLOR[st], color:'#fff', borderColor: STATUS_COLOR[st]} : {})}}
                  onClick={() => setStatus(st)}
                  disabled={updateMutation.isPending}>
                  {STATUS_LABEL[st]}
                </button>
              ))}
            </div>
          </div>

          {/* Delete */}
          <div style={{marginTop:'auto', paddingTop:16, borderTop:'1px solid rgba(13,13,13,0.08)'}}>
            <button style={s.deleteBtn} onClick={() => { if(confirm('Delete this appointment?')) deleteMutation.mutate() }}
              disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? 'Deleting…' : 'Delete Appointment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────

const BORDER = '1px solid rgba(13,13,13,0.08)'

const s: Record<string, React.CSSProperties> = {
  page:           { minHeight: '100vh', background: '#f7f7f5', fontFamily: "'Inter', -apple-system, sans-serif" },

  // Header
  header:         { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 },
  headerLeft:     { display:'flex', alignItems:'center', gap:12 },
  headerRight:    { display:'flex', alignItems:'center', gap:12 },
  title:          { fontSize:22, fontWeight:700, color:'#0d0d0d', letterSpacing:'-0.02em', margin:0 },
  todayBtn:       { padding:'5px 12px', borderRadius:7, border:BORDER, background:'#fff', fontSize:13, fontWeight:500, cursor:'pointer', color:'#0d0d0d' },
  navBtns:        { display:'flex', gap:2 },
  navBtn:         { width:28, height:28, borderRadius:7, border:BORDER, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'#0d0d0d' },
  dateLabel:      { fontSize:15, fontWeight:600, color:'#0d0d0d', letterSpacing:'-0.01em' },
  viewTabs:       { display:'flex', background:'#fff', border:BORDER, borderRadius:8, overflow:'hidden' },
  viewTab:        { padding:'5px 14px', fontSize:13, fontWeight:500, border:'none', background:'none', cursor:'pointer', color:'rgba(13,13,13,0.5)' },
  viewTabActive:  { background:'#212121', color:'#fff' },
  newBtn:         { display:'flex', alignItems:'center', gap:6, padding:'7px 16px', background:'#212121', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:500, cursor:'pointer' },

  // Time grid
  gridWrapper:    { display:'flex', background:'#fff', borderRadius:12, border:BORDER, overflow:'hidden' },
  timeCol:        { width:52, flexShrink:0, borderRight:BORDER },
  timeCell:       { height:HOUR_PX, display:'flex', alignItems:'flex-start', justifyContent:'flex-end', paddingRight:8, paddingTop:4, fontSize:11, color:'rgba(13,13,13,0.35)', fontWeight:500, boxSizing:'border-box' as const },
  dayCol:         { position:'relative' as const, minHeight: HOUR_PX * HOURS.length },
  hourSlot:       { height:HOUR_PX, borderBottom:'1px solid rgba(13,13,13,0.05)', cursor:'cell', boxSizing:'border-box' as const, transition:'background 0.1s' },

  // Appointment block
  apptBlock:      { position:'absolute' as const, borderRadius:6, padding:'3px 6px', overflow:'hidden', cursor:'pointer', zIndex:2, transition:'filter 0.1s' },
  apptTime:       { fontSize:10, fontWeight:600, opacity:0.85 },
  apptName:       { fontSize:12, fontWeight:600, whiteSpace:'nowrap' as const, overflow:'hidden', textOverflow:'ellipsis' },
  apptService:    { fontSize:10, opacity:0.75, whiteSpace:'nowrap' as const, overflow:'hidden', textOverflow:'ellipsis' },

  // Current time line
  nowLine:        { position:'absolute' as const, left:0, right:0, height:2, background:'#DF5198', zIndex:3, display:'flex', alignItems:'center' },
  nowDot:         { width:8, height:8, borderRadius:'50%', background:'#DF5198', marginLeft:-4, flexShrink:0 },

  // Week view header
  weekHeader:     { display:'flex', background:'#fff', borderRadius:'12px 12px 0 0', borderBottom:BORDER, borderLeft:BORDER, borderRight:BORDER, borderTop:BORDER },
  weekDayHeader:  { flex:1, display:'flex', flexDirection:'column' as const, alignItems:'center', padding:'10px 0', gap:4, borderLeft:'1px solid rgba(13,13,13,0.06)' },
  weekDayHeaderToday: { background:'rgba(223,81,152,0.04)' },
  weekDayName:    { fontSize:11, fontWeight:600, color:'rgba(13,13,13,0.4)', textTransform:'uppercase' as const, letterSpacing:'0.06em' },
  weekDayNum:     { fontSize:16, fontWeight:600, color:'#0d0d0d', width:30, height:30, display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'50%' },
  weekDayNumToday:{ background:'#DF5198', color:'#fff' },

  // Month view
  monthWrapper:   { background:'#fff', borderRadius:12, border:BORDER, overflow:'hidden' },
  monthDayNames:  { display:'grid', gridTemplateColumns:'repeat(7,1fr)', borderBottom:BORDER },
  monthDayName:   { padding:'10px 0', textAlign:'center' as const, fontSize:11, fontWeight:600, color:'rgba(13,13,13,0.4)', textTransform:'uppercase' as const, letterSpacing:'0.06em' },
  monthGrid:      { display:'grid', gridTemplateColumns:'repeat(7,1fr)' },
  monthCell:      { minHeight:110, padding:'6px 8px', borderRight:BORDER, borderBottom:BORDER, cursor:'pointer', transition:'background 0.1s' },
  monthCellToday: { background:'rgba(223,81,152,0.04)' },
  monthCellOtherMonth: { opacity:0.45 },
  monthCellNum:   { fontSize:13, fontWeight:600, color:'#0d0d0d', marginBottom:4, display:'inline-block', width:22, height:22, lineHeight:'22px', textAlign:'center' as const, borderRadius:'50%' },
  monthCellNumToday: { background:'#DF5198', color:'#fff' },
  monthAppts:     { display:'flex', flexDirection:'column' as const, gap:2 },
  monthApptChip:  { borderRadius:4, padding:'2px 5px', fontSize:10, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap' as const, overflow:'hidden', textOverflow:'ellipsis' },
  monthMore:      { fontSize:10, color:'rgba(13,13,13,0.4)', paddingLeft:4 },

  // Overlay
  overlay:        { position:'fixed' as const, inset:0, background:'rgba(0,0,0,0.35)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' },

  // New appointment modal
  modal:          { background:'#fff', borderRadius:14, width:480, maxHeight:'90vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.18)' },
  modalHeader:    { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 20px 14px', borderBottom:BORDER },
  modalTitle:     { fontSize:16, fontWeight:700, color:'#0d0d0d', letterSpacing:'-0.01em' },
  modalBody:      { padding:'16px 20px', display:'flex', flexDirection:'column' as const, gap:14 },
  modalFooter:    { display:'flex', gap:8, justifyContent:'flex-end', padding:'14px 20px', borderTop:BORDER },
  closeBtn:       { background:'none', border:'none', cursor:'pointer', padding:4, borderRadius:6, display:'flex', alignItems:'center', color:'rgba(13,13,13,0.4)' },
  field:          { display:'flex', flexDirection:'column' as const, gap:5 },
  row:            { display:'flex', gap:12 },
  label:          { fontSize:12, fontWeight:600, color:'rgba(13,13,13,0.55)', letterSpacing:'0.03em' },
  input:          { padding:'8px 10px', borderRadius:8, border:BORDER, fontSize:13, color:'#0d0d0d', background:'#fff', outline:'none', width:'100%', boxSizing:'border-box' as const, fontFamily:'inherit' },
  hint:           { fontSize:11, color:'rgba(13,13,13,0.4)', margin:'2px 0 0' },
  dropdown:       { position:'absolute' as const, top:'100%', left:0, right:0, background:'#fff', border:BORDER, borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,0.1)', zIndex:10, marginTop:2 },
  dropdownItem:   { padding:'8px 12px', cursor:'pointer', fontSize:13, borderBottom:'1px solid rgba(13,13,13,0.05)' },
  cancelBtn:      { padding:'8px 18px', borderRadius:8, border:BORDER, background:'#fff', fontSize:13, fontWeight:500, cursor:'pointer', color:'#0d0d0d' },
  saveBtn:        { padding:'8px 18px', borderRadius:8, border:'none', background:'#212121', color:'#fff', fontSize:13, fontWeight:500, cursor:'pointer' },

  // Appointment drawer
  drawer:         { background:'#fff', borderRadius:14, width:400, maxHeight:'90vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.18)', display:'flex', flexDirection:'column' as const },
  deptBar:        { height:5, flexShrink:0 },
  drawerContent:  { padding:20, display:'flex', flexDirection:'column' as const, gap:16, flex:1 },
  drawerHeader:   { display:'flex', justifyContent:'space-between', alignItems:'flex-start' },
  drawerDept:     { fontSize:11, fontWeight:700, color:'rgba(13,13,13,0.4)', textTransform:'uppercase' as const, letterSpacing:'0.08em', marginBottom:4 },
  drawerName:     { fontSize:20, fontWeight:700, color:'#0d0d0d', letterSpacing:'-0.02em' },
  drawerMeta:     { display:'flex', flexDirection:'column' as const, gap:8 },
  metaRow:        { display:'flex', alignItems:'flex-start', gap:8, fontSize:13, color:'rgba(13,13,13,0.7)', lineHeight:1.4 },
  drawerSection:  { display:'flex', flexDirection:'column' as const, gap:8 },
  sectionLabel:   { fontSize:11, fontWeight:700, color:'rgba(13,13,13,0.4)', textTransform:'uppercase' as const, letterSpacing:'0.08em' },
  statusGrid:     { display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 },
  statusBtn:      { padding:'6px 10px', borderRadius:7, border:BORDER, background:'#fff', fontSize:12, fontWeight:500, cursor:'pointer', color:'#0d0d0d', textAlign:'center' as const },
  deleteBtn:      { width:'100%', padding:'9px', borderRadius:8, border:'1px solid rgba(229,57,53,0.3)', background:'rgba(229,57,53,0.05)', color:'#e53935', fontSize:13, fontWeight:500, cursor:'pointer' },
}
