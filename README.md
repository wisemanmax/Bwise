# Byheir Wise · Operations Portfolio

A portfolio site showcasing operational dashboards, analytics views, and system design thinking for regulated financial services. The site highlights how cross-functional programs translate into measurable improvements in compliance, customer experience, and operational throughput.

## What’s inside

- **Operations dashboards** that mirror day-to-day command center workflows across collections, credit, fraud, servicing, and education teams.
- **Case study narrative** explaining the operational problem, dashboard design choices, and KPI definitions behind the flagship dashboard.
- **Mock data layer** backed by local JSON to demonstrate how data modeling drives the UI without a backend.

## Key views to explore

- `index.html` — main portfolio landing page and navigation hub.
- `pages/dashboard.html` — operations command center dashboard (data-backed).
- `pages/case-study.html` — end-to-end story of the operational challenge and KPI strategy.
- `pages/education-dashboard.html` — education analytics portal.
- `pages/fraud-risk.html` — risk investigation workflow.

## Data modeling

Dashboard metrics are sourced from `assets/data/dashboard-data.json`. This mock data file feeds the status banner and KPI overview cards in the operations dashboard, illustrating how a lightweight data layer can power UI without a backend.

## Tech stack

- HTML5 + CSS3
- Vanilla JavaScript
- Static JSON for mock data

## Running locally

No build step is required. You can open `index.html` directly in your browser, or run a local web server:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.
