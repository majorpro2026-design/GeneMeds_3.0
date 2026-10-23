import { useMutation, useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, Dna, FlaskConical, Info, TriangleAlert, Upload, type LucideIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { useToast } from '../../components/Toast'
import type { VisitDetail } from '../../lib/doctorApi'
import { analyse, extractLab, fillDiplotypes, genesForDrug, recommendFor, saveRecord, type RecResult, type Safety, type SavedRx, type SuggestedTest } from '../../lib/rxApi'
import { ErrorBox } from '../admin/ui'

const GENE = 'inline-block rounded-full border border-[#F0ABFC] bg-[#FDF4FF] px-2.5 py-0.5 font-mono text-xs font-semibold text-gene'
const CPIC: Record<string, string> = { A: 'bg-green-100 text-green-800', B: 'bg-blue-100 text-blue-800', C: 'bg-amber-100 text-amber-800' }
const safeUrl = (u: string | null) => (u && /^https?:\/\//i.test(u) ? u : null)
const inputCls = 'h-10 min-w-0 flex-1 rounded-ctl border bg-white px-3 font-mono text-sm placeholder:text-muted focus:border-violet focus:outline-none focus:ring-[3px] focus:ring-violet/15'
const SHOWN_LEVELS = ['A', 'B']

type Tone = 'green' | 'amber' | 'blue' | 'gray'
const TONE: Record<Tone, { bar: string; chip: string; label: string }> = {
  green: { bar: 'bg-ok', chip: 'bg-green-100 text-green-800', label: 'Actionable' },
  amber: { bar: 'bg-warn', chip: 'bg-amber-100 text-amber-800', label: 'Guidance available' },
  blue: { bar: 'bg-info', chip: 'bg-blue-100 text-blue-800', label: 'Recommendation found' },
  gray: { bar: 'bg-slate-400', chip: 'bg-slate-100 text-slate-700', label: 'No CPIC data' },
}
const SAFETY: Record<Safety['status'], { box: string; icon: LucideIcon; ic: string; badge: string; label: string }> = {
  not_risky: { box: 'border-green-200 bg-green-50', icon: Check, ic: 'text-ok', badge: 'bg-green-100 text-green-800', label: 'Not risky' },
  alternate_found: { box: 'border-blue-200 bg-blue-50', icon: Info, ic: 'text-blue-600', badge: 'bg-blue-100 text-blue-800', label: 'CPIC guideline' },
  no_alternative_documented: { box: 'border-amber-200 bg-amber-50', icon: TriangleAlert, ic: 'text-warn', badge: 'bg-amber-100 text-amber-800', label: 'Review needed' },
  unknown: { box: 'border-line bg-lav-pale', icon: Info, ic: 'text-muted', badge: 'bg-slate-100 text-slate-700', label: 'Unknown' },
}
function toneOf(res: RecResult, tests: SuggestedTest[]): Tone {
  if (!res.found) return 'gray'
  if (!res.recommendation) return 'amber'
  const level = tests.find(t => t.drugName === res.genericName || t.drugName === res.drugName)?.cpicLevel
  return level === 'A' || level === 'B' ? 'green' : level === 'C' ? 'amber' : 'blue'
}

const SCALE = ['Poor', 'Intermediate', 'Normal', 'Rapid', 'Ultrarapid']
function PhenoScale({ name }: { name: string }) {
  const n = name.toLowerCase()
  const pos = n.includes('ultra') ? 4 : n.includes('poor') ? 0 : n.includes('intermediate') ? 1 : n.includes('rapid') ? 3 : n.includes('normal') ? 2 : -1
  if (pos < 0) return null
  return (
    <div className="flex w-full max-w-[200px] gap-0.5" role="img" aria-label={`Metabolizer scale: ${SCALE[pos]}`}>
      {SCALE.map((s, i) => <span key={s} title={s} className={`h-1.5 flex-1 rounded-full ${i === pos ? 'bg-gene' : 'bg-line'}`} />)}
    </div>
  )
}

function Section({ n, title, sub, children }: { n: string; title: string; sub: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-3">
        <span className="grid size-8 place-items-center rounded-full bg-lav-light font-heading text-xs font-extrabold text-violet">{n}</span>
        <div><h2 className="text-lg font-bold leading-tight">{title}</h2><p className="text-sm text-muted">{sub}</p></div>
      </div>
      {children}
    </section>
  )
}

export function GeneStep({ visit, rx, onBack, onNext }: { visit: VisitDetail; rx: SavedRx; onBack: () => void; onNext: () => void }) {
  const toast = useToast()
  const analysis = useQuery({ queryKey: ['doctor', 'analysis', rx.prescriptionId, rx.savedAt], queryFn: () => analyse(rx) })
  const allTests = analysis.data ?? []
  const tests = allTests.filter(t => SHOWN_LEVELS.includes((t.cpicLevel ?? '').trim().toUpperCase()))
  const hidden = allTests.length - tests.length
  const genes = [...new Set(tests.map(t => t.geneSymbol))]
  const drugs = [...new Set(tests.map(t => t.drugName).filter(Boolean))]

  const [dip, setDip] = useState<Record<string, string>>({})
  const [file, setFile] = useState<File | null>(null)
  const [lines, setLines] = useState<string[]>([])
  const [ocrError, setOcrError] = useState('')
  const [results, setResults] = useState<RecResult[]>([])
  const [saved, setSaved] = useState<Record<string, number | null>>({})

  const dipsFor = (drug: string) => genesForDrug(tests, drug).filter(g => dip[g]?.trim()).map(g => ({ geneSymbol: g, diplotypeName: dip[g].trim() }))
  const anyDip = genes.some(g => dip[g]?.trim())

  const ocr = useMutation({
    mutationFn: (f: File) => extractLab(f),
    onSuccess: l => { setLines(l); setDip(d => fillDiplotypes(genes, l, d)); setOcrError('') },
    onError: e => setOcrError(e instanceof Error ? e.message : 'Could not read the report.'),
  })
  const recommend = useMutation({
    mutationFn: () => Promise.all(drugs.map(d => recommendFor(d, dipsFor(d)))),
    onSuccess: r => { setResults(r); setSaved({}) },
  })
  const save = useMutation({
    mutationFn: (drug: string) => saveRecord(drug, dipsFor(drug), visit.patient.patientId),
    onSuccess: (r, drug) => {
      if (!r.savedRecordIds) { toast('Nothing to save: no complete recommendation for this medicine.', 'info'); return }
      setSaved(s => ({ ...s, [drug]: r.savedRecordIds?.resultIds?.[0] ?? null }))
      toast('Saved to the patient record.', 'success')
    },
    onError: e => toast(e instanceof Error ? e.message : 'Could not save.', 'error'),
  })

  function pick(f: File | undefined) {
    if (!f) return
    if (!['image/jpeg', 'image/png', 'image/tiff', 'image/webp'].includes(f.type)) { setOcrError('Choose a JPEG, PNG, TIFF or WebP image.'); return }
    if (f.size > 5 * 1024 * 1024) { setOcrError('The image is larger than 5 MB.'); return }
    setOcrError(''); setFile(f)
  }

  if (analysis.isPending) return <p role="status" className="py-10 text-center text-muted">Checking the CPIC gene-drug data…</p>
  if (analysis.isError) return <ErrorBox error={analysis.error} onRetry={() => void analysis.refetch()} />

  const nav = (
    <div className="flex justify-between">
      <Button variant="secondary" onClick={onBack}><ArrowLeft className="size-4" aria-hidden /> Edit prescription</Button>
      <Button onClick={onNext}>Continue to review <ArrowRight className="size-4" aria-hidden /></Button>
    </div>
  )
  if (tests.length === 0) {
  return (
    <div className="grid gap-5">
      <Card className="text-center"><Dna className="mx-auto mb-2 size-8 text-violet" aria-hidden />
        <p className="font-semibold text-navy">No Level A or B gene tests apply</p>
        <p className="text-sm text-muted">{hidden > 0 ? `${hidden} lower-level gene-drug pair${hidden === 1 ? ' is' : 's are'} not shown.` : 'None of these medicines has a CPIC gene-drug pair in the knowledge base.'}</p></Card>
      {nav}
    </div>
  )
}

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center gap-2 rounded-card bg-gradient-to-r from-navy to-violet p-4 text-white">
        <Dna className="size-5" aria-hidden /><strong className="font-heading">Prescription analysis</strong>
        <span className="ml-auto flex gap-2 text-xs font-bold">
          <span className="rounded-full bg-white/20 px-3 py-1">{drugs.length} drug{drugs.length === 1 ? '' : 's'}</span>
          <span className="rounded-full bg-white/20 px-3 py-1">{genes.length} gene{genes.length === 1 ? '' : 's'}</span>
        </span>
      </div>

      <Section n="01" title="Recommended gene tests" sub={`CPIC Level A and B only${hidden > 0 ? ` · ${hidden} lower-level pair${hidden === 1 ? '' : 's'} hidden` : ''}.`}>
        <div className="overflow-x-auto rounded-card border border-line bg-white shadow-card">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-lav-pale text-xs uppercase tracking-wide text-muted">
              <tr><th className="p-3">Drug</th><th className="p-3">Gene</th><th className="p-3">CPIC level</th><th className="p-3">Guideline</th></tr>
            </thead>
            <tbody>
              {tests.map((t, i) => {
                const url = safeUrl(t.guidelineUrl)
                return (
                  <tr key={i} className="border-t border-line">
                    <td className="p-3 font-semibold capitalize">{t.drugName || '—'}</td>
                    <td className="p-3"><span className={GENE}>{t.geneSymbol}</span></td>
                    <td className="p-3">{t.cpicLevel ? <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${CPIC[t.cpicLevel] ?? 'bg-slate-100 text-slate-700'}`}>Level {t.cpicLevel}</span> : '—'}</td>
                    <td className="p-3">{url && t.guidelineName ? <a href={url} target="_blank" rel="noreferrer" className="font-semibold text-violet underline underline-offset-2">{t.guidelineName}</a> : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section n="02" title="Enter gene test results" sub="Type each diplotype, or upload the lab report image to fill them in.">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h3 className="mb-3 flex items-center gap-2 font-semibold"><Dna className="size-4 text-gene" aria-hidden /> Manual entry</h3>
            <div className="grid gap-3">
              {genes.map(g => (
                <label key={g} className="flex items-center gap-3">
                  <span className={`${GENE} w-24 text-center`}>{g}</span>
                  <input aria-label={`Diplotype for ${g}`} value={dip[g] ?? ''} onChange={e => setDip(d => ({ ...d, [g]: e.target.value }))} placeholder="e.g. *1/*4" autoComplete="off" spellCheck={false}
                    className={`${inputCls} ${dip[g]?.trim() ? 'border-ok bg-green-50' : 'border-line'}`} />
                </label>
              ))}
            </div>
          </Card>
          <Card>
            <h3 className="mb-3 flex items-center gap-2 font-semibold"><Upload className="size-4 text-violet" aria-hidden /> Upload lab report</h3>
            <label htmlFor="lab-file" className="flex cursor-pointer flex-col items-center gap-1 rounded-card border-2 border-dashed border-lav p-5 text-center transition focus-within:border-violet hover:border-violet hover:bg-lav-pale">
              <Upload className="size-6 text-violet" aria-hidden />
              <span className="break-all text-sm font-semibold">{file ? file.name : 'Click to choose an image'}</span>
              <span className="text-xs text-muted">JPEG · PNG · TIFF · WebP · max 5 MB</span>
            </label>
            <input id="lab-file" type="file" accept="image/jpeg,image/png,image/tiff,image/webp" className="sr-only" onChange={e => pick(e.target.files?.[0])} />
            <Button className="mt-3" variant="secondary" disabled={!file} loading={ocr.isPending} onClick={() => file && ocr.mutate(file)}><FlaskConical className="size-4" aria-hidden /> Extract diplotypes</Button>
            {ocrError && <p role="alert" className="mt-2 text-sm text-err">{ocrError}</p>}
            {lines.length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-violet">View extracted text ({lines.length} lines)</summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-ctl border border-line bg-lav-pale p-3 text-xs">{lines.join('\n')}</pre></details>}
            <p className="mt-3 text-xs text-muted">Extraction uses an AI model. Always check the filled values against the report.</p>
          </Card>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-lav-pale p-4">
          <span className="text-sm text-muted">{anyDip ? 'Ready. Genes left empty are listed as missing in the result.' : 'Enter at least one diplotype to get a recommendation.'}</span>
          <Button disabled={!anyDip} loading={recommend.isPending} onClick={() => recommend.mutate()}><Dna className="size-4" aria-hidden /> Get recommendation</Button>
        </div>
      </Section>

      {results.length > 0 && (
        <Section n="03" title="Clinical recommendations" sub="CPIC-based guidance for each prescribed medicine.">
          <div className="grid gap-4">
           {results.map(r => <RecCard key={r.drugName} res={r} tone={toneOf(r, tests)} shown={genes} dip={dip} savedId={saved[r.drugName]} saving={save.isPending && save.variables === r.drugName} onSave={() => save.mutate(r.drugName)} />)}
          </div>
          <p className="mt-4 flex items-start gap-2 rounded-card border border-line bg-lav-pale p-3 text-xs text-muted">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> Decision support only. These recommendations come from CPIC guidelines. Apply your clinical judgement before acting on any of them.
          </p>
        </Section>
      )}
      {nav}
    </div>
  )
}

function RecCard({ res, tone, shown, dip, savedId, saving, onSave }: { res: RecResult; tone: Tone; shown: string[]; dip: Record<string, string>; savedId: number | null | undefined; saving: boolean; onSave: () => void }) {
  const t = TONE[tone]
  const rec = res.recommendation
  const isSaved = savedId !== undefined
  const missing = (res.missingGeneData ?? []).filter(g => shown.includes(g))
  return (
    <article className="relative overflow-hidden rounded-card border border-line bg-white shadow-card">
      <span className={`absolute inset-y-0 left-0 w-1 ${t.bar}`} aria-hidden />
      <header className="flex flex-wrap items-center justify-between gap-3 p-5 pl-6">
        <div>
          <h3 className="font-heading text-base font-bold capitalize text-navy">{res.genericName ?? res.drugName}</h3>
          <p className="text-xs text-muted">{res.found ? `Generic · ${res.drugName}` : (res.reason ?? 'No pharmacogenomic guideline found.')}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${rec ? t.chip : 'bg-amber-100 text-amber-800'}`}>{res.found ? (rec ? t.label : 'Incomplete data') : t.label}</span>
      </header>
      {res.found && (
        <>
          {Object.keys(res.phenotypes ?? {}).length > 0 && (
            <div className="grid gap-3 border-y border-line bg-lav-pale px-6 py-3 sm:grid-cols-2">
              {Object.entries(res.phenotypes ?? {}).map(([gene, ph]) => (
                <div key={gene} className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-sm"><span className={GENE}>{gene}</span><code className="rounded bg-white px-1.5 text-xs">{dip[gene] ?? '—'}</code><span className="font-semibold">{ph.phenotypeName}</span></div>
                  <PhenoScale name={ph.phenotypeName} />
                </div>
              ))}
            </div>
          )}
          {rec && <p className="mx-6 my-4 rounded-r-ctl border-l-[3px] border-info bg-blue-50 p-4 text-sm leading-relaxed text-navy">{rec.drugRecommendation}</p>}
          {!rec && missing.length > 0 && (
            <p className="mx-6 my-4 flex flex-wrap items-center gap-2 rounded-ctl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <TriangleAlert className="size-4" aria-hidden /> Missing diplotypes for a full recommendation: {missing.map(g => <span key={g} className={GENE}>{g}</span>)}
            </p>
          )}
          {(res.drugSafetyStatus ?? []).length > 0 && (
            <div className="mx-6 mb-4 grid gap-2">
              <p className="text-xs font-bold uppercase tracking-wide text-muted">Drug safety assessment</p>
              {(res.drugSafetyStatus ?? []).map((s, i) => {
                const m = SAFETY[s.status]
                return (
                  <div key={i} className={`flex items-start gap-3 rounded-ctl border p-3 ${m.box}`}>
                    <m.icon className={`mt-0.5 size-4 shrink-0 ${m.ic}`} aria-hidden />
                    <div className="min-w-0 flex-1 text-sm">
                      <strong className="text-navy">
                        {s.status === 'not_risky' && 'No genetic concern'}
                        {s.status === 'alternate_found' && <>Consider alternate: <span className="capitalize text-blue-700">{s.alternativeDrugGeneric}</span></>}
                        {s.status === 'no_alternative_documented' && 'Risky — no specific alternate documented'}
                        {s.status === 'unknown' && 'No safety data available'}
                      </strong>
                      <span className="block text-xs text-muted">{s.geneSymbol} · {s.phenotypeName}</span>
                      {s.status === 'alternate_found' && s.rationale && <span className="mt-1 block text-xs">{s.rationale}</span>}
                      {s.status === 'no_alternative_documented' && <span className="mt-1 block text-xs">Consult the CPIC guideline before dispensing.</span>}
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${m.badge}`}>{m.label}</span>
                  </div>
                )
              })}
            </div>
          )}
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-3">
            <span className="text-xs font-semibold text-ok">{rec?.guidelineTitle}</span>
            {rec && (isSaved
              ? <span className="inline-flex items-center gap-1.5 rounded-ctl bg-green-100 px-3 py-1.5 text-xs font-bold text-green-800"><Check className="size-4" aria-hidden /> Saved{savedId ? ` · record #${savedId}` : ''}</span>
              : <Button className="h-9" loading={saving} onClick={onSave}><Check className="size-4" aria-hidden /> Save to patient record</Button>)}
          </footer>
        </>
      )}
    </article>
  )
}