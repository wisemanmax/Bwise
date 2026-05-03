# Byheir Wise — Portfolio

Source for **[www.byheir.com](https://www.byheir.com)** — the portfolio of Byheir Wise, engineer and BI platform owner in regulated student lending.

Static site (HTML / CSS / vanilla JS) hosted on GitHub Pages with a custom domain via `CNAME`. No build step.

---

## Quickstart

```bash
# Clone and serve locally — no install, no build
git clone https://github.com/wisemanmax/Bwise.git
cd Bwise
python3 -m http.server 8000
# → http://localhost:8000
```

Or just open `index.html` directly in a browser.

---

## Repo structure

```
.
├── index.html              # Single-page portfolio (hero, about, experience, projects, work, skills, contact)
├── pages/                  # ~70 sub-pages: case studies, demos, UI explorations, domain suites
├── assets/
│   ├── style.css           # Global styles
│   ├── script.js           # Interactions (nav, guided tour, etc.)
│   ├── byheir-wise-resume.pdf
│   ├── data/               # JSON fixtures for demos (dashboard, learning library)
│   └── work-thumbs/        # Card thumbnails
├── mock-exports/           # Sample report exports (PNG/SVG) for BI showcases
├── CNAME                   # GitHub Pages → www.byheir.com
└── manifest.webmanifest    # PWA manifest
```

---

## Evidence index

Where to look when you want proof of a specific claim.

### Case studies (decisions + tradeoffs, not just screenshots)
| Project | What it shows | File |
|---|---|---|
| Operations Command Center | Cross-functional ops platform — KPI design, alert/workflow architecture | `pages/case-study.html` |
| The Builder | AI-augmented reporting & validation — multi-stage pipelines, audit trails | `pages/the-builder.html` |
| SQL Playground · Lending KPIs | In-browser SQLite (WASM), Snowflake-shaped lending schema, 21 challenges | `pages/sql-playground-case-study.html` |
| Power BI Dashboards | Executive reporting, KPI standardization, reconciliation patterns | `pages/power-bi-dashboards.html` |

### Domain suites (UI explorations across regulated-fintech workflows)
| Domain | Entry point | Coverage |
|---|---|---|
| Collections | `pages/collections-toolkit.html` | Segmentation, dialer, comms hub, QA, compliance, skip-trace, agency mgmt |
| Fraud Risk | `pages/fraud-risk.html` | Real-time monitoring, alert triage, link analysis, ID verification, investigations |
| Credit Underwriting | `pages/credit-underwriting.html` | Decision engine, doc processing, manual review, adverse action, scoring |
| Servicing CX | `pages/servicing-cexp.html` | Account mgmt, loss mitigation, support portal, comms hub, surveys |
| Education | `pages/education-overview.html` | Cohorts, content studio, modules, quizzes, tests, library |

### Live demos (functional, not mockups)
| Demo | What runs | File |
|---|---|---|
| Operations Dashboard | SLA risk, alerts, workload — links the suites above | `pages/dashboard.html` |
| Refi Intelligence | Cohort heatmaps, funnel drop-off, savings dist. across 5,000 synthetic apps | `pages/refi-intelligence.html` |
| SQL Playground | Real SQL against a synthetic lending portfolio in-browser | `pages/sql-playground.html` |
| Banking PWA | iOS-style banking — biometric login, transfers, round-ups, push | `pages/banking.html` |

### External projects (live in production, separate repos)
| Project | Stack | Link |
|---|---|---|
| IronLog Analytics Ecosystem | React 18, Vite, Supabase, Vercel, Cloudflare R2, PWA | [ironlog.space](https://ironlog.space) |
| PartnerPulse | React 18, Vite, Recharts, Cloudflare Workers, Claude Sonnet | [partnerpulse.byheir.com](https://partnerpulse.byheir.com) |

### Engineering practice pages
| Topic | File |
|---|---|
| HTML / CSS / JS examples | `pages/html.html`, `pages/css.html`, `javascript.html` |
| CI/CD discipline | `pages/cicd.html` |
| Backend / mock APIs | `pages/backend.html`, `pages/mock-api.html` |
| Compliance matrix | `pages/compliance-matrix.html` |
| AI search | `pages/ai-search.html` |

---

## Resume bullet → repo evidence

| Resume claim | Where to verify |
|---|---|
| Power BI / Snowflake reporting across collections, fraud, compliance, servicing | Domain suites (above) + `pages/power-bi-dashboards.html` |
| Reduced manual reporting effort by 60% via Python automation | `pages/the-builder.html` (validation/release flow) |
| AI-augmented testing platform across six categories | `pages/the-builder.html`, `pages/ai-search.html` |
| Full-stack work in Python / TypeScript / React | IronLog, PartnerPulse, `pages/refi-intelligence.html` |
| IaC & CI/CD discipline for analytics tooling | `pages/cicd.html` |
| Adoption / training / KPI standardization | `pages/case-study.html` (Operations Command Center) |

---

## Tech

Static HTML/CSS/vanilla JS. PWA manifest. No framework, no build step, no dependencies. Hosted on GitHub Pages.

External projects linked from the work section use React 18 + Vite + Supabase / Cloudflare Workers (separate repos).

---

## Contact

- Site: [www.byheir.com](https://www.byheir.com)
- Email: [byheirw@gmail.com](mailto:byheirw@gmail.com)
- LinkedIn: [byheir-wise](https://www.linkedin.com/in/byheir-wise-976253265)
