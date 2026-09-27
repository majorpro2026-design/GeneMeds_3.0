type ChatRole = 'user' | 'assistant'
type ChatMessage = { role: ChatRole; content: string; time?: string }

export type ClinicalContextState = {
  patient: { name: string; dob: string; sex: string } | null
  items: { name: string; dosage: string; frequency: string; duration: string; generics: string[] }[]
  diplotypes: Record<string, string>
  suggestedTests: { geneSymbol: string; drugName: string }[]
  recommendations: { drugName: string; recommendation?: string; safetyStatus?: { geneSymbol: string; phenotypeName: string; status: string; alternativeDrugGeneric: string | null }[] }[]
}

const CHAT_ENDPOINT = import.meta.env.VITE_CHAT_API_URL ?? '/api/chat'

let sending = false
let error = ''
let messages: ChatMessage[] = []
let draft = ''

const PROMPTS = [
  { text: 'Explain PGx findings for this prescription', icon: '🧬' },
  { text: 'Why is CYP2C19 / CYP2D6 relevant here?', icon: '💊' },
  { text: 'What alternate drugs are recommended?', icon: '📋' },
  { text: 'Summarize clinical guidance for this patient', icon: '⚕️' },
]

export function renderCopilotPanelHTML(context: ClinicalContextState, collapsed: boolean): string {
  if (collapsed) {
    return `
      <div class="copilot-panel copilot-panel--collapsed">
        <button class="copilot-expand-btn" data-copilot-action="toggle-collapse" title="Expand GeneMeds Copilot">
          <span class="copilot-status-dot"></span>
          <span class="copilot-expand-title">GeneMeds Copilot</span>
          <span class="copilot-expand-icon">◀</span>
        </button>
      </div>
    `
  }

  const patientName = context.patient ? context.patient.name : 'No patient'
  const medsCount = context.items.length
  const filledDips = Object.values(context.diplotypes).filter(v => (v ?? '').trim()).length
  const recsCount = context.recommendations.filter(r => r.recommendation).length

  return `
    <div class="copilot-panel" role="region" aria-label="GeneMeds Copilot workspace panel">
      <!-- Header -->
      <div class="copilot-head">
        <div class="copilot-title">
          <span class="copilot-status-dot"></span>
          <div>
            <strong>GeneMeds Copilot</strong>
            <span>Clinical Decision Support AI</span>
          </div>
        </div>
        <button class="copilot-action-btn" data-copilot-action="toggle-collapse" title="Collapse Copilot panel">
          <span class="copilot-icon-collapse">▶</span>
          <span class="copilot-btn-label">Collapse</span>
        </button>
      </div>

      <!-- Clinical Context Indicator Bar -->
      <div class="copilot-context-bar">
        <div class="copilot-context-chip ${context.patient ? 'active' : ''}" title="Active Patient">
          <span class="copilot-context-dot"></span>
          <span>${escapeHtml(patientName)}</span>
        </div>
        <div class="copilot-context-chip ${medsCount > 0 ? 'active' : ''}" title="Prescribed Medicines">
          <span>💊 ${medsCount} ${medsCount === 1 ? 'drug' : 'drugs'}</span>
        </div>
        <div class="copilot-context-chip ${filledDips > 0 || recsCount > 0 ? 'active' : ''}" title="PGx Status">
          <span>${recsCount > 0 ? `✅ ${recsCount} Recs` : filledDips > 0 ? `🧬 ${filledDips} Genes` : 'Step 1: Draft'}</span>
        </div>
      </div>

      <!-- Conversation Area -->
      <div class="copilot-body" id="copilot-chat-body">
        ${messages.length ? messages.map(renderMessageBubble).join('') : renderWelcomeState()}
        ${sending ? renderTypingBubble() : ''}
      </div>

      <!-- Quick Action Prompts (When Empty) -->
      ${messages.length === 0 ? `
        <div class="copilot-prompts">
          <div class="copilot-prompts-heading">Suggested Clinical Queries</div>
          <div class="copilot-prompts-grid">
            ${PROMPTS.map(p => `
              <button class="copilot-prompt-chip" data-copilot-prompt="${escapeAttr(p.text)}">
                <span class="prompt-icon">${p.icon}</span>
                <span>${escapeHtml(p.text)}</span>
              </button>
            `).join('')}
          </div>
        </div>
      ` : ''}

      ${error ? `<div class="copilot-error-banner"><span>⚠️</span> ${escapeHtml(error)}</div>` : ''}

      <!-- Sticky Input Bar -->
      <form class="copilot-input-form" data-copilot-form onsubmit="return false">
        <div class="copilot-input-container">
          <textarea
            class="copilot-textarea"
            id="copilot-input"
            rows="1"
            placeholder="Ask about this patient, drug, or result..."
            ${sending ? 'disabled' : ''}
          >${escapeHtml(draft)}</textarea>
          <button type="submit" class="copilot-send-btn" ${sending || !draft.trim() ? 'disabled' : ''} aria-label="Send message">
            ${sendIcon()}
          </button>
        </div>
      </form>
    </div>
  `
}

function renderWelcomeState(): string {
  return `
    <div class="copilot-welcome">
      <div class="copilot-welcome-icon">⚕️</div>
      <h4>GeneMeds Clinical Copilot</h4>
      <p>Real-time AI decision-support contextualized to your active patient, prescribed medicines, and CPIC pharmacogenomic guidelines.</p>
    </div>
  `
}

function renderMessageBubble(m: ChatMessage): string {
  const isBot = m.role === 'assistant'
  const roleName = isBot ? 'GENEMEDS COPILOT' : 'CLINICIAN'
  const timeStr = m.time || ''

  return `
    <div class="copilot-msg ${isBot ? 'copilot-msg--bot' : 'copilot-msg--user'}">
      <div class="copilot-msg-meta">
        <span class="copilot-msg-role">${roleName}</span>
        ${timeStr ? `<span class="copilot-msg-time">${escapeHtml(timeStr)}</span>` : ''}
      </div>
      <div class="copilot-msg-bubble">
        ${isBot ? formatMarkdown(m.content) : escapeHtml(m.content)}
      </div>
    </div>
  `
}

function renderTypingBubble(): string {
  return `
    <div class="copilot-msg copilot-msg--bot">
      <div class="copilot-msg-meta">
        <span class="copilot-msg-role">GENEMEDS COPILOT</span>
      </div>
      <div class="copilot-msg-bubble copilot-typing">
        <span class="spinner" style="width:12px;height:12px;display:inline-block"></span>
        <span>Analyzing clinical context...</span>
      </div>
    </div>
  `
}

export function bindCopilotEvents(
  container: HTMLElement,
  getContext: () => ClinicalContextState,
  onToggleCollapse: () => void,
  onStateChanged?: () => void
) {
  if (!container) return

  // Collapse / Expand toggle button
  container.querySelectorAll('[data-copilot-action="toggle-collapse"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      onToggleCollapse()
    })
  })

  // Quick Prompt Chips
  container.querySelectorAll<HTMLButtonElement>('.copilot-prompt-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.copilotPrompt
      if (p) {
        draft = p
        void triggerSendMessage(getContext, onStateChanged)
      }
    })
  })

  // Textarea input
  const textarea = container.querySelector<HTMLTextAreaElement>('#copilot-input')
  if (textarea) {
    textarea.addEventListener('input', () => {
      draft = textarea.value
      const sendBtn = container.querySelector<HTMLButtonElement>('.copilot-send-btn')
      if (sendBtn) sendBtn.disabled = sending || !draft.trim()
    })

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void triggerSendMessage(getContext, onStateChanged)
      }
    })
  }

  // Form submit
  const form = container.querySelector<HTMLFormElement>('[data-copilot-form]')
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      void triggerSendMessage(getContext, onStateChanged)
    })
  }

  scrollToBottom(container)
}

async function triggerSendMessage(getContext: () => ClinicalContextState, onStateChanged?: () => void) {
  const text = draft.trim()
  if (!text || sending) return

  const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  messages = [...messages, { role: 'user', content: text, time: now }]
  draft = ''
  sending = true
  error = ''
  if (onStateChanged) onStateChanged()

  const ctx = getContext()

  try {
    const response = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        context: {
          patient: ctx.patient,
          medicines: ctx.items,
          diplotypes: ctx.diplotypes,
          suggestedTests: ctx.suggestedTests,
          recommendations: ctx.recommendations,
        },
      }),
    })

    if (!response.ok) {
      const err = (await response.json().catch(() => ({}))) as { detail?: string }
      throw new Error(err.detail ?? `Assistant request failed with status ${response.status}`)
    }

    const body = (await response.json()) as { reply?: string }
    if (body.reply) {
      const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      messages = [...messages, { role: 'assistant', content: body.reply, time: botTime }]
    }
  } catch (err) {
    error = err instanceof Error ? err.message : 'Could not reach the assistant.'
  } finally {
    sending = false
    if (onStateChanged) onStateChanged()
  }
}

function scrollToBottom(container: HTMLElement) {
  const body = container.querySelector<HTMLElement>('#copilot-chat-body')
  if (body) {
    body.scrollTop = body.scrollHeight
  }
}

function formatMarkdown(text: string): string {
  if (!text) return ''
  let html = escapeHtml(text)

  // Bold text **foo**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
  // Italic *foo*
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>')
  // Gene code chips `foo`
  html = html.replace(/`([^`]+)`/g, '<code class="gene-code-chip">$1</code>')

  const lines = html.split('\n')
  const out: string[] = []
  let inList = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (!inList) { inList = true; out.push('<ul class="copilot-list">') }
      out.push(`<li>${line.substring(2)}</li>`)
    } else {
      if (inList) { inList = false; out.push('</ul>') }
      if (line) {
        out.push(`<p>${line}</p>`)
      }
    }
  }
  if (inList) out.push('</ul>')

  return out.join('')
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeAttr(value: string): string {
  return escapeHtml(value)
}

function sendIcon(): string {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>`
}