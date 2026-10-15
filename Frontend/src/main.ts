import './style.css'
import './catalogue.css'
import './chat.css'
import { renderCopilotPanelHTML, bindCopilotEvents, type ClinicalContextState } from './chat'

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

type Patient = {
  patient_id: number
  full_name: string
  dob: string
  sex: string
}

const DRUG_ENDPOINT = import.meta.env.VITE_DRUGS_API_URL ?? '/api/drugs'
const PRESCRIPTION_ENDPOINT = import.meta.env.VITE_PRESCRIPTION_API_URL ?? '/api/prescriptions'
const UPLOAD_EXTRACT_ENDPOINT = '/api/prescriptions/upload-extract'
const GENE_RECOMMENDATION_ENDPOINT = '/api/gene-recommendation'
const PATIENT_SEARCH_ENDPOINT = '/api/patients/search'
const PATIENT_CREATE_ENDPOINT = '/api/patients'
const FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'Every 6 hours', 'As needed']
const SUGGESTION_LIMIT = 6
const CATALOG_LIMIT = 18

// ── App state ──────────────────────────────────────────────────────────────────
let currentTheme: 'dark' | 'light' = (localStorage.getItem('genemeds-theme') as 'dark' | 'light') ||
  (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')

function applyTheme(theme: 'dark' | 'light') {
  currentTheme = theme
  document.documentElement.setAttribute('data-theme', theme)
  localStorage.setItem('genemeds-theme', theme)
}
applyTheme(currentTheme)

let authChecking = true
let currentHCP: HCPUser | null = null
let authMode: 'signin' | 'register' = 'signin'
let authLoading = false
let authError = ''

// Patient state
let selectedPatient: Patient | null = null
let patientSearchQuery = ''
let patientSearchResults: Patient[] = []
let patientSearchLoading = false
let patientSearchError = ''
let showCreatePatientModal = false
let createPatientLoading = false
let createPatientError = ''

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
let savedPrescriptionId: number | string | null = null

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
let selectedRecDrugIndex = 0
let leftContextCollapsed: Record<string, boolean> = {
  medicines: false,
  genes: false,
  results: false,
}

// Step 3 — save per drug
let saveState: Record<string, { loading: boolean; saved: boolean; error: string; savedIds: { resultIds: number[]; assessmentId: number | null } | null }> = {}
// Copilot panel state
let copilotCollapsed = localStorage.getItem('genemeds-copilot-collapsed') === 'true'

function getClinicalContext(): ClinicalContextState {
  return {
    patient: selectedPatient ? { name: selectedPatient.full_name, dob: selectedPatient.dob, sex: selectedPatient.sex } : null,
    items: items.map(item => ({
      name: item.name,
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.duration,
      generics: item.generics,
    })),
    diplotypes: { ...diplotypeInputs },
    suggestedTests: suggestedTests.map(t => ({ geneSymbol: t.geneSymbol, drugName: t.drugName })),
    recommendations: recommendationResults.map(r => ({
      drugName: r.drugName,
      recommendation: r.recommendation?.drugRecommendation,
      safetyStatus: r.drugSafetyStatus?.map(s => ({
        geneSymbol: s.geneSymbol,
        phenotypeName: s.phenotypeName,
        status: s.status,
        alternativeDrugGeneric: s.alternativeDrugGeneric,
      })),
    })),
  }
}

const app = document.querySelector<HTMLDivElement>('#app')!

// ── Icons ──────────────────────────────────────────────────────────────────────
const icon = (name: 'plus' | 'search' | 'chevron' | 'trash' | 'check' | 'arrow' | 'refresh' | 'warning' | 'upload' | 'dna' | 'flask' | 'info' | 'sun' | 'moon' | 'mail' | 'lock' | 'eye' | 'pill' | 'doc') => {
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
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    pill: '<path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`
}

const geneLogo = `<svg class="gene-logo" viewBox="0 0 32 32" fill="none" aria-hidden="true">
  <path d="M6 4C12 8 20 24 26 28M26 4C20 8 12 24 6 28" stroke="var(--primary)" stroke-width="2.5" stroke-linecap="round"/>
  <path d="M10 8C14 12 18 20 22 24M22 8C18 12 14 20 10 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity="0.6"/>
  <line x1="8" y1="8" x2="24" y2="8" stroke="var(--primary)" stroke-width="2" stroke-linecap="round"/>
  <line x1="11" y1="13" x2="21" y2="13" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="11" y1="19" x2="21" y2="19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  <line x1="8" y1="24" x2="24" y2="24" stroke="var(--primary)" stroke-width="2" stroke-linecap="round"/>
</svg>`

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

function formatDob(dobStr: string): string {
  if (!dobStr) return ''
  const parts = dobStr.split('-')
  if (parts.length !== 3) return dobStr
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthIdx = parseInt(parts[1], 10) - 1
  return `${parseInt(parts[2], 10)} ${months[monthIdx] || ''} ${parts[0]}`
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'P'
}

async function searchPatients(query: string) {
  patientSearchQuery = query
  const q = query.trim()
  if (!q) {
    patientSearchResults = []
    patientSearchLoading = false
    patientSearchError = ''
    updatePatientResultsContainer()
    return
  }
  patientSearchLoading = true
  patientSearchError = ''
  updatePatientResultsContainer()

  try {
    const res = await fetch(`${PATIENT_SEARCH_ENDPOINT}?q=${encodeURIComponent(q)}`, { credentials: 'include' })
    if (res.status === 401) {
      currentHCP = null
      authError = 'Session expired. Please sign in again.'
      render()
      return
    }
    if (!res.ok) {
      throw new Error(`Search failed (${res.status})`)
    }
    const data = (await res.json()) as Patient[]
    patientSearchResults = data
  } catch (err) {
    patientSearchError = err instanceof Error ? err.message : 'Error searching patients'
  } finally {
    patientSearchLoading = false
    updatePatientResultsContainer()
  }
}

function updatePatientResultsContainer() {
  const container = document.querySelector('#patient-results-container')
  if (container) {
    container.innerHTML = renderPatientSearchResultsHTML()
  }
}

async function submitCreatePatient(fullName: string, dob: string, sex: string) {
  console.log('[PATIENT MODAL] Create Patient submitted')
  console.log('[PATIENT MODAL] payload =', { full_name: fullName, dob, sex })
  if (!fullName || !dob || !sex) {
    createPatientError = 'Please fill in all required patient fields.'
    render()
    return
  }
  createPatientLoading = true
  createPatientError = ''
  render()

  try {
    const res = await fetch(PATIENT_CREATE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ full_name: fullName, dob, sex }),
    })
    console.log('[PATIENT MODAL] API response status =', res.status)
    if (res.status === 401) {
      currentHCP = null
      authError = 'Session expired. Please sign in again.'
      render()
      return
    }
    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as { detail?: string }
      throw new Error(errData.detail ?? 'Failed to create patient.')
    }
    const newPatient = (await res.json()) as Patient
    console.log('[PATIENT MODAL] API response =', res.status)
    console.log('[PATIENT MODAL] patient created =', newPatient)
    // Automatically select the newly created patient
    selectedPatient = newPatient
    showCreatePatientModal = false
    createPatientLoading = false
    createPatientError = ''
    patientSearchQuery = ''
    patientSearchResults = []
    render()
  } catch (err) {
    console.error('[PATIENT MODAL] Error creating patient:', err)
    createPatientError = err instanceof Error ? err.message : 'Could not create patient.'
    createPatientLoading = false
    render()
  }
}

function uniqueGenes(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of suggestedTests) {
    const gene = (t.geneSymbol || '').trim()
    if (gene && !seen.has(gene.toUpperCase())) {
      seen.add(gene.toUpperCase())
      out.push(gene)
    }
  }
  return out
}

function uniqueDrugNames(): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of suggestedTests) {
    const d = (t.drugName || '').trim()
    if (d && !seen.has(d.toLowerCase())) {
      seen.add(d.toLowerCase())
      out.push(d)
    }
  }
  if (out.length === 0) {
    for (const item of items) {
      const d = (item.selectedGeneric || item.name || '').trim()
      if (d && !seen.has(d.toLowerCase())) {
        seen.add(d.toLowerCase())
        out.push(d)
      }
    }
  }
  return out
}

function genesForDrug(drugName: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  const target = drugName.trim().toLowerCase()
  for (const t of suggestedTests) {
    const d = (t.drugName || '').trim().toLowerCase()
    const g = (t.geneSymbol || '').trim()
    if ((d === target || !d) && g && !seen.has(g.toUpperCase())) {
      seen.add(g.toUpperCase())
      out.push(g)
    }
  }
  if (out.length === 0) {
    return uniqueGenes()
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
        <label for="signin-email">Email address</label>
        <div class="auth-input-wrap">
          <span class="input-icon">${icon('mail')}</span>
          <input type="email" id="signin-email" class="auth-input" placeholder="doctor@example.com" autocomplete="email" required>
        </div>
      </div>

      <div class="auth-form-group">
        <label for="signin-password">Password</label>
        <div class="auth-input-wrap">
          <span class="input-icon">${icon('lock')}</span>
          <input type="password" id="signin-password" class="auth-input" placeholder="••••••••" autocomplete="current-password" required>
          <button type="button" class="pw-toggle-btn" data-action="toggle-pw" data-target="signin-password" title="Toggle password visibility">
            ${icon('eye')}
          </button>
        </div>
      </div>

      <div class="auth-options">
        <label class="auth-checkbox">
          <input type="checkbox" checked>
          <span>Keep me signed in</span>
        </label>
        <a href="#" class="auth-forgot" onclick="event.preventDefault(); alert('Please contact system administrator to reset password.');">Forgot password?</a>
      </div>

      <button type="submit" class="primary auth-submit-btn" id="btn-signin-submit" data-action="submit-signin" ${authLoading ? 'disabled' : ''}>
        ${authLoading ? '<span class="spinner"></span> Signing in...' : `Sign In ${icon('arrow')}`}
      </button>
    </form>
  `
}

function renderRegisterForm() {
  return `
    <form class="auth-form" onsubmit="return false">
      <div class="auth-form-group">
        <label for="reg-fullname">Full Name</label>
        <div class="auth-input-wrap">
          <span class="input-icon">${icon('info')}</span>
          <input type="text" id="reg-fullname" class="auth-input" placeholder="Dr. Jane Doe" autocomplete="name" required>
        </div>
      </div>

      <div class="auth-form-group">
        <label for="reg-number">Medical Registration Number</label>
        <div class="auth-input-wrap">
          <span class="input-icon">${icon('doc')}</span>
          <input type="text" id="reg-number" class="auth-input" placeholder="e.g. MCI-123456" autocomplete="off" required>
        </div>
      </div>

      <div class="auth-form-group">
        <label for="reg-email">Email Address</label>
        <div class="auth-input-wrap">
          <span class="input-icon">${icon('mail')}</span>
          <input type="email" id="reg-email" class="auth-input" placeholder="doctor@example.com" autocomplete="email" required>
        </div>
      </div>

      <div class="auth-form-group">
        <label for="reg-password">Password (min 8 characters)</label>
        <div class="auth-input-wrap">
          <span class="input-icon">${icon('lock')}</span>
          <input type="password" id="reg-password" class="auth-input" placeholder="••••••••" autocomplete="new-password" minlength="8" required>
          <button type="button" class="pw-toggle-btn" data-action="toggle-pw" data-target="reg-password" title="Toggle password visibility">
            ${icon('eye')}
          </button>
        </div>
      </div>

      <div class="auth-form-group">
        <label for="reg-confirm-password">Confirm Password</label>
        <div class="auth-input-wrap">
          <span class="input-icon">${icon('lock')}</span>
          <input type="password" id="reg-confirm-password" class="auth-input" placeholder="••••••••" autocomplete="new-password" minlength="8" required>
          <button type="button" class="pw-toggle-btn" data-action="toggle-pw" data-target="reg-confirm-password" title="Toggle password visibility">
            ${icon('eye')}
          </button>
        </div>
      </div>

      <button type="submit" class="primary auth-submit-btn" id="btn-register-submit" data-action="submit-register" ${authLoading ? 'disabled' : ''}>
        ${authLoading ? '<span class="spinner"></span> Creating account...' : `Create Account ${icon('arrow')}`}
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
          <button class="theme-toggle-btn" data-action="toggle-theme" title="Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} theme" aria-label="Toggle theme">
            ${currentTheme === 'dark' ? icon('sun') : icon('moon')}
          </button>
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
          <button class="theme-toggle-btn" data-action="toggle-theme" title="Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} theme" aria-label="Toggle theme">
            ${currentTheme === 'dark' ? icon('sun') : icon('moon')}
          </button>
        </header>

        <div class="auth-layout">
          <!-- Left Hero Column -->
          <div class="auth-hero">
            <div class="auth-hero-platform">PHARMACOGENOMICS PLATFORM</div>
            <h1>Right drug.<br>For your <span class="highlight">genes</span>.</h1>
            <p>Evidence-based pharmacogenomic guidance for safer, more effective treatment decisions.</p>
            <hr class="auth-hero-divider">
            <div class="auth-hero-stats">
              <div class="auth-stat-badge">
                ${icon('pill')}
                <div>
                  <strong>500+</strong>
                  <small>Drugs</small>
                </div>
              </div>
              <div class="auth-stat-badge">
                ${icon('dna')}
                <div>
                  <strong>132+</strong>
                  <small>Genes</small>
                </div>
              </div>
              <div class="auth-stat-badge">
                ${icon('doc')}
                <div>
                  <strong>CPIC</strong>
                  <small>Guidelines</small>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Form Panel -->
          <div class="auth-panel">
            <div class="auth-card">
              <div class="auth-card-logo">
                <span class="brand-mark">${geneLogo}</span>
                <span class="brand" style="font-size:18px">Gene<span>Meds</span></span>
              </div>
              <h2>${authMode === 'signin' ? 'Welcome back' : 'Create an account'}</h2>
              <p class="auth-sub">${authMode === 'signin' ? 'Sign in to your account to continue.' : 'Register as a Healthcare Professional.'}</p>

              <div id="auth-error-container">
                ${authError ? `<div class="auth-error-banner"><span>⚠️</span> <div>${escapeHtml(authError)}</div></div>` : ''}
              </div>

              ${authMode === 'signin' ? renderSignInForm() : renderRegisterForm()}

              <div class="auth-divider">or</div>

              <div class="auth-switch">
                ${authMode === 'signin'
                  ? `Don't have an account? <button class="auth-switch-btn" data-action="set-auth-mode" data-mode="register">Register</button>`
                  : `Already have an account? <button class="auth-switch-btn" data-action="set-auth-mode" data-mode="signin">Sign In</button>`
                }
              </div>
            </div>
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
    <div class="workspace-layout ${copilotCollapsed ? 'copilot-layout--collapsed' : ''}">
      <header class="workspace-header">
        <a class="brand" href="#" aria-label="GeneMeds home">
          <span class="brand-mark">${geneLogo}</span>
          <span>Gene<span>Meds</span></span>
        </a>
        <div class="header-right">
          <button class="copilot-header-toggle ${copilotCollapsed ? 'collapsed' : ''}" data-action="toggle-copilot-panel" title="${copilotCollapsed ? 'Expand Copilot Panel' : 'Collapse Copilot Panel'}">
            <span class="copilot-dot"></span>
            <span>${copilotCollapsed ? 'Expand Copilot' : 'Copilot Active'}</span>
          </button>
          <button class="theme-toggle-btn" data-action="toggle-theme" title="Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} theme" aria-label="Toggle theme">
            ${currentTheme === 'dark' ? icon('sun') : icon('moon')}
          </button>
          <div class="doctor">
            <span class="avatar">${escapeHtml(initials)}</span>
            <div>
              <strong>${escapeHtml(currentHCP.fullName)}</strong>
              <small>Reg: ${escapeHtml(currentHCP.registrationNumber)}</small>
            </div>
            <button class="doctor-logout-btn" data-action="logout">Sign Out</button>
          </div>
        </div>
      </header>

      <div class="workspace-body">
        <main class="clinical-stage">
          <section class="page-heading">
            <div>
              <h1>${step === 1 ? 'Create a new prescription' : step === 2 ? 'Enter Genetic Test Results' : 'Clinical Recommendation'}</h1>
              <p>${step === 1 ? 'Add medicines and treatment directions for your patient.' : step === 2 ? 'Review recommended gene tests and enter patient diplotypes.' : 'Personalized pharmacogenomic guidance for this prescription.'}</p>
            </div>
            <div class="step-count">Step <strong>${step}</strong> of 3</div>
          </section>
          ${stepper()}

          <div class="page-stage step-${step}">
            ${step === 1 ? createStep() : step === 2 ? resultsPage() : recommendationStep()}
          </div>
        </main>

        <aside class="copilot-aside-root" id="copilot-aside-root">
          ${renderCopilotPanelHTML(getClinicalContext(), copilotCollapsed)}
        </aside>
      </div>
    </div>
    ${renderCreatePatientModalHTML()}
  `

  syncSearchSuggestions()
  syncUploadState()
  syncLabFileLabel()

  const copilotRoot = document.querySelector<HTMLElement>('#copilot-aside-root')
  if (copilotRoot) {
    bindCopilotEvents(
      copilotRoot,
      getClinicalContext,
      () => {
        copilotCollapsed = !copilotCollapsed
        localStorage.setItem('genemeds-copilot-collapsed', String(copilotCollapsed))
        render()
      },
      () => {
        if (copilotRoot) {
          copilotRoot.innerHTML = renderCopilotPanelHTML(getClinicalContext(), copilotCollapsed)
          bindCopilotEvents(copilotRoot, getClinicalContext, () => {
            copilotCollapsed = !copilotCollapsed
            localStorage.setItem('genemeds-copilot-collapsed', String(copilotCollapsed))
            render()
          })
        }
      }
    )
  }
}

function patientSection() {
  if (selectedPatient) {
    return `
      <section class="patient-card card">
        <span class="patient-section-tag">SELECTED PATIENT</span>
        <div class="patient-summary-content">
          <div class="patient-avatar-circle">
            ${escapeHtml(getInitials(selectedPatient.full_name))}
          </div>
          <div class="patient-details-body">
            <div class="patient-name-line">
              <h3>${escapeHtml(selectedPatient.full_name)}</h3>
              <span class="patient-id-chip">P${String(selectedPatient.patient_id).padStart(5, '0')}</span>
            </div>
            <p class="patient-meta-line">
              <span>DOB: ${formatDob(selectedPatient.dob)}</span>
              <span class="dot-separator">•</span>
              <span>Sex: ${escapeHtml(selectedPatient.sex)}</span>
            </p>
          </div>
          <button class="secondary change-patient-btn" data-action="change-patient">Change Patient</button>
        </div>
      </section>
    `
  }

  return `
    <section class="patient-card card">
      <div class="card-title">
        <div>
          <h2>Patient Selection</h2>
          <p>Search and select an existing patient or create a new patient for this prescription.</p>
        </div>
        <button class="secondary btn-create-patient-trigger" data-action="open-create-patient-modal">
          ${icon('plus')} Create New Patient
        </button>
      </div>

      <div class="patient-search-wrap">
        <label for="patient-search-input">Search Patient</label>
        <div class="search-box">
          ${icon('search')}
          <input
            id="patient-search-input"
            autocomplete="off"
            placeholder="Search patient by name or ID (e.g. Rahul, P00124)..."
            value="${escapeAttr(patientSearchQuery)}"
          />
          ${patientSearchLoading ? '<span class="spinner"></span>' : ''}
        </div>
        <div class="patient-results-container" id="patient-results-container">
          ${renderPatientSearchResultsHTML()}
        </div>
      </div>
    </section>
  `
}

function renderPatientSearchResultsHTML() {
  if (!patientSearchQuery.trim()) {
    return `
      <div class="patient-hint-box">
        Type a patient name or ID above to search existing database records, or click <strong>+ Create New Patient</strong>.
      </div>
    `
  }

  if (patientSearchLoading) {
    return `<div class="patient-hint-box"><span class="spinner"></span> Searching patients...</div>`
  }

  if (patientSearchError) {
    return `<div class="auth-error-banner"><span>⚠️</span> <div>${escapeHtml(patientSearchError)}</div></div>`
  }

  if (patientSearchResults.length === 0) {
    return `
      <div class="patient-empty-results">
        <p>No patients found matching "<strong>${escapeHtml(patientSearchQuery)}</strong>".</p>
        <button class="primary" data-action="open-create-patient-modal">${icon('plus')} Create New Patient</button>
      </div>
    `
  }

  return `
    <div class="patient-results-list">
      ${patientSearchResults.map(p => `
        <div class="patient-result-item" data-action="select-patient" data-patient-id="${p.patient_id}">
          <div class="patient-result-avatar">${escapeHtml(getInitials(p.full_name))}</div>
          <div class="patient-result-info">
            <strong>${escapeHtml(p.full_name)}</strong>
            <small>P${String(p.patient_id).padStart(5, '0')} · ${formatDob(p.dob)} · ${escapeHtml(p.sex)}</small>
          </div>
          <span class="patient-select-btn">${icon('check')} Select</span>
        </div>
      `).join('')}
    </div>
  `
}

function renderCreatePatientModalHTML() {
  if (!showCreatePatientModal) return ''

  const today = new Date().toISOString().split('T')[0]

  return `
    <div class="patient-modal-backdrop" data-action="close-modal-backdrop">
      <div class="patient-modal-card">
        <div class="patient-modal-header">
          <div>
            <h3>Create New Patient</h3>
            <p>Enter basic demographics to create and select patient.</p>
          </div>
          <button type="button" class="modal-close-btn" data-action="close-create-patient-modal" title="Close modal">✕</button>
        </div>
        <form id="create-patient-form" onsubmit="return false">
          ${createPatientError ? `<div class="auth-error-banner"><span>⚠️</span> <div>${escapeHtml(createPatientError)}</div></div>` : ''}

          <div class="auth-form-group">
            <label for="patient-full-name">Full Name <b>*</b></label>
            <div class="auth-input-wrap">
              <span class="input-icon">${icon('info')}</span>
              <input type="text" id="patient-full-name" class="auth-input" placeholder="e.g. Rahul Sharma" required>
            </div>
          </div>

          <div class="auth-form-group">
            <label for="patient-dob">Date of Birth <b>*</b></label>
            <div class="auth-input-wrap">
              <span class="input-icon">${icon('doc')}</span>
              <input type="date" id="patient-dob" class="auth-input" max="${today}" required>
            </div>
          </div>

          <div class="auth-form-group">
            <label for="patient-sex">Sex <b>*</b></label>
            <div class="auth-input-wrap">
              <select id="patient-sex" class="auth-input" required>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div class="patient-modal-footer">
            <button type="button" class="secondary" data-action="close-create-patient-modal">Cancel</button>
            <button type="submit" class="primary" id="btn-create-patient-submit" data-action="submit-create-patient" ${createPatientLoading ? 'disabled' : ''}>
              ${createPatientLoading ? '<span class="spinner"></span> Creating...' : `Create & Select ${icon('arrow')}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  `
}

function stepper() {
  const labels = ['Prescription', 'Genetic Results', 'Clinical Recommendation']
  return `<nav class="stepper" aria-label="Prescription steps">${labels
    .map((label, index) => {
      const n = index + 1
      const state = n === step ? 'active' : n < step ? 'done' : ''
      const clickable = n === 1 || (n === 2 && (step >= 2 || submitted)) || (n === 3 && recommendationResults.length > 0)
      return `<div class="step ${state} ${clickable ? 'step--clickable' : ''}" ${clickable ? `data-action="go-to-step" data-step-num="${n}"` : ''}><span class="step-number">${n < step ? icon('check') : n}</span><span>${label}</span></div>${n < 3 ? '<div class="step-line"></div>' : ''}`
    })
    .join('')}</nav>`
}

// ── Step 1: Create prescription ───────────────────────────────────────────────
function createStep() {
  const catalogue = getCatalogueDrugs(query, CATALOG_LIMIT)
  const hasQuery = Boolean(query.trim())
  return `
    ${patientSection()}
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
        <div class="catalogue-grid-wrap">${renderCatalogue(catalogue)}</div>
      </section>

      ${items.length ? `<div class="drug-list">${items.map((item, index) => drugForm(item, index)).join('')}</div>` : emptyState()}

      ${submitError ? `<div class="submission-error">${escapeHtml(submitError)}</div>` : ''}

      <footer class="card-footer">
        <span class="completion-note">${allComplete() ? 'All treatment details are complete.' : items.length ? 'Complete dosage, frequency, and duration for each medicine.' : 'Add at least one medicine to continue.'}</span>
        <button class="primary" data-action="submit-prescription" ${allComplete() || submitting ? '' : 'disabled'}>${submitting ? '<span class="spinner"></span> Uploading...' : `Proceed ${icon('arrow')}`}</button>
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

// ── Step 2: Genetic results & diplotype entry ─────────────────────────

// ── Step 3: Full-width results page ───────────────────────────────────────────
function resultsPage() {
  const genes = uniqueGenes()
  const hasAnyDiplotype = genes.some(g => (diplotypeInputs[g] ?? '').trim())
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
            <div style="display:flex;gap:10px;align-items:center;">
              ${recommendationResults.length ? `
                <button class="secondary" data-action="go-to-step" data-step-num="3" type="button">
                  View Recommendations ${icon('arrow')}
                </button>
              ` : ''}
              <button class="primary get-rec-btn" data-action="get-recommendation" ${recommendationLoading || !hasAnyDiplotype ? 'disabled' : ''}>
                ${recommendationLoading ? '<span class="spinner"></span> Generating…' : `${icon('dna')} Get Recommendation ${icon('arrow')}`}
              </button>
            </div>
          </div>
          ${recommendationError ? `<div class="entry-error" style="margin-top:12px">${icon('warning')} ${escapeHtml(recommendationError)}</div>` : ''}
        </div>
        ` : ''}
      </div>
    </div>
  `
}

// ── Step 3: Dedicated Clinical Recommendation Workspace ───────────────────────
function recommendationStep(): string {
  if (!selectedPatient) {
    return `
      <div class="card" style="padding: 40px; text-align: center;">
        <div style="font-size: 32px; margin-bottom: 12px;">⚠️</div>
        <h3 style="font-size: 18px; margin-bottom: 8px;">No Patient Selected</h3>
        <p style="color: var(--text-muted); margin-bottom: 20px;">Please return to Step 1 to select or create a patient before reviewing recommendations.</p>
        <button class="primary" data-action="back-to-create">${icon('arrow')} Return to Step 1</button>
      </div>
    `
  }

  const genes = uniqueGenes()
  const recResults = recommendationResults
  const activeIndex = Math.min(selectedRecDrugIndex, Math.max(0, recResults.length - 1))
  const currentRec = recResults[activeIndex] || (recResults.length ? recResults[0] : null)

  return `
    <div class="rec-workspace-layout">
      <!-- Left Context Panel (Evidence Trail) -->
      <aside class="rec-left-context">
        <div class="rec-context-card">
          <div class="rec-context-header">
            <h3>Clinical Context</h3>
            <span class="rec-context-badge">Evidence Trail</span>
          </div>

          <!-- Section 1: Prescribed Medicines -->
          <div class="rec-context-sec ${leftContextCollapsed.medicines ? 'collapsed' : ''}">
            <button class="rec-context-sec-title" data-action="toggle-left-sec" data-sec="medicines" type="button">
              <span>PRESCRIBED MEDICINES</span>
              <span class="rec-collapse-arrow">${icon('chevron')}</span>
            </button>
            <div class="rec-context-sec-content">
              ${items.length ? items.map(item => `
                <div class="rec-context-med-item">
                  <strong>${escapeHtml(item.name)}</strong>
                  <small>${escapeHtml(item.strength)} · ${escapeHtml(item.dosage || 'Dosage pending')} ${escapeHtml(item.frequency || '')}</small>
                </div>
              `).join('') : '<div class="rec-none-text">No medicines listed</div>'}
            </div>
          </div>

          <!-- Section 2: Affected Genes -->
          <div class="rec-context-sec ${leftContextCollapsed.genes ? 'collapsed' : ''}">
            <button class="rec-context-sec-title" data-action="toggle-left-sec" data-sec="genes" type="button">
              <span>AFFECTED GENES</span>
              <span class="rec-collapse-arrow">${icon('chevron')}</span>
            </button>
            <div class="rec-context-sec-content">
              <div class="rec-gene-tags">
                ${genes.length ? genes.map(g => `<span class="gene-chip">${escapeHtml(g)}</span>`).join('') : '<span class="rec-none-text">No genes identified</span>'}
              </div>
            </div>
          </div>

          <!-- Section 3: Genetic Results -->
          <div class="rec-context-sec ${leftContextCollapsed.results ? 'collapsed' : ''}">
            <button class="rec-context-sec-title" data-action="toggle-left-sec" data-sec="results" type="button">
              <span>GENETIC RESULTS</span>
              <span class="rec-collapse-arrow">${icon('chevron')}</span>
            </button>
            <div class="rec-context-sec-content">
              ${genes.length ? genes.map(gene => {
                const dip = (diplotypeInputs[gene] ?? '').trim()
                const phenoObj = currentRec?.phenotypes?.[gene]
                const pheno = phenoObj?.phenotypeName
                return `
                  <div class="rec-context-result-item">
                    <div class="rec-context-result-gene">
                      <span class="gene-chip">${escapeHtml(gene)}</span>
                      <code class="rec-dip-val">${escapeHtml(dip || 'Not entered')}</code>
                    </div>
                    ${pheno ? `<div class="rec-pheno-val">${escapeHtml(pheno)}</div>` : ''}
                  </div>
                `
              }).join('') : '<div class="rec-none-text">No genetic results entered</div>'}
              ${ocrExtractedLines.length ? `<div class="rec-ocr-tag">${icon('flask')} Lab OCR Extracted</div>` : ''}
            </div>
          </div>

        </div>
      </aside>

      <!-- Center Main Recommendation Workspace -->
      <main class="rec-center-main">

        <!-- Patient Identity Banner -->
        <div class="rec-patient-banner">
          <div class="rec-patient-avatar">${escapeHtml(getInitials(selectedPatient.full_name))}</div>
          <div class="rec-patient-info">
            <div class="rec-patient-name-line">
              <h2 class="rec-patient-name">${escapeHtml(selectedPatient.full_name)}</h2>
              <span class="rec-patient-id">P${String(selectedPatient.patient_id).padStart(5, '0')}</span>
            </div>
            <div class="rec-patient-meta-line">
              <span>DOB: ${formatDob(selectedPatient.dob)}</span>
              <span class="dot-sep">•</span>
              <span>Sex: ${escapeHtml(selectedPatient.sex)}</span>
            </div>
          </div>
        </div>

        <!-- Multiple Medicine Selector Tabs -->
        ${recResults.length > 1 ? `
          <div class="rec-medicine-tabs" role="tablist">
            ${recResults.map((r, i) => `
              <button
                class="rec-med-tab ${i === activeIndex ? 'active' : ''}"
                data-action="select-rec-tab"
                data-index="${i}"
                role="tab"
                type="button"
                aria-selected="${i === activeIndex ? 'true' : 'false'}"
              >
                <span class="tab-drug-name">${escapeHtml(r.genericName ?? r.drugName)}</span>
                ${r.recommendation ? `<span class="tab-dot tab-dot--active"></span>` : `<span class="tab-dot tab-dot--muted"></span>`}
              </button>
            `).join('')}
          </div>
        ` : ''}

        <!-- Center Recommendation Card Content -->
        ${renderCenterRecommendationContent(currentRec)}

        <!-- Bottom Action Bar -->
        <footer class="rec-action-footer">
          <button class="secondary" data-action="back-to-genetics" type="button">
            ${icon('arrow')} Back to Genetic Results
          </button>
          
          <div class="rec-action-right">
            ${currentRec && currentRec.found && currentRec.recommendation ? `
              ${saveState[currentRec.drugName]?.saved
                ? `<span class="rc-saved-badge">${icon('check')} Recommendation Saved</span>`
                : `<button class="primary" data-action="save-recommendation" data-drug="${escapeAttr(currentRec.drugName)}" ${saveState[currentRec.drugName]?.loading ? 'disabled' : ''} type="button">
                    ${saveState[currentRec.drugName]?.loading ? '<span class="spinner"></span> Saving...' : `${icon('check')} Save Recommendation`}
                  </button>`
              }
            ` : ''}
          </div>
        </footer>

      </main>
    </div>
  `
}

function renderCenterRecommendationContent(res: RecommendationResult | null): string {
  if (!res) {
    return `
      <div class="rec-main-card rec-main-card--status-gray">
        <div class="empty-prescription">
          <span>${icon('flask')}</span>
          <h3>No Recommendation Available</h3>
          <p>Please enter diplotype results on Step 2 and click "Get Recommendation".</p>
        </div>
      </div>
    `
  }

  const drugTitle = escapeHtml(res.genericName ?? res.drugName)
  const isFound = res.found
  const rec = res.recommendation
  const missing = res.missingGeneData ?? []
  const phenotypes = res.phenotypes ?? {}
  const phenotypeEntries = Object.entries(phenotypes)
  const safetyList = res.drugSafetyStatus ?? []

  // Determine status classification and styling
  let statusBadgeText = 'No CPIC data available'
  let statusClass = 'status-gray'
  let statusIcon = icon('warning')

  if (!isFound || !rec) {
    statusBadgeText = missing.length ? 'Insufficient genetic info' : 'No CPIC data available'
    statusClass = 'status-gray'
    statusIcon = icon('warning')
  } else {
    // Has recommendation
    const hasAlternate = safetyList.some(s => s.status === 'alternate_found')
    const hasRisk = safetyList.some(s => s.status === 'no_alternative_documented')
    const cpicTest = suggestedTests.find(t => t.drugName === res.genericName || t.drugName === res.drugName)
    const cpicLevel = cpicTest?.cpicLevel

    if (hasAlternate) {
      statusBadgeText = 'Alternative recommended'
      statusClass = 'status-blue'
      statusIcon = icon('info')
    } else if (hasRisk) {
      statusBadgeText = 'Actionable PGx result'
      statusClass = 'status-amber'
      statusIcon = icon('warning')
    } else if (cpicLevel === 'A' || cpicLevel === 'B') {
      statusBadgeText = 'Actionable PGx result'
      statusClass = 'status-green'
      statusIcon = icon('check')
    } else {
      statusBadgeText = 'Guidance available'
      statusClass = 'status-blue'
      statusIcon = icon('check')
    }
  }

  // Phenotype headline string e.g. "CYP2C19 · Poor Metabolizer"
  const phenotypeHeadline = phenotypeEntries.length
    ? phenotypeEntries.map(([gene, ph]) => `${gene} · ${ph.phenotypeName}`).join(' | ')
    : 'Pharmacogenomic Recommendation'

  return `
    <div class="rec-main-card rec-main-card--${statusClass}">
      <!-- Header: Drug Name + Status -->
      <div class="rec-card-header">
        <div class="rec-drug-header-info">
          <span class="rec-drug-label">PRESCRIBED DRUG</span>
          <h2 class="rec-drug-title">${drugTitle}</h2>
          <span class="rec-gene-finding">${escapeHtml(phenotypeHeadline)}</span>
        </div>
        <div class="rec-status-badge ${statusClass}">
          ${statusIcon}
          <span>${escapeHtml(statusBadgeText)}</span>
        </div>
      </div>

      <!-- Phenotype pill strip -->
      ${phenotypeEntries.length ? `
        <div class="rec-pheno-strip">
          ${phenotypeEntries.map(([gene, ph]) => {
            const dip = escapeHtml(diplotypeInputs[gene] ?? '—')
            return `
              <div class="rec-pheno-tag">
                <span class="rec-pheno-gene">${escapeHtml(gene)}</span>
                <code class="rec-pheno-dip">${dip}</code>
                <span class="rec-pheno-name">${escapeHtml(ph.phenotypeName)}</span>
              </div>
            `
          }).join('')}
        </div>
      ` : ''}

      <!-- Primary Recommendation Box -->
      <div class="rec-primary-box">
        <div class="rec-primary-label">
          ${icon('dna')}
          <span>PRIMARY RECOMMENDATION</span>
        </div>
        ${rec ? `
          <div class="rec-primary-text">
            ${escapeHtml(rec.drugRecommendation)}
          </div>
        ` : `
          <div class="rec-primary-text rec-primary-text--empty">
            ${isFound
              ? 'No applicable CPIC recommendation was returned for the available genetic information.'
              : escapeHtml(res.reason ?? 'No CPIC pharmacogenomic recommendation available.')
            }
          </div>
        `}
      </div>

      <!-- Missing diplotypes alert if applicable -->
      ${!rec && missing.length ? `
        <div class="rec-alert-box rec-alert-box--amber">
          ${icon('warning')}
          <div>
            <strong>Missing Diplotype Data</strong>
            <p>Additional diplotypes needed for a complete recommendation: ${missing.map(g => `<span class="gene-chip">${escapeHtml(g)}</span>`).join(' ')}</p>
          </div>
        </div>
      ` : ''}

      <!-- Rationale Section -->
      ${(rec?.comments || rec?.implications) ? `
        <div class="rec-section-block">
          <h3 class="rec-section-title">Why this recommendation?</h3>
          <div class="rec-section-body">
            ${rec.comments ? `<p>${escapeHtml(rec.comments)}</p>` : ''}
            ${rec.implications ? `<p><strong>Clinical Implications:</strong> ${escapeHtml(String(rec.implications))}</p>` : ''}
          </div>
        </div>
      ` : ''}

      <!-- Alternative Therapy Section -->
      ${safetyList.length ? `
        <div class="rec-section-block">
          <h3 class="rec-section-title">Alternative Therapy & Safety Assessment</h3>
          <div class="rec-alt-list">
            ${safetyList.map(s => {
              if (s.status === 'alternate_found' && s.alternativeDrugGeneric) {
                return `
                  <div class="rec-alt-card rec-alt-card--found">
                    <div class="rec-alt-head">
                      <span class="rec-alt-badge">${icon('check')} Recommended Alternative</span>
                      <strong class="rec-alt-name">${escapeHtml(s.alternativeDrugGeneric)}</strong>
                    </div>
                    <div class="rec-alt-meta">
                      <span>Gene: <strong>${escapeHtml(s.geneSymbol)}</strong> (${escapeHtml(s.phenotypeName)})</span>
                    </div>
                    ${s.rationale ? `<div class="rec-alt-rationale"><p>${escapeHtml(s.rationale)}</p></div>` : ''}
                    ${s.guidelineTitle ? `<div class="rec-alt-guide"><small>Guideline: ${escapeHtml(s.guidelineTitle)}</small></div>` : ''}
                  </div>
                `
              }
              if (s.status === 'no_alternative_documented') {
                return `
                  <div class="rec-alt-card rec-alt-card--warning">
                    <div class="rec-alt-head">
                      <span class="rec-alt-badge warning">${icon('warning')} Risk Identified</span>
                      <strong class="rec-alt-name">Use Caution / Consult Guidelines</strong>
                    </div>
                    <div class="rec-alt-meta">
                      <span>Gene: <strong>${escapeHtml(s.geneSymbol)}</strong> (${escapeHtml(s.phenotypeName)})</span>
                    </div>
                    <p class="rec-alt-text">Specific alternative therapy is not documented in CPIC for this phenotype. Close clinical monitoring is advised.</p>
                  </div>
                `
              }
              return ''
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Guideline & Evidence Section -->
      <div class="rec-section-block rec-section-block--evidence">
        <h3 class="rec-section-title">Guideline & Evidence</h3>
        <div class="rec-evidence-row">
          <div class="rec-evidence-info">
            <span class="rec-evidence-source">CPIC Guidelines</span>
            <span class="rec-evidence-title">${escapeHtml(rec?.guidelineTitle ?? 'Clinical Pharmacogenetics Implementation Consortium')}</span>
          </div>
          ${rec?.guidelineTitle ? `<span class="rec-evidence-check">${icon('check')} Level A Evidence</span>` : ''}
        </div>
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

// ── DOM sync helpers ───────────────────────────────────────────────────────────

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
  if (!selectedPatient) {
    submitError = 'Please search and select a patient before continuing.'
    render()
    return
  }
  submitting = true; submitError = ''; render()

  const payload = {
    prescriptionId: `draft-${Date.now()}`,
    prescribedAt: new Date().toISOString(),
    patientId: selectedPatient.patient_id,
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
    const body = (await response.json()) as { suggestedTests?: unknown; prescription_id?: number | string }
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
  document.querySelectorAll<HTMLInputElement>('[data-action="diplotype-input"][data-gene]')
    .forEach(el => {
      const gene = el.dataset.gene
      if (gene && el.value.trim()) diplotypeInputs[gene] = el.value.trim()
    })

  const drugNames = uniqueDrugNames()
  console.log('[RECOMMENDATIONS] Fetching for drugNames =', drugNames)
  console.log('[RECOMMENDATIONS] Current diplotypeInputs =', diplotypeInputs)

  if (drugNames.length === 0) {
    console.warn('[RECOMMENDATIONS] No drug names found for recommendation lookup.')
    recommendationError = 'No medicines found in prescription to look up recommendations.'
    render()
    return
  }

  recommendationLoading = true
  recommendationError = ''
  recommendationResults = []
  render()

  try {
    const results = await Promise.all(
      drugNames.map(async drugName => {
        const diplotypes = genesForDrug(drugName)
          .filter(g => (diplotypeInputs[g] ?? '').trim())
          .map(g => ({ geneSymbol: g, diplotypeName: diplotypeInputs[g].trim() }))

        console.log(`[RECOMMENDATIONS] Calling POST /api/gene-recommendation for '${drugName}' with diplotypes:`, diplotypes)

        try {
          const response = await fetch(GENE_RECOMMENDATION_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              drugName,
              diplotypes,
              patientId: selectedPatient?.patient_id ?? null,
              enteredByDoctorId: currentHCP?.id ?? null,
            }),
          })
          console.log(`[RECOMMENDATIONS] Response status for '${drugName}':`, response.status)

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
          console.log(`[RECOMMENDATIONS] Received result for '${drugName}':`, body)
          return { ...body, drugName }
        } catch (error) {
          console.error(`[RECOMMENDATIONS] Fetch error for '${drugName}':`, error)
          return { drugName, found: false, reason: error instanceof Error ? error.message : 'Network error.' } as RecommendationResult
        }
      })
    )
    console.log('[RECOMMENDATIONS] All results received =', results)
    recommendationResults = results
    selectedRecDrugIndex = 0
    step = 3
  } catch (error) {
    console.error('[RECOMMENDATIONS] Error in getRecommendation =', error)
    recommendationError = error instanceof Error ? error.message : 'Could not fetch recommendations.'
  } finally {
    recommendationLoading = false
    render()
  }
}

async function saveRecommendation(drugName: string) {
  const existing = recommendationResults.find(r => r.drugName === drugName)
  if (!existing?.found || !existing.recommendation) return

  if (!selectedPatient) {
    saveState[drugName] = { loading: false, saved: false, error: 'Please select a patient first.', savedIds: null }
    render()
    return
  }

  saveState[drugName] = { loading: true, saved: false, error: '', savedIds: null }; render()

  const diplotypes = genesForDrug(drugName)
    .filter(g => (diplotypeInputs[g] ?? '').trim())
    .map(g => ({ geneSymbol: g, diplotypeName: diplotypeInputs[g].trim() }))

  try {
    // 1. Ensure prescription header & items are transactionally persisted to database if not already saved
    if (!savedPrescriptionId) {
      console.log('[PRESCRIPTION SAVE] sending final prescription')
      console.log('[PRESCRIPTION SAVE] patient_id =', selectedPatient.patient_id)
      console.log('[PRESCRIPTION SAVE] persist = true')
      console.log('[PRESCRIPTION SAVE] items =', items)

      const rxPayload = {
        patientId: selectedPatient.patient_id,
        persist: true,
        prescribedDrugs: items.map(item => ({
          drugId: item.id, drugName: item.name, strength: item.strength,
          generics: item.generics, selectedGeneric: item.selectedGeneric,
          dosage: item.dosage, frequency: item.frequency,
          durationDays: Number(item.duration), note: item.note,
        })),
      }
      const rxRes = await fetch(PRESCRIPTION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'include',
        body: JSON.stringify(rxPayload),
      })
      if (rxRes.ok) {
        const rxBody = (await rxRes.json().catch(() => ({}))) as { prescription_id?: number | string }
        console.log('[PRESCRIPTION SAVE] response prescription_id =', rxBody.prescription_id)
        if (rxBody.prescription_id) {
          savedPrescriptionId = rxBody.prescription_id
        }
      } else {
        console.error('[PRESCRIPTION SAVE] POST /api/prescriptions failed status =', rxRes.status)
      }
    }

    // 2. Persist PGx test result and risk assessment audit log
    const response = await fetch(GENE_RECOMMENDATION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        drugName,
        diplotypes,
        patientId: selectedPatient.patient_id,
        enteredByDoctorId: currentHCP?.id ?? null,
        persist: true,
      }),
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

  item[field] = target.value

  // Update specific drug form's completion badge & hint without full page re-render
  const formEl = target.closest('.drug-form')
  if (formEl) {
    const statusEl = formEl.querySelector('.detail-status')
    const helpEl = formEl.querySelector<HTMLElement>('.field-help')
    const complete = isComplete(item)
    if (statusEl) {
      statusEl.className = `detail-status ${complete ? 'complete' : ''}`
      statusEl.innerHTML = complete ? `${icon('check')} Complete` : 'Details needed'
    }
    if (helpEl) {
      helpEl.style.display = complete ? 'none' : 'block'
    }
  }

  // Update completion note & submit button state live
  const completionNote = document.querySelector('.completion-note')
  if (completionNote) {
    completionNote.textContent = allComplete()
      ? 'All treatment details are complete.'
      : items.length
      ? 'Complete dosage, frequency, and duration for each medicine.'
      : 'Add at least one medicine to continue.'
  }

  syncUploadState()
}

// ── Event listeners ────────────────────────────────────────────────────────────
app.addEventListener('input', event => {
  const target = event.target as HTMLInputElement | HTMLSelectElement | null
  if (!target) return

  if (target.id === 'patient-search-input') {
    patientSearchQuery = target.value
    void searchPatients(patientSearchQuery)
    return
  }

  if (target.id === 'drug-search') {
    query = target.value
    syncSearchSuggestions()
    const gridWrap = document.querySelector('.catalogue-grid-wrap')
    if (gridWrap) {
      const catalogue = getCatalogueDrugs(query, CATALOG_LIMIT)
      gridWrap.innerHTML = renderCatalogue(catalogue)
    }
    return
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

app.addEventListener('submit', event => {
  const target = event.target as HTMLFormElement | null
  if (target?.id === 'create-patient-form') {
    event.preventDefault()
    const fnEl = document.querySelector<HTMLInputElement>('#patient-full-name')
    const dobEl = document.querySelector<HTMLInputElement>('#patient-dob')
    const sexEl = document.querySelector<HTMLSelectElement>('#patient-sex')
    const fn = (fnEl?.value ?? '').trim()
    const dob = (dobEl?.value ?? '').trim()
    const sex = (sexEl?.value ?? '').trim()
    void submitCreatePatient(fn, dob, sex)
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

  if (action === 'open-create-patient-modal') {
    console.log('[PATIENT MODAL] Add New Patient clicked')
    showCreatePatientModal = true
    createPatientError = ''
    render()
    console.log('[PATIENT MODAL] modal opened')
    return
  }

  if (action === 'close-modal-backdrop') {
    if (target === actionEl) {
      console.log('[PATIENT MODAL] backdrop clicked -> closing modal')
      showCreatePatientModal = false
      createPatientError = ''
      render()
    }
    return
  }

  if (action === 'close-create-patient-modal') {
    console.log('[PATIENT MODAL] close / cancel clicked -> closing modal')
    showCreatePatientModal = false
    createPatientError = ''
    render()
    return
  }

  if (action === 'submit-create-patient') {
    const fnEl = document.querySelector<HTMLInputElement>('#patient-full-name')
    const dobEl = document.querySelector<HTMLInputElement>('#patient-dob')
    const sexEl = document.querySelector<HTMLSelectElement>('#patient-sex')
    const fn = (fnEl?.value ?? '').trim()
    const dob = (dobEl?.value ?? '').trim()
    const sex = (sexEl?.value ?? '').trim()
    void submitCreatePatient(fn, dob, sex)
    return
  }

  if (action === 'select-patient') {
    const patientIdStr = actionEl?.dataset.patientId
    if (patientIdStr) {
      const pId = parseInt(patientIdStr, 10)
      const match = patientSearchResults.find(p => p.patient_id === pId)
      if (match) {
        selectedPatient = match
        patientSearchQuery = ''
        patientSearchResults = []
        render()
      }
    }
    return
  }

  if (action === 'change-patient') {
    selectedPatient = null
    patientSearchQuery = ''
    patientSearchResults = []
    render()
    return
  }

  if (action === 'set-auth-mode') {
    const mode = actionEl?.dataset.mode as 'signin' | 'register' | undefined
    if (mode && mode !== authMode) {
      authMode = mode
      authError = ''
      render()
    }
    return
  }

  if (action === 'toggle-copilot-panel') {
    copilotCollapsed = !copilotCollapsed
    localStorage.setItem('genemeds-copilot-collapsed', String(copilotCollapsed))
    render()
    return
  }

  if (action === 'toggle-theme') {
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark')
    document.querySelectorAll<HTMLButtonElement>('.theme-toggle-btn').forEach(btn => {
      btn.title = `Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} theme`
      btn.innerHTML = currentTheme === 'dark' ? icon('sun') : icon('moon')
    })
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
  if (action === 'next-step' && submitted) { step = 2; render(); return }
  if (action === 'go-to-step') {
    const sNum = parseInt(actionEl?.dataset.stepNum ?? '1', 10)
    if (sNum === 1) { step = 1; render(); return }
    if (sNum === 2 && (step >= 2 || submitted)) { step = 2; render(); return }
    if (sNum === 3 && recommendationResults.length > 0) { step = 3; render(); return }
  }
  if (action === 'back-to-genetics') { step = 2; render(); return }
  if (action === 'select-rec-tab') {
    const idx = parseInt(actionEl?.dataset.index ?? '0', 10)
    selectedRecDrugIndex = idx
    render()
    return
  }
  if (action === 'toggle-left-sec') {
    const sec = actionEl?.dataset.sec
    if (sec && sec in leftContextCollapsed) {
      leftContextCollapsed[sec] = !leftContextCollapsed[sec]
      render()
    }
    return
  }

  if (action === 'new-prescription') {
    step = 1; submitted = false; items = []; submitError = ''; query = ''
    suggestedTests = []; diplotypeInputs = {}; labReportFile = null
    labExtractLoading = false; labExtractError = ''; ocrExtractedLines = []
    recommendationLoading = false; recommendationError = ''
    recommendationResults = []; saveState = {}; savedPrescriptionId = null
    render(); return
  }

  if (action === 'retry-load') { void loadDrugs(); return }
  if (action === 'extract-lab-report') { void extractLabReport(); return }
  if (action === 'get-recommendation') { void getRecommendation(); return }

  if (action === 'focus-search') {
    if (step !== 1) { step = 1; render() }
    window.setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('#drug-search')
      if (el) { el.focus(); el.select() }
    }, 50)
    return
  }

  if (action === 'save-recommendation') {
    const drugName = target?.closest<HTMLElement>('[data-drug]')?.dataset.drug ?? ''
    if (drugName) void saveRecommendation(drugName)
    return
  }
})

// Global keyboard shortcut (⌘K / Ctrl+K)
window.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    if (step !== 1) { step = 1; render() }
    window.setTimeout(() => {
      const el = document.querySelector<HTMLInputElement>('#drug-search')
      if (el) { el.focus(); el.select() }
    }, 50)
  }
})

void checkAuthSession()

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
