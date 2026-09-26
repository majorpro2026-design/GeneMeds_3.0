import './style.css'
import './catalogue.css'
import './chat.css'
import { mountChatWidget } from './chat'

type Drug = {
  id: string
  name: string
  strength: string
  generics: string[]
  source: string
}

type PrescriptionDrug = Drug & {
  dosage: string
  frequency: string
  duration: string
  note: string
  selectedGeneric: string
}

type SuggestedTest = {
  title: string
  description: string
  geneSymbol: string
  drugName: string
  guidelineName: string | null
  guidelineUrl: string | null
  cpicLevel: string | null
  clinpgxLevel: string | null
  provisional: boolean
}

type DrugApiItem = {
  id?: number | string
  drugId?: number | string
  name?: string
  drugName?: string
  brandName?: string
  strength?: string
  dosageForm?: string
  presentation?: string
  generics?: string[]
  genericNames?: string[]
  genericName?: string
  activeIngredients?: string[]
  source?: string
  sourceName?: string
}

type DrugSafetyStatus = {
  geneSymbol: string
  phenotypeName: string
  activityScore: string | null
  status: 'alternate_found' | 'no_alternative_documented' | 'not_risky' | 'unknown'
  alternativeDrugGeneric: string | null
  rationale: string | null
  confidenceLevel: string | null
  guidelineTitle: string | null
  requiresClinicianReview: boolean
}

type RecommendationResult = {
  drugName: string
  found: boolean
  reason?: string
  genericName?: string
  relevantGenes?: string[]
  phenotypes?: Record<string, { phenotypeName: string; activityScore: string | null; description: string }>
  missingGeneData?: string[]
  recommendation?: {
    recommendationId?: number
    drugRecommendation: string
    implications?: unknown
    comments?: string
    guidelineTitle?: string
  } | null
  drugSafetyStatus?: DrugSafetyStatus[]
  savedRecordIds?: { resultIds: number[]; assessmentId: number | null }
}

type HCPUser = {
  id: number
  fullName: string
  registrationNumber: string
  email: string
  isActive: boolean
  lastLoginAt: string | null
}

const DRUG_ENDPOINT = import.meta.env.VITE_DRUGS_API_URL ?? '/api/drugs'
const PRESCRIPTION_ENDPOINT = import.meta.env.VITE_PRESCRIPTION_API_URL ?? '/api/prescriptions'
const UPLOAD_EXTRACT_ENDPOINT = '/api/prescriptions/upload-extract'
const GENE_RECOMMENDATION_ENDPOINT = '/api/gene-recommendation'
const FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'Every 6 hours', 'As needed']
const SUGGESTION_LIMIT = 6
const CATALOG_LIMIT = 18

// ── App state ──────────────────────────────────────────────────────────────────
let authChecking = true
let currentHCP: HCPUser | null = null
let authMode: 'signin' | 'register' = 'signin'
let authLoading = false
let authError = ''

let drugs: Drug[] = []
let loadingDrugs = true
let loadError = ''
let query = ''
let searchFocused = false
let step = 1
let items: PrescriptionDrug[] = []
let submitting = false
let submitError = ''
let submitted = false
let suggestedTests: SuggestedTest[] = []

// Step 3 — gene entry
let diplotypeInputs: Record<string, string> = {}
let labReportFile: File | null = null
let labExtractLoading = false
let labExtractError = ''
let ocrExtractedLines: string[] = []

// Step 3 — recommendation
let recommendationLoading = false
let recommendationError = ''
let recommendationResults: RecommendationResult[] = []

// Step 3 — save per drug
let saveState: Record<string, { loading: boolean; saved: boolean; error: string; savedIds: RecommendationResult['savedRecordIds'] | null }> = {}

const app = document.querySelector<HTMLDivElement>('#app')!

// ── Icons ──────────────────────────────────────────────────────────────────────
const icon = (name: 'plus' | 'search' | 'chevron' | 'trash' | 'check' | 'arrow' | 'refresh' | 'warning' | 'upload' | 'dna' | 'flask' | 'info') => {
  const paths: Record<string, string> = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>',
    chevron: '<path d="m7 10 5 5 5-5"/>',
    trash: '<path d="M4 7h16M10 11v6m4-6v6M9 7l1-2h4l1 2m-9 0 1 13h10l1-13"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"/>',
    warning: '<path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
    dna: '<path d="M2 15c6.667-6 13.333 0 20-6M2 9c6.667 6 13.333 0 20 6M7 11.5c0 0 2-3 5-3s5 3 5 3M7 12.5c0 0 2 3 5 3s5-3 5-3"/>',
    flask: '<path d="M6 2v6l-2 4a4 4 0 0 0 3.4 6h5.2a4 4 0 0 0 3.4-6l-2-4V2"/><path d="M6 2h8"/><path d="M9 12h6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4m0 4h.01"/>',
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`
}

const geneLogo = `<svg class="gene-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#ffffff18" stroke-width="1.5" d="M24 4 39 10v11c0 10-6.2 18.2-15 23C15.2 39.2 9 31 9 21V10L24 4Z"/><path stroke="#d9efff" d="M17 14c8 0 6 20 14 20M31 14c-8 0-6 20-14 20M18 19h12M18 29h12"/><path stroke-width="2.3" d="M24 20v8m-4-4h8"/></svg>`

// ── Utilities ─────────────────────────────────────────────────────────────────
function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
function escapeAttr(value: string) { return escapeHtml(value) }

const isComplete = (item: PrescriptionDrug) => Boolean(item.dosage && item.frequency && item.duration)
const allComplete = () => items.length > 0 && items.every(isComplete)

function uniqueGenes(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of suggestedTests) {
    if (t.geneSymbol && !seen.has(t.geneSymbol)) { seen.add(t.geneSymbol); out.push(t.geneSymbol) }
  }
  return out
}
function uniqueDrugNames(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of suggestedTests) {
    if (t.drugName && !seen.has(t.drugName)) { seen.add(t.drugName); out.push(t.drugName) }
  }
  return out
}
function genesForDrug(drugName: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of suggestedTests) {
    if (t.drugName === drugName && t.geneSymbol && !seen.has(t.geneSymbol)) { seen.add(t.geneSymbol); out.push(t.geneSymbol) }
  }
  return out
}

// ── Auth handlers & session ───────────────────────────────────────────────────
let sessionCheckDone = false

async function checkAuthSession() {
  if (sessionCheckDone) return
  authChecking = true
  render()
  try {
    const res = await fetch('/api/auth/hcp/me', { credentials: 'include' })
    if (res.ok) {
      const data = (await res.json()) as { hcp: HCPUser }
      currentHCP = data.hcp
      void loadDrugs()
    } else {
      currentHCP = null
    }
  } catch {
    currentHCP = null
  } finally {
    authChecking = false
    sessionCheckDone = true
    render()
  }
}

function updateAuthErrorBanner(msg: string) {
  authError = msg
  const container = document.querySelector('#auth-error-container')
  if (container) {
    container.innerHTML = msg ? `<div class="auth-error-banner"><span>⚠️</span> <div>${escapeHtml(msg)}</div></div>` : ''
  }
}

function updateSubmitBtn(btnId: string, isLoading: boolean, loadingText: string, normalText: string) {
  authLoading = isLoading
  const btn = document.querySelector<HTMLButtonElement>(`#${btnId}`)
  if (btn) {
    btn.disabled = isLoading
    btn.innerHTML = isLoading ? `<span class="spinner"></span> ${loadingText}` : normalText
  }
}

async function submitSignIn() {
  try {
    const emailEl = document.querySelector<HTMLInputElement>('#signin-email')
    const passwordEl = document.querySelector<HTMLInputElement>('#signin-password')
    const email = (emailEl?.value ?? '').trim()
    const password = passwordEl?.value ?? ''

    if (!email || !password) {
      updateAuthErrorBanner('Please enter both email and password.')
      return
    }

    updateAuthErrorBanner('')
    updateSubmitBtn('btn-signin-submit', true, 'Signing in...', 'Sign In')

    const res = await fetch('/api/auth/hcp/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { detail?: string }
      throw new Error(err.detail ?? 'Invalid email or password.')
    }
    const data = (await res.json()) as { hcp: HCPUser }
    currentHCP = data.hcp
    updateAuthErrorBanner('')
    render()
    void loadDrugs()
  } catch (err) {
    updateAuthErrorBanner(err instanceof Error ? err.message : 'Login failed.')
    updateSubmitBtn('btn-signin-submit', false, 'Signing in...', 'Sign In')
  }
}

async function submitRegister() {
  try {
    const fullNameEl = document.querySelector<HTMLInputElement>('#reg-fullname')
    const regNumberEl = document.querySelector<HTMLInputElement>('#reg-number')
    const emailEl = document.querySelector<HTMLInputElement>('#reg-email')
    const passwordEl = document.querySelector<HTMLInputElement>('#reg-password')
    const confirmPasswordEl = document.querySelector<HTMLInputElement>('#reg-confirm-password')

    const fullName = (fullNameEl?.value ?? '').trim()
    const registrationNumber = (regNumberEl?.value ?? '').trim()
    const email = (emailEl?.value ?? '').trim()
    const password = passwordEl?.value ?? ''
    const confirmPassword = confirmPasswordEl?.value ?? ''

    if (!fullName || !registrationNumber || !email || !password || !confirmPassword) {
      updateAuthErrorBanner('Please fill in all registration fields.')
      return
    }

    if (password.length < 8) {
      updateAuthErrorBanner('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      updateAuthErrorBanner('Passwords do not match.')
      return
    }

    updateAuthErrorBanner('')
    updateSubmitBtn('btn-register-submit', true, 'Creating account...', 'Create Account')

    const res = await fetch('/api/auth/hcp/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        fullName,
        registrationNumber,
        email,
        password,
        confirmPassword,
      }),
    })
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { detail?: string }
      throw new Error(err.detail ?? 'Registration failed.')
    }
    const data = (await res.json()) as { hcp: HCPUser }
    currentHCP = data.hcp
    updateAuthErrorBanner('')
    render()
    void loadDrugs()
  } catch (err) {
    updateAuthErrorBanner(err instanceof Error ? err.message : 'Registration failed.')
    updateSubmitBtn('btn-register-submit', false, 'Creating account...', 'Create Account')
  }
}

async function logoutHCP() {
  try {
    await fetch('/api/auth/hcp/logout', { method: 'POST', credentials: 'include' })
  } catch {
    // Ignore error
  } finally {
    currentHCP = null
    authError = ''
    sessionCheckDone = false
    render()
  }
}

function renderSignInForm() {
  return `
    <form class="auth-form" onsubmit="return false">
      <div class="auth-form-group">
        <label for="signin-email">Email Address <b>*</b></label>
        <div class="auth-input-wrap">
          <input type="email" id="signin-email" class="auth-input" placeholder="doctor@example.com" autocomplete="email" required>
        </div>
      </div>

      <div class="auth-form-group">
        <label for="signin-password">Password <b>*</b></label>
        <div class="auth-input-wrap">
          <input type="password" id="signin-password" class="auth-input" placeholder="••••••••" autocomplete="current-password" required>
          <button type="button" class="pw-toggle-btn" data-action="toggle-pw" data-target="signin-password" title="Toggle password visibility">
            ${icon('info')}
          </button>
        </div>
      </div>

      <button type="submit" class="primary auth-submit-btn" id="btn-signin-submit" data-action="submit-signin" ${authLoading ? 'disabled' : ''}>
        ${authLoading ? '<span class="spinner"></span> Signing in...' : 'Sign In'}
      </button>
    </form>
  `
}

function renderRegisterForm() {
  return `
    <form class="auth-form" onsubmit="return false">
      <div class="auth-form-group">
        <label for="reg-fullname">Full Name <b>*</b></label>
        <div class="auth-input-wrap">
          <input type="text" id="reg-fullname" class="auth-input" placeholder="Dr. Jane Doe" autocomplete="name" required>
        </div>
      </div>

      <div class="auth-form-group">
        <label for="reg-number">Medical Registration Number <b>*</b></label>
        <div class="auth-input-wrap">
          <input type="text" id="reg-number" class="auth-input" placeholder="e.g. MCI-123456" autocomplete="off" required>
        </div>
      </div>

      <div class="auth-form-group">
        <label for="reg-email">Email Address <b>*</b></label>
        <div class="auth-input-wrap">
          <input type="email" id="reg-email" class="auth-input" placeholder="doctor@example.com" autocomplete="email" required>
        </div>
      </div>

      <div class="auth-form-group">
        <label for="reg-password">Password (min 8 characters) <b>*</b></label>
        <div class="auth-input-wrap">
          <input type="password" id="reg-password" class="auth-input" placeholder="••••••••" autocomplete="new-password" minlength="8" required>
          <button type="button" class="pw-toggle-btn" data-action="toggle-pw" data-target="reg-password" title="Toggle password visibility">
            ${icon('info')}
          </button>
        </div>
      </div>

      <div class="auth-form-group">
        <label for="reg-confirm-password">Confirm Password <b>*</b></label>
        <div class="auth-input-wrap">
          <input type="password" id="reg-confirm-password" class="auth-input" placeholder="••••••••" autocomplete="new-password" minlength="8" required>
          <button type="button" class="pw-toggle-btn" data-action="toggle-pw" data-target="reg-confirm-password" title="Toggle password visibility">
            ${icon('info')}
          </button>
        </div>
      </div>

      <button type="submit" class="primary auth-submit-btn" id="btn-register-submit" data-action="submit-register" ${authLoading ? 'disabled' : ''}>
        ${authLoading ? '<span class="spinner"></span> Creating account...' : 'Create Account'}
      </button>
    </form>
  `
}

// ── Main render ────────────────────────────────────────────────────────────────
function render() {
  if (authChecking) {
    app.innerHTML = `
      <main>
        <header>
          <a class="brand" href="#" aria-label="GeneMeds home">
            <span class="brand-mark">${geneLogo}</span>
            <span>Gene<span>Meds</span></span>
          </a>
        </header>
        <div class="auth-loading-splash">
          <span class="spinner"></span>
          <span>Verifying authorization...</span>
        </div>
      </main>
    `
    return
  }

  if (!currentHCP) {
    app.innerHTML = `
      <main>
        <header>
          <a class="brand" href="#" aria-label="GeneMeds home">
            <span class="brand-mark">${geneLogo}</span>
            <span>Gene<span>Meds</span></span>
          </a>
        </header>

        <div class="auth-wrapper">
          <div class="auth-card">
            <div class="auth-header">
              <span class="brand-mark">${geneLogo}</span>
              <h1>Healthcare Professional Portal</h1>
              <p>Sign in to your account or register to access clinical pharmacogenomic guidance.</p>
            </div>

            <div class="auth-tabs" role="tablist">
              <button class="auth-tab ${authMode === 'signin' ? 'active' : ''}" data-action="set-auth-mode" data-mode="signin" role="tab">Sign In</button>
              <button class="auth-tab ${authMode === 'register' ? 'active' : ''}" data-action="set-auth-mode" data-mode="register" role="tab">Register</button>
            </div>

            <div id="auth-error-container">
              ${authError ? `<div class="auth-error-banner"><span>⚠️</span> <div>${escapeHtml(authError)}</div></div>` : ''}
            </div>

            ${authMode === 'signin' ? renderSignInForm() : renderRegisterForm()}
          </div>
        </div>
      </main>
    `
    syncSearchSuggestions()
    syncUploadState()
    syncLabFileLabel()
    return
  }

  const initials = currentHCP.fullName
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'DR'

  app.innerHTML = `
    <main class="${step === 3 ? 'main-wide' : ''}">
      <header>
        <a class="brand" href="#" aria-label="GeneMeds home">
          <span class="brand-mark">${geneLogo}</span>
          <span>Gene<span>Meds</span></span>
        </a>
        <div class="doctor">
          <span class="avatar">${escapeHtml(initials)}</span>
          <div>
            <strong>${escapeHtml(currentHCP.fullName)}</strong>
            <small>Reg: ${escapeHtml(currentHCP.registrationNumber)}</small>
          </div>
          <button class="doctor-logout-btn" data-action="logout">Sign Out</button>
        </div>
      </header>

      ${step < 3 ? `
      <section class="page-heading">
        <div>
          <h1>${step === 1 ? 'Create a new prescription' : 'Review drug & generic information'}</h1>
          <p>${step === 1 ? 'Add medicines and treatment directions for your patient.' : 'Confirm the generic information for the prescribed medicines.'}</p>
        </div>
        <div class="step-count">Step <strong>${step}</strong> of 3</div>
      </section>
      ${stepper()}
      ` : ''}

      <div class="page-stage step-${step}">
        ${step === 1 ? createStep() : step === 2 ? reviewStep() : resultsPage()}
      </div>
    </main>
  `

  syncSearchSuggestions()
  syncUploadState()
  syncLabFileLabel()
}

function stepper() {
  const labels = ['Create prescription', 'Review drug info', 'Gene test results']
  return `<nav class="stepper" aria-label="Prescription steps">${labels
    .map((label, index) => {
      const n = index + 1
      const state = n === step ? 'active' : n < step ? 'done' : ''
      return `<div class="step ${state}"><span class="step-number">${n < step ? icon('check') : n}</span><span>${label}</span></div>${n < 3 ? '<div class="step-line"></div>' : ''}`
    })
    .join('')}</nav>`
}

// ── Step 1: Create prescription ───────────────────────────────────────────────
function createStep() {
  const catalogue = getCatalogueDrugs(query, CATALOG_LIMIT)
  const hasQuery = Boolean(query.trim())
  return `
    <section class="card prescription-card">
      <div class="card-title">
        <div>
          <h2>Medicines</h2>
          <p>Search and add all medicines prescribed to the patient.</p>
        </div>
        <div class="card-actions">
          <span class="medicine-count">${items.length} ${items.length === 1 ? 'medicine' : 'medicines'}</span>
          ${items.length ? '<button class="clear-all" data-action="clear-all">Clear all</button>' : ''}
        </div>
      </div>

      <div class="search-wrap">
        <label for="drug-search">Search medicine</label>
        <div class="search-box">
          ${icon('search')}
          <input id="drug-search" autocomplete="off" placeholder="${loadingDrugs ? 'Loading medicines...' : 'Start typing a drug name...'}" value="${escapeAttr(query)}" aria-busy="${loadingDrugs ? 'true' : 'false'}">
          ${icon('chevron')}
        </div>
        <div class="results" id="drug-results"></div>
        <div class="results empty" id="drug-empty" style="display:none"></div>
      </div>

      <section class="catalogue-panel">
        <div class="catalogue-head">
          <div>
            <h3>${loadingDrugs ? 'Loading drug catalogue' : hasQuery ? 'Matching medicines' : 'Drug catalogue'}</h3>
            <p>${loadingDrugs ? 'Fetching the medicine list from the backend.' : hasQuery ? `${catalogue.length} match${catalogue.length === 1 ? '' : 'es'} found.` : `Showing ${catalogue.length} medicines. Type to narrow the list.`}</p>
          </div>
          <span class="medicine-count">${loadingDrugs ? 'Loading' : `${drugs.length} total`}</span>
        </div>
        ${renderCatalogue(catalogue)}
      </section>

      ${items.length ? `<div class="drug-list">${items.map((item, index) => drugForm(item, index)).join('')}</div>` : emptyState()}

      ${submitError ? `<div class="submission-error">${escapeHtml(submitError)}</div>` : ''}

      <footer class="card-footer">
        <span class="completion-note">${allComplete() ? 'All treatment details are complete.' : items.length ? 'Complete dosage, frequency, and duration for each medicine.' : 'Add at least one medicine to continue.'}</span>
        <button class="primary" data-action="submit-prescription" ${allComplete() || submitting ? '' : 'disabled'}>${submitting ? '<span class="spinner"></span> Uploading...' : `Upload prescription ${icon('arrow')}`}</button>
      </footer>
    </section>
  `
}

function emptyState() {
  if (loadingDrugs) return `<div class="empty-prescription"><span>${icon('refresh')}</span><h3>Loading medicines</h3><p>Fetching the drug catalog from the backend.</p></div>`
  if (loadError) return `<div class="empty-prescription"><span>${icon('warning')}</span><h3>Could not load medicines</h3><p>${escapeHtml(loadError)}</p><button class="secondary" data-action="retry-load">Retry</button></div>`
  return `<div class="empty-prescription"><span>${icon('plus')}</span><h3>No medicines added yet</h3><p>Search by medicine, generic, or brand name to begin this prescription.</p></div>`
}

function drugForm(item: PrescriptionDrug, index: number) {
  return `
    <article class="drug-form">
      <div class="drug-row">
        <div class="pill">${index + 1}</div>
        <div>
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(item.strength)}</p>
        </div>
        <span class="detail-status ${isComplete(item) ? 'complete' : ''}">${isComplete(item) ? `${icon('check')} Complete` : 'Details needed'}</span>
        <button class="remove" data-action="remove-drug" data-id="${item.id}" aria-label="Remove ${escapeAttr(item.name)}">${icon('trash')}</button>
      </div>
      <div class="form-grid">
        <label>Dosage <b>*</b><input data-field="dosage" data-id="${item.id}" placeholder="e.g. 1 tablet" value="${escapeAttr(item.dosage)}"></label>
        <label>Frequency <b>*</b>
          <select data-field="frequency" data-id="${item.id}">
            <option value="">Select frequency</option>
            ${FREQUENCIES.map(value => `<option ${item.frequency === value ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
        </label>
        <label>Duration <b>*</b>
          <div class="duration">
            <input data-field="duration" data-id="${item.id}" type="number" min="1" placeholder="0" value="${escapeAttr(item.duration)}">
            <span>days</span>
          </div>
        </label>
        <label class="note-field">Note <em>Optional</em><input data-field="note" data-id="${item.id}" placeholder="e.g. Take after food" value="${escapeAttr(item.note)}"></label>
      </div>
      ${isComplete(item) ? '' : '<p class="field-help">Dosage, frequency, and duration are required before you can upload.</p>'}
    </article>
  `
}

// ── Step 2: Review generics ───────────────────────────────────────────────────
function reviewStep() {
  return `
    <section class="card review-card">
      <div class="card-title">
        <div>
          <h2>Generic information</h2>
          <p>Review the source and selected generic for every prescribed medicine.</p>
        </div>
        <span class="verified">${icon('check')} Verified data</span>
      </div>
      <div class="review-table">
        <div class="table-head"><span>DRUG</span><span>GENERIC NAME(S)</span><span>SELECTED GENERIC</span><span>SOURCE</span></div>
        ${items.map(item => `
          <article class="table-row">
            <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.strength)}</small></div>
            <div class="generic-tags">${item.generics.map(g => `<span>${escapeHtml(g)}</span>`).join('')}</div>
            <div class="selected">${icon('check')} ${escapeHtml(item.selectedGeneric)}</div>
            <div class="source">${escapeHtml(item.source)}</div>
          </article>`).join('')}
      </div>
      <footer class="card-footer">
        <button class="secondary" data-action="back-to-create">Back</button>
        <button class="primary" data-action="next-step">Continue to gene results ${icon('arrow')}</button>
      </footer>
    </section>
  `
}

// ── Step 3: Full-width results page ───────────────────────────────────────────
function resultsPage() {
  const genes = uniqueGenes()
  const hasAnyDiplotype = genes.some(g => (diplotypeInputs[g] ?? '').trim())
  const hasAnyResult = recommendationResults.some(r => r.found && r.recommendation)
  const actionableCount = recommendationResults.filter(r => r.found && r.recommendation).length

  return `
    <div class="rp-layout">

      <!-- Sidebar -->
      <aside class="rp-sidebar">
        <div class="sidebar-card">
          <div class="sidebar-header">
            <h3>Prescribed Medicines</h3>
            <p>${items.length} medicine${items.length !== 1 ? 's' : ''} in this prescription</p>
          </div>
          <div class="sidebar-drug-list">
            ${items.map((item, i) => `
              <div class="sidebar-drug-item">
                <span class="sidebar-drug-num">${i + 1}</span>
                <div class="sidebar-drug-info">
                  <strong>${escapeHtml(item.name)}</strong>
                  <small>${escapeHtml(item.dosage)} · ${escapeHtml(item.frequency)}</small>
                </div>
              </div>`).join('')}
          </div>
          <div class="sidebar-footer">
            <button class="secondary" style="width:100%;justify-content:center;font-size:12px;padding:9px 14px" data-action="new-prescription">${icon('plus')} New prescription</button>
          </div>
        </div>
      </aside>

      <!-- Main content -->
      <div class="rp-main">

        <!-- Summary strip -->
        <div class="rp-summary-strip">
          <div class="rp-summary-title">
            <strong>Prescription Analysis</strong>
            <span>CPIC pharmacogenomic guidance</span>
          </div>
          <div class="rp-summary-chips">
            <span class="rp-chip rp-chip--blue">${items.length} drug${items.length !== 1 ? 's' : ''}</span>
            <span class="rp-chip rp-chip--purple">${genes.length} gene${genes.length !== 1 ? 's' : ''}</span>
            ${actionableCount > 0 ? `<span class="rp-chip rp-chip--green">${actionableCount} actionable</span>` : ''}
          </div>
        </div>

        <!-- Section 01 -->
        <div class="rp-sec">
          <div class="rp-sec-label">
            <span class="rp-sec-num">01</span>
            <div>
              <h2 class="rp-sec-title">Recommended Gene Tests</h2>
              <p class="rp-sec-sub">Based on prescribed medicines, these pharmacogenomic tests are recommended before dispensing.</p>
            </div>
          </div>
          ${renderGeneTestTable()}
        </div>

        <!-- Section 02 -->
        ${genes.length ? `
        <div class="rp-sec">
          <div class="rp-sec-label">
            <span class="rp-sec-num">02</span>
            <div>
              <h2 class="rp-sec-title">Enter Gene Test Results</h2>
              <p class="rp-sec-sub">Enter the patient's diplotype for each gene manually or upload a lab report to auto-extract.</p>
            </div>
          </div>
          <div class="entry-grid">
            <!-- Manual entry card -->
            <div class="entry-card">
              <div class="entry-card-head">
                <span class="entry-card-icon">${icon('dna')}</span>
                <div>
                  <h3>Manual Entry</h3>
                  <p>Type the diplotype string for each gene (e.g. <code>*4/*4</code>).</p>
                </div>
              </div>
              <div class="diplotype-list">
                ${genes.map(gene => {
                  const val = escapeAttr(diplotypeInputs[gene] ?? '')
                  const filled = (diplotypeInputs[gene] ?? '').trim()
                  return `
                    <div class="diplotype-row">
                      <span class="gene-chip">${escapeHtml(gene)}</span>
                      <input
                        class="diplotype-input ${filled ? 'diplotype-input--filled' : ''}"
                        data-action="diplotype-input"
                        data-gene="${escapeAttr(gene)}"
                        placeholder="e.g. *1/*4"
                        value="${val}"
                        autocomplete="off"
                        spellcheck="false"
                      >
                      ${filled ? `<span class="diplotype-check">${icon('check')}</span>` : ''}
                    </div>`
                }).join('')}
              </div>
            </div>
            <!-- Lab upload card -->
            <div class="entry-card">
              <div class="entry-card-head">
                <span class="entry-card-icon">${icon('upload')}</span>
                <div>
                  <h3>Upload Lab Report</h3>
                  <p>Upload an image of the lab report to auto-extract diplotype values.</p>
                </div>
              </div>
              <div class="lab-upload-area">
                <label class="lab-dropzone" for="lab-report-file">
                  <span class="lab-dropzone-icon">${icon('upload')}</span>
                  <span class="lab-dropzone-name" id="lab-file-name">${labReportFile ? escapeHtml(labReportFile.name) : 'Click to choose an image'}</span>
                  <span class="lab-dropzone-hint">JPEG · PNG · TIFF · WebP · max 5 MB</span>
                </label>
                <input id="lab-report-file" type="file" accept="image/jpeg,image/png,image/tiff,image/webp" style="display:none">
                <button class="primary lab-extract-btn" data-action="extract-lab-report" ${labExtractLoading || !labReportFile ? 'disabled' : ''}>
                  ${labExtractLoading ? '<span class="spinner"></span> Extracting…' : `${icon('flask')} Extract diplotypes`}
                </button>
                ${labExtractError ? `<div class="entry-error">${icon('warning')} ${escapeHtml(labExtractError)}</div>` : ''}
                ${ocrExtractedLines.length ? `
                  <details class="ocr-preview">
                    <summary>View extracted text (${ocrExtractedLines.length} lines)</summary>
                    <pre>${ocrExtractedLines.map(l => escapeHtml(l)).join('\n')}</pre>
                  </details>` : ''}
              </div>
            </div>
          </div>
          <div class="get-rec-bar">
            <div class="get-rec-bar-info">
              ${hasAnyDiplotype
                ? `<span class="get-rec-ready">${icon('check')} Ready — unfilled genes will be listed as missing in the result</span>`
                : `<span class="get-rec-hint">${icon('info')} Enter at least one diplotype to get a recommendation</span>`}
            </div>
            <button class="primary get-rec-btn" data-action="get-recommendation" ${recommendationLoading || !hasAnyDiplotype ? 'disabled' : ''}>
              ${recommendationLoading ? '<span class="spinner"></span> Generating…' : `${icon('dna')} Get Recommendation`}
            </button>
          </div>
          ${recommendationError ? `<div class="entry-error" style="margin-top:12px">${icon('warning')} ${escapeHtml(recommendationError)}</div>` : ''}
        </div>
        ` : ''}

        <!-- Section 03 -->
        ${recommendationResults.length ? `
        <div class="rp-sec">
          <div class="rp-sec-label">
            <span class="rp-sec-num">03</span>
            <div>
              <h2 class="rp-sec-title">Clinical Recommendations</h2>
              <p class="rp-sec-sub">CPIC-based pharmacogenomic guidance for each prescribed medicine.</p>
            </div>
          </div>
          ${hasAnyResult ? `<div class="rc-section-summary">${icon('check')} ${actionableCount} of ${recommendationResults.length} drug${recommendationResults.length !== 1 ? 's have' : ' has'} actionable recommendations</div>` : ''}
          ${renderRecommendationBlocks()}
          ${hasAnyResult ? `<p class="rc-disclaimer">${icon('info')} These recommendations are derived from CPIC guidelines. Apply clinical judgement before acting on any suggestion.</p>` : ''}
        </div>
        ` : ''}

      </div>
    </div>
  `
}

function renderGeneTestTable(): string {
  if (!suggestedTests.length) {
    return '<div class="rp-empty">No gene-test recommendations were returned for this prescription.</div>'
  }
  const rows = suggestedTests.map(test => {
    const cpic = test.cpicLevel ? `<span class="cpic-badge cpic-${escapeAttr(test.cpicLevel.toLowerCase())}">${escapeHtml(test.cpicLevel)}</span>` : '<span class="cpic-na">—</span>'
    const guideline = test.guidelineUrl && test.guidelineName
      ? `<a class="guideline-link" href="${escapeAttr(test.guidelineUrl)}" target="_blank" rel="noreferrer">${escapeHtml(test.guidelineName)}</a>`
      : '<span class="cpic-na">—</span>'
    return `
      <div class="gt3-row">
        <div class="gt3-drug"><strong>${escapeHtml(test.drugName || '—')}</strong></div>
        <div class="gt3-gene"><span class="gene-chip">${escapeHtml(test.geneSymbol)}</span></div>
        <div class="gt3-cpic">${cpic}</div>
        <div class="gt3-guide">${guideline}</div>
      </div>`
  }).join('')

  return `
    <div class="gt3-table">
      <div class="gt3-head">
        <span>DRUG</span><span>GENE</span><span>CPIC LEVEL</span><span>GUIDELINE</span>
      </div>
      ${rows}
    </div>`
}

function renderRecommendationBlocks(): string {
  return recommendationResults.map(res => {
    if (!res.found) {
      return `
        <div class="rc-card rc-card--gray">
          <div class="rc-header">
            <div class="rc-drug-icon rc-drug-icon--gray">${icon('warning')}</div>
            <div>
              <div class="rc-drug-name">${escapeHtml(res.drugName)}</div>
              <div class="rc-drug-generic">No CPIC data available</div>
            </div>
            <span class="rc-status-badge rc-badge--gray">No CPIC data</span>
          </div>
          <div class="rc-footer">
            <span class="rc-guideline">${escapeHtml(res.reason ?? 'No pharmacogenomic guideline found.')}</span>
          </div>
        </div>`
    }

    const missing = res.missingGeneData ?? []
    const rec = res.recommendation
    const phenotypes = res.phenotypes ?? {}
    const ss = saveState[res.drugName]

    // Determine color
    const cpic = (rec ? (suggestedTests.find(t => t.drugName === res.genericName || t.drugName === res.drugName)?.cpicLevel ?? null) : null)
    let color = 'blue'
    if (!rec) color = 'amber'
    else if (cpic === 'A' || cpic === 'B') color = 'green'
    else if (cpic === 'C') color = 'amber'
    else color = 'blue'
    if (!res.found) color = 'gray'

    const statusText = rec
      ? (color === 'green' ? 'Actionable' : color === 'amber' ? 'Guidance available' : 'Recommendation found')
      : 'Incomplete data'

    const phenotypeEntries = Object.entries(phenotypes)

    return `
      <div class="rc-card rc-card--${color}">
        <div class="rc-header">
          <div class="rc-drug-icon rc-drug-icon--${color}">${icon('flask')}</div>
          <div>
            <div class="rc-drug-name">${escapeHtml(res.genericName ?? res.drugName)}</div>
            <div class="rc-drug-generic">Generic · ${escapeHtml(res.drugName)}</div>
          </div>
          <span class="rc-status-badge rc-badge--${color}">${rec ? icon('check') : icon('warning')} ${statusText}</span>
        </div>

        ${phenotypeEntries.length ? `
          <div class="rc-phenotype-strip">
            ${phenotypeEntries.map(([gene, ph]) => {
              const dip = escapeHtml(diplotypeInputs[gene] ?? '—')
              return `<span class="rc-pheno-pill"><b class="rc-pheno-gene">${escapeHtml(gene)}</b><code class="rc-pheno-dip">${dip}</code><span class="rc-pheno-name">${escapeHtml(ph.phenotypeName)}</span></span>`
            }).join('')}
          </div>` : ''}

        ${rec ? `<div class="rc-rec-box"><p>${escapeHtml(rec.drugRecommendation)}</p></div>` : ''}

        ${!rec && missing.length ? `
          <div class="rc-no-rec-box">
            ${icon('warning')}
            <div>Missing diplotypes for a full recommendation: ${missing.map(g => `<span class="gene-chip">${escapeHtml(g)}</span>`).join(' ')}</div>
          </div>` : ''}

        ${(res.drugSafetyStatus ?? []).length ? `
          <div class="rc-safety-section">
            <div class="rc-safety-label">Drug Safety Assessment</div>
            ${(res.drugSafetyStatus ?? []).map(ss => {
              if (ss.status === 'not_risky') {
                return `<div class="rc-safety-row rc-safety--green">
                  <span class="rc-safety-icon">${icon('check')}</span>
                  <div class="rc-safety-body">
                    <strong>No genetic concern</strong>
                    <span class="rc-safety-gene">${escapeHtml(ss.geneSymbol)} · ${escapeHtml(ss.phenotypeName)}</span>
                  </div>
                  <span class="rc-safety-badge rc-safety-badge--green">Not risky</span>
                </div>`
              }
              if (ss.status === 'alternate_found') {
                return `<div class="rc-safety-row rc-safety--blue">
                  <span class="rc-safety-icon">${icon('info')}</span>
                  <div class="rc-safety-body">
                    <strong>Consider alternate: <span class="rc-alt-drug">${escapeHtml(ss.alternativeDrugGeneric ?? '')}</span></strong>
                    <span class="rc-safety-gene">${escapeHtml(ss.geneSymbol)} · ${escapeHtml(ss.phenotypeName)}</span>
                    ${ss.rationale ? `<span class="rc-safety-rationale">${escapeHtml(ss.rationale.substring(0, 180))}${ss.rationale.length > 180 ? '…' : ''}</span>` : ''}
                  </div>
                  <span class="rc-safety-badge rc-safety-badge--blue">CPIC Guideline</span>
                </div>`
              }
              if (ss.status === 'no_alternative_documented') {
                return `<div class="rc-safety-row rc-safety--amber">
                  <span class="rc-safety-icon">${icon('warning')}</span>
                  <div class="rc-safety-body">
                    <strong>Risky — no specific alternate documented</strong>
                    <span class="rc-safety-gene">${escapeHtml(ss.geneSymbol)} · ${escapeHtml(ss.phenotypeName)}</span>
                    <span class="rc-safety-rationale">Consult the CPIC guideline before dispensing.</span>
                  </div>
                  <span class="rc-safety-badge rc-safety-badge--amber">Review needed</span>
                </div>`
              }
              // unknown
              return `<div class="rc-safety-row rc-safety--gray">
                <span class="rc-safety-icon">${icon('info')}</span>
                <div class="rc-safety-body">
                  <strong>No safety data available</strong>
                  <span class="rc-safety-gene">${escapeHtml(ss.geneSymbol)} · ${escapeHtml(ss.phenotypeName)}</span>
                </div>
                <span class="rc-safety-badge rc-safety-badge--gray">Unknown</span>
              </div>`
            }).join('')}
          </div>` : ''}

        <div class="rc-footer">
          <span class="rc-guideline">
            ${rec?.guidelineTitle ? `${icon('check')} ${escapeHtml(rec.guidelineTitle)}` : ''}
          </span>
          ${rec ? (ss?.saved && ss.savedIds
            ? `<div class="rc-saved-badge">${icon('check')} Saved <span class="rc-saved-ids">Record #${ss.savedIds.resultIds?.[0] ?? '?'}</span></div>`
            : `<button class="primary rc-save-btn" data-action="save-recommendation" data-drug="${escapeAttr(res.drugName)}" ${ss?.loading ? 'disabled' : ''}>
                ${ss?.loading ? '<span class="spinner"></span> Saving…' : `${icon('check')} Save to patient record`}
              </button>`) : ''}
        </div>
      </div>`
  }).join('')
}

// ── DOM sync helpers ───────────────────────────────────────────────────────────
function syncSearchSuggestions() {
  const input = document.querySelector<HTMLInputElement>('#drug-search')
  if (input && input.value !== query) input.value = query

  const results = document.querySelector<HTMLElement>('#drug-results')
  const empty = document.querySelector<HTMLElement>('#drug-empty')
  if (!results || !empty) return

  if (!searchFocused) {
    results.innerHTML = ''; results.style.display = 'none'
    empty.innerHTML = ''; empty.style.display = 'none'
    return
  }

  const matches = findMatches(query)
  results.innerHTML = matches.map(drug => `
    <button class="result" data-action="add-drug" data-id="${drug.id}">
      <span class="result-plus">${icon('plus')}</span>
      <span><strong>${escapeHtml(drug.name)}</strong><small>${escapeHtml(drug.strength)}</small></span>
      <span class="add-label">Add</span>
    </button>`).join('')

  results.style.display = matches.length ? 'block' : 'none'
  empty.style.display = query.trim() && !matches.length ? 'block' : 'none'
  empty.textContent = query.trim() && !matches.length ? 'No medicines matched your search. Try a generic or brand name.' : ''
}

function syncUploadState() {
  const btn = document.querySelector<HTMLButtonElement>('[data-action="submit-prescription"]')
  if (btn) btn.disabled = !allComplete() || submitting
}

function syncLabFileLabel() {
  const label = document.querySelector<HTMLElement>('#lab-file-name')
  if (label) label.textContent = labReportFile ? labReportFile.name : 'Click to choose an image'
}

// ── Drug catalog helpers ───────────────────────────────────────────────────────
function findMatches(term: string) {
  if (loadingDrugs) return []
  return getCatalogueDrugs(term, SUGGESTION_LIMIT)
}

function getCatalogueDrugs(term: string, limit: number) {
  const q = term.trim().toLowerCase()
  const available = drugs.filter(drug => !items.some(item => item.id === drug.id))
  const ranked = available
    .map(drug => {
      const names = [drug.name, ...drug.generics].map(v => v.toLowerCase())
      if (q && !names.some(n => n.includes(q))) return null
      return { drug, rank: q && names.some(n => n.startsWith(q)) ? 0 : 1 }
    })
    .filter((e): e is { drug: Drug; rank: number } => Boolean(e))
    .sort((a, b) => a.rank - b.rank || a.drug.name.localeCompare(b.drug.name))
    .map(e => e.drug)
  return ranked.slice(0, limit)
}

function renderCatalogue(catalogue: Drug[]) {
  if (loadingDrugs) return `<div class="catalogue-loading"><div class="bar" style="width:72%"></div><div class="bar" style="width:88%"></div><div class="bar" style="width:64%"></div></div>`
  if (loadError) return `<div class="catalogue-empty">The drug catalogue could not be loaded yet.</div>`
  if (!catalogue.length) return `<div class="catalogue-empty">No medicines matched your search. Try a brand name or generic name.</div>`
  return `
    <div class="catalogue-grid">
      ${catalogue.map(drug => `
        <article class="catalogue-card" data-action="add-drug" data-id="${drug.id}">
          <div>
            <strong>${escapeHtml(drug.name)}</strong>
            <small>${escapeHtml(drug.strength || 'Strength not listed')}</small>
            <div class="catalogue-meta">${drug.generics.map(g => `<span>${escapeHtml(g)}</span>`).join('')}</div>
          </div>
          <button class="secondary catalogue-add" data-action="add-drug" data-id="${drug.id}">Add medicine</button>
        </article>`).join('')}
    </div>`
}

function normalizeDrug(item: DrugApiItem, index: number): Drug | null {
  const id = String(item.id ?? item.drugId ?? `drug-${index + 1}`).trim()
  const name = (item.name ?? item.drugName ?? item.brandName ?? '').trim()
  const strength = (item.strength ?? item.dosageForm ?? item.presentation ?? '').trim()
  const generics = normalizeList(item.generics ?? item.genericNames ?? item.activeIngredients)
  const generic = (item.genericName ?? '').trim()
  const source = (item.source ?? item.sourceName ?? 'Backend catalog').trim()
  if (!id || !name) return null
  return { id, name, strength, generics: generics.length ? generics : generic ? [generic] : [name], source }
}

function normalizeList(value: unknown) {
  return Array.isArray(value) ? value.map(v => String(v).trim()).filter(Boolean) : []
}

// ── API calls ──────────────────────────────────────────────────────────────────
async function loadDrugs() {
  loadingDrugs = true; loadError = ''; render()
  try {
    const data = await fetchDrugCatalog()
    const list = extractList(data).map(normalizeDrug).filter((d): d is Drug => Boolean(d))
    if (!list.length) throw new Error('The backend returned an empty drug catalog.')
    drugs = list
  } catch (error) {
    drugs = []
    loadError = error instanceof Error ? error.message : 'Could not load medicines.'
  } finally {
    loadingDrugs = false; render()
  }
}

async function fetchDrugCatalog() {
  try {
    const response = await fetch(DRUG_ENDPOINT, { headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`Drug catalog request failed with status ${response.status}`)
    const text = await response.text()
    if (!text.trim()) throw new Error('Drug catalog response was empty.')
    return JSON.parse(text) as unknown
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Could not load medicines.')
  }
}

function extractList(body: unknown): DrugApiItem[] {
  if (Array.isArray(body)) return body as DrugApiItem[]
  if (!body || typeof body !== 'object') return []
  const p = body as { data?: unknown; drugs?: unknown; items?: unknown }
  if (Array.isArray(p.data)) return p.data as DrugApiItem[]
  if (Array.isArray(p.drugs)) return p.drugs as DrugApiItem[]
  if (Array.isArray(p.items)) return p.items as DrugApiItem[]
  return []
}

async function submitPrescription() {
  if (!allComplete() || submitting) return
  submitting = true; submitError = ''; render()

  const payload = {
    prescriptionId: `draft-${Date.now()}`,
    prescribedAt: new Date().toISOString(),
    prescribedDrugs: items.map(item => ({
      drugId: item.id, drugName: item.name, strength: item.strength,
      generics: item.generics, selectedGeneric: item.selectedGeneric,
      dosage: item.dosage, frequency: item.frequency,
      durationDays: Number(item.duration), note: item.note,
    })),
  }

  try {
    const response = await fetch(PRESCRIPTION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    })
    if (response.status === 401) {
      currentHCP = null
      authError = 'Session expired. Please sign in again.'
      return
    }
    if (!response.ok) throw new Error(`Prescription upload failed with status ${response.status}`)
    const body = (await response.json()) as { suggestedTests?: unknown }
    suggestedTests = extractSuggestedTests(body.suggestedTests)
    submitted = true
    step = 2
  } catch (error) {
    submitError = error instanceof Error ? error.message : 'Unexpected error while uploading the prescription.'
  } finally {
    submitting = false; render()
  }
}

async function extractLabReport() {
  if (!labReportFile) { labExtractError = 'Please select a lab report image first.'; render(); return }
  labExtractLoading = true; labExtractError = ''; ocrExtractedLines = []; render()

  try {
    const formData = new FormData()
    formData.append('file', labReportFile)
    const response = await fetch(UPLOAD_EXTRACT_ENDPOINT, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'include',
      body: formData,
    })
    if (response.status === 401) {
      currentHCP = null
      authError = 'Session expired. Please sign in again.'
      return
    }
    if (!response.ok) {
      const err = (await response.json().catch(() => ({}))) as { detail?: string }
      throw new Error(err.detail ?? `Extraction failed with status ${response.status}`)
    }
    const body = (await response.json()) as { rawText?: { text: string }[] }
    const lines = (body.rawText ?? []).map(l => l.text)
    ocrExtractedLines = lines
    autoFillDiplotypeInputs(lines)
  } catch (error) {
    labExtractError = error instanceof Error ? error.message : 'Could not extract text from lab report.'
  } finally {
    labExtractLoading = false; render()
  }
}

/**
 * Tries to match gene symbols from suggestedTests against extracted OCR lines.
 * Handles formats like:
 *   "CYP2D6 *4/*4"
 *   "CYP2D6: *4/*4"
 *   "Gene: CYP2D6  Diplotype: *4/*4"
 *   "CYP2D6" on one line, "*4/*4" on the next
 */
function autoFillDiplotypeInputs(lines: string[]) {
  const genes = uniqueGenes()
  // Matches diplotype patterns: *4/*4, *1/*2xN, *17/*17, etc.
  const diplotypeRe = /(\*\d+(?:[a-z]\d*)?(?:x\d+)?\/\*\d+(?:[a-z]\d*)?(?:x\d+)?)/i

  for (const gene of genes) {
    if ((diplotypeInputs[gene] ?? '').trim()) continue // don't overwrite existing
    const geneRe = new RegExp(`\\b${gene.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')

    for (let i = 0; i < lines.length; i++) {
      if (!geneRe.test(lines[i])) continue
      // Search this line and the next 3 joined together
      const window = lines.slice(i, i + 4).join(' ')
      const match = diplotypeRe.exec(window)
      if (match) {
        diplotypeInputs[gene] = match[1]
        break
      }
    }
  }
}

async function getRecommendation() {
  if (recommendationLoading) return

  // Sync any diplotype input values from the live DOM into state before render()
  // destroys the elements. This ensures OCR-filled or programmatically set values
  // that didn't go through the input event handler are captured.
  document.querySelectorAll<HTMLInputElement>('[data-action="diplotype-input"][data-gene]')
    .forEach(el => {
      const gene = el.dataset.gene
      if (gene && el.value.trim()) diplotypeInputs[gene] = el.value.trim()
    })

  recommendationLoading = true; recommendationError = ''; recommendationResults = []; render()

  try {
    const results = await Promise.all(
      uniqueDrugNames().map(async drugName => {
        const diplotypes = genesForDrug(drugName)
          .filter(g => (diplotypeInputs[g] ?? '').trim())
          .map(g => ({ geneSymbol: g, diplotypeName: diplotypeInputs[g].trim() }))
        try {
          const response = await fetch(GENE_RECOMMENDATION_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ drugName, diplotypes }),
          })
          if (response.status === 401) {
            currentHCP = null
            authError = 'Session expired. Please sign in again.'
            render()
            return { drugName, found: false, reason: 'Session expired.' } as RecommendationResult
          }
          if (!response.ok) {
            const err = (await response.json().catch(() => ({}))) as { detail?: string }
            return { drugName, found: false, reason: err.detail ?? `Failed with status ${response.status}` } as RecommendationResult
          }
          const body = (await response.json()) as RecommendationResult
          return { ...body, drugName }
        } catch (error) {
          return { drugName, found: false, reason: error instanceof Error ? error.message : 'Network error.' } as RecommendationResult
        }
      })
    )
    recommendationResults = results
  } catch (error) {
    recommendationError = error instanceof Error ? error.message : 'Could not fetch recommendations.'
  } finally {
    recommendationLoading = false; render()
  }
}

async function saveRecommendation(drugName: string) {
  const existing = recommendationResults.find(r => r.drugName === drugName)
  if (!existing?.found || !existing.recommendation) return

  saveState[drugName] = { loading: true, saved: false, error: '', savedIds: null }; render()

  const diplotypes = genesForDrug(drugName)
    .filter(g => (diplotypeInputs[g] ?? '').trim())
    .map(g => ({ geneSymbol: g, diplotypeName: diplotypeInputs[g].trim() }))

  try {
    const response = await fetch(GENE_RECOMMENDATION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ drugName, diplotypes, patientId: 1, enteredByDoctorId: 1, persist: true }),
    })
    if (response.status === 401) {
      currentHCP = null
      authError = 'Session expired. Please sign in again.'
      render()
      return
    }
    if (!response.ok) {
      const err = (await response.json().catch(() => ({}))) as { detail?: string }
      throw new Error(err.detail ?? `Save failed with status ${response.status}`)
    }
    const body = (await response.json()) as RecommendationResult
    saveState[drugName] = { loading: false, saved: true, error: '', savedIds: body.savedRecordIds ?? null }
  } catch (error) {
    saveState[drugName] = { loading: false, saved: false, error: error instanceof Error ? error.message : 'Could not save.', savedIds: null }
  } finally {
    render()
  }
}

// ── Input field sync ───────────────────────────────────────────────────────────
function syncDrugField(target: HTMLInputElement | HTMLSelectElement) {
  const id = target.dataset.id
  const item = items.find(e => e.id === id)
  const field = target.dataset.field as keyof Pick<PrescriptionDrug, 'dosage' | 'frequency' | 'duration' | 'note'> | undefined
  if (!item || !field) return

  const ss = target instanceof HTMLInputElement ? target.selectionStart : null
  const se = target instanceof HTMLInputElement ? target.selectionEnd : null
  item[field] = target.value
  render()

  const rep = [...document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]')]
    .find(el => el.dataset.id === id && el.dataset.field === field)
  if (!rep) return
  rep.focus()
  if (rep instanceof HTMLInputElement && ss !== null && se !== null) rep.setSelectionRange(ss, se)
}

// ── Event listeners ────────────────────────────────────────────────────────────
app.addEventListener('input', event => {
  const target = event.target as HTMLInputElement | HTMLSelectElement | null
  if (!target) return

  if (target.id === 'drug-search') {
    query = target.value; syncSearchSuggestions(); return
  }

  if (target.matches('[data-action="diplotype-input"]')) {
    const gene = (target as HTMLInputElement).dataset.gene ?? ''
    if (gene) {
      diplotypeInputs[gene] = target.value
      // Live update: check/uncheck icon + button state without full redraw
      const row = target.closest('.diplotype-row')
      if (row) {
        const existing = row.querySelector('.diplotype-check')
        if (target.value.trim() && !existing) {
          const span = document.createElement('span')
          span.className = 'diplotype-check'
          span.innerHTML = icon('check')
          row.appendChild(span)
          target.classList.add('diplotype-input--filled')
        } else if (!target.value.trim() && existing) {
          existing.remove()
          target.classList.remove('diplotype-input--filled')
        }
      }
      const btn = document.querySelector<HTMLButtonElement>('[data-action="get-recommendation"]')
      if (btn) {
        const genes = uniqueGenes()
        btn.disabled = !genes.some(g => (diplotypeInputs[g] ?? '').trim()) || recommendationLoading
      }
    }
    return
  }

  if (target.matches('[data-field]')) { searchFocused = false; syncDrugField(target) }
})

app.addEventListener('change', event => {
  const target = event.target as HTMLInputElement | null
  if (target?.id === 'lab-report-file' && target.files?.[0]) {
    labReportFile = target.files[0]
    // Enable extract button without full redraw
    const btn = document.querySelector<HTMLButtonElement>('[data-action="extract-lab-report"]')
    if (btn) btn.disabled = false
    syncLabFileLabel()
  }
})

app.addEventListener('focusin', event => {
  const target = event.target as HTMLElement | null
  if (target?.id !== 'drug-search') return
  searchFocused = true; syncSearchSuggestions()
})

app.addEventListener('focusout', event => {
  const target = event.target as HTMLElement | null
  if (target?.id !== 'drug-search') return
  window.setTimeout(() => { searchFocused = false; syncSearchSuggestions() }, 150)
})

function addDrugToPrescription(id: string) {
  const drug = drugs.find(e => e.id === id)
  if (!drug) return false
  items = [...items, { ...drug, dosage: '', frequency: '', duration: '', note: '', selectedGeneric: drug.generics[0] ?? drug.name }]
  query = ''; searchFocused = false; render()
  return true
}

app.addEventListener('pointerdown', event => {
  const target = event.target as HTMLElement | null
  const result = target?.closest<HTMLElement>('#drug-results [data-action="add-drug"][data-id]')
  const id = result?.dataset.id
  if (!id) return
  event.preventDefault(); addDrugToPrescription(id)
})

app.addEventListener('click', event => {
  const target = event.target as HTMLElement | null
  const actionEl = target?.closest<HTMLElement>('[data-action]')
  const action = actionEl?.dataset.action
  // Resolve id only from the action element itself, not by walking up the whole tree.
  // Walking up with closest('[data-id]') would accidentally match data-id on drug form
  // inputs/selects that are already in the prescription list.
  const id = actionEl?.dataset.id ?? actionEl?.closest<HTMLElement>('[data-id]')?.dataset.id

  if (action === 'set-auth-mode') {
    const mode = actionEl?.dataset.mode as 'signin' | 'register' | undefined
    if (mode && mode !== authMode) {
      authMode = mode
      authError = ''
      render()
    }
    return
  }

  if (action === 'toggle-pw') {
    const targetId = actionEl?.dataset.target
    if (targetId) {
      const input = document.querySelector<HTMLInputElement>(`#${targetId}`)
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password'
      }
    }
    return
  }

  if (action === 'submit-signin') { void submitSignIn(); return }
  if (action === 'submit-register') { void submitRegister(); return }
  if (action === 'logout') { void logoutHCP(); return }

  if (action === 'add-drug' && id) { addDrugToPrescription(id); return }
  if (action === 'remove-drug' && id) { items = items.filter(i => i.id !== id); render(); return }
  if (action === 'clear-all') { items = []; render(); return }
  if (action === 'submit-prescription') { void submitPrescription(); return }
  if (action === 'back-to-create') { step = 1; render(); return }
  if (action === 'next-step' && submitted) { step = 3; render(); return }

  if (action === 'new-prescription') {
    step = 1; submitted = false; items = []; submitError = ''; query = ''
    suggestedTests = []; diplotypeInputs = {}; labReportFile = null
    labExtractLoading = false; labExtractError = ''; ocrExtractedLines = []
    recommendationLoading = false; recommendationError = ''
    recommendationResults = []; saveState = {}
    render(); return
  }

  if (action === 'retry-load') { void loadDrugs(); return }
  if (action === 'extract-lab-report') { void extractLabReport(); return }
  if (action === 'get-recommendation') { void getRecommendation(); return }

  if (action === 'save-recommendation') {
    const drugName = target?.closest<HTMLElement>('[data-drug]')?.dataset.drug ?? ''
    if (drugName) void saveRecommendation(drugName)
    return
  }
})

void checkAuthSession()
mountChatWidget()

// ── Response parser ────────────────────────────────────────────────────────────
function extractSuggestedTests(value: unknown): SuggestedTest[] {
  if (!Array.isArray(value)) return []
  return value.map(item => {
    if (!item || typeof item !== 'object') return null
    const e = item as Record<string, unknown>
    const title = String(e.title ?? '').trim()
    const description = String(e.description ?? '').trim()
    const geneSymbol = String(e.geneSymbol ?? '').trim()
    if (!title || !description || !geneSymbol) return null
    return {
      title, description, geneSymbol,
      drugName: String(e.drugName ?? '').trim(),
      guidelineName: e.guidelineName == null ? null : String(e.guidelineName).trim() || null,
      guidelineUrl: e.guidelineUrl == null ? null : String(e.guidelineUrl).trim() || null,
      cpicLevel: e.cpicLevel == null ? null : String(e.cpicLevel).trim() || null,
      clinpgxLevel: e.clinpgxLevel == null ? null : String(e.clinpgxLevel).trim() || null,
      provisional: Boolean(e.provisional),
    }
  }).filter((i): i is SuggestedTest => Boolean(i))
}
