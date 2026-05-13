import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { MessageCircle, X, Paperclip, Send } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function EllaChat() {
  const [open, setOpen]           = useState(false)
  const [messages, setMessages]   = useState<Message[]>([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [attached, setAttached]   = useState<{ name: string; content: string } | null>(null)
  const { profile } = useAuth()
  const fileRef  = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function send() {
    if (!input.trim() && !attached) return
    if (!profile) return

    let text = input.trim()
    if (attached) {
      text = text
        ? `${text}\n\n[File: ${attached.name}]\n${attached.content}`
        : `[File: ${attached.name}]\n${attached.content}`
    }

    const display = input.trim() || `Attached: ${attached?.name}`
    setMessages(prev => [...prev, { role: 'user', content: display }])
    setInput('')
    setAttached(null)
    setLoading(true)

    try {
      const res = await api.post('/ella/chat', { user_id: profile.id, message: text })
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const content = await file.text()
    setAttached({ name: file.name, content })
    e.target.value = ''
  }

  return (
    <>
      {/* Floating circle trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={s.trigger}
        title={open ? 'Close Ella' : 'Chat with Ella'}
      >
        {open
          ? <X size={18} color="#fff" strokeWidth={2.5} />
          : <MessageCircle size={18} color="#fff" strokeWidth={2} />
        }
      </button>

      {/* Slide-in panel */}
      <div style={{ ...s.panel, ...(open ? s.panelOpen : {}) }}>

        {/* Header */}
        <div style={s.header}>
          <div style={s.avatar}>E</div>
          <div style={s.headerText}>
            <p style={s.name}>Ella</p>
            <p style={s.role}>Salon AI assistant</p>
          </div>
          <button onClick={() => setOpen(false)} style={s.closeBtn} title="Close">
            <X size={15} color="rgba(13,13,13,0.4)" />
          </button>
        </div>

        {/* Message list */}
        <div style={s.messages}>
          {messages.length === 0 && !loading && (
            <div style={s.empty}>
              <div style={s.emptyAvatar}>E</div>
              <p style={s.emptyTitle}>Hi, I'm Ella</p>
              <p style={s.emptySub}>Ask me anything about the salon — revenue, payroll, expenses, trends.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ ...s.bubble, ...(m.role === 'user' ? s.userBubble : s.ellaBubble) }}>
              {m.content}
            </div>
          ))}
          {loading && (
            <div style={{ ...s.bubble, ...s.ellaBubble, ...s.thinking }}>
              Thinking…
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Attached file badge */}
        {attached && (
          <div style={s.fileBadge}>
            <Paperclip size={12} color="#212121" />
            <span style={s.fileName}>{attached.name}</span>
            <button onClick={() => setAttached(null)} style={s.fileX}>×</button>
          </div>
        )}

        {/* Input row */}
        <div style={s.inputRow}>
          <input
            type="file"
            ref={fileRef}
            onChange={handleFile}
            style={{ display: 'none' }}
            accept=".txt,.csv,.md,.json,.pdf"
          />
          <button
            onClick={() => fileRef.current?.click()}
            style={s.attachBtn}
            title="Attach file"
          >
            <Paperclip size={15} color="rgba(13,13,13,0.35)" />
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask Ella anything…"
            style={s.textInput}
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={loading || (!input.trim() && !attached)}
            style={{ ...s.sendBtn, ...(loading || (!input.trim() && !attached) ? s.sendBtnDisabled : {}) }}
          >
            <Send size={14} color="#fff" />
          </button>
        </div>
      </div>
    </>
  )
}

const s: Record<string, React.CSSProperties> = {
  trigger: {
    position: 'fixed',
    top: 14,
    right: 20,
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: '#212121',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 10px rgba(33,33,33,0.12)',
    zIndex: 1001,
    transition: 'transform 0.15s, box-shadow 0.15s',
  },

  panel: {
    position: 'fixed',
    top: 0,
    right: 0,
    width: '33vw',
    minWidth: 360,
    maxWidth: 480,
    height: '100vh',
    background: '#fff',
    borderLeft: '1px solid rgba(13,13,13,0.09)',
    boxShadow: '-4px 0 40px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1000,
    transform: 'translateX(100%)',
    transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  panelOpen: {
    transform: 'translateX(0)',
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 16px',
    borderBottom: '1px solid rgba(13,13,13,0.09)',
    background: '#fafaf9',
    flexShrink: 0,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: '#212121',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    fontWeight: 700,
    color: '#fff',
    flexShrink: 0,
  },
  headerText: { flex: 1 },
  name: { fontSize: 14, fontWeight: 600, color: '#0d0d0d', letterSpacing: '-0.01em' },
  role: { fontSize: 11, color: 'rgba(13,13,13,0.4)', marginTop: 1 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 },

  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '40px 24px',
    gap: 10,
  },
  emptyAvatar: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: 'rgba(214,210,203,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 700,
    color: '#212121',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: '#0d0d0d', letterSpacing: '-0.02em' },
  emptySub: { fontSize: 13, color: 'rgba(13,13,13,0.5)', lineHeight: 1.5 },

  bubble: {
    padding: '9px 13px',
    borderRadius: 12,
    fontSize: 14,
    lineHeight: 1.55,
    maxWidth: '88%',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  userBubble: {
    background: '#0d0d0d',
    color: '#fff',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 3,
  },
  ellaBubble: {
    background: '#f7f7f5',
    color: '#0d0d0d',
    alignSelf: 'flex-start',
    border: '1px solid rgba(13,13,13,0.08)',
    borderBottomLeftRadius: 3,
  },
  thinking: {
    color: 'rgba(13,13,13,0.35)',
    fontStyle: 'italic',
  },

  fileBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 16px',
    background: 'rgba(214,210,203,0.3)',
    borderTop: '1px solid rgba(13,13,13,0.07)',
    flexShrink: 0,
  },
  fileName: { fontSize: 12, color: '#212121', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  fileX: { background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(13,13,13,0.35)', fontSize: 18, lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center' },

  inputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 12px',
    borderTop: '1px solid rgba(13,13,13,0.09)',
    background: '#fff',
    flexShrink: 0,
  },
  attachBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 6, borderRadius: 7, flexShrink: 0 },
  textInput: {
    flex: 1,
    border: '1px solid rgba(13,13,13,0.12)',
    borderRadius: 9,
    padding: '8px 12px',
    fontSize: 14,
    color: '#0d0d0d',
    background: '#fafaf9',
    outline: 'none',
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: '#212121',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'opacity 0.12s',
  },
  sendBtnDisabled: {
    opacity: 0.4,
    cursor: 'default',
  },
}
