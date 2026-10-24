import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Check,
  Dna,
  FileText,
  Info,
  Pill,
  Printer,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { Logo } from '../../components/Logo'
import type { VisitDetail } from '../../lib/doctorApi'
import { age, type VisitStatus } from '../../lib/receptionApi'
import { analyse, type Safety, type SavedRx, type SuggestedTest } from '../../lib/rxApi'
import type { DiagnosticData } from './GeneStep'

const GENE_CHIP =
  'inline-block rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 font-mono text-xs font-semibold text-violet'

const CPIC_BADGE: Record<string, string> = {
  A: 'bg-green-100 text-green-800 border border-green-200',
  B: 'bg-blue-100 text-blue-800 border border-blue-200',
  C: 'bg-amber-100 text-amber-800 border border-amber-200',
}

const SAFETY_MAP: Record<
  Safety['status'],
  {
    box: string
    icon: LucideIcon
    ic: string
    badge: string
    title: string
  }
> = {
  not_risky: {
    box: 'border-green-200 bg-green-50/70 text-green-950',
    icon: ShieldCheck,
    ic: 'text-ok',
    badge: 'bg-green-100 text-green-800',
    title: 'Standard Therapeutic Response Expected',
  },
  alternate_found: {
    box: 'border-blue-200 bg-blue-50/90 text-blue-950',
    icon: Info,
    ic: 'text-blue-600',
    badge: 'bg-blue-100 text-blue-800 font-semibold',
    title: 'Alternate Therapy Recommended by CPIC',
  },
  no_alternative_documented: {
    box: 'border-amber-200 bg-amber-50/80 text-amber-950',
    icon: TriangleAlert,
    ic: 'text-warn',
    badge: 'bg-amber-100 text-amber-800 font-semibold',
    title: 'High Risk / Clinical Review Required',
  },
  unknown: {
    box: 'border-line bg-lav-pale/60 text-ink',
    icon: Info,
    ic: 'text-muted',
    badge: 'bg-slate-100 text-slate-700',
    title: 'Inconclusive / Unknown Risk',
  },
}

export function ReviewStep({
  visit,
  rx,
  doctorName,
  status,
  finishing,
  diagnosticData,
  onBack,
  onFinish,
}: {
  visit: VisitDetail
  rx: SavedRx | null
  doctorName: string
  status: VisitStatus
  finishing: boolean
  diagnosticData?: DiagnosticData
  onBack: () => void
  onFinish: () => void
}) {
  const p = visit.patient

  // Fallback query if page opened without prior GeneStep memory
  const analysis = useQuery({
    queryKey: ['doctor', 'analysis', rx?.prescriptionId, rx?.savedAt],
    queryFn: () => (rx ? analyse(rx) : Promise.resolve([])),
    enabled: (!diagnosticData?.tests || diagnosticData.tests.length === 0) && !!rx,
  })

  const tests: SuggestedTest[] =
    diagnosticData?.tests && diagnosticData.tests.length > 0
      ? diagnosticData.tests
      : (analysis.data?.filter(t => ['A', 'B'].includes((t.cpicLevel ?? '').trim().toUpperCase())) ?? [])

  const diplotypes = diagnosticData?.diplotypes ?? {}
  const results = diagnosticData?.results ?? []

  // Compile individual gene profiles from entered diplotypes and computed results
  const geneProfiles = Object.entries(diplotypes)
    .filter(([_, dipVal]) => Boolean(dipVal?.trim()))
    .map(([gene, dipVal]) => {
      let matchPheno: { phenotypeName: string; activityScore: string | null; description?: string } | undefined
      for (const r of results) {
        if (r.phenotypes && r.phenotypes[gene]) {
          matchPheno = r.phenotypes[gene]
          break
        }
      }
      return {
        gene,
        diplotype: dipVal,
        phenotypeName: matchPheno?.phenotypeName,
        activityScore: matchPheno?.activityScore,
        description: matchPheno?.description,
      }
    })

  const todayStr = new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="grid gap-6">
      {!rx ? (
        <Card className="text-center text-muted">No prescription was saved for this visit.</Card>
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-white shadow-card print:rounded-none print:border-0 print:shadow-none print:p-0">
          {/* Top Brand Accent Bar */}
          <div className="h-2 bg-gradient-to-r from-violet via-gene to-gold print:h-1.5" />

          {/* Report Master Header */}
          <div className="flex flex-wrap items-start justify-between gap-5 border-b border-line p-6 sm:p-8">
            <div className="flex items-center gap-4">
              <Logo size={42} />
              <div className="border-l border-line pl-4">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-violet">
                  Clinical Pharmacogenomics
                </span>
                <h2 className="font-heading text-lg font-bold text-navy sm:text-xl">
                  Diagnostic & Prescribing Report
                </h2>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs font-semibold text-muted">
                Visit Code: <span className="font-mono text-navy font-bold">{visit.visit.visitCode}</span>
              </p>
              <p className="text-xs text-muted">Consulting Physician: <strong className="text-navy">Dr. {doctorName}</strong></p>
              <p className="text-xs text-muted">Date: {todayStr}</p>
            </div>
          </div>

          <div className="space-y-8 p-6 sm:p-8">
            {/* ============================================================ */}
            {/* 0. PATIENT & CLINICAL DETAILS */}
            {/* ============================================================ */}
            <section className="rounded-card border border-line bg-lav-pale/40 p-5 print:bg-white print:border-slate-300">
              <div className="mb-3 flex items-center gap-2 border-b border-line pb-2 text-xs font-bold uppercase tracking-wider text-navy">
                <FileText className="size-4 text-violet" aria-hidden />
                <span>0. Patient & Encounter Details</span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
                <div>
                  <span className="block text-muted">Patient Full Name</span>
                  <strong className="text-sm font-bold text-navy">{p.fullName}</strong>
                </div>
                <div>
                  <span className="block text-muted">Patient Code / MRN</span>
                  <strong className="font-mono text-sm font-semibold text-violet">{p.patientCode}</strong>
                </div>
                <div>
                  <span className="block text-muted">Age / Biological Sex</span>
                  <span className="text-sm font-semibold text-navy">
                    {age(p.dob)} yrs · <span className="capitalize">{p.sex}</span>
                  </span>
                </div>
                <div>
                  <span className="block text-muted">Date of Birth</span>
                  <span className="text-sm font-semibold text-navy">{p.dob}</span>
                </div>
                <div>
                  <span className="block text-muted">Phone Number</span>
                  <span className="text-sm font-semibold text-navy">{p.phone}</span>
                </div>
                <div>
                  <span className="block text-muted">Reason for Consultation</span>
                  <span className="text-sm font-medium text-navy">{visit.visit.reason || 'General clinical consultation'}</span>
                </div>
                <div className="col-span-2 sm:col-span-2">
                  <span className="block text-muted">Clinical Diagnosis</span>
                  <strong className="text-sm font-bold text-navy">
                    {rx.diagnosis || 'Clinical evaluation and pharmacogenomic screening'}
                  </strong>
                </div>
              </div>
            </section>

            {/* ============================================================ */}
            {/* 1. PRESCRIBED DRUGS */}
            {/* ============================================================ */}
            <section className="print:break-inside-avoid">
              <div className="mb-3 flex items-center gap-2 border-b border-line pb-2 text-xs font-bold uppercase tracking-wider text-navy">
                <Pill className="size-4 text-violet" aria-hidden />
                <span>1. Prescribed Medications</span>
              </div>
              <div className="overflow-x-auto rounded-ctl border border-line">
                <table className="w-full min-w-[540px] text-left text-xs">
                  <thead className="bg-lav-pale/70 uppercase tracking-wide text-muted print:bg-slate-100">
                    <tr className="border-b border-line">
                      <th className="py-2.5 pl-4 pr-2 font-bold">#</th>
                      <th className="px-3 py-2.5 font-bold">Medication Name (Brand)</th>
                      <th className="px-3 py-2.5 font-bold">Generic Compound</th>
                      <th className="px-3 py-2.5 font-bold">Dosage</th>
                      <th className="px-3 py-2.5 font-bold">Frequency</th>
                      <th className="py-2.5 pl-3 pr-4 font-bold">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rx.items.map((it, i) => (
                      <tr key={i} className="hover:bg-lav-pale/20">
                        <td className="py-3 pl-4 pr-2 font-bold text-violet">{i + 1}</td>
                        <td className="px-3 py-3 font-semibold text-navy">{it.drugName}</td>
                        <td className="px-3 py-3 font-mono capitalize text-muted">{it.genericName || '—'}</td>
                        <td className="px-3 py-3 text-navy">{it.dosage}</td>
                        <td className="px-3 py-3 text-navy">{it.frequency}</td>
                        <td className="py-3 pl-3 pr-4 text-navy">{it.durationDays} days</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rx.notes && (
                <div className="mt-3 rounded-ctl border border-line bg-lav-pale/30 p-3 text-xs text-muted">
                  <strong className="text-navy">Physician Clinical Notes: </strong>
                  {rx.notes}
                </div>
              )}
            </section>

            {/* ============================================================ */}
            {/* 2. SELECTED GENES */}
            {/* ============================================================ */}
            <section className="print:break-inside-avoid">
              <div className="mb-3 flex items-center justify-between border-b border-line pb-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy">
                  <Dna className="size-4 text-violet" aria-hidden />
                  <span>2. Targeted Pharmacogenomic Screening (Selected Genes)</span>
                </div>
                <span className="text-[11px] text-muted">CPIC Level A & B Guidelines</span>
              </div>

              {tests.length === 0 ? (
                <div className="rounded-ctl border border-dashed border-line p-4 text-center text-xs text-muted">
                  No Level A or B CPIC gene-drug interactions identified for the prescribed medications.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-ctl border border-line">
                  <table className="w-full min-w-[540px] text-left text-xs">
                    <thead className="bg-lav-pale/70 uppercase tracking-wide text-muted print:bg-slate-100">
                      <tr className="border-b border-line">
                        <th className="py-2.5 pl-4 pr-2 font-bold">Prescribed Drug</th>
                        <th className="px-3 py-2.5 font-bold">Targeted Gene</th>
                        <th className="px-3 py-2.5 font-bold">CPIC Evidence Level</th>
                        <th className="py-2.5 pl-3 pr-4 font-bold">Clinical Guideline Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {tests.map((t, idx) => (
                        <tr key={idx} className="hover:bg-lav-pale/20">
                          <td className="py-2.5 pl-4 pr-2 font-semibold capitalize text-navy">{t.drugName || '—'}</td>
                          <td className="px-3 py-2.5">
                            <span className={GENE_CHIP}>{t.geneSymbol}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            {t.cpicLevel ? (
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                                  CPIC_BADGE[t.cpicLevel] ?? 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                Level {t.cpicLevel} ({t.cpicLevel === 'A' ? 'Strong Evidence' : 'Moderate Evidence'})
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-2.5 pl-3 pr-4 font-medium text-muted">
                            {t.guidelineName || 'CPIC Clinical Practice Guideline'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ============================================================ */}
            {/* 3. EXTRACTED DIPLOTYPES */}
            {/* ============================================================ */}
            <section className="print:break-inside-avoid">
              <div className="mb-3 flex items-center justify-between border-b border-line pb-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy">
                  <Dna className="size-4 text-gene" aria-hidden />
                  <span>3. Patient Laboratory Genomic Profile (Extracted Diplotypes)</span>
                </div>
                <span className="text-[11px] text-muted">Genotype to Phenotype Translation</span>
              </div>

              {geneProfiles.length === 0 ? (
                <div className="rounded-ctl border border-dashed border-line bg-lav-pale/20 p-4 text-center text-xs text-muted">
                  No patient diplotypes were recorded for this encounter. Diagnostic recommendations rely on standard therapeutic protocols.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-ctl border border-line">
                  <table className="w-full min-w-[540px] text-left text-xs">
                    <thead className="bg-lav-pale/70 uppercase tracking-wide text-muted print:bg-slate-100">
                      <tr className="border-b border-line">
                        <th className="py-2.5 pl-4 pr-2 font-bold">Gene Symbol</th>
                        <th className="px-3 py-2.5 font-bold">Patient Diplotype</th>
                        <th className="px-3 py-2.5 font-bold">Predicted Metabolizer Phenotype</th>
                        <th className="px-3 py-2.5 font-bold">Activity Score</th>
                        <th className="py-2.5 pl-3 pr-4 font-bold">Clinical Interpretation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {geneProfiles.map((gp, i) => (
                        <tr key={i} className="hover:bg-lav-pale/20">
                          <td className="py-3 pl-4 pr-2 font-bold">
                            <span className={GENE_CHIP}>{gp.gene}</span>
                          </td>
                          <td className="px-3 py-3 font-mono font-bold text-navy">{gp.diplotype}</td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center rounded-ctl bg-lav-light px-2.5 py-0.5 font-semibold text-violet">
                              {gp.phenotypeName || 'Phenotype translation available'}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-mono text-muted">{gp.activityScore ?? '—'}</td>
                          <td className="py-3 pl-3 pr-4 text-muted">
                            {gp.description ||
                              (gp.phenotypeName
                                ? `Classified as ${gp.phenotypeName}`
                                : 'Laboratory-verified patient allele')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* ============================================================ */}
            {/* 4. ALTERNATE RECOMMENDATIONS & SAFETY */}
            {/* ============================================================ */}
            <section className="print:break-inside-avoid">
              <div className="mb-3 flex items-center justify-between border-b border-line pb-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-navy">
                  <ShieldAlert className="size-4 text-violet" aria-hidden />
                  <span>4. Clinical Recommendations & Alternate Therapies</span>
                </div>
                <span className="text-[11px] text-muted">CPIC Actionable Guidance</span>
              </div>

              {results.length === 0 ? (
                <div className="rounded-ctl border border-dashed border-line p-4 text-center text-xs text-muted">
                  No automated CPIC guidance was generated. Please ensure diplotypes are entered in Step 2 to generate therapeutic recommendations.
                </div>
              ) : (
                <div className="grid gap-4">
                  {results.map((r, idx) => {
                    const rec = r.recommendation
                    const safetyList = r.drugSafetyStatus ?? []

                    return (
                      <article
                        key={idx}
                        className="rounded-ctl border border-line bg-white p-4 shadow-sm print:border-slate-300 print:shadow-none print:break-inside-avoid"
                      >
                        <header className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2">
                          <div>
                            <h4 className="font-heading text-sm font-bold capitalize text-navy">
                              {r.genericName ?? r.drugName}
                            </h4>
                            <span className="text-[11px] text-muted">
                              {r.found ? `Prescribed Formulation: ${r.drugName}` : (r.reason ?? 'No CPIC guidance found')}
                            </span>
                          </div>
                          {rec?.guidelineTitle && (
                            <span className="text-[11px] font-semibold text-violet">
                              {rec.guidelineTitle}
                            </span>
                          )}
                        </header>

                        {/* CPIC Drug Recommendation */}
                        {rec && (
                          <div className="mb-3 rounded-ctl border-l-4 border-violet bg-lav-pale/40 p-3.5 text-xs leading-relaxed text-navy print:border-violet print:bg-slate-50">
                            <strong className="block mb-1 text-violet font-bold">CPIC Therapeutic Guidance:</strong>
                            {rec.drugRecommendation}
                          </div>
                        )}

                        {/* Safety Evaluations & Alternate Drug Recommendations */}
                        {safetyList.length > 0 && (
                          <div className="grid gap-2">
                            {safetyList.map((s, sIdx) => {
                              const cfg = SAFETY_MAP[s.status]
                              const hasAlternate = s.status === 'alternate_found' && s.alternativeDrugGeneric

                              return (
                                <div
                                  key={sIdx}
                                  className={`rounded-ctl border p-3 ${cfg.box} print:border-slate-300`}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-2.5">
                                      <cfg.icon className={`mt-0.5 size-4 shrink-0 ${cfg.ic}`} aria-hidden />
                                      <div>
                                        <p className="font-bold text-xs">
                                          {cfg.title}
                                        </p>
                                        <p className="text-[11px] text-muted">
                                          Gene: <span className="font-semibold text-navy">{s.geneSymbol}</span> · Phenotype: <span className="font-semibold text-navy">{s.phenotypeName}</span>
                                        </p>

                                        {/* Highlight Alternate Drug if Available */}
                                        {hasAlternate && (
                                          <div className="mt-2 rounded-ctl border border-blue-300 bg-white p-2.5 text-xs text-navy print:border-blue-400">
                                            <div className="flex items-center gap-2">
                                              <span className="font-bold uppercase text-[10px] tracking-wide text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                                                Recommended Alternate
                                              </span>
                                              <span className="font-bold text-sm text-blue-900 capitalize">
                                                {s.alternativeDrugGeneric}
                                              </span>
                                            </div>
                                            {s.rationale && (
                                              <p className="mt-1 text-[11px] text-muted">
                                                <strong className="text-navy">Clinical Rationale: </strong>
                                                {s.rationale}
                                              </p>
                                            )}
                                          </div>
                                        )}

                                        {/* Rationale if risky with no alternate */}
                                        {s.status === 'no_alternative_documented' && (
                                          <p className="mt-1 text-[11px] text-amber-900">
                                            Consider clinical dose reduction or specialized drug monitoring as recommended by CPIC.
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.badge}`}>
                                      {s.status === 'alternate_found'
                                        ? 'Alternate Available'
                                        : s.status === 'not_risky'
                                        ? 'Normal Risk'
                                        : 'Action Required'}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            {/* ============================================================ */}
            {/* SIGN-OFF & CLINICAL GOVERNANCE */}
            {/* ============================================================ */}
            <div className="border-t border-line pt-6 print:break-inside-avoid">
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1">
                    Clinical Governance & Governance Notice
                  </h5>
                  <p className="text-[11px] leading-relaxed text-muted">
                    This diagnostic report is generated using peer-reviewed Clinical Pharmacogenetics Implementation
                    Consortium (CPIC) guidelines. These pharmacogenomic evaluations are intended to support, not replace,
                    clinical judgement. Therapeutic modifications should take into account patient history, renal and
                    hepatic function, and co-prescribed medications.
                  </p>
                </div>
                <div className="flex flex-col justify-end sm:items-end">
                  <div className="w-64 border-t-2 border-navy/70 pt-2 text-xs">
                    <p className="font-bold text-navy">Dr. {doctorName}</p>
                    <p className="text-[11px] text-muted">Licensed Physician · Clinical Pharmacogenomics Attestation</p>
                    <p className="text-[11px] text-muted">{todayStr}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Screen Controls & Print / PDF Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        {status === 'in_consultation' ? (
          <Button variant="secondary" onClick={onBack}>
            <ArrowLeft className="size-4" aria-hidden /> Back to Gene Analysis
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-3">
          {rx && (
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden /> Print / Save as PDF
            </Button>
          )}
          {status === 'in_consultation' && (
            <Button loading={finishing} onClick={onFinish}>
              <Check className="size-4" aria-hidden /> Complete Visit
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}