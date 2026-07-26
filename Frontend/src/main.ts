import './style.css'
import './catalogue.css'

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

const DRUG_ENDPOINT = import.meta.env.VITE_DRUGS_API_URL ?? '/api/drugs'

const PRESCRIPTION_ENDPOINT = import.meta.env.VITE_PRESCRIPTION_API_URL ?? '/api/prescriptions'
const FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'Every 6 hours', 'As needed']
const SUGGESTION_LIMIT = 6
const CATALOG_LIMIT = 18

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

const app = document.querySelector<HTMLDivElement>('#app')!

const icon = (name: 'plus' | 'search' | 'chevron' | 'trash' | 'check' | 'arrow' | 'refresh' | 'warning') => {
  const paths = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>',
    chevron: '<path d="m7 10 5 5 5-5"/>',
    trash: '<path d="M4 7h16M10 11v6m4-6v6M9 7l1-2h4l1 2m-9 0 1 13h10l1-13"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"/>',
    warning: '<path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/>',
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`
}

const geneLogo = `<svg class="gene-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#ffffff18" stroke-width="1.5" d="M24 4 39 10v11c0 10-6.2 18.2-15 23C15.2 39.2 9 31 9 21V10L24 4Z"/><path stroke="#d9efff" d="M17 14c8 0 6 20 14 20M31 14c-8 0-6 20-14 20M18 19h12M18 29h12"/><path stroke-width="2.3" d="M24 20v8m-4-4h8"/></svg>`

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeAttr(value: string) {
  return escapeHtml(value)
}

const isComplete = (item: PrescriptionDrug) => Boolean(item.dosage && item.frequency && item.duration)
const allComplete = () => items.length > 0 && items.every(isComplete)

function render() {
  app.innerHTML = `
    <main>
      <header>
        <a class="brand" href="#" aria-label="GeneMeds home">
          <span class="brand-mark">${geneLogo}</span>
          <span>Gene<span>Meds</span></span>
        </a>
        <div class="doctor">
          <span class="avatar">DR</span>
          <div><strong>Dr. Amelia Carter</strong><small>General Physician</small></div>
        </div>
      </header>

      <section class="page-heading">
        <div>
          <h1>${step === 1 ? 'Create a new prescription' : step === 2 ? 'Review drug & generic information' : 'Prescription complete'}</h1>
          <p>${step === 1 ? 'Add medicines and treatment directions for your patient.' : step === 2 ? 'Confirm the generic information for the prescribed medicines.' : 'Your prescription has been created and is ready to share.'}</p>
        </div>
        ${step < 3 ? `<div class="step-count">Step <strong>${step}</strong> of 3</div>` : ''}
      </section>

      ${stepper()}

      <div class="page-stage step-${step}">
        ${step === 1 ? createStep() : step === 2 ? reviewStep() : successStep()}
      </div>
    </main>
  `

  syncSearchSuggestions()
  syncUploadState()
}

function stepper() {
  const labels = ['Create prescription', 'Review drug info', 'Test recommendation']
  return `<nav class="stepper" aria-label="Prescription steps">${labels
    .map((label, index) => {
      const n = index + 1
      const state = n === step ? 'active' : n < step ? 'done' : ''
      return `<div class="step ${state}"><span class="step-number">${n < step ? icon('check') : n}</span><span>${label}</span></div>${n < 3 ? '<div class="step-line"></div>' : ''}`
    })
    .join('')}</nav>`
}

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

      ${
        items.length
          ? `<div class="drug-list">${items.map((item, index) => drugForm(item, index)).join('')}</div>`
          : emptyState()
      }

      ${submitError ? `<div class="submission-error">${escapeHtml(submitError)}</div>` : ''}

      <footer class="card-footer">
        <span class="completion-note">${allComplete() ? 'All treatment details are complete.' : items.length ? 'Complete dosage, frequency, and duration for each medicine.' : 'Add at least one medicine to continue.'}</span>
        <button class="primary" data-action="submit-prescription" ${allComplete() || submitting ? '' : 'disabled'}>${submitting ? '<span class="spinner"></span> Uploading...' : `Upload prescription ${icon('arrow')}`}</button>
      </footer>
    </section>
  `
}

function emptyState() {
  if (loadingDrugs) {
    return `<div class="empty-prescription"><span>${icon('refresh')}</span><h3>Loading medicines</h3><p>Fetching the drug catalog from the backend.</p></div>`
  }

  if (loadError) {
    return `<div class="empty-prescription"><span>${icon('warning')}</span><h3>Could not load medicines</h3><p>${escapeHtml(loadError)}</p><button class="secondary" data-action="retry-load">Retry</button></div>`
  }

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
        ${items
          .map(
            item => `
              <article class="table-row">
                <div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.strength)}</small></div>
                <div class="generic-tags">${item.generics.map(g => `<span>${escapeHtml(g)}</span>`).join('')}</div>
                <div class="selected">${icon('check')} ${escapeHtml(item.selectedGeneric)}</div>
                <div class="source">${escapeHtml(item.source)}</div>
              </article>
            `,
          )
          .join('')}
      </div>

      <footer class="card-footer">
        <button class="secondary" data-action="back-to-create">Back</button>
        <button class="primary" data-action="next-step">Continue to recommendations ${icon('arrow')}</button>
      </footer>
    </section>
  `
}

function successStep() {
  return `
    <section class="success-layout">
      <div class="success-card">
        <span class="success-icon">${icon('check')}</span>
        <p class="eyebrow">PRESCRIPTION SAVED</p>
        <p>Prescription saved successfully. You can now share it or create a new prescription.</p>
        <button class="primary" data-action="new-prescription">Create another prescription ${icon('plus')}</button>
      </div>

      <div class="card test-card">
        <div class="test-heading">
          <div>
            <span class="test-icon">+</span>
            <h2>Gene-test suggestions</h2>
            <p>Recommendations based on the selected genes linked to the prescribed medicines.</p>
          </div>
          <span class="recommendation">${icon('check')} Recommended</span>
        </div>
        <div class="test-list">
          ${
            suggestedTests.length
              ? suggestedTests
                  .map(
                    (test, index) => `
                <div class="test">
                  <span>${index + 1}</span>
                  <div>
                    <strong>${escapeHtml(test.title)}</strong>
                    <p>${escapeHtml(test.description)}</p>
                    <small>${escapeHtml(test.geneSymbol)}${test.cpicLevel ? ` · CPIC ${escapeHtml(test.cpicLevel)}` : ''}${test.clinpgxLevel ? ` · ClinPGx ${escapeHtml(test.clinpgxLevel)}` : ''}</small>
                    ${test.guidelineUrl ? `<a href="${escapeAttr(test.guidelineUrl)}" target="_blank" rel="noreferrer">Open guideline</a>` : ''}
                  </div>
                </div>
              `,
                  )
                  .join('')
              : '<div class="catalogue-empty">No gene-test recommendations were returned for this prescription.</div>'
          }
        </div>
        <p class="disclaimer">These recommendations come from the gene-drug pair table. Use your clinical judgement before ordering any test.</p>
      </div>
    </section>
  `
}

function syncSearchSuggestions() {
  const input = document.querySelector<HTMLInputElement>('#drug-search')
  if (input && input.value !== query) input.value = query

  const results = document.querySelector<HTMLElement>('#drug-results')
  const empty = document.querySelector<HTMLElement>('#drug-empty')
  if (!results || !empty) return

  if (!searchFocused) {
    results.innerHTML = ''
    results.style.display = 'none'
    empty.innerHTML = ''
    empty.style.display = 'none'
    return
  }

  const matches = findMatches(query)

  results.innerHTML = matches
    .map(
      drug => `
        <button class="result" data-action="add-drug" data-id="${drug.id}">
          <span class="result-plus">${icon('plus')}</span>
          <span><strong>${escapeHtml(drug.name)}</strong><small>${escapeHtml(drug.strength)}</small></span>
          <span class="add-label">Add</span>
        </button>
      `,
    )
    .join('')

  results.style.display = matches.length ? 'block' : 'none'
  empty.style.display = query.trim() && !matches.length ? 'block' : 'none'
  empty.textContent = query.trim() && !matches.length ? 'No medicines matched your search. Try a generic or brand name.' : ''
}

function syncUploadState() {
  const button = document.querySelector<HTMLButtonElement>('[data-action="submit-prescription"]')
  if (button) button.disabled = !allComplete() || submitting
}

function findMatches(term: string) {
  if (loadingDrugs) return []
  return getCatalogueDrugs(term, SUGGESTION_LIMIT)
}

function getCatalogueDrugs(term: string, limit: number) {
  const q = term.trim().toLowerCase()
  const available = drugs.filter(drug => !items.some(item => item.id === drug.id))

  const ranked = available
    .map(drug => {
      const names = [drug.name, ...drug.generics].map(value => value.toLowerCase())

      if (q && !names.some(name => name.includes(q))) {
        return null
      }

      const rank = q && names.some(name => name.startsWith(q)) ? 0 : 1
      return { drug, rank }
    })
    .filter((entry): entry is { drug: Drug; rank: number } => Boolean(entry))
    .sort((a, b) => a.rank - b.rank || a.drug.name.localeCompare(b.drug.name))
    .map(entry => entry.drug)

  return ranked.slice(0, limit)
}

function renderCatalogue(catalogue: Drug[]) {
  if (loadingDrugs) {
    return `
      <div class="catalogue-loading">
        <div class="bar" style="width:72%"></div>
        <div class="bar" style="width:88%"></div>
        <div class="bar" style="width:64%"></div>
      </div>
    `
  }

  if (loadError) {
    return `<div class="catalogue-empty">The drug catalogue could not be loaded yet.</div>`
  }

  if (!catalogue.length) {
    return `<div class="catalogue-empty">No medicines matched your search. Try a brand name or generic name.</div>`
  }

  return `
    <div class="catalogue-grid">
      ${catalogue
        .map(
          drug => `
            <article class="catalogue-card" data-action="add-drug" data-id="${drug.id}">
              <div>
                <strong>${escapeHtml(drug.name)}</strong>
                <small>${escapeHtml(drug.strength || 'Strength not listed')}</small>
                <div class="catalogue-meta">
                  ${drug.generics.map(g => `<span>${escapeHtml(g)}</span>`).join('')}
                </div>
              </div>
              <button class="secondary catalogue-add" data-action="add-drug" data-id="${drug.id}">Add medicine</button>
            </article>
          `,
        )
        .join('')}
    </div>
  `
}

function normalizeDrug(item: DrugApiItem, index: number): Drug | null {
  const idValue = item.id ?? item.drugId ?? `drug-${index + 1}`
  const id = String(idValue).trim()
  const name = (item.name ?? item.drugName ?? item.brandName ?? '').trim()
  const strength = (item.strength ?? item.dosageForm ?? item.presentation ?? '').trim()
  const generics = normalizeList(item.generics ?? item.genericNames ?? item.activeIngredients)
  const generic = (item.genericName ?? '').trim()
  const source = (item.source ?? item.sourceName ?? 'Backend catalog').trim()

  if (!id || !name) return null

  return {
    id,
    name,
    strength,
    generics: generics.length ? generics : generic ? [generic] : [name],
    source,
  }
}

function normalizeList(value: unknown) {
  return Array.isArray(value) ? value.map(v => String(v).trim()).filter(Boolean) : []
}

async function loadDrugs() {
  loadingDrugs = true
  loadError = ''
  render()

  try {
    const data = await fetchDrugCatalog()
    const list = extractList(data).map(normalizeDrug).filter((drug): drug is Drug => Boolean(drug))

    if (!list.length) {
      throw new Error('The backend returned an empty drug catalog.')
    }

    drugs = list
  } catch (error) {
    drugs = []
    loadError = error instanceof Error ? error.message : 'Could not load medicines.'
  } finally {
    loadingDrugs = false
    render()
  }
}

async function fetchDrugCatalog() {
  let lastError = 'Could not load medicines.'
  try {
    const response = await fetch(DRUG_ENDPOINT, { headers: { Accept: 'application/json' } })
    if (!response.ok) {
      throw new Error(`Drug catalog request failed with status ${response.status}`)
    }

    const text = await response.text()
    if (!text.trim()) {
      throw new Error('Drug catalog response was empty.')
    }

    return JSON.parse(text) as unknown
  } catch (error) {
    lastError = error instanceof Error ? error.message : lastError
  }

  throw new Error(lastError)
}

function extractList(body: unknown): DrugApiItem[] {
  if (Array.isArray(body)) return body as DrugApiItem[]
  if (!body || typeof body !== 'object') return []

  const payload = body as { data?: unknown; drugs?: unknown; items?: unknown }
  if (Array.isArray(payload.data)) return payload.data as DrugApiItem[]
  if (Array.isArray(payload.drugs)) return payload.drugs as DrugApiItem[]
  if (Array.isArray(payload.items)) return payload.items as DrugApiItem[]
  return []
}

async function submitPrescription() {
  if (!allComplete() || submitting) return

  submitting = true
  submitError = ''
  render()

  const payload = {
    prescriptionId: `draft-${Date.now()}`,
    prescribedAt: new Date().toISOString(),
    prescribedDrugs: items.map(item => ({
      drugId: item.id,
      drugName: item.name,
      strength: item.strength,
      generics: item.generics,
      selectedGeneric: item.selectedGeneric,
      dosage: item.dosage,
      frequency: item.frequency,
      durationDays: Number(item.duration),
      note: item.note,
    })),
  }

  try {
    const response = await fetch(PRESCRIPTION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Prescription upload failed with status ${response.status}`)
    }

    const body = (await response.json()) as { suggestedTests?: unknown }
    suggestedTests = extractSuggestedTests(body.suggestedTests)
    submitted = true
    step = 2
  } catch (error) {
    submitError = error instanceof Error ? error.message : 'Unexpected error while uploading the prescription.'
  } finally {
    submitting = false
    render()
  }
}

function syncDrugField(target: HTMLInputElement | HTMLSelectElement) {
  const id = target.dataset.id
  const item = items.find(entry => entry.id === id)
  const field = target.dataset.field as keyof Pick<PrescriptionDrug, 'dosage' | 'frequency' | 'duration' | 'note'> | undefined
  if (!item || !field) return

  const selectionStart = target instanceof HTMLInputElement ? target.selectionStart : null
  const selectionEnd = target instanceof HTMLInputElement ? target.selectionEnd : null

  item[field] = target.value
  render()

  const replacement = [...document.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-field]')].find(
    element => element.dataset.id === id && element.dataset.field === field,
  )
  if (!replacement) return

  replacement.focus()
  if (replacement instanceof HTMLInputElement && selectionStart !== null && selectionEnd !== null) {
    replacement.setSelectionRange(selectionStart, selectionEnd)
  }
}

app.addEventListener('input', event => {
  const target = event.target as HTMLInputElement | HTMLSelectElement | null
  if (!target) return

  if (target.id === 'drug-search') {
    query = target.value
    syncSearchSuggestions()
    return
  }

  if (target.matches('[data-field]')) {
    searchFocused = false
    syncDrugField(target)
  }
})

app.addEventListener('focusin', event => {
  const target = event.target as HTMLElement | null
  if (target?.id !== 'drug-search') return

  searchFocused = true
  syncSearchSuggestions()
})

app.addEventListener('focusout', event => {
  const target = event.target as HTMLElement | null
  if (target?.id !== 'drug-search') return

  window.setTimeout(() => {
    searchFocused = false
    syncSearchSuggestions()
  }, 150)
})

function addDrugToPrescription(id: string) {
  const drug = drugs.find(entry => entry.id === id)
  if (!drug) return false

  items = [...items, { ...drug, dosage: '', frequency: '', duration: '', note: '', selectedGeneric: drug.generics[0] ?? drug.name }]
  query = ''
  searchFocused = false
  render()
  return true
}

app.addEventListener('pointerdown', event => {
  const target = event.target as HTMLElement | null
  const result = target?.closest<HTMLElement>('#drug-results [data-action="add-drug"][data-id]')
  const id = result?.dataset.id
  if (!id) return

  event.preventDefault()
  addDrugToPrescription(id)
})

app.addEventListener('click', event => {
  const target = event.target as HTMLElement | null
  const action = target?.closest<HTMLElement>('[data-action]')?.dataset.action
  const id = target?.closest<HTMLElement>('[data-id]')?.dataset.id

  if (action === 'add-drug' && id) {
    addDrugToPrescription(id)
    return
  }

  if (action === 'remove-drug' && id) {
    items = items.filter(item => item.id !== id)
    render()
    return
  }

  if (action === 'clear-all') {
    items = []
    render()
    return
  }

  if (action === 'submit-prescription') {
    void submitPrescription()
    return
  }

  if (action === 'back-to-create') {
    step = 1
    render()
    return
  }

  if (action === 'next-step' && submitted) {
    step = 3
    render()
    return
  }

  if (action === 'new-prescription') {
    step = 1
    submitted = false
    items = []
    submitError = ''
    suggestedTests = []
    render()
    return
  }

  if (action === 'retry-load') {
    void loadDrugs()
  }
})

void loadDrugs()

function extractSuggestedTests(value: unknown): SuggestedTest[] {
  if (!Array.isArray(value)) return []

  return value
    .map(item => {
      if (!item || typeof item !== 'object') return null

      const entry = item as {
        title?: unknown
        description?: unknown
        geneSymbol?: unknown
        drugName?: unknown
        guidelineName?: unknown
        guidelineUrl?: unknown
        cpicLevel?: unknown
        clinpgxLevel?: unknown
        provisional?: unknown
      }

      const title = String(entry.title ?? '').trim()
      const description = String(entry.description ?? '').trim()
      const geneSymbol = String(entry.geneSymbol ?? '').trim()
      if (!title || !description || !geneSymbol) return null

      return {
        title,
        description,
        geneSymbol,
        drugName: String(entry.drugName ?? '').trim(),
        guidelineName: entry.guidelineName == null ? null : String(entry.guidelineName).trim() || null,
        guidelineUrl: entry.guidelineUrl == null ? null : String(entry.guidelineUrl).trim() || null,
        cpicLevel: entry.cpicLevel == null ? null : String(entry.cpicLevel).trim() || null,
        clinpgxLevel: entry.clinpgxLevel == null ? null : String(entry.clinpgxLevel).trim() || null,
        provisional: Boolean(entry.provisional),
      }
    })
    .filter((item): item is SuggestedTest => Boolean(item))
}
