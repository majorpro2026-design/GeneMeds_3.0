import { api, ApiError } from './api'

export type CatalogDrug = { drugId: string; drugName: string; genericName: string | null; generics: string[] }
export type RxItem = { drugName: string; genericName: string | null; dosage: string; frequency: string; durationDays: number }
export type SavedRx = { prescriptionId: number; notes: string | null; diagnosis: string | null; savedAt: string; items: RxItem[] }

export const saveRx = (visitId: number, body: { items: RxItem[]; notes: string; diagnosis: string }) =>
  api<{ prescriptionId: number }>(`/api/doctor/visits/${visitId}/prescription`, { method: 'PUT', body })

export type HistoryVisit = {
  visitId: number; visitCode: string; status: string; reason: string | null; createdAt: string
  prescription: { diagnosis: string | null; notes: string | null; savedAt: string; items: RxItem[] } | null
}
export const getHistory = (visitId: number) => api<{ items: HistoryVisit[] }>(`/api/doctor/visits/${visitId}/history`)
export type SuggestedTest = { geneSymbol: string; drugName: string; guidelineName: string | null; guidelineUrl: string | null; cpicLevel: string | null }
export type Phenotype = { phenotypeName: string; activityScore: string | null; description: string }
export type Safety = {
  geneSymbol: string; phenotypeName: string; activityScore: string | null
  status: 'alternate_found' | 'no_alternative_documented' | 'not_risky' | 'unknown'
  alternativeDrugGeneric: string | null; rationale: string | null
}
export type RecResult = {
  drugName: string; found: boolean; reason?: string; genericName?: string
  phenotypes?: Record<string, Phenotype>; missingGeneData?: string[]
  recommendation?: { drugRecommendation: string; guidelineTitle?: string } | null
  drugSafetyStatus?: Safety[]; savedRecordIds?: { resultIds: number[]; assessmentId: number | null }
}
export type ChatMsg = { role: 'user' | 'assistant'; content: string }
type Dip = { geneSymbol: string; diplotypeName: string }

export const FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'Every 6 hours', 'As needed']

export async function searchCatalog(q: string) {
  const r = await api<{ data: CatalogDrug[] }>(`/api/drugs?${new URLSearchParams({ q, limit: '12' })}`)
  return r.data
}
export const getRx = (visitId: number) => api<{ prescription: SavedRx | null }>(`/api/doctor/visits/${visitId}/prescription`)

export async function analyse(rx: SavedRx): Promise<SuggestedTest[]> {
  const res = await api<{ suggestedTests?: Record<string, unknown>[] }>('/api/prescriptions', {
    method: 'POST',
    body: {
      prescriptionId: `rx-${rx.prescriptionId}`,
      prescribedAt: rx.savedAt,
      prescribedDrugs: rx.items.map(i => ({
        drugName: i.drugName, selectedGeneric: i.genericName, generics: i.genericName ? [i.genericName] : [],
        dosage: i.dosage, frequency: i.frequency, durationDays: i.durationDays,
      })),
    },
  })
  const s = (v: unknown) => (v == null || String(v).trim() === '' ? null : String(v).trim())
  return (res.suggestedTests ?? []).filter(t => s(t.geneSymbol)).map(t => ({
    geneSymbol: String(t.geneSymbol).trim(), drugName: s(t.drugName) ?? '',
    guidelineName: s(t.guidelineName), guidelineUrl: s(t.guidelineUrl), cpicLevel: s(t.cpicLevel),
  }))
}

export async function recommendFor(drugName: string, diplotypes: Dip[]): Promise<RecResult> {
  try {
    const r = await api<RecResult>('/api/gene-recommendation', { method: 'POST', body: { drugName, diplotypes } })
    return { ...r, drugName }
  } catch (e) {
    return { drugName, found: false, reason: e instanceof Error ? e.message : 'Could not load this recommendation.' }
  }
}
export const saveRecord = (drugName: string, diplotypes: Dip[], patientId: number) =>
  api<RecResult>('/api/gene-recommendation', { method: 'POST', body: { drugName, diplotypes, patientId, persist: true } })

export function genesForDrug(tests: SuggestedTest[], drug: string) {
  return [...new Set(tests.filter(t => t.drugName === drug).map(t => t.geneSymbol))]
}

/** Finds "*4/*4"-style diplotypes near each gene name in OCR text; never overwrites typed values. */
export function fillDiplotypes(genes: string[], lines: string[], current: Record<string, string>) {
  const out = { ...current }
  const re = /(\*\d+(?:[a-z]\d*)?(?:x\d+)?\/\*\d+(?:[a-z]\d*)?(?:x\d+)?)/i
  for (const gene of genes) {
    if ((out[gene] ?? '').trim()) continue
    const geneRe = new RegExp(`\\b${gene.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    for (let i = 0; i < lines.length; i++) {
      if (!geneRe.test(lines[i])) continue
      const m = re.exec(lines.slice(i, i + 4).join(' '))
      if (m) { out[gene] = m[1]; break }
    }
  }
  return out
}

export async function extractLab(file: File): Promise<string[]> {
  const fd = new FormData()
  fd.append('file', file)
  let res: Response
  try { res = await fetch('/api/prescriptions/upload-extract', { method: 'POST', credentials: 'include', headers: { Accept: 'application/json' }, body: fd }) }
  catch { throw new ApiError('Cannot reach the server. Check your connection.', 0) }
  const data = (await res.json().catch(() => ({}))) as { detail?: unknown; rawText?: { text: string }[] }
  if (!res.ok) throw new ApiError(typeof data.detail === 'string' ? data.detail : 'Could not read the report.', res.status)
  return (data.rawText ?? []).map(l => l.text)
}

export async function sendChat(messages: ChatMsg[], drugs: string[]) {
  const r = await api<{ reply?: string }>('/api/chat', { method: 'POST', body: { messages: messages.slice(-20), context: { drugs } } })
  return r.reply ?? ''
}