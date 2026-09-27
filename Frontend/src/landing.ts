export type LandingPageOptions = {
  currentHCP: { fullName: string; registrationNumber: string } | null
  geneLogo: string
}

export function initTheme() {
  const saved = localStorage.getItem('genemeds-theme')
  if (saved === 'dark' || (!saved && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
}

export function toggleTheme(): 'light' | 'dark' {
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
  const next = current === 'dark' ? 'light' : 'dark'
  if (next === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
  localStorage.setItem('genemeds-theme', next)
  return next
}

export function renderLandingPage(options: LandingPageOptions): string {
  const { currentHCP, geneLogo } = options

  return `
    <div class="landing-wrapper">
      <!-- 1. Premium Clinical SaaS Navbar -->
      <header id="landing-navbar" class="landing-header">
        <div class="landing-header-inner">
          <div class="landing-header-left">
            <a class="brand landing-brand" href="/" data-nav="/" aria-label="GeneMeds home">
              <span class="brand-mark">${geneLogo}</span>
              <span class="brand-title">Gene<span>Meds</span></span>
              <span class="brand-dna-tag" title="Clinical Pharmacogenomics">
                <svg class="dna-mini-icon" viewBox="0 0 24 24" aria-hidden="true" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M2 15c6.667-6 13.333 0 20-6M2 9c6.667 6 13.333 0 20 6M7 11.5c0 0 2-3 5-3s5 3 5 3M7 12.5c0 0 2 3 5 3s5-3 5-3"/>
                </svg>
                <span>PGx</span>
              </span>
            </a>
          </div>

          <!-- Navigation Links -->
          <nav class="landing-nav" aria-label="Main Navigation">
            <a href="#hero" class="landing-nav-link active">HOME</a>
            <a href="#about" class="landing-nav-link">ABOUT</a>
            <a href="#why-genemeds" class="landing-nav-link">WHY GENEMEDS</a>
            <a href="#how-it-works" class="landing-nav-link">HOW IT WORKS</a>
            <a href="#for-clinicians" class="landing-nav-link">FOR HEALTHCARE PRACTITIONERS</a>
            <a href="#developers" class="landing-nav-link">DEVELOPERS</a>
          </nav>

          <!-- Right: Login, Get Started, Theme Toggle -->
          <div class="landing-header-actions">
            <!-- Light/Dark theme toggle -->
            <button class="theme-toggle-btn" data-action="toggle-theme" aria-label="Toggle dark and light theme" title="Toggle theme">
              <svg class="theme-icon-sun" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
              <svg class="theme-icon-moon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            </button>

            ${
              currentHCP
                ? `
              <span class="landing-user-badge">Dr. ${escapeHtml(currentHCP.fullName)}</span>
              <button class="primary landing-btn-primary" data-nav="/app" data-action="go-app">
                Prescription Portal
              </button>
            `
                : `
              <button class="landing-btn-secondary" data-nav="/login" data-action="go-login">
                Login
              </button>
            `
            }

            <!-- Mobile menu hamburger -->
            <button class="landing-mobile-menu-btn" data-action="toggle-mobile-menu" aria-label="Toggle navigation menu">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Mobile navigation drawer -->
        <div id="landing-mobile-drawer" class="landing-mobile-drawer" style="display:none;">
          <a href="#hero" class="mobile-nav-link">HOME</a>
          <a href="#about" class="mobile-nav-link">ABOUT</a>
          <a href="#why-genemeds" class="mobile-nav-link">WHY GENEMEDS</a>
          <a href="#how-it-works" class="mobile-nav-link">HOW IT WORKS</a>
          <a href="#for-clinicians" class="mobile-nav-link">FOR HEALTHCARE PRACTITIONERS</a>
          <a href="#developers" class="mobile-nav-link">DEVELOPERS</a>
          <div class="mobile-drawer-divider"></div>
          ${
            currentHCP
              ? `<button class="primary" style="width:100%" data-nav="/app" data-action="go-app">Prescription Portal</button>`
              : `<button class="secondary" style="width:100%;margin-bottom:8px" data-nav="/login" data-action="go-login">Login</button>`
          }
        </div>
      </header>

      <!-- Main Landing Page Content -->
      <main id="landing-content" class="landing-page">

        <!-- 2. Hero Section -->
        <section id="hero" class="landing-section hero-section">
          <div class="hero-badge">
            <span class="hero-badge-dot"></span>
            <span>Clinical Decision Support</span>
          </div>

          <h1 class="hero-title">
            <span class="hero-kicker">Welcome to</span>
            <span class="hero-brand-lockup">GeneMeds</span>
          </h1>

          <p class="hero-tagline">Decoded genes, <em>safer prescribing</em></p>

          <p class="hero-subtitle">
            Personalized care supported by genetic insight and evidence-aware decision making.
          </p>

          <div class="hero-actions">
            <button class="primary hero-btn-main" data-nav="/login" data-action="go-login">
              <span>Get Started</span>
              <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14m-6-6 6 6-6 6"/>
              </svg>
            </button>
            <a href="#how-it-works" class="hero-btn-secondary">
              <span>How It Works</span>
            </a>
          </div>

          <!-- Sophisticated Genomic Medical Visualization -->
          <div class="hero-visual-wrapper">
            <div class="clinical-glass-card">

              <!-- Frame Header -->
              <div class="cgc-header">
                <div class="cgc-header-left">
                  <span class="cgc-pulse-dot" aria-hidden="true"></span>
                  <span class="cgc-pipeline-title">PHARMACOGENOMIC DECISION PIPELINE</span>
                  <span class="cgc-sample-id">PROTOCOL PGX-2C19</span>
                </div>
                <div class="cgc-header-right">
                  <span class="cgc-cpic-badge">
                    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    <span>CPIC® Level A Guideline</span>
                  </span>
                </div>
              </div>

              <!-- Connected Data Flow Pipeline -->
              <div class="cgc-pipeline-flow">

                <!-- Stage 1: Prescribed Drug & Medicine/Pill Element -->
                <div class="cgc-stage cgc-stage--drug">
                  <div class="cgc-stage-header">
                    <span class="cgc-stage-tag">PRESCRIBED DRUG</span>
                    <span class="cgc-pill-badge">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="2" y="7" width="20" height="10" rx="5"/>
                        <line x1="12" y1="7" x2="12" y2="17"/>
                      </svg>
                      Oral Agent
                    </span>
                  </div>
                  <div class="cgc-stage-body">
                    <div class="cgc-capsule-icon-wrap" aria-hidden="true">
                      <svg class="cgc-capsule-svg" viewBox="0 0 36 36" fill="none">
                        <rect x="4" y="12" width="28" height="12" rx="6" fill="url(#pill-gradient)" stroke="#2463b7" stroke-width="1.6"/>
                        <line x1="18" y1="12" x2="18" y2="24" stroke="#ffffff" stroke-width="1.5" stroke-dasharray="2 1"/>
                        <defs>
                          <linearGradient id="pill-gradient" x1="0" y1="0" x2="36" y2="36">
                            <stop offset="0%" stop-color="#3b82f6"/>
                            <stop offset="50%" stop-color="#1d4ed8"/>
                            <stop offset="50%" stop-color="#f8fafc"/>
                            <stop offset="100%" stop-color="#cbd5e1"/>
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                    <div class="cgc-drug-meta">
                      <strong class="cgc-drug-name">Clopidogrel</strong>
                      <span class="cgc-drug-desc">75 mg · Antiplatelet</span>
                      <span class="cgc-drug-note">Hepatic bio-activation required</span>
                    </div>
                  </div>
                </div>

                <!-- Connector 1 -->
                <div class="cgc-connector" aria-hidden="true">
                  <div class="cgc-connector-line"></div>
                  <svg class="cgc-connector-arrow" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2">
                    <path d="M5 12h14m-6-6 6 6-6 6"/>
                  </svg>
                </div>

                <!-- Stage 2: Gene & DNA Variant -->
                <div class="cgc-stage cgc-stage--gene">
                  <div class="cgc-stage-header">
                    <span class="cgc-stage-tag">GENETIC VARIANT</span>
                    <span class="cgc-gene-badge">
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M2 15c6.667-6 13.333 0 20-6M2 9c6.667 6 13.333 0 20 6"/>
                      </svg>
                      Biomarker
                    </span>
                  </div>
                  <div class="cgc-stage-body">
                    <div class="cgc-dna-icon-wrap" aria-hidden="true">
                      <!-- Stylized DNA Double Helix Track -->
                      <svg class="cgc-helix-svg" viewBox="0 0 36 36" fill="none">
                        <path d="M7 6 C 18 14, 18 22, 7 30" stroke="#8b5cf6" stroke-width="2.2" stroke-linecap="round"/>
                        <path d="M29 6 C 18 14, 18 22, 29 30" stroke="#3b82f6" stroke-width="2.2" stroke-linecap="round"/>
                        <line x1="11" y1="10" x2="25" y2="10" stroke="currentColor" stroke-width="1.3" opacity="0.6"/>
                        <line x1="16" y1="18" x2="20" y2="18" stroke="currentColor" stroke-width="1.3" opacity="0.6"/>
                        <line x1="11" y1="26" x2="25" y2="26" stroke="currentColor" stroke-width="1.3" opacity="0.6"/>
                      </svg>
                    </div>
                    <div class="cgc-gene-meta">
                      <strong class="cgc-gene-title">CYP2C19</strong>
                      <div class="cgc-allele-chip">
                        <span class="cgc-allele-label">Diplotype:</span>
                        <code class="cgc-allele-code">*2/*2</code>
                      </div>
                      <span class="cgc-gene-note">Loss-of-function allele</span>
                    </div>
                  </div>
                </div>

                <!-- Connector 2 -->
                <div class="cgc-connector" aria-hidden="true">
                  <div class="cgc-connector-line"></div>
                  <svg class="cgc-connector-arrow" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2">
                    <path d="M5 12h14m-6-6 6 6-6 6"/>
                  </svg>
                </div>

                <!-- Stage 3: Phenotype -->
                <div class="cgc-stage cgc-stage--pheno">
                  <div class="cgc-stage-header">
                    <span class="cgc-stage-tag">METABOLIC STATUS</span>
                    <span class="cgc-score-badge">Score: 0.0</span>
                  </div>
                  <div class="cgc-stage-body">
                    <div class="cgc-pheno-badge-icon" aria-hidden="true">
                      <span>⚡</span>
                    </div>
                    <div class="cgc-pheno-meta">
                      <strong class="cgc-pheno-name">Poor Metabolizer</strong>
                      <span class="cgc-pheno-flag">Marked Deficit (PM)</span>
                      <span class="cgc-pheno-note">Severely diminished active metabolite</span>
                    </div>
                  </div>
                </div>

                <!-- Connector 3 -->
                <div class="cgc-connector" aria-hidden="true">
                  <div class="cgc-connector-line"></div>
                  <svg class="cgc-connector-arrow" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2">
                    <path d="M5 12h14m-6-6 6 6-6 6"/>
                  </svg>
                </div>

                <!-- Stage 4: CPIC Guidance & Clinical Alternative -->
                <div class="cgc-stage cgc-stage--guidance">
                  <div class="cgc-stage-header">
                    <span class="cgc-stage-tag">CPIC GUIDANCE</span>
                    <span class="cgc-alert-badge">High Risk Alert</span>
                  </div>
                  <div class="cgc-stage-body cgc-guidance-body">
                    <div class="cgc-guidance-headline">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2">
                        <circle cx="12" cy="12" r="9"/>
                        <path d="M12 8v4m0 4h.01"/>
                      </svg>
                      <strong>Avoid Standard Clopidogrel</strong>
                    </div>
                    <p class="cgc-guidance-reason">
                      Diminished platelet inhibition markedly increases risk of ischemic adverse events.
                    </p>
                    <div class="cgc-alt-recommendation">
                      <span class="cgc-alt-label">Consider Alternate:</span>
                      <strong class="cgc-alt-name">Prasugrel or Ticagrelor</strong>
                    </div>
                  </div>
                </div>

              </div>

              <!-- Prominent Illustrative Notice -->
              <div class="cgc-footer-notice">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <circle cx="12" cy="12" r="9"/>
                  <path d="M12 8v4m0 4h.01"/>
                </svg>
                <span>
                  <strong>Illustrative UI Visualization</strong> — Example CPIC CYP2C19 protocol demonstration. Not an active clinical recommendation.
                </span>
              </div>

            </div>
          </div>
        </section>

        <!-- 3. Clinical Intelligence: Orbit Section -->
        <section id="clinical-intelligence" class="landing-section orbit-section">
          <div class="section-header-center">
            <div class="section-badge">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                <circle cx="12" cy="12" r="3"/>
                <circle cx="12" cy="12" r="9"/>
              </svg>
              <span>Clinical Intelligence Orbit</span>
            </div>
            <h2 class="section-title">Centralized Precision Prescribing Intelligence</h2>
            <p class="section-description">
              GeneMeds unifies patient genetics, pharmacological mechanisms, and CPIC evidence into a cohesive intelligence orbit—surfacing actionable guidance before dispensing.
            </p>
          </div>

          <div class="orbit-wrapper">
            <!-- Concentric Background Rings -->
            <div class="orbit-rings-visual" aria-hidden="true">
              <div class="orbit-ring orbit-ring--outer"></div>
              <div class="orbit-ring orbit-ring--middle"></div>
              <div class="orbit-ring orbit-ring--inner"></div>
              <div class="orbit-crosshair orbit-crosshair--h"></div>
              <div class="orbit-crosshair orbit-crosshair--v"></div>
            </div>

            <!-- Central Hub: GeneMeds Core Engine -->
            <div class="orbit-hub">
              <div class="orbit-hub-pulse" aria-hidden="true"></div>
              <div class="orbit-hub-inner">
                <div class="orbit-hub-logo">
                  ${geneLogo}
                </div>
                <strong class="orbit-hub-title">Gene<span>Meds</span></strong>
                <span class="orbit-hub-sub">PGx Inference Hub</span>
                <span class="orbit-hub-status">
                  <span class="hub-status-dot"></span>
                  Active Protocol
                </span>
              </div>
            </div>

            <!-- Orbiting Satellites (4 Distinct Nodes) -->
            <div class="orbit-nodes-grid">

              <!-- Node 1: Genomics (North-West) -->
              <div class="orbit-node orbit-node--genomics">
                <div class="orbit-node-glow" aria-hidden="true"></div>
                <div class="orbit-node-header">
                  <div class="orbit-node-icon orbit-node-icon--purple">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M2 15c6.667-6 13.333 0 20-6M2 9c6.667 6 13.333 0 20 6M7 11.5c0 0 2-3 5-3s5 3 5 3M7 12.5c0 0 2 3 5 3s5-3 5-3"/>
                    </svg>
                  </div>
                  <span class="orbit-node-tag orbit-node-tag--purple">Variant Profiling</span>
                </div>
                <h3 class="orbit-node-title">Genomics</h3>
                <p class="orbit-node-desc">
                  Curates validated pharmacogenes (CYP2D6, CYP2C19, TPMT, DPYD) and patient star-allele diplotypes with functional allele designations.
                </p>
                <div class="orbit-node-meta">
                  <span>Star-Allele Nomenclature</span>
                  <span>•</span>
                  <span>Activity Scoring</span>
                </div>
              </div>

              <!-- Node 2: Drug-Gene Mapping (North-East) -->
              <div class="orbit-node orbit-node--drug-gene">
                <div class="orbit-node-glow" aria-hidden="true"></div>
                <div class="orbit-node-header">
                  <div class="orbit-node-icon orbit-node-icon--blue">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="2" y="7" width="20" height="10" rx="5"/>
                      <line x1="12" y1="7" x2="12" y2="17"/>
                    </svg>
                  </div>
                  <span class="orbit-node-tag orbit-node-tag--blue">Enzyme Interactions</span>
                </div>
                <h3 class="orbit-node-title">Drug–Gene Mapping</h3>
                <p class="orbit-node-desc">
                  Pairs prescribed compounds with hepatic metabolic pathways, active metabolites, and prodrug bio-activation requirements in real time.
                </p>
                <div class="orbit-node-meta">
                  <span>Enzymatic Catalysis</span>
                  <span>•</span>
                  <span>Pharmacokinetics</span>
                </div>
              </div>

              <!-- Node 3: Patient Safety (South-West) -->
              <div class="orbit-node orbit-node--safety">
                <div class="orbit-node-glow" aria-hidden="true"></div>
                <div class="orbit-node-header">
                  <div class="orbit-node-icon orbit-node-icon--amber">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  </div>
                  <span class="orbit-node-tag orbit-node-tag--amber">Pre-Dispense Defense</span>
                </div>
                <h3 class="orbit-node-title">Patient Safety</h3>
                <p class="orbit-node-desc">
                  Identifies drug toxicity risks, narrow therapeutic index hazards, and sub-therapeutic exposure before the prescription is dispensed.
                </p>
                <div class="orbit-node-meta">
                  <span>Adverse Event Prevention</span>
                  <span>•</span>
                  <span>Audit Trails</span>
                </div>
              </div>

              <!-- Node 4: CPIC Evidence (South-East) -->
              <div class="orbit-node orbit-node--cpic">
                <div class="orbit-node-glow" aria-hidden="true"></div>
                <div class="orbit-node-header">
                  <div class="orbit-node-icon orbit-node-icon--green">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                  </div>
                  <span class="orbit-node-tag orbit-node-tag--green">Clinical Consensus</span>
                </div>
                <h3 class="orbit-node-title">CPIC Evidence</h3>
                <p class="orbit-node-desc">
                  Aligns recommendations directly with peer-reviewed Clinical Pharmacogenetics Implementation Consortium Level A &amp; B consensus guidelines.
                </p>
                <div class="orbit-node-meta">
                  <span>Level A/B Evidence</span>
                  <span>•</span>
                  <span>ClinGen Integrated</span>
                </div>
              </div>

            </div>
          </div>
        </section>

        <!-- 4. From Data to Decision: 8-Stage Connected Pipeline -->
        <section id="data-to-decision" class="landing-section pipeline-section">
          <div class="section-header-center">
            <div class="section-badge">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                <path d="M5 12h14m-6-6 6 6-6 6"/>
              </svg>
              <span>From Data to Decision</span>
            </div>
            <h2 class="section-title">The Pharmacogenomic Decision Flow</h2>
            <p class="section-description">
              A continuous, auditable clinical pipeline transforming patient prescription orders and genetic biomarkers into clear, guideline-backed prescribing decisions.
            </p>
          </div>

          <!-- Connected Visual Pipeline Container -->
          <div class="pipeline-container">
            <!-- Continuous Timeline Track Spine -->
            <div class="pipeline-track-spine" aria-hidden="true"></div>

            <!-- Row 1: Stages 01 to 04 -->
            <div class="pipeline-stage-row pipeline-stage-row--upper">

              <!-- Stage 01 -->
              <div class="pipeline-step-card" data-step="01">
                <div class="pipeline-step-head">
                  <span class="pipeline-step-num">01</span>
                  <div class="pipeline-step-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                      <polyline points="10 9 9 9 8 9"/>
                    </svg>
                  </div>
                </div>
                <div class="pipeline-step-body">
                  <span class="pipeline-step-category">Initial Order</span>
                  <h4 class="pipeline-step-name">Prescription</h4>
                  <p class="pipeline-step-text">Clinician selects medications and directions at the bedside or clinic.</p>
                </div>
                <div class="pipeline-step-pill">
                  <span>Rx Entry Point</span>
                </div>
              </div>

              <!-- Inter-stage Connector 01 -> 02 -->
              <div class="pipeline-step-connector" aria-hidden="true">
                <div class="connector-line"></div>
                <div class="connector-arrow">›</div>
              </div>

              <!-- Stage 02 -->
              <div class="pipeline-step-card" data-step="02">
                <div class="pipeline-step-head">
                  <span class="pipeline-step-num">02</span>
                  <div class="pipeline-step-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="2" y="7" width="20" height="10" rx="5"/>
                      <line x1="12" y1="7" x2="12" y2="17"/>
                    </svg>
                  </div>
                </div>
                <div class="pipeline-step-body">
                  <span class="pipeline-step-category">Formulary</span>
                  <h4 class="pipeline-step-name">Drug</h4>
                  <p class="pipeline-step-text">System resolves active pharmaceutical ingredient and generic pharmacokinetics.</p>
                </div>
                <div class="pipeline-step-pill">
                  <span>Compound Verification</span>
                </div>
              </div>

              <!-- Inter-stage Connector 02 -> 03 -->
              <div class="pipeline-step-connector" aria-hidden="true">
                <div class="connector-line"></div>
                <div class="connector-arrow">›</div>
              </div>

              <!-- Stage 03 -->
              <div class="pipeline-step-card" data-step="03">
                <div class="pipeline-step-head">
                  <span class="pipeline-step-num">03</span>
                  <div class="pipeline-step-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                  </div>
                </div>
                <div class="pipeline-step-body">
                  <span class="pipeline-step-category">Biomarker</span>
                  <h4 class="pipeline-step-name">Gene</h4>
                  <p class="pipeline-step-text">Queries verified metabolic enzyme and transport protein loci for this drug.</p>
                </div>
                <div class="pipeline-step-pill">
                  <span>Gene Target Identified</span>
                </div>
              </div>

              <!-- Inter-stage Connector 03 -> 04 -->
              <div class="pipeline-step-connector" aria-hidden="true">
                <div class="connector-line"></div>
                <div class="connector-arrow">›</div>
              </div>

              <!-- Stage 04 -->
              <div class="pipeline-step-card" data-step="04">
                <div class="pipeline-step-head">
                  <span class="pipeline-step-num">04</span>
                  <div class="pipeline-step-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M2 15c6.667-6 13.333 0 20-6M2 9c6.667 6 13.333 0 20 6"/>
                    </svg>
                  </div>
                </div>
                <div class="pipeline-step-body">
                  <span class="pipeline-step-category">Laboratory</span>
                  <h4 class="pipeline-step-name">Genotype / Diplotype</h4>
                  <p class="pipeline-step-text">Captures patient allelic variations manually or via lab report OCR auto-fill.</p>
                </div>
                <div class="pipeline-step-pill">
                  <span>Star-Alleles Assigned</span>
                </div>
              </div>

            </div>

            <!-- Turnaround flow connector on desktop between upper and lower row -->
            <div class="pipeline-row-turnaround" aria-hidden="true">
              <div class="turnaround-stem"></div>
              <div class="turnaround-arrow">↓</div>
            </div>

            <!-- Row 2: Stages 05 to 08 -->
            <div class="pipeline-stage-row pipeline-stage-row--lower">

              <!-- Stage 05 -->
              <div class="pipeline-step-card" data-step="05">
                <div class="pipeline-step-head">
                  <span class="pipeline-step-num">05</span>
                  <div class="pipeline-step-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12 6 12 12 16 14"/>
                    </svg>
                  </div>
                </div>
                <div class="pipeline-step-body">
                  <span class="pipeline-step-category">Metabolic State</span>
                  <h4 class="pipeline-step-name">Phenotype</h4>
                  <p class="pipeline-step-text">Calculates activity score to classify functional metabolic phenotype.</p>
                </div>
                <div class="pipeline-step-pill">
                  <span>Functional Score</span>
                </div>
              </div>

              <!-- Inter-stage Connector 05 -> 06 -->
              <div class="pipeline-step-connector" aria-hidden="true">
                <div class="connector-line"></div>
                <div class="connector-arrow">›</div>
              </div>

              <!-- Stage 06 -->
              <div class="pipeline-step-card" data-step="06">
                <div class="pipeline-step-head">
                  <span class="pipeline-step-num">06</span>
                  <div class="pipeline-step-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                  </div>
                </div>
                <div class="pipeline-step-body">
                  <span class="pipeline-step-category">Guideline Curation</span>
                  <h4 class="pipeline-step-name">CPIC Evidence</h4>
                  <p class="pipeline-step-text">Evaluates peer-reviewed consensus recommendations for this gene-drug pair.</p>
                </div>
                <div class="pipeline-step-pill">
                  <span>Level A/B Matched</span>
                </div>
              </div>

              <!-- Inter-stage Connector 06 -> 07 -->
              <div class="pipeline-step-connector" aria-hidden="true">
                <div class="connector-line"></div>
                <div class="connector-arrow">›</div>
              </div>

              <!-- Stage 07 -->
              <div class="pipeline-step-card" data-step="07">
                <div class="pipeline-step-head">
                  <span class="pipeline-step-num">07</span>
                  <div class="pipeline-step-icon">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </div>
                </div>
                <div class="pipeline-step-body">
                  <span class="pipeline-step-category">Clinical Safety</span>
                  <h4 class="pipeline-step-name">Risk Assessment</h4>
                  <p class="pipeline-step-text">Quantifies adverse drug reaction severity or therapeutic failure probabilities.</p>
                </div>
                <div class="pipeline-step-pill">
                  <span>Risk Stratified</span>
                </div>
              </div>

              <!-- Inter-stage Connector 07 -> 08 -->
              <div class="pipeline-step-connector" aria-hidden="true">
                <div class="connector-line"></div>
                <div class="connector-arrow">›</div>
              </div>

              <!-- Stage 08 -->
              <div class="pipeline-step-card pipeline-step-card--final" data-step="08">
                <div class="pipeline-step-head">
                  <span class="pipeline-step-num pipeline-step-num--final">08</span>
                  <div class="pipeline-step-icon pipeline-step-icon--final">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                </div>
                <div class="pipeline-step-body">
                  <span class="pipeline-step-category pipeline-step-category--final">Actionable Outcome</span>
                  <h4 class="pipeline-step-name">Clinical Decision</h4>
                  <p class="pipeline-step-text">Delivers clear dosing adjustment, standard clearance, or alternative medication.</p>
                </div>
                <div class="pipeline-step-pill pipeline-step-pill--final">
                  <span>Prescribing Guidance</span>
                </div>
              </div>

            </div>

          </div>

          <!-- Subtle Pipeline Compliance Note -->
          <div class="pipeline-compliance-note">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <circle cx="12" cy="12" r="9"/>
              <path d="M12 8v4m0 4h.01"/>
            </svg>
            <span>All decision-support stages reference published CPIC guidelines. Final prescription authority remains with the treating clinician.</span>
          </div>
        </section>

        <!-- 5. How It Works -->
        <section id="how-it-works" class="landing-section">
          <div class="section-header-center">
            <div class="section-badge">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                <path d="M12 2v20M2 12h20"/>
              </svg>
              <span>How It Works</span>
            </div>
            <h2 class="section-title">Five Connected Steps to Safer Prescribing</h2>
            <p class="section-description">
              GeneMeds helps translate prescription intent and genetic evidence into a clear, evidence-linked medication decision without disrupting clinical workflow.
            </p>
          </div>

          <div class="workflow-visual">
            <div class="workflow-timeline" aria-label="GeneMeds workflow timeline">
              <div class="workflow-step">
                <span class="workflow-step-index">01</span>
                <div class="workflow-step-card">
                  <h3>Create Prescription</h3>
                  <p>Clinicians search the formulary, add medicines, and record dosage, frequency, and duration.</p>
                </div>
              </div>
              <div class="workflow-step-arrow" aria-hidden="true">→</div>

              <div class="workflow-step">
                <span class="workflow-step-index">02</span>
                <div class="workflow-step-card">
                  <h3>Identify Relevant Gene</h3>
                  <p>The platform maps each drug to the relevant pharmacogene and likely metabolizer pathways.</p>
                </div>
              </div>
              <div class="workflow-step-arrow" aria-hidden="true">→</div>

              <div class="workflow-step">
                <span class="workflow-step-index">03</span>
                <div class="workflow-step-card">
                  <h3>Interpret Genetic Result</h3>
                  <p>Genetic data can be entered manually or extracted from laboratory reports and translated to phenotype.</p>
                </div>
              </div>
              <div class="workflow-step-arrow" aria-hidden="true">→</div>

              <div class="workflow-step">
                <span class="workflow-step-index">04</span>
                <div class="workflow-step-card">
                  <h3>Apply CPIC Guidance</h3>
                  <p>Clinical rules align the phenotype and the drug to published CPIC recommendations and safety signals.</p>
                </div>
              </div>
              <div class="workflow-step-arrow" aria-hidden="true">→</div>

              <div class="workflow-step">
                <span class="workflow-step-index">05</span>
                <div class="workflow-step-card">
                  <h3>Assess Risk</h3>
                  <p>Clinicians review the risk profile, therapeutic alternatives, and any need for additional clinical evaluation.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 6. Product Showcase -->
        <section id="product-showcase" class="landing-section">
          <div class="section-header-center">
            <div class="section-badge">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                <path d="M3 12h18M12 3v18"/>
              </svg>
              <span>Product Showcase</span>
            </div>
            <h2 class="section-title">From Prescription to Clinical Recommendation</h2>
            <p class="section-description">
              The GeneMeds workflow connects medication selection, genomic interpretation, and guideline-based recommendations in a single clinical interface.
            </p>
          </div>

          <div class="showcase-window">
            <div class="showcase-toolbar">
              <span class="window-dot window-dot--red"></span>
              <span class="window-dot window-dot--amber"></span>
              <span class="window-dot window-dot--green"></span>
              <span class="window-title">GeneMeds Workflow</span>
            </div>

            <div class="showcase-workflow">
              <div class="showcase-node showcase-node--primary">
                <span class="showcase-node-label">Prescription Creation</span>
                <strong>Clopidogrel · 75 mg</strong>
              </div>
              <div class="showcase-arrow" aria-hidden="true">→</div>

              <div class="showcase-node">
                <span class="showcase-node-label">Recommended Gene Tests</span>
                <strong>CYP2C19</strong>
              </div>
              <div class="showcase-arrow" aria-hidden="true">→</div>

              <div class="showcase-node">
                <span class="showcase-node-label">Gene Result Entry</span>
                <strong>*2/*2 diplotype</strong>
              </div>
              <div class="showcase-arrow" aria-hidden="true">→</div>

              <div class="showcase-node showcase-node--highlight">
                <span class="showcase-node-label">Clinical Recommendation</span>
                <strong>Consider alternate therapy</strong>
              </div>
            </div>

            <div class="showcase-panels">
              <div class="showcase-panel">
                <span class="showcase-panel-title">Clinical Context</span>
                <ul>
                  <li>Medication prescribed</li>
                  <li>Dose and duration recorded</li>
                  <li>Therapeutic context captured</li>
                </ul>
              </div>
              <div class="showcase-panel">
                <span class="showcase-panel-title">Genomic Review</span>
                <ul>
                  <li>Manual entry or lab upload</li>
                  <li>Phenotype interpretation</li>
                  <li>Evidence-linked summary</li>
                </ul>
              </div>
              <div class="showcase-panel showcase-panel--accent">
                <span class="showcase-panel-title">Action</span>
                <ul>
                  <li>Risk assessment</li>
                  <li>Alternate option review</li>
                  <li>Prescribing guidance</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <!-- 7. About GeneMeds -->
        <section id="about" class="landing-section">
          <div class="section-header-center">
            <div class="section-badge">WHO WE ARE</div>
            <h2 class="section-title">Making precision prescribing measurable</h2>
            <p class="section-description">
              GeneMeds brings pharmacogenomic intelligence into the clinical workflow so treatment decisions can be grounded in evidence, context, and patient-specific biology.
            </p>
          </div>

          <div class="about-visual">
            <div class="about-grid">
              <div class="about-pill about-pill--primary">
                <span class="about-pill-label">WHO WE ARE</span>
                <strong>We help clinicians interpret the genetic context behind everyday prescribing decisions.</strong>
              </div>
              <div class="about-pill about-pill--secondary">
                <span class="about-pill-label">MISSION</span>
                <strong>Translate complex genetic data into clearer, safer medication choices.</strong>
              </div>
              <div class="about-pill about-pill--highlight">
                <span class="about-pill-label">VISION</span>
                <strong>Enable a future where personalised care is practical, scalable, and clinically actionable.</strong>
              </div>
            </div>

            <div class="about-pipeline" aria-label="Genetic data to clinical insight pipeline">
              <div class="about-step">
                <span class="about-step-label">Genetic Data</span>
              </div>
              <div class="about-arrow" aria-hidden="true">↓</div>
              <div class="about-step">
                <span class="about-step-label">Phenotype</span>
              </div>
              <div class="about-arrow" aria-hidden="true">↓</div>
              <div class="about-step">
                <span class="about-step-label">CPIC Evidence</span>
              </div>
              <div class="about-arrow" aria-hidden="true">↓</div>
              <div class="about-step about-step--highlight">
                <span class="about-step-label">Clinical Insight</span>
              </div>
            </div>
          </div>
        </section>

        <section id="why-genemeds" class="landing-section">
          <div class="section-header-center">
            <div class="section-badge">WHY GENEMEDS</div>
            <h2 class="section-title">Precision medicine without the noise</h2>
            <p class="section-description">
              The platform filters complexity into useful signals so prescribing teams can act earlier and with more confidence.
            </p>
          </div>

          <div class="why-grid">
            <article class="why-card why-card--blue">
              <div class="why-card-icon">✦</div>
              <h3>Precision Medicine</h3>
              <p>Tailors treatment decisions to the patient’s genetic context.</p>
            </article>
            <article class="why-card why-card--purple">
              <div class="why-card-icon">▣</div>
              <h3>Evidence Based</h3>
              <p>Links clinical decisions to published pharmacogenomic guidance.</p>
            </article>
            <article class="why-card why-card--cyan">
              <div class="why-card-icon">◎</div>
              <h3>CPIC Guidelines</h3>
              <p>Connects genotype and phenotype to relevant clinical recommendations.</p>
            </article>
            <article class="why-card why-card--green">
              <div class="why-card-icon">◌</div>
              <h3>AI-Assisted Insights</h3>
              <p>Surfaces patterns quickly without replacing clinician judgment.</p>
            </article>
          </div>
        </section>

        <!-- 8. Built for Healthcare Practitioners -->
        <section id="for-clinicians" class="landing-section">
          <div class="section-header-center">
            <div class="section-badge">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="10" cy="7" r="4"/>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span>For Healthcare Practitioners</span>
            </div>
            <h2 class="section-title">Built for healthcare decision-making</h2>
            <p class="section-description">
              GeneMeds supports medication review, pharmacogenomic interpretation, and clinical workflow planning with clear, evidence-aware guidance.
            </p>
          </div>

          <div class="clinician-grid">
            <article class="clinician-card">
              <span class="clinician-tag">Doctors</span>
              <h3>Medication Review</h3>
              <p>Helps evaluate prescribing context, dose considerations, and genetic risk before a treatment is finalized.</p>
            </article>
            <article class="clinician-card">
              <span class="clinician-tag">Healthcare Providers</span>
              <h3>Workflow Integration</h3>
              <p>Provides a structured, manageable decision-support layer that fits into everyday clinical operations.</p>
            </article>
            <article class="clinician-card">
              <span class="clinician-tag">Clinical Researchers</span>
              <h3>Evidence Exploration</h3>
              <p>Creates a clearer lens for gene-drug relationships, phenotype interpretation, and clinical inquiry.</p>
            </article>
          </div>
        </section>

        <!-- 9. Developers / Architecture -->
        <section id="developers" class="landing-section">
          <div class="section-header-center">
            <div class="section-badge">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                <path d="M8 9l-5 3 5 3M16 9l5 3-5 3M14 3l-4 18"/>
              </svg>
              <span>Developers</span>
            </div>
            <h2 class="section-title">The GeneMeds team</h2>
          </div>

          <div class="developer-layout">
            <div class="team-grid" aria-label="GeneMeds development team">
              <button class="team-member" type="button" data-action="open-developer-profile" data-developer="komal">
                <span class="team-avatar">KG</span>
                <span class="team-name-wrap">
                  <span class="team-name">Komal Gehani</span>
                  <span class="team-role">Faculty Mentor</span>
                </span>
              </button>
              <button class="team-member" type="button" data-action="open-developer-profile" data-developer="aditya-balki">
                <span class="team-avatar">AB</span>
                <span class="team-name-wrap">
                  <span class="team-name">Aditya Balki</span>
                  <span class="team-role">Alumni Mentor</span>
                </span>
              </button>
              <button class="team-member" type="button" data-action="open-developer-profile" data-developer="aditya-yelne">
                <span class="team-avatar">AY</span>
                <span class="team-name">Aditya Yelne</span>
              </button>
              <button class="team-member" type="button" data-action="open-developer-profile" data-developer="amod">
                <span class="team-avatar">AP</span>
                <span class="team-name">Amod Pathak</span>
              </button>
              <button class="team-member" type="button" data-action="open-developer-profile" data-developer="payal">
                <span class="team-avatar">PM</span>
                <span class="team-name">Payal Mohanapure</span>
              </button>
              <button class="team-member" type="button" data-action="open-developer-profile" data-developer="sharvari">
                <span class="team-avatar">SG</span>
                <span class="team-name">Sharvari Ghotekar</span>
              </button>
            </div>
          </div>
        </section>

        <!-- 10. Final CTA -->
        <section id="final-cta" class="landing-section cta-section">
          <div class="cta-card">
            <h2 class="cta-title">Bring Pharmacogenomics Into the Prescribing Workflow.</h2>
            <p class="cta-subtitle">
              Give clinicians a clearer view of drug-gene interactions, phenotype interpretation, and evidence-based prescribing decisions.
            </p>
            <div class="cta-actions">
              <button class="primary cta-btn" data-nav="/login" data-action="go-login">
                Enter GeneMeds
                <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M5 12h14m-6-6 6 6-6 6"/>
                </svg>
              </button>
            </div>
          </div>
        </section>
      </main>

      <div id="developer-profile-modal" class="landing-modal" aria-hidden="true" hidden>
        <div class="landing-modal-backdrop" data-action="close-developer-profile"></div>
        <div class="landing-modal-panel developer-profile-panel" role="dialog" aria-modal="true" aria-labelledby="developer-profile-name">
          <button class="landing-modal-close" type="button" data-action="close-developer-profile" aria-label="Close developer profile">×</button>
          <div class="landing-modal-visual developer-profile-visual" id="developer-profile-visual">
            <div class="developer-profile-avatar" id="developer-profile-avatar">AP</div>
          </div>
          <div class="landing-modal-body">
            <span class="section-badge" id="developer-profile-tag">Team member</span>
            <h3 id="developer-profile-name">Amod Pathak</h3>
            <div id="developer-profile-details" class="developer-profile-details"></div>
          </div>
        </div>
      </div>

      <!-- 11. Footer -->
      <footer id="landing-footer" class="landing-footer">
        <div class="landing-footer-inner">
          <div class="footer-brand-col">
            <div class="brand landing-brand" aria-label="GeneMeds brand">
              <span class="brand-mark">${geneLogo}</span>
              <span class="brand-title">Gene<span>Meds</span></span>
            </div>
            <p class="footer-tagline">Clinical Pharmacogenomics Decision Support System.</p>
            <p class="footer-disclaimer">
              GeneMeds provides clinical decision support using published guidance, while final prescribing authority remains with the treating clinician.
            </p>
          </div>

          <div class="footer-links-col">
            <strong>Company</strong>
            <a href="#about">About</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#product-showcase">Product Showcase</a>
            <a href="#developers">Developers</a>
          </div>

          <div class="footer-links-col">
            <strong>Access</strong>
            <a href="/login" data-nav="/login">Login</a>
            <a href="#clinical-intelligence">Features</a>
            <a href="#for-clinicians">For Clinicians</a>
          </div>
        </div>

        <div class="footer-bottom">
          <span>&copy; ${new Date().getFullYear()} GeneMeds</span>
          <span>Precision Pharmacogenomics Platform</span>
        </div>
      </footer>
    </div>
  `
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
