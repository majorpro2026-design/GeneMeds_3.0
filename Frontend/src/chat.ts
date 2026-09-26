type ChatRole = 'user' | 'assistant'
type ChatMessage = { role: ChatRole; content: string }

const CHAT_ENDPOINT = import.meta.env.VITE_CHAT_API_URL ?? '/api/chat'

let open = false
let sending = false
let error = ''
let messages: ChatMessage[] = []
let draft = ''

let root: HTMLDivElement | null = null

const PROMPTS = [
  'CYP2D6 *4/*4 risk',
  'CPIC Level A guidelines',
  'Clopidogrel diplotype dosing',
]

/**
 * Mounts the assistant widget once, as a sibling of #app rather than inside
 * it, so it survives main.ts's full-innerHTML re-renders on every step
 * change and keeps its own conversation state throughout the workflow.
 */
export function mountChatWidget() {
  if (root) return
  root = document.createElement('div')
  root.id = 'chat-widget-root'
  document.body.appendChild(root)
  renderChat()
}

function renderChat() {
  if (!root) return
  root.innerHTML = `
    <div class="chat-widget ${open ? 'chat-widget--open' : ''}">
      ${open ? panel() : ''}
      <button class="chat-toggle" data-chat-action="toggle" aria-label="${open ? 'Close assistant' : 'Open assistant'}">
        ${open ? closeIcon() : chatIcon()}
      </button>
    </div>
  `
  bind()
  scrollToBottom()
  if (open) root.querySelector<HTMLInputElement>('#chat-input')?.focus()
}

function panel() {
  return `
    <div class="chat-panel" role="dialog" aria-label="GeneMeds copilot">
      <div class="chat-panel-head">
        <div class="chat-panel-title">
          <span class="chat-status-dot"></span>
          <div>
            <strong>GeneMeds Copilot</strong>
            <span>Clinical Pharmacogenomic AI</span>
          </div>
        </div>
        <button class="chat-close" data-chat-action="close" aria-label="Close">&times;</button>
      </div>
      <div class="chat-body" id="chat-body">
        ${messages.length ? messages.map(bubble).join('') : emptyChat()}
        ${sending ? typingBubble() : ''}
      </div>
      ${messages.length === 0 ? `
        <div class="chat-prompts">
          ${PROMPTS.map(p => `<button class="chat-prompt-pill" data-prompt="${escapeAttr(p)}">${escapeHtml(p)}</button>`).join('')}
        </div>
      ` : ''}
      ${error ? `<div class="chat-error" style="padding:8px 16px;font-size:11.5px;color:#fca5a5;background:rgba(239,68,68,0.15);border-top:1px solid rgba(239,68,68,0.3)">${escapeHtml(error)}</div>` : ''}
      <form class="chat-input-row" data-chat-form>
        <input class="chat-input" id="chat-input" autocomplete="off" placeholder="Ask about drugs, genes, or CPIC guidance..." value="${escapeAttr(draft)}" ${sending ? 'disabled' : ''}>
        <button type="submit" class="chat-send" ${sending || !draft.trim() ? 'disabled' : ''} aria-label="Send">${sendIcon()}</button>
      </form>
    </div>
  `
}

function emptyChat() {
  return `
    <div class="chat-welcome">
      ${chatIcon()}
      <h4>GeneMeds Copilot</h4>
      <p>Ask about prescribed medicines, gene-drug interactions, diplotypes, or CPIC guideline recommendations.</p>
    </div>
  `
}

function bubble(m: ChatMessage) {
  const isBot = m.role === 'assistant'
  return `
    <div class="chat-msg ${isBot ? 'chat-msg-bot' : 'chat-msg-user'}">
      ${escapeHtml(m.content)}
    </div>
  `
}

function typingBubble() {
  return `
    <div class="chat-msg chat-msg-bot" style="display:flex;gap:4px;align-items:center">
      <span class="spinner" style="width:12px;height:12px"></span>
      <span style="font-size:11.5px;color:var(--text-muted)">Copilot is analyzing...</span>
    </div>
  `
}

function bind() {
  if (!root) return
  root.querySelector('[data-chat-action="toggle"]')?.addEventListener('click', () => { open = !open; renderChat() })
  root.querySelector('[data-chat-action="close"]')?.addEventListener('click', () => { open = false; renderChat() })

  root.querySelectorAll<HTMLButtonElement>('.chat-prompt-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.prompt
      if (p) { draft = p; void sendMessage() }
    })
  })

  const input = root.querySelector<HTMLInputElement>('#chat-input')
  input?.addEventListener('input', () => {
    draft = input.value
    const btn = root?.querySelector<HTMLButtonElement>('.chat-send')
    if (btn) btn.disabled = sending || !draft.trim()
  })

  const form = root.querySelector<HTMLFormElement>('[data-chat-form]')
  form?.addEventListener('submit', event => { event.preventDefault(); void sendMessage() })
}

async function sendMessage() {
  const text = draft.trim()
  if (!text || sending) return
  messages = [...messages, { role: 'user', content: text }]
  draft = ''
  sending = true
  error = ''
  renderChat()

  try {
    const response = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ messages }),
    })
    if (!response.ok) {
      const err = (await response.json().catch(() => ({}))) as { detail?: string }
      throw new Error(err.detail ?? `Assistant request failed with status ${response.status}`)
    }
    const body = (await response.json()) as { reply?: string }
    if (body.reply) messages = [...messages, { role: 'assistant', content: body.reply }]
  } catch (err) {
    error = err instanceof Error ? err.message : 'Could not reach the assistant.'
  } finally {
    sending = false
    renderChat()
  }
}

function scrollToBottom() {
  const body = root?.querySelector<HTMLElement>('#chat-body')
  if (body) body.scrollTop = body.scrollHeight
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
function escapeAttr(value: string) { return escapeHtml(value) }

function chatIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/></svg>`
}
function closeIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>`
}
function sendIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>`
}