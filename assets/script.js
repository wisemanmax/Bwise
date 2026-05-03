// Improved script.js with error handling, performance optimizations, and accessibility

document.documentElement.classList.add('js-enabled');

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Debounce function to limit execution rate
 */
function debounce(fn, delay = 250) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), delay);
  };
}

/**
 * Announce changes to screen readers
 */
function announceToScreenReader(message) {
  const liveRegion = document.getElementById('aria-live-region') || createLiveRegion();
  liveRegion.textContent = message;
  setTimeout(() => liveRegion.textContent = '', 1000);
}

function createLiveRegion() {
  const region = document.createElement('div');
  region.id = 'aria-live-region';
  region.className = 'sr-only';
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  document.body.appendChild(region);
  return region;
}

/**
 * Safe querySelector with error handling
 */
function safeQuery(selector, context = document) {
  try {
    return context.querySelector(selector);
  } catch (error) {
    console.error(`Query failed for selector: ${selector}`, error);
    return null;
  }
}

function safeQueryAll(selector, context = document) {
  try {
    return context.querySelectorAll(selector);
  } catch (error) {
    console.error(`QueryAll failed for selector: ${selector}`, error);
    return [];
  }
}

// ============================================================================
// MOBILE NAVIGATION
// ============================================================================

class MobileNavigation {
  constructor() {
    this.navToggle = safeQuery('.nav-toggle');
    this.navMenu = safeQuery('.nav-menu');
    this.focusableElements = [];
    
    if (!this.navToggle || !this.navMenu) {
      console.warn('Navigation elements not found');
      return;
    }
    
    this.init();
  }

  init() {
    // Setup event listeners
    this.navToggle.addEventListener('click', () => this.toggleMenu());
    
    // Close menu when clicking on links
    this.navMenu.addEventListener('click', (e) => {
      if (e.target.tagName === 'A' && this.navMenu.classList.contains('open')) {
        this.closeMenu();
      }
    });

    // Close menu on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.navMenu.classList.contains('open')) {
        this.closeMenu();
        this.navToggle.focus();
      }
    });

    // Setup focus trap
    this.setupFocusTrap();
  }

  setupFocusTrap() {
    this.focusableElements = Array.from(
      this.navMenu.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])')
    );

    this.navMenu.addEventListener('keydown', (e) => this.trapFocus(e));
  }

  trapFocus(e) {
    if (e.key !== 'Tab' || !this.navMenu.classList.contains('open')) return;
    if (this.focusableElements.length === 0) return;

    const first = this.focusableElements[0];
    const last = this.focusableElements[this.focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  toggleMenu() {
    const isOpen = this.navMenu.classList.toggle('open');
    this.navToggle.setAttribute('aria-expanded', String(isOpen));
    
    if (isOpen) {
      this.openMenu();
    } else {
      this.closeMenu();
    }
  }

  openMenu() {
    document.body.style.overflow = 'hidden';
    announceToScreenReader('Navigation menu opened');
    
    // Focus first menu item
    setTimeout(() => {
      if (this.focusableElements.length > 0) {
        this.focusableElements[0].focus();
      }
    }, 100);
  }

  closeMenu() {
    this.navMenu.classList.remove('open');
    this.navToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    announceToScreenReader('Navigation menu closed');
  }
}

// ============================================================================
// DASHBOARD MANAGER
// ============================================================================

class DashboardSection {
  constructor(root, dataSet) {
    this.root = root;
    this.dataSet = dataSet;
    this.animationTimeout = null;
    this.viewButtons = Array.from(safeQueryAll('.demo-btn[data-view]', this.root));
    this.metricCards = Array.from(safeQueryAll('.metric-card', this.root));

    if (this.viewButtons.length === 0) {
      return;
    }

    this.currentView = this.getInitialView();
    this.init();
  }

  getInitialView() {
    const activeButton = this.viewButtons.find(btn => btn.classList.contains('active')) || this.viewButtons[0];
    return activeButton ? activeButton.dataset.view : null;
  }

  init() {
    this.viewButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view) this.setView(view);
      });
    });

    this.setupKeyboardNavigation();

    if (this.currentView) {
      this.setView(this.currentView);
    }
  }

  setupKeyboardNavigation() {
    this.viewButtons.forEach((btn, index) => {
      btn.addEventListener('keydown', (e) => {
        let targetIndex;

        switch (e.key) {
          case 'ArrowRight':
          case 'ArrowDown':
            targetIndex = (index + 1) % this.viewButtons.length;
            break;
          case 'ArrowLeft':
          case 'ArrowUp':
            targetIndex = (index - 1 + this.viewButtons.length) % this.viewButtons.length;
            break;
          case 'Home':
            targetIndex = 0;
            break;
          case 'End':
            targetIndex = this.viewButtons.length - 1;
            break;
          default:
            return;
        }

        e.preventDefault();
        this.viewButtons[targetIndex].focus();
      });
    });
  }

  setView(view) {
    if (!this.dataSet[view]) {
      console.error(`Invalid view: ${view}`);
      return;
    }

    this.currentView = view;

    try {
      this.updateMetrics(this.dataSet[view]);
      this.updateButtons(view);
      this.animateCards();

      const viewName = view.replace(/-/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
      announceToScreenReader(`${viewName} view selected`);
    } catch (error) {
      console.error('Error updating dashboard view:', error);
      announceToScreenReader('Error updating dashboard');
    }
  }

  updateMetrics(data) {
    const metricNodes = safeQueryAll('[data-metric-key]', this.root);

    if (metricNodes.length > 0) {
      metricNodes.forEach(node => {
        const key = node.dataset.metricKey;
        const values = data[key];
        if (!values) return;

        const valueElement = node.querySelector('.metric-value');
        const changeElement = node.querySelector('.metric-change');

        this.animateValueChange(valueElement, values.value);
        if (changeElement) {
          changeElement.textContent = values.change;
        }
      });
      return;
    }

    Object.entries(data).forEach(([key, values]) => {
      const valueElement = document.getElementById(key);
      const changeElement = document.getElementById(`${key}Change`);

      this.animateValueChange(valueElement, values.value);
      if (changeElement) {
        changeElement.textContent = values.change;
      }
    });
  }

  animateValueChange(valueElement, nextValue) {
    if (!valueElement) return;
    valueElement.style.transition = 'opacity 0.2s';
    valueElement.style.opacity = '0.5';

    setTimeout(() => {
      valueElement.textContent = nextValue;
      valueElement.style.opacity = '1';
    }, 100);
  }

  updateButtons(activeView) {
    this.viewButtons.forEach(btn => {
      const isActive = btn.dataset.view === activeView;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  animateCards() {
    clearTimeout(this.animationTimeout);

    this.animationTimeout = setTimeout(() => {
      this.metricCards.forEach((card, index) => {
        card.classList.remove('pulse');
        void card.offsetWidth;
        setTimeout(() => {
          card.classList.add('pulse');
        }, index * 50);
      });
    }, 100);
  }
}

class DashboardManager {
  constructor() {
    this.dataSets = {
      reporting: {
        monthly: {
          totalReports: { value: '2,847', change: 'Up 12 percent from last period' },
          timeSaved: { value: '1,240', change: 'About 60 percent efficiency gain' },
          complianceScore: { value: '98.4', change: 'Stable and in target range' },
          userSatisfaction: { value: '4.8', change: 'High adoption and positive feedback' }
        },
        quarterly: {
          totalReports: { value: '8,310', change: 'Up 18 percent vs prior quarter' },
          timeSaved: { value: '3,720', change: 'Manual work down about 64 percent' },
          complianceScore: { value: '98.7', change: 'Slight improvement after new checks' },
          userSatisfaction: { value: '4.7', change: 'Consistent positive feedback' }
        },
        yearly: {
          totalReports: { value: '32,400', change: 'Up 26 percent year over year' },
          timeSaved: { value: '14,800', change: 'Full year impact across all units' },
          complianceScore: { value: '98.9', change: 'Sustained performance at target' },
          userSatisfaction: { value: '4.8', change: 'Strong sentiment at scale' }
        }
      },
      'mock-api': {
        core: {
          versionedEndpoints: { value: '18', change: 'CRUD, admin, and reporting APIs' },
          authCoverage: { value: '100%', change: 'RBAC, scopes, and policy checks' },
          jobSuccessRate: { value: '99.3%', change: 'Scheduled rollups with retries' },
          testCoverage: { value: '93%', change: 'CI gated with minimum threshold' }
        },
        jobs: {
          versionedEndpoints: { value: '12', change: 'Job-triggering endpoints + webhooks' },
          authCoverage: { value: '100%', change: 'Signed payloads for job workflows' },
          jobSuccessRate: { value: '99.6%', change: 'Retry queue within SLA' },
          testCoverage: { value: '91%', change: 'Job workflows + scheduler tests' }
        },
        security: {
          versionedEndpoints: { value: '16', change: 'Auth endpoints with token rotation' },
          authCoverage: { value: '100%', change: 'Policy + MFA-ready session controls' },
          jobSuccessRate: { value: '98.8%', change: 'Security checks inline with jobs' },
          testCoverage: { value: '95%', change: 'Security unit + integration tests' }
        },
        quality: {
          versionedEndpoints: { value: '20', change: 'API catalog fully documented' },
          authCoverage: { value: '100%', change: 'Coverage verified by test suites' },
          jobSuccessRate: { value: '99.1%', change: 'Stability tracked in QA dashboards' },
          testCoverage: { value: '96%', change: 'Automation gates and regression packs' }
        }
      },
      cicd: {
        ci: {
          buildSuccess: { value: '98.8%', change: 'Last 30 builds passing' },
          qualityGates: { value: '6', change: 'Lint, tests, coverage, security' },
          deployCadence: { value: 'Weekly', change: 'Stable, staged promotions' },
          mttr: { value: '12 min', change: 'Automated rollback runbooks' }
        },
        quality: {
          buildSuccess: { value: '99.1%', change: 'Optimized caching and build reuse' },
          qualityGates: { value: '8', change: 'Added contract + perf checks' },
          deployCadence: { value: 'Bi-weekly', change: 'Quality focus window' },
          mttr: { value: '10 min', change: 'Incident response refinements' }
        },
        deploy: {
          buildSuccess: { value: '98.4%', change: 'Deployment smoke tests tracked' },
          qualityGates: { value: '7', change: 'Release checklist enforced' },
          deployCadence: { value: 'Weekly', change: 'Automated stage promotions' },
          mttr: { value: '9 min', change: 'Blue/green rollback ready' }
        },
        release: {
          buildSuccess: { value: '99.3%', change: 'Release stabilization branch' },
          qualityGates: { value: '9', change: 'Audit + approval gates added' },
          deployCadence: { value: 'Monthly', change: 'Stakeholder release cadence' },
          mttr: { value: '11 min', change: 'Post-release validation runbook' }
        }
      }
    };

    this.sections = safeQueryAll('.demo-section');

    if (this.sections.length === 0) {
      console.info('Dashboard not present on this page');
      return;
    }

    this.sections.forEach(section => {
      const key = section.dataset.dashboard || 'reporting';
      const dataSet = this.dataSets[key];
      if (dataSet) {
        new DashboardSection(section, dataSet);
      }
    });
  }
}

// ============================================================================
// INTERSECTION OBSERVER FOR SCROLL ANIMATIONS
// ============================================================================

class ScrollAnimations {
  constructor() {
    this.options = {
      threshold: 0.15,
      rootMargin: '0px 0px -50px 0px'
    };

    this.init();
  }

  init() {
    // Check for browser support
    if (!('IntersectionObserver' in window)) {
      console.info('IntersectionObserver not supported');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => this.handleIntersection(entries),
      this.options
    );

    // Observe all animatable elements
    const selectors = [
      '.experience-card',
      '.skill-card',
      '.metric-card',
      '.featured-story',
      '.stat-box'
    ];

    selectors.forEach(selector => {
      safeQueryAll(selector).forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
      });
    });
  }

  handleIntersection(entries) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  }
}

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

class PerformanceMonitor {
  constructor() {
    if ('PerformanceObserver' in window) {
      this.observeLCP();
      this.observeFID();
    }
    
    this.logPageLoad();
  }

  observeLCP() {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        console.log('LCP:', lastEntry.renderTime || lastEntry.loadTime);
      });
      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (error) {
      console.warn('LCP observation failed:', error);
    }
  }

  observeFID() {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          console.log('FID:', entry.processingStart - entry.startTime);
        });
      });
      observer.observe({ entryTypes: ['first-input'] });
    } catch (error) {
      console.warn('FID observation failed:', error);
    }
  }

  logPageLoad() {
    window.addEventListener('load', () => {
      if (performance.getEntriesByType) {
        const [navigation] = performance.getEntriesByType('navigation');
        if (navigation) {
          console.log('Page Load Time:', navigation.loadEventEnd - navigation.fetchStart, 'ms');
          console.log('DOM Interactive:', navigation.domInteractive - navigation.fetchStart, 'ms');
        }
      }
    });
  }
}

// ============================================================================
// SMOOTH SCROLL FOR ANCHOR LINKS
// ============================================================================

function initSmoothScroll() {
  safeQueryAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      
      // Skip empty anchors
      if (href === '#' || href === '#!') return;

      const target = safeQuery(href);
      if (!target) return;

      e.preventDefault();
      
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });

      // Update focus for accessibility
      target.setAttribute('tabindex', '-1');
      target.focus();
      
      // Update URL without jumping
      history.pushState(null, null, href);
    });
  });
}

// ============================================================================
// BACKEND SHOWCASE INTERACTIONS
// ============================================================================

class BackendShowcase {
  constructor() {
    this.filterButtons = safeQueryAll('[data-showcase-filter]');
    this.cards = safeQueryAll('[data-showcase-tag]');
    this.summary = safeQuery('[data-showcase-summary]');
    this.kpiNodes = safeQueryAll('[data-showcase-kpi]');
    this.maskToggle = safeQuery('[data-mask-toggle]');
    this.maskedValues = safeQueryAll('[data-mask-value]');
    this.retryButton = safeQuery('[data-retry-button]');
    this.retryStatus = safeQuery('[data-retry-status]');
    this.logStream = safeQuery('[data-log-stream]');
    this.auditLog = safeQuery('[data-audit-log]');

    this.kpiValues = {
      all: {
        services: { value: '12', change: 'Versioned APIs, jobs, and reporting endpoints' },
        coverage: { value: '92%', change: 'Unit + integration suites with quality gates' },
        latency: { value: '180ms', change: 'Optimized queries + caching strategy' },
        compliance: { value: '99%', change: 'Secure logging, masking, and evidence trails' }
      },
      backend: {
        services: { value: '6', change: 'CRUD APIs, auth middleware, and background jobs' },
        coverage: { value: '94%', change: 'Controller + service layer test coverage' },
        latency: { value: '140ms', change: 'API optimized with async I/O + caching' },
        compliance: { value: '97%', change: 'Threat modeling and endpoint hardening' }
      },
      data: {
        services: { value: '4', change: 'Reporting views and data validation jobs' },
        coverage: { value: '90%', change: 'SQL unit tests + migration verification' },
        latency: { value: '220ms', change: 'Index tuning on high volume reports' },
        compliance: { value: '98%', change: 'Data lineage and masking controls' }
      },
      enterprise: {
        services: { value: '5', change: 'Admin portal, RBAC, and form builder' },
        coverage: { value: '93%', change: 'Role/permission logic fully tested' },
        latency: { value: '160ms', change: 'UI actions backed by cached policies' },
        compliance: { value: '99%', change: 'Audit log coverage for all admin actions' }
      },
      devops: {
        services: { value: '8', change: 'CI pipelines, checks, and deployments' },
        coverage: { value: '95%', change: 'Coverage gates enforced in CI' },
        latency: { value: '170ms', change: 'Performance baselines tracked per release' },
        compliance: { value: '98%', change: 'Release evidence and change logs' }
      },
      security: {
        services: { value: '7', change: 'Authorization and security services' },
        coverage: { value: '91%', change: 'Auth, validation, and logging tests' },
        latency: { value: '150ms', change: 'Security middleware optimized' },
        compliance: { value: '99%', change: 'Audit readiness controls always on' }
      }
    };

    this.summaryText = {
      all: 'Multi-system view: backend APIs, analytics pipelines, admin tooling, and compliance controls aligned to internal SLAs and regulatory audit expectations.',
      backend: 'Backend view: CRUD APIs, versioned endpoints, background jobs, retry logic, and structured logging for operational visibility.',
      data: 'Data view: normalized SQL schemas, migration scripts, indexed tables, and KPI-ready reporting layers.',
      enterprise: 'Enterprise view: admin portals with RBAC, feature flags, dynamic form builders, and audit trails.',
      devops: 'DevOps view: CI/CD, test coverage gates, deployment readiness, and branching discipline.',
      security: 'Security view: input validation, authorization checks, secure logging, and data masking.'
    };

    if (
      this.filterButtons.length === 0 &&
      this.cards.length === 0 &&
      !this.summary &&
      this.kpiNodes.length === 0
    ) {
      return;
    }

    this.currentFilter = 'all';
    this.init();
  }

  init() {
    this.filterButtons.forEach(button => {
      button.addEventListener('click', () => this.applyFilter(button.dataset.showcaseFilter));
    });

    if (this.maskToggle) {
      this.maskToggle.addEventListener('click', () => this.toggleMaskedValues());
    }

    if (this.retryButton) {
      this.retryButton.addEventListener('click', () => this.simulateRetries());
    }

    if (this.logStream) {
      this.startLogStreamRotation();
    }

    if (this.auditLog) {
      this.startAuditLogRotation();
    }
  }

  applyFilter(filter) {
    if (!filter || !this.kpiValues[filter]) {
      return;
    }

    this.currentFilter = filter;
    this.filterButtons.forEach(button => {
      const isActive = button.dataset.showcaseFilter === filter;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });

    this.cards.forEach(card => {
      const tags = (card.dataset.showcaseTag || '').split(',').map(tag => tag.trim());
      const shouldShow = filter === 'all' || tags.includes(filter);
      card.style.display = shouldShow ? '' : 'none';
    });

    this.updateSummary();
    this.updateKpis();
  }

  updateSummary() {
    if (this.summary) {
      this.summary.textContent = this.summaryText[this.currentFilter] || this.summaryText.all;
    }
  }

  updateKpis() {
    const values = this.kpiValues[this.currentFilter];
    if (!values) return;

    this.kpiNodes.forEach(node => {
      const key = node.dataset.kpiKey;
      if (!key || !values[key]) return;

      const valueNode = node.querySelector('.metric-value');
      const changeNode = node.querySelector('.metric-change');

      if (valueNode) valueNode.textContent = values[key].value;
      if (changeNode) changeNode.textContent = values[key].change;

      node.classList.add('pulse');
      setTimeout(() => node.classList.remove('pulse'), 600);
    });
  }

  toggleMaskedValues() {
    this.maskedValues.forEach(valueNode => {
      const isMasked = valueNode.textContent === valueNode.dataset.maskValue;
      valueNode.textContent = isMasked ? valueNode.dataset.maskRaw : valueNode.dataset.maskValue;
    });
  }

  simulateRetries() {
    if (!this.retryStatus) return;
    const steps = [
      'Attempt 1 failed: SQL timeout. Waiting 2s...',
      'Attempt 2 failed: transient network error. Waiting 4s...',
      'Attempt 3 succeeded: rollup completed.'
    ];

    let index = 0;
    this.retryStatus.textContent = steps[index];

    const interval = setInterval(() => {
      index += 1;
      if (index >= steps.length) {
        clearInterval(interval);
        return;
      }
      this.retryStatus.textContent = steps[index];
    }, 1000);
  }

  startLogStreamRotation() {
    const messages = [
      '[2025-01-08 10:11:32Z] api.v1.qa-scores POST 201 (Auth=Required, Trace=8f3a...)',
      '[2025-01-08 10:11:33Z] jobs.qa-score-rollup SUCCESS duration=842ms',
      '[2025-01-08 10:11:34Z] sql.reporting VIEW REFRESHED (QaScoresDaily)',
      '[2025-01-08 10:11:36Z] audit.user-role UPDATE user=ops_admin role=ComplianceLead',
      '[2025-01-08 10:11:40Z] security.masking PII redaction applied fields=SSN,DOB',
      '[2025-01-08 10:11:45Z] auth.jwt REFRESH token issued user=qa_supervisor'
    ];

    let offset = 0;
    setInterval(() => {
      if (!this.logStream) return;
      offset = (offset + 1) % messages.length;
      const output = messages.slice(offset).concat(messages.slice(0, offset)).join('\n');
      this.logStream.textContent = output;
    }, 6000);
  }

  startAuditLogRotation() {
    const entries = [
      '[2025-01-08 09:02] jlee updated form qa-scorecard-v4 (sections=2, questions=6)',
      '[2025-01-08 09:11] kpatel updated role compliance_lead (added audit.write)',
      '[2025-01-08 09:21] mrobinson toggled feature flag new-qa-dashboard ON',
      '[2025-01-08 09:34] rhuang exported QA report (filters=region-east, month=Dec)',
      '[2025-01-08 09:47] sjohnson approved release v1.4.0 (change-id=CR-1842)'
    ];

    let start = 0;
    setInterval(() => {
      if (!this.auditLog) return;
      start = (start + 1) % entries.length;
      const output = entries.slice(start).concat(entries.slice(0, start)).join('\n');
      this.auditLog.textContent = output;
    }, 8000);
  }
}

// ============================================================================
// PLATFORM LAB INTERACTIONS
// ============================================================================

class PlatformLab {
  constructor() {
    this.filterButtons = safeQueryAll('[data-lab-filter]');
    this.cards = safeQueryAll('[data-lab-tag]');
    this.summary = safeQuery('[data-lab-summary]');
    this.deliverables = safeQuery('[data-lab-deliverables]');
    this.kpiNodes = safeQueryAll('[data-lab-kpi]');
    this.pipelineButton = safeQuery('[data-pipeline-run]');
    this.pipelineSteps = safeQueryAll('[data-pipeline-step]');
    this.pipelineStatus = safeQuery('[data-pipeline-status]');
    this.promptChips = safeQueryAll('[data-prompt-chip]');
    this.promptTitle = safeQuery('[data-prompt-title]');
    this.promptDescription = safeQuery('[data-prompt-description]');
    this.promptArtifacts = safeQuery('[data-prompt-artifacts]');
    this.promptNotes = safeQuery('[data-prompt-notes]');
    this.promptCode = safeQuery('[data-prompt-code]');

    this.kpiValues = {
      backend: {
        deliverables: { value: '7', change: 'API modules, jobs, and support services' },
        readiness: { value: '88%', change: 'Auth + tests in progress' },
        owners: { value: '4', change: 'Engineering, QA, ops, security' }
      },
      data: {
        deliverables: { value: '5', change: 'Schema, migrations, reporting views' },
        readiness: { value: '82%', change: 'Indexing and KPI mapping remaining' },
        owners: { value: '3', change: 'Data engineering + analytics' }
      },
      enterprise: {
        deliverables: { value: '6', change: 'Portal, form builder, audit log' },
        readiness: { value: '90%', change: 'RBAC and change tracking ready' },
        owners: { value: '4', change: 'Product, ops, compliance, eng' }
      },
      devops: {
        deliverables: { value: '4', change: 'Pipelines, quality gates, releases' },
        readiness: { value: '86%', change: 'Security scans to finalize' },
        owners: { value: '2', change: 'DevOps + engineering' }
      },
      security: {
        deliverables: { value: '5', change: 'Validation, masking, audit notes' },
        readiness: { value: '92%', change: 'Evidence pack automation' },
        owners: { value: '3', change: 'Security + compliance' }
      }
    };

    this.summaryText = {
      backend: {
        summary: 'Backend view: CRUD APIs, background jobs, versioned endpoints, and structured logging layered with secure configuration handling.',
        deliverables: ['API v1: QA Scores', 'API v1: Audit Events', 'Secrets via Env', 'Job Scheduler']
      },
      data: {
        summary: 'Data view: SQL schema normalization, legacy migration scripts, KPI rollups, and query optimization with indexed tables.',
        deliverables: ['Schema v2', 'Migration scripts', 'KPI views', 'Query plans']
      },
      enterprise: {
        summary: 'Enterprise view: Admin portal with RBAC, form builder workflows, and audit trails for every critical action.',
        deliverables: ['Admin portal', 'Form builder', 'Audit log', 'Feature flags']
      },
      devops: {
        summary: 'DevOps view: CI/CD pipelines with tests, linting, quality checks, and controlled deployments with rollback playbooks.',
        deliverables: ['CI YAML', 'Coverage gates', 'Release checklist', 'Rollback plan']
      },
      security: {
        summary: 'Security view: Input validation, authorization checks, data masking, and audit readiness notes.',
        deliverables: ['Auth policies', 'Masking rules', 'Secure logging', 'Audit notes']
      }
    };

    this.promptData = {
      chatbot: {
        title: 'AI Chatbot for Contact Center QA',
        description: 'Build a secure chatbot that answers QA policy questions, logs feedback, and routes complex issues to supervisors.',
        artifacts: [
          'Node API with /messages endpoint',
          'Policy knowledge base schema',
          'UI chat widget with logging'
        ],
        notes: [
          'Integrate auth middleware and rate limiting',
          'Persist transcripts for audit trails',
          'Deploy via Replit + GitHub sync'
        ],
        code: '// Sample prompt\n\"Build a compliance-aware QA assistant chatbot with role-based responses\\nand logging for every conversation.\"'
      },
      dashboard: {
        title: 'Data Visualization Studio',
        description: 'Generate a KPI dashboard with filters, drilldowns, and story-driven insights for leadership.',
        artifacts: [
          'Analytics API with KPI endpoints',
          'Chart components for trends and alerts',
          'CSV export pipeline'
        ],
        notes: [
          'Explain KPI definitions in tooltips',
          'Connect to Snowflake or Postgres',
          'Ship weekly snapshots automatically'
        ],
        code: '// Sample prompt\n\"Create a Power BI-style dashboard with KPI cards, filters,\\nand a narrative insight panel.\"'
      },
      game: {
        title: '2D Retro Ops Game',
        description: 'Build a retro game that teaches contact center compliance through fun scenarios and scoring.',
        artifacts: [
          'Sprite atlas + game loop',
          'Scoring logic and timers',
          'Achievement system'
        ],
        notes: [
          'Use leaderboard for training cohorts',
          'Add accessibility mode for keyboard only',
          'Deploy to Replit for quick playtests'
        ],
        code: '// Sample prompt\n\"Create a 2D retro training game with levels, scoring,\\nand a compliance checklist.\"'
      },
      mobile: {
        title: 'Mobile Companion App',
        description: 'Prototype a mobile app for supervisors to review QA scores and approve escalations.',
        artifacts: [
          'React Native UI kit',
          'Secure API client',
          'Offline-ready sync queue'
        ],
        notes: [
          'Push notifications for urgent escalations',
          'Masked PII by default',
          'Sync to main API every 15 minutes'
        ],
        code: '// Sample prompt\n\"Design a mobile app for supervisors with QA scorecards,\\nsecure approvals, and push alerts.\"'
      }
    };

    if (
      this.filterButtons.length === 0 &&
      this.cards.length === 0 &&
      !this.pipelineButton &&
      this.promptChips.length === 0
    ) {
      return;
    }

    this.currentFilter = 'backend';
    this.pipelineInterval = null;
    this.init();
  }

  init() {
    this.filterButtons.forEach(button => {
      button.addEventListener('click', () => this.applyFilter(button.dataset.labFilter));
    });

    if (this.pipelineButton) {
      this.pipelineButton.addEventListener('click', () => this.runPipeline());
    }

    if (this.promptChips.length > 0) {
      this.promptChips.forEach(chip => {
        chip.addEventListener('click', () => this.setPrompt(chip.dataset.promptKey));
      });
    }

    this.applyFilter(this.currentFilter);
    this.setPrompt('chatbot');
  }

  applyFilter(filter) {
    if (!filter || !this.kpiValues[filter]) return;
    this.currentFilter = filter;

    this.filterButtons.forEach(button => {
      const isActive = button.dataset.labFilter === filter;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });

    this.cards.forEach(card => {
      const tags = (card.dataset.labTag || '').split(',').map(tag => tag.trim());
      const shouldShow = tags.includes(filter);
      card.style.display = shouldShow ? '' : 'none';
    });

    this.updateSummary();
    this.updateKpis();
  }

  updateSummary() {
    const info = this.summaryText[this.currentFilter];
    if (!info) return;

    if (this.summary) {
      this.summary.textContent = info.summary;
    }

    if (this.deliverables) {
      this.deliverables.innerHTML = info.deliverables.map(item => `<span>${item}</span>`).join('');
    }
  }

  updateKpis() {
    const values = this.kpiValues[this.currentFilter];
    if (!values) return;

    this.kpiNodes.forEach(node => {
      const key = node.dataset.kpiKey;
      if (!key || !values[key]) return;

      const valueNode = node.querySelector('.metric-value');
      const changeNode = node.querySelector('.metric-change');

      if (valueNode) valueNode.textContent = values[key].value;
      if (changeNode) changeNode.textContent = values[key].change;

      node.classList.add('pulse');
      setTimeout(() => node.classList.remove('pulse'), 600);
    });
  }

  runPipeline() {
    if (!this.pipelineSteps.length || !this.pipelineStatus) return;
    if (this.pipelineInterval) clearInterval(this.pipelineInterval);

    this.pipelineSteps.forEach(step => step.classList.remove('is-active'));
    this.pipelineStatus.textContent = 'Pipeline started...';

    let index = 0;
    this.pipelineInterval = setInterval(() => {
      if (index > 0) this.pipelineSteps[index - 1].classList.remove('is-active');
      if (index < this.pipelineSteps.length) {
        this.pipelineSteps[index].classList.add('is-active');
        this.pipelineStatus.textContent = `Running: ${this.pipelineSteps[index].textContent}`;
        index += 1;
      } else {
        this.pipelineStatus.textContent = 'Pipeline complete. Release ready.';
        clearInterval(this.pipelineInterval);
      }
    }, 900);
  }

  setPrompt(key) {
    if (!key || !this.promptData[key]) return;
    const data = this.promptData[key];

    this.promptChips.forEach(chip => {
      chip.classList.toggle('active', chip.dataset.promptKey === key);
    });

    if (this.promptTitle) this.promptTitle.textContent = data.title;
    if (this.promptDescription) this.promptDescription.textContent = data.description;
    if (this.promptArtifacts) {
      this.promptArtifacts.innerHTML = data.artifacts.map(item => `<li>${item}</li>`).join('');
    }
    if (this.promptNotes) {
      this.promptNotes.innerHTML = data.notes.map(item => `<li>${item}</li>`).join('');
    }
    if (this.promptCode) {
      this.promptCode.textContent = data.code;
    }
  }
}

// ============================================================================
// LEARNING LIBRARY
// ============================================================================

class LearningLibrary {
  constructor(section) {
    this.section = section;
    this.track = section.dataset.libraryTrack;
    this.source = section.dataset.librarySource || '../assets/data/learning-library.json';
    this.searchInput = safeQuery('[data-library-search]', section);
    this.levelFilter = safeQuery('[data-library-filter]', section);
    this.grid = safeQuery('[data-library-grid]', section);
    this.countLabel = safeQuery('[data-library-count]', section);
    this.loadMoreButton = safeQuery('[data-library-more]', section);
    this.visibleCount = 12;
    this.items = [];
    this.filteredItems = [];
  }

  async init() {
    if (!this.track || !this.grid) return;

    try {
      this.items = await LearningLibrary.loadData(this.source);
      this.filteredItems = this.items.filter(item => item.track === this.track);
      this.applyFilters();
      this.bindEvents();
    } catch (error) {
      console.error('Learning library failed to load', error);
      if (this.grid) {
        this.grid.innerHTML = '<p class="library-empty">Unable to load library data.</p>';
      }
    }
  }

  static async loadData(source) {
    if (!LearningLibrary.cache) {
      LearningLibrary.cache = {};
    }
    if (LearningLibrary.cache[source]) {
      return LearningLibrary.cache[source];
    }
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Library fetch failed: ${response.status}`);
    }
    const data = await response.json();
    LearningLibrary.cache[source] = data;
    return data;
  }

  bindEvents() {
    if (this.searchInput) {
      this.searchInput.addEventListener('input', debounce(() => {
        this.visibleCount = 12;
        this.applyFilters();
      }, 200));
    }

    if (this.levelFilter) {
      this.levelFilter.addEventListener('change', () => {
        this.visibleCount = 12;
        this.applyFilters();
      });
    }

    if (this.loadMoreButton) {
      this.loadMoreButton.addEventListener('click', () => {
        this.visibleCount += 12;
        this.render();
      });
    }
  }

  applyFilters() {
    const query = this.searchInput ? this.searchInput.value.trim().toLowerCase() : '';
    const level = this.levelFilter ? this.levelFilter.value : 'all';
    this.filteredItems = this.items.filter(item => {
      if (item.track !== this.track) return false;
      const matchesLevel = level === 'all' || item.level === level;
      const haystack = `${item.title} ${item.summary} ${item.focus} ${(item.tags || []).join(' ')}`.toLowerCase();
      const matchesQuery = !query || haystack.includes(query);
      return matchesLevel && matchesQuery;
    });

    this.render();
  }

  render() {
    if (!this.grid) return;
    this.grid.innerHTML = '';

    const fragment = document.createDocumentFragment();
    const visibleItems = this.filteredItems.slice(0, this.visibleCount);

    visibleItems.forEach(item => {
      const card = document.createElement('article');
      card.className = 'library-card';
      card.innerHTML = `
        <div class="library-card__header">
          <span class="library-card__track">${item.track.toUpperCase()}</span>
          <span class="library-card__level">${item.level}</span>
        </div>
        <h3 class="library-card__title">${item.title}</h3>
        <p class="library-card__summary">${item.summary}</p>
        <div class="library-card__meta">
          <span>${item.duration}</span>
          <span>${item.focus}</span>
        </div>
        <div class="library-card__tags">
          ${(item.tags || []).map(tag => `<span class="library-tag">${tag}</span>`).join('')}
        </div>
      `;
      fragment.appendChild(card);
    });

    if (visibleItems.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'library-empty';
      empty.textContent = 'No modules match your filters yet.';
      fragment.appendChild(empty);
    }

    this.grid.appendChild(fragment);

    if (this.countLabel) {
      this.countLabel.textContent = `${this.filteredItems.length.toLocaleString()} modules available`;
    }

    if (this.loadMoreButton) {
      this.loadMoreButton.disabled = this.visibleCount >= this.filteredItems.length;
      this.loadMoreButton.textContent = this.loadMoreButton.disabled ? 'All modules loaded' : 'Load more modules';
    }
  }
}

LearningLibrary.cache = null;

// ============================================================================
// SITE TOUR
// ============================================================================

class SiteTour {
  constructor() {
    this.seenKey = 'byheir-tour-seen-v1';
    this.stateKey = 'byheir-tour-state-v1';
    this.tourSets = SiteTour.buildTourSets();

    this.mode = null;
    this.steps = [];
    this.currentIndex = -1;
    this.active = false;
    this.lastFocus = null;
    this.elements = {};
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.handleKeydown = this.handleKeydown.bind(this);
    this.handleFocusTrap = this.handleFocusTrap.bind(this);
    this.reposition = this.reposition.bind(this);
    this._rafPending = false;

    this.init();
  }

  static buildTourSets() {
    return {
      full: [
        { page: '/', id: 'hero',
          title: "Welcome — here's the full tour",
          body: "Seven-plus years in regulated fintech, end-to-end ownership of BI platforms and full-stack apps. The status badge is live: I'm available for opportunities.",
          details: [
            "Use Next / Back, or arrow keys, to navigate",
            "Skip anytime — resume from the tour chip",
            "Every project, demo, and live app — start to finish"
          ] },
        { page: '/', id: 'about',
          title: "What I actually do",
          body: "Power BI / Snowflake reporting at Sallie Mae, plus full-stack tools when product gaps need filling.",
          details: [
            "Bridge between BI, ops, compliance, and engineering",
            "Production-grade data models and dashboards",
            "Ship the supporting apps when no team exists"
          ] },
        { page: '/', id: 'experience',
          title: "Seven years at Sallie Mae — with the receipts",
          body: "Measurable impact, shipped systems. The bullets behind the headline are highlighted here.",
          details: [
            "1,000+ users on my reporting pipeline",
            "60% manual reporting eliminated via Python automation",
            "AI-augmented Snowflake testing platform — solo build"
          ] },
        { page: '/', id: 'projects-partnerpulse',
          title: "PartnerPulse — solo, in production",
          body: "A relationship-analytics PWA on a zero-infrastructure serverless stack: GitHub Pages + Cloudflare Workers.",
          details: [
            "One shared view of partner health and engagement",
            "Edge functions for auth and data sync",
            "Live for paying users today"
          ],
          detailHref: 'https://partnerpulse.byheir.com', detailLabel: "Visit PartnerPulse", detailExternal: true },
        { page: '/', id: 'projects-builder',
          title: "The Builder — CI/CD discipline for analytics",
          body: "Enterprise release practices applied to BI deliverables.",
          details: [
            "Multi-stage data validation with branch review",
            "Change auditing and merge controls",
            "The same engineering rigor analysts deserve"
          ],
          detailHref: '/pages/the-builder.html', detailLabel: "Read the case study" },
        { page: '/', id: 'projects-ironlog',
          title: "IronLog — three-app analytics PWA suite",
          body: "IronLog, FinanceLog, and NutritionLog on a unified Supabase backend with SSO and real-time sync — designed and built solo.",
          details: [
            "One backend, three product surfaces",
            "Session-level monitoring + feature-effectiveness tracking",
            "Live in production at ironlog.space"
          ],
          detailHref: 'https://ironlog.space', detailLabel: "Visit IronLog", detailExternal: true },
        { page: '/', id: 'work-demo',
          title: "Operations Dashboard — click in and explore",
          body: "A clickable command-center hub linking the Credit Underwriting, Fraud Risk, and Collections Toolkit suites.",
          details: [
            "Saved-view chips filter every panel without reload",
            "Exec brief, live workload, KPI quickview",
            "Working demo of how I think about ops tooling"
          ],
          deepDive: { mode: 'dashboardDeepDive', label: "Walk me through the dashboard →" } },
        { page: '/', id: 'work-refi',
          title: "Refi Intelligence — portfolio analytics demo",
          body: "A React + Recharts analytics build over 5,000 synthetic refi applications — cohort heatmaps, funnel drop-off, savings distribution, and AI-augmented narrative.",
          details: [
            "Cohort table, funnel, and savings charts in one view",
            "Compare mode toggles 7-day vs 30-day side-by-side",
            "Bring-your-own-key Anthropic integration for narrative"
          ],
          detailHref: '/pages/refi-intelligence.html', detailLabel: "Open Refi Intelligence" },
        { page: '/', id: 'work-sql',
          title: "SQL Playground — real SQL, in the browser",
          body: "SQLite compiled to WebAssembly with a Snowflake-shaped lending schema. ~1,700 loans, ~28k payments, seeded patterns that reveal vintage drift, channel skew, and FICO-driven loss curves.",
          details: [
            "21 challenges across Risk, Funnel, Portfolio, Behavior, Vintage, Pricing",
            "Hard prompts use window functions and multi-CTE constructs",
            "Single file, zero backend — works offline once cached"
          ],
          detailHref: '/pages/sql-playground.html', detailLabel: "Open SQL Playground" },
        { page: '/', id: 'work-banking',
          title: "Banking PWA — installable, biometric, offline-ready",
          body: "iOS-style banking surface with biometric login, transfers, round-ups, and push notifications — built as a full PWA.",
          details: [
            "Service Worker + Web Manifest for installability",
            "Biometric auth flow and push notification hooks",
            "End-to-end UX, not just static screens"
          ],
          detailHref: '/pages/banking.html', detailLabel: "Open Banking PWA" },
        { page: '/', id: 'work-fraud',
          title: "Fraud Risk — real-time alert triage",
          body: "Risk-ops UI for monitoring fraud alerts, link analysis between actors, and identity verification.",
          details: [
            "Alert triage queue with severity weighting",
            "Link analysis surfaces relationships between cases",
            "Built to mirror real fraud-ops workflows"
          ],
          detailHref: '/pages/fraud-risk.html', detailLabel: "Open Fraud Risk" },
        { page: '/', id: 'work-credit',
          title: "Credit Underwriting — decision engine UI",
          body: "Application decisioning with document processing, manual review, and adverse-action workflow.",
          details: [
            "Decision engine output with overrides",
            "Document upload + manual review queue",
            "Adverse-action notice flow under compliance constraints"
          ],
          detailHref: '/pages/credit-underwriting.html', detailLabel: "Open Credit Underwriting" },
        { page: '/', id: 'work-collections',
          title: "Collections Toolkit — end-to-end ops suite",
          body: "Segmentation, dialer, comms hub, QA, and compliance — the full collections workflow in one UI.",
          details: [
            "Account segmentation and prioritization",
            "Outbound dialer + omnichannel comms hub",
            "QA scoring and compliance guardrails"
          ],
          detailHref: '/pages/collections-toolkit.html', detailLabel: "Open Collections Toolkit" },
        { page: '/', id: 'work-external',
          title: "Three live apps in production",
          body: "Each opens in a new tab so you don't lose your place in the tour.",
          details: [
            "IronLog — analytics PWA suite",
            "PartnerPulse — partner relationship analytics",
            "Wiseforge — chat-to-deploy site builder"
          ] },
        { page: '/', id: 'skills',
          title: "BI · SQL · Full-stack",
          body: "The combination is the point — deep enough to ship enterprise reporting and deep enough to build the apps around it.",
          details: [
            "BI: Power BI, Snowflake, semantic models",
            "Full-stack: TypeScript, PWAs, Cloudflare Workers",
            "Data: SQL at scale, Python automation, AI-assisted testing"
          ] },
        { page: '/', id: 'code-samples',
          title: "See how I write code",
          body: "Bite-sized walkthroughs across HTML, CSS, JavaScript, Backend, and CI/CD — each with a working preview.",
          details: [
            "Signal beyond bullet points on a resume",
            "Same patterns I use in production",
            "Code and live result, side by side"
          ] },
        { page: '/', id: 'contact',
          title: "Open to roles in regulated fintech",
          body: "Senior engineering, BI / data-platform, or reporting-platform roles.",
          details: [
            "Email is the fastest path",
            "Resume below for the paper trail",
            "Same-day reply most weekdays"
          ] },
        { page: '/', isRecap: true,
          title: "That's the tour.",
          body: "Two ways forward: grab the resume for a paper trail, or send a note — I usually reply the same day." }
      ],
      recruiter: [
        { page: '/', id: 'hero',
          title: "The 60-second pitch",
          body: "Seven-plus years in regulated fintech. BI platform owner. Full-stack engineer. Currently available.",
          details: [
            "7 stops · ~60 seconds",
            "Skip or finish anytime"
          ] },
        { page: '/', id: 'experience',
          title: "The receipts",
          body: "Seven years of compliance-grade delivery, with measurable outcomes.",
          details: [
            "1,000+ users on my reporting",
            "60% manual reporting eliminated via Python",
            "AI-augmented Snowflake testing platform — solo build"
          ] },
        { page: '/', id: 'projects-partnerpulse',
          title: "Solo-shipped, in production",
          body: "Three platforms architected and shipped end-to-end. Discovery to deploy. No team.",
          details: [
            "PartnerPulse — relationship analytics PWA",
            "The Builder — CI/CD for analytics",
            "IronLog — analytics PWA suite"
          ] },
        { page: '/', id: 'work-external',
          title: "Live in production today",
          body: "Real users right now — click any to verify.",
          details: [
            "IronLog (PWA suite)",
            "PartnerPulse (analytics)",
            "Wiseforge (chat-to-deploy)"
          ] },
        { page: '/', id: 'skills',
          title: "Senior IC across BI · SQL · Full-stack",
          body: "Deep enough to ship enterprise reporting AND deep enough to build the apps around it.",
          details: [
            "Power BI, Snowflake, semantic models",
            "TypeScript, PWAs, Cloudflare Workers",
            "SQL at scale, Python automation"
          ] },
        { page: '/', id: 'contact',
          title: "Open to senior roles in regulated fintech",
          body: "Senior engineering, BI / data-platform, or reporting-platform leadership.",
          details: [
            "Email gets the fastest reply",
            "Resume is one click",
            "Same-day reply most weekdays"
          ] },
        { page: '/', isRecap: true,
          title: "That's the snapshot.",
          body: "Grab the resume for the paper trail or send a note — I usually reply same day." }
      ],
      dashboardDeepDive: [
        { page: '/pages/dashboard.html', id: 'dashboard-header',
          title: "Operations Dashboard — the command center",
          body: "Designed for ops leadership to see system state in one glance — built solo.",
          details: [
            "Reporting metadata up top",
            "Live KPI quickview to the right",
            "Hand-built to show how I think about ops tooling"
          ] },
        { page: '/pages/dashboard.html', id: 'dashboard-views',
          title: "Saved views switch focus instantly",
          body: "Click any chip to filter the entire dashboard — every panel below updates without a page reload.",
          details: [
            "Filter by team, priority, or status",
            "Zero round-trips — pure client-side state",
            "URL-shareable view if needed"
          ] },
        { page: '/pages/dashboard.html', id: 'dashboard-brief',
          title: "Exec-ready summary",
          body: "The kind of one-pager I write for leadership weekly.",
          details: [
            "Headlines first, supporting bullets after",
            "All numbers update with the active filter",
            "Print-friendly layout under the hood"
          ] },
        { page: '/pages/dashboard.html', id: 'dashboard-workload',
          title: "Live workload across squads",
          body: "Status colors, progress bars, meta — every card reflects the active filters above.",
          details: [
            "Same pattern I use for production ops dashboards",
            "Accessible color choices, not just signal-by-hue",
            "Cards stay scannable as data grows"
          ] },
        { page: '/pages/dashboard.html', isRecap: true,
          recapBackHref: '/', recapBackLabel: "← Back to portfolio",
          title: "That's the demo.",
          body: "This whole dashboard is part of the portfolio — clickable, interactive, hand-built. Head back home for the rest, or take the resume." }
      ]
    };
  }

  // ---------------------------------------------------------------- lifecycle

  init() {
    this.buildPrompt();

    const chip = safeQuery('[data-tour-trigger]');
    if (chip) {
      chip.hidden = false;
      chip.addEventListener('click', () => this.openPrompt());
      this.elements.chip = chip;
    }
    this.updateChipText();

    // ?tour=recruiter|full|dashboardDeepDive (optionally &step=N) overrides the
    // prompt — useful for sharing direct links into a specific step.
    const urlMode = this.readUrlMode();
    if (urlMode) {
      this.clearState();
      const startIdx = this.readUrlStep();
      setTimeout(
        () => this.start(urlMode, startIdx == null ? undefined : startIdx),
        this.reduceMotion ? 0 : 200
      );
      return;
    }

    const state = this.loadState();
    if (state && this.tourSets[state.mode]) {
      if (state.autoResume) {
        // Cross-page nav we initiated — resume immediately
        setTimeout(() => this.start(state.mode, state.index), this.reduceMotion ? 0 : 200);
      } else {
        // Page reload or external return — offer resume
        setTimeout(() => this.openPrompt(), 600);
      }
    } else if (!this.hasBeenSeen()) {
      setTimeout(() => this.openPrompt(), 1400);
    }
  }

  readUrlMode() {
    try {
      const params = new URLSearchParams(window.location.search);
      const v = params.get('tour');
      if (v === 'recruiter' || v === 'full' || v === 'dashboardDeepDive') return v;
    } catch (e) {}
    return null;
  }

  readUrlStep() {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get('step');
      if (raw == null) return null;
      const v = parseInt(raw, 10);
      if (Number.isFinite(v) && v >= 1) return v - 1; // 1-based to 0-based
    } catch (e) {}
    return null;
  }

  updateChipText() {
    const chip = this.elements.chip;
    if (!chip) return;
    const state = this.loadState();
    const labelNode = chip.querySelector('[data-tour-chip-label]');
    const targetText = state && this.tourSets[state.mode] ? 'Resume tour' : 'Take the tour';
    if (labelNode) {
      labelNode.textContent = targetText;
    } else {
      // Fallback if the markup hasn't been updated to use a labelled span
      chip.textContent = targetText;
    }
  }

  hasBeenSeen() {
    try { return localStorage.getItem(this.seenKey) === '1'; }
    catch (e) { return false; }
  }

  markSeen() {
    try { localStorage.setItem(this.seenKey, '1'); } catch (e) {}
  }

  loadState() {
    try {
      const raw = sessionStorage.getItem(this.stateKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.mode !== 'string') return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  saveState(extras) {
    try {
      // Preserve a stashed `parent` (set when entering a deep-dive) across
      // routine state writes — otherwise every goTo within the deep-dive
      // would erase the parent reference and we'd lose the resume point.
      let prevParent = null;
      try {
        const raw = sessionStorage.getItem(this.stateKey);
        if (raw) {
          const prev = JSON.parse(raw);
          if (prev && prev.parent) prevParent = prev.parent;
        }
      } catch (e) {}
      const payload = {
        ...(prevParent ? { parent: prevParent } : {}),
        mode: this.mode,
        index: this.currentIndex,
        ...(extras || {})
      };
      sessionStorage.setItem(this.stateKey, JSON.stringify(payload));
    } catch (e) {}
  }

  clearState() {
    try { sessionStorage.removeItem(this.stateKey); } catch (e) {}
  }

  // Returns the parent-tour reference stashed by enterDeepDive, or null.
  getParent() {
    const state = this.loadState();
    if (state && state.parent && this.tourSets[state.parent.mode]) {
      return state.parent;
    }
    return null;
  }

  logEvent(name, data) {
    try {
      console.info(`[tour] ${name}`, { mode: this.mode, index: this.currentIndex, ...(data || {}) });
    } catch (e) {}
  }

  // ---------------------------------------------------------------- routing

  currentPath() {
    let p = window.location.pathname || '/';
    if (p === '' || p === '/') return '/index.html';
    if (p.endsWith('/')) return p + 'index.html';
    return p;
  }

  normalizePage(stepPage) {
    if (!stepPage || stepPage === '/' || stepPage === 'index.html') return '/index.html';
    if (stepPage.startsWith('/')) return stepPage;
    return '/' + stepPage;
  }

  pageMatches(stepPage) {
    const want = this.normalizePage(stepPage);
    const here = this.currentPath();
    return here === want || here.endsWith(want);
  }

  navigateTo(stepPage) {
    const target = this.normalizePage(stepPage);
    window.location.assign(target);
  }

  // ---------------------------------------------------------------- prompt

  buildPrompt() {
    const card = document.createElement('aside');
    card.className = 'tour-prompt';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-labelledby', 'tour-prompt-title');
    card.setAttribute('aria-describedby', 'tour-prompt-body');
    card.hidden = true;
    document.body.appendChild(card);
    this.elements.prompt = card;
  }

  renderPickerPrompt() {
    if (!this.elements.prompt) return;
    this.elements.prompt.classList.remove('is-resume');
    this.elements.prompt.innerHTML = `
      <button type="button" class="tour-prompt__close" aria-label="Dismiss tour offer">×</button>
      <p class="tour-prompt__eyebrow">First time here?</p>
      <h2 id="tour-prompt-title" class="tour-prompt__title">Take a guided tour</h2>
      <p id="tour-prompt-body" class="tour-prompt__body">Built solo. Same engine, two formats — pick the one that fits your time.</p>
      <div class="tour-prompt__actions tour-prompt__actions--stacked">
        <button type="button" class="tour-prompt__btn tour-prompt__btn--primary" data-tour-action="start-recruiter">
          <strong>Recruiter snapshot</strong>
          <span class="tour-prompt__btn-hint">~60 seconds · headlines + metrics</span>
        </button>
        <button type="button" class="tour-prompt__btn tour-prompt__btn--ghost" data-tour-action="start-full">
          <strong>Full tour</strong>
          <span class="tour-prompt__btn-hint">~90 seconds · every section, with deep-dive option</span>
        </button>
        <button type="button" class="tour-prompt__btn tour-prompt__btn--text" data-tour-action="dismiss">Not now</button>
      </div>
    `;
    this.bindPromptActions();
  }

  renderResumePrompt(state) {
    if (!this.elements.prompt) return;
    const set = this.tourSets[state.mode] || [];
    const total = set.length;
    const stepNum = Math.min(Math.max(state.index + 1, 1), total);
    const modeLabel = state.mode === 'recruiter'
      ? 'Recruiter snapshot'
      : (state.mode === 'dashboardDeepDive' ? 'Dashboard deep-dive' : 'Full tour');

    this.elements.prompt.classList.add('is-resume');
    this.elements.prompt.innerHTML = `
      <button type="button" class="tour-prompt__close" aria-label="Dismiss">×</button>
      <p class="tour-prompt__eyebrow">Tour in progress</p>
      <h2 id="tour-prompt-title" class="tour-prompt__title">Resume where you left off?</h2>
      <p id="tour-prompt-body" class="tour-prompt__body">${modeLabel} · step <strong>${stepNum} of ${total}</strong></p>
      <div class="tour-prompt__actions tour-prompt__actions--stacked">
        <button type="button" class="tour-prompt__btn tour-prompt__btn--primary" data-tour-action="resume">Resume tour →</button>
        <button type="button" class="tour-prompt__btn tour-prompt__btn--text" data-tour-action="end-resume">End tour</button>
      </div>
    `;
    this.bindPromptActions();
  }

  bindPromptActions() {
    if (!this.elements.prompt) return;
    this.elements.prompt.querySelectorAll('[data-tour-action]').forEach(btn => {
      btn.addEventListener('click', () => this.handlePromptAction(btn.dataset.tourAction));
    });
    const close = this.elements.prompt.querySelector('.tour-prompt__close');
    if (close) close.addEventListener('click', () => this.dismissPrompt());
  }

  handlePromptAction(action) {
    switch (action) {
      case 'start-recruiter':
        this.start('recruiter');
        break;
      case 'start-full':
        this.start('full');
        break;
      case 'resume': {
        const state = this.loadState();
        if (state && this.tourSets[state.mode]) {
          this.start(state.mode, state.index);
          this.logEvent('tour_resume');
        } else {
          this.renderPickerPrompt();
        }
        break;
      }
      case 'end-resume':
        this.clearState();
        this.dismissPrompt();
        this.logEvent('tour_end_from_resume');
        break;
      case 'dismiss':
      default:
        this.dismissPrompt();
        break;
    }
  }

  openPrompt() {
    if (this.active) return;
    const state = this.loadState();
    if (state && this.tourSets[state.mode]) {
      this.renderResumePrompt(state);
    } else {
      this.renderPickerPrompt();
    }
    this.elements.prompt.hidden = false;
    requestAnimationFrame(() => {
      this.elements.prompt.classList.add('is-visible');
    });
    this.logEvent('tour_prompt_show');
  }

  dismissPrompt() {
    if (!this.elements.prompt) return;
    this.elements.prompt.classList.remove('is-visible');
    setTimeout(() => {
      if (this.elements.prompt) this.elements.prompt.hidden = true;
    }, 250);
    this.markSeen();
    this.updateChipText();
    this.pulseChip();
    this.logEvent('tour_prompt_dismiss');
  }

  pulseChip() {
    if (!this.elements.chip) return;
    this.elements.chip.classList.add('is-pulsing');
    setTimeout(() => {
      if (this.elements.chip) this.elements.chip.classList.remove('is-pulsing');
    }, 4200);
  }

  // ---------------------------------------------------------------- overlay

  buildOverlay() {
    if (this.elements.overlay) return;

    const overlay = document.createElement('div');
    overlay.className = 'tour-overlay';
    overlay.setAttribute('aria-hidden', 'true');

    const spotlight = document.createElement('div');
    spotlight.className = 'tour-spotlight';
    spotlight.setAttribute('aria-hidden', 'true');

    const tooltip = document.createElement('div');
    tooltip.className = 'tour-tooltip';
    tooltip.setAttribute('role', 'dialog');
    tooltip.setAttribute('aria-modal', 'true');
    tooltip.setAttribute('aria-labelledby', 'tour-tooltip-title');
    tooltip.setAttribute('aria-describedby', 'tour-tooltip-body');
    tooltip.tabIndex = -1;
    tooltip.innerHTML = `
      <div class="tour-tooltip__head">
        <span class="tour-tooltip__step" data-tour-step-counter>1 / 1</span>
        <span class="tour-tooltip__mode" data-tour-mode-badge hidden></span>
        <button type="button" class="tour-tooltip__skip" data-tour-skip aria-label="Skip tour">Skip ✕</button>
      </div>
      <h3 id="tour-tooltip-title" class="tour-tooltip__title" data-tour-title></h3>
      <p id="tour-tooltip-body" class="tour-tooltip__body" data-tour-body></p>
      <ul class="tour-tooltip__details" data-tour-details hidden></ul>
      <a class="tour-tooltip__detail" data-tour-detail hidden>Open detail →</a>
      <button type="button" class="tour-tooltip__deepdive" data-tour-deepdive hidden></button>
      <div class="tour-tooltip__recap" data-tour-recap hidden>
        <a class="tour-tooltip__btn tour-tooltip__btn--ghost" data-tour-recap-back hidden></a>
        <a class="tour-tooltip__btn tour-tooltip__btn--primary" href="/assets/byheir-wise-resume.pdf" download>Download resume</a>
        <a class="tour-tooltip__btn tour-tooltip__btn--ghost" href="mailto:byheirw@gmail.com">Email me</a>
      </div>
      <div class="tour-tooltip__progress" data-tour-progress aria-hidden="true"></div>
      <div class="tour-tooltip__actions">
        <button type="button" class="tour-tooltip__btn tour-tooltip__btn--ghost" data-tour-prev>Back</button>
        <button type="button" class="tour-tooltip__btn tour-tooltip__btn--primary" data-tour-next>Next →</button>
      </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(spotlight);
    document.body.appendChild(tooltip);

    this.elements.overlay = overlay;
    this.elements.spotlight = spotlight;
    this.elements.tooltip = tooltip;
    this.elements.title = tooltip.querySelector('[data-tour-title]');
    this.elements.body = tooltip.querySelector('[data-tour-body]');
    this.elements.details = tooltip.querySelector('[data-tour-details]');
    this.elements.counter = tooltip.querySelector('[data-tour-step-counter]');
    this.elements.modeBadge = tooltip.querySelector('[data-tour-mode-badge]');
    this.elements.detail = tooltip.querySelector('[data-tour-detail]');
    this.elements.deepDiveBtn = tooltip.querySelector('[data-tour-deepdive]');
    this.elements.recap = tooltip.querySelector('[data-tour-recap]');
    this.elements.recapBackBtn = tooltip.querySelector('[data-tour-recap-back]');
    this.elements.prevBtn = tooltip.querySelector('[data-tour-prev]');
    this.elements.nextBtn = tooltip.querySelector('[data-tour-next]');
    this.elements.skipBtn = tooltip.querySelector('[data-tour-skip]');
    this.elements.progress = tooltip.querySelector('[data-tour-progress]');

    this.elements.prevBtn.addEventListener('click', () => this.prev());
    this.elements.nextBtn.addEventListener('click', () => this.next());
    this.elements.skipBtn.addEventListener('click', () => this.end(false));
    this.elements.deepDiveBtn.addEventListener('click', () => this.enterDeepDive());
    this.elements.recapBackBtn.addEventListener('click', (e) => {
      const step = this.steps[this.currentIndex];
      if (!step || !step.recapBackHref) return;
      e.preventDefault();

      // If a parent tour is waiting, route the user back into it rather than
      // dumping them on the destination page with no tour state.
      const parent = this.getParent();
      if (parent && this.resumeParent(parent)) return;

      this.clearState();
      this.logEvent('tour_back_to_portfolio', { from: this.mode });
      this.navigateTo(step.recapBackHref);
    });

    tooltip.addEventListener('keydown', this.handleFocusTrap);
  }

  rebuildProgress() {
    if (!this.elements.progress) return;
    this.elements.progress.innerHTML = this.steps
      .map((_, i) => `<span class="tour-tooltip__dot" data-step-dot="${i}"></span>`)
      .join('');
  }

  // ---------------------------------------------------------------- navigation

  start(mode, startIndex) {
    if (!this.tourSets[mode]) return;
    if (this.active) {
      this._teardownOverlay(true);
    }
    this.mode = mode;
    this.steps = this.tourSets[mode];
    this.currentIndex = -1;
    this.active = true;
    this.lastFocus = document.activeElement;
    this.dismissPrompt();
    this.markSeen();
    this.buildOverlay();
    this.rebuildProgress();
    document.body.classList.add('tour-active');
    document.addEventListener('keydown', this.handleKeydown);
    window.addEventListener('resize', this.reposition);
    window.addEventListener('scroll', this.reposition, { passive: true });
    this.logEvent('tour_start', { mode });
    const requested = typeof startIndex === 'number' ? startIndex : 0;
    const idx = Math.max(0, Math.min(requested, this.steps.length - 1));
    this.updateChipText();
    this.goTo(idx);
    announceToScreenReader(`${mode === 'recruiter' ? 'Recruiter' : (mode === 'dashboardDeepDive' ? 'Dashboard' : 'Full')} tour started`);
  }

  // Resume the parent tour at the step after where the user branched off.
  // Used both when the deep-dive recap's Finish button is hit and when the
  // recap "Back to portfolio" button is clicked.
  resumeParent(parent) {
    const targetSet = this.tourSets[parent.mode];
    if (!targetSet) return false;
    const nextIndex = Math.min(parent.index + 1, targetSet.length - 1);
    const nextStep = targetSet[nextIndex];

    // Move into the parent tour. Wipe the deep-dive's state record (which
    // carries the parent reference) before saving the new clean parent state,
    // so we don't accidentally chain into another resume.
    this.mode = parent.mode;
    this.steps = targetSet;
    this.currentIndex = nextIndex;
    this.clearState();

    const onSamePage = !nextStep.page || this.pageMatches(nextStep.page);
    if (!onSamePage) {
      this.saveState({ autoResume: true });
      this.logEvent('tour_deepdive_return', { mode: parent.mode, to: nextIndex, crossPage: true });
      this.navigateTo(nextStep.page);
      return true;
    }

    this.saveState();
    this.rebuildProgress();
    this.renderStep();
    this.place();
    this.logEvent('tour_deepdive_return', { mode: parent.mode, to: nextIndex });
    announceToScreenReader(`Resuming tour at step ${nextIndex + 1} of ${targetSet.length}`);
    return true;
  }

  end(completed) {
    if (!this.active) return;

    // Finishing a deep-dive that has a parent waiting? Resume the parent
    // instead of tearing the tour down entirely. (Skip = end everything.)
    if (completed) {
      const parent = this.getParent();
      if (parent && this.resumeParent(parent)) return;
    }

    this.active = false;
    this.clearState();

    document.removeEventListener('keydown', this.handleKeydown);
    window.removeEventListener('resize', this.reposition);
    window.removeEventListener('scroll', this.reposition);
    document.body.classList.remove('tour-active');

    const { overlay, spotlight, tooltip } = this.elements;
    [overlay, spotlight, tooltip].forEach(el => {
      if (el) el.classList.remove('is-visible');
    });
    setTimeout(() => this._teardownOverlay(false), 260);

    if (this.lastFocus && typeof this.lastFocus.focus === 'function') {
      try { this.lastFocus.focus(); } catch (e) {}
    }

    this.updateChipText();
    if (completed) this.pulseChip();
    this.logEvent(completed ? 'tour_complete' : 'tour_skip');
    announceToScreenReader(completed ? 'Tour complete' : 'Tour ended');
  }

  _teardownOverlay(immediate) {
    ['overlay', 'spotlight', 'tooltip'].forEach(key => {
      const el = this.elements[key];
      if (el && el.parentNode) el.parentNode.removeChild(el);
      this.elements[key] = null;
    });
    if (immediate) {
      // Also clear references to inner nodes so buildOverlay rebuilds cleanly
      ['title', 'body', 'details', 'counter', 'modeBadge', 'detail', 'deepDiveBtn', 'recap',
       'recapBackBtn', 'prevBtn', 'nextBtn', 'skipBtn', 'progress'].forEach(k => {
        this.elements[k] = null;
      });
    }
  }

  goTo(index) {
    if (index < 0 || index >= this.steps.length) return;
    const step = this.steps[index];

    if (step.page && !this.pageMatches(step.page)) {
      // Cross-page navigation needed — persist with autoResume so the next page picks it up
      this.currentIndex = index;
      this.saveState({ index, autoResume: true });
      this.logEvent('tour_cross_page', { to: step.page });
      this.navigateTo(step.page);
      return;
    }

    this.currentIndex = index;
    this.saveState();
    this.renderStep();
    this.place();
  }

  next() {
    if (this.currentIndex >= this.steps.length - 1) {
      this.end(true);
      return;
    }
    this.goTo(this.currentIndex + 1);
  }

  prev() {
    if (this.currentIndex <= 0) return;
    this.goTo(this.currentIndex - 1);
  }

  enterDeepDive() {
    const step = this.steps[this.currentIndex];
    if (!step || !step.deepDive) return;
    const { mode } = step.deepDive;
    if (!this.tourSets[mode]) return;

    // Stash the current tour as `parent` so we can resume it when the
    // deep-dive ends.
    const parent = { mode: this.mode, index: this.currentIndex };

    const targetSet = this.tourSets[mode];
    const firstStep = targetSet[0];
    this.mode = mode;
    this.steps = targetSet;
    this.currentIndex = 0;
    this.saveState({ index: 0, autoResume: true, parent });
    this.logEvent('tour_deepdive_enter', { mode, parent });
    if (firstStep.page && !this.pageMatches(firstStep.page)) {
      this.navigateTo(firstStep.page);
    } else {
      this.rebuildProgress();
      this.renderStep();
      this.place();
    }
  }

  reposition() {
    if (!this.active) return;
    if (this._rafPending) return;
    this._rafPending = true;
    requestAnimationFrame(() => {
      this._rafPending = false;
      const step = this.steps[this.currentIndex];
      if (!step || step.isRecap || !step.id) return;
      const target = document.querySelector(`[data-tour-id="${step.id}"]`);
      if (target) this.placeAroundTarget(target);
    });
  }

  handleKeydown(e) {
    if (!this.active) return;
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        this.end(false);
        break;
      case 'ArrowRight':
      case 'PageDown':
        e.preventDefault();
        this.next();
        break;
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault();
        this.prev();
        break;
    }
  }

  handleFocusTrap(e) {
    if (e.key !== 'Tab' || !this.elements.tooltip) return;
    const focusables = Array.from(
      this.elements.tooltip.querySelectorAll('a[href], button:not([disabled])')
    ).filter(el => !el.hidden && el.offsetParent !== null);
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // ---------------------------------------------------------------- rendering

  renderStep() {
    const step = this.steps[this.currentIndex];
    if (!step || !this.elements.tooltip) return;

    this.elements.title.textContent = step.title;
    this.elements.body.textContent = step.body;
    this.elements.counter.textContent = `${this.currentIndex + 1} / ${this.steps.length}`;

    // Optional bullet details — populated via DOM API to keep content escaped
    if (this.elements.details) {
      this.elements.details.innerHTML = '';
      if (Array.isArray(step.details) && step.details.length) {
        step.details.forEach(text => {
          const li = document.createElement('li');
          li.textContent = text;
          this.elements.details.appendChild(li);
        });
        this.elements.details.hidden = false;
      } else {
        this.elements.details.hidden = true;
      }
    }

    // Mode badge
    if (this.mode === 'recruiter') {
      this.elements.modeBadge.hidden = false;
      this.elements.modeBadge.textContent = 'Recruiter';
    } else if (this.mode === 'dashboardDeepDive') {
      this.elements.modeBadge.hidden = false;
      this.elements.modeBadge.textContent = 'Deep dive';
    } else {
      this.elements.modeBadge.hidden = true;
      this.elements.modeBadge.textContent = '';
    }

    // Detail link
    if (step.detailHref && !step.isRecap) {
      this.elements.detail.hidden = false;
      this.elements.detail.textContent = (step.detailLabel || 'Open detail') +
        (step.detailExternal ? ' ↗' : ' →');
      this.elements.detail.href = step.detailHref;
      if (step.detailExternal) {
        this.elements.detail.target = '_blank';
        this.elements.detail.rel = 'noopener noreferrer';
      } else {
        this.elements.detail.removeAttribute('target');
        this.elements.detail.removeAttribute('rel');
      }
    } else {
      this.elements.detail.hidden = true;
    }

    // Deep-dive entry button
    if (step.deepDive && this.tourSets[step.deepDive.mode]) {
      this.elements.deepDiveBtn.hidden = false;
      this.elements.deepDiveBtn.textContent = step.deepDive.label || 'Take the deep dive →';
    } else {
      this.elements.deepDiveBtn.hidden = true;
    }

    // Recap card
    this.elements.recap.hidden = !step.isRecap;
    this.elements.tooltip.classList.toggle('is-recap', !!step.isRecap);
    const parentTour = step.isRecap ? this.getParent() : null;
    if (step.isRecap && step.recapBackHref) {
      this.elements.recapBackBtn.hidden = false;
      // When a parent tour is waiting, re-label this from "back to portfolio"
      // to "resume tour" so the user knows it puts them back where they were.
      const defaultLabel = step.recapBackLabel || '← Back';
      this.elements.recapBackBtn.textContent = parentTour
        ? `← Resume ${parentTour.mode === 'recruiter' ? 'recruiter snapshot' : 'full tour'}`
        : defaultLabel;
      this.elements.recapBackBtn.href = step.recapBackHref;
    } else {
      this.elements.recapBackBtn.hidden = true;
    }

    // Prev/Next buttons
    this.elements.prevBtn.disabled = this.currentIndex === 0;
    const isLast = this.currentIndex === this.steps.length - 1;
    if (isLast && parentTour) {
      this.elements.nextBtn.textContent = 'Resume tour →';
    } else {
      this.elements.nextBtn.textContent = isLast ? 'Finish' : 'Next →';
    }

    // Skip and Finish do the same thing on the recap; hide Skip there so
    // Finish is the single explicit end-of-tour action.
    if (this.elements.skipBtn) this.elements.skipBtn.hidden = !!step.isRecap;

    // Progress dots
    Array.from(this.elements.progress.children).forEach((dot, i) => {
      dot.classList.toggle('is-current', i === this.currentIndex);
      dot.classList.toggle('is-done', i < this.currentIndex);
    });

    announceToScreenReader(`Step ${this.currentIndex + 1} of ${this.steps.length}: ${step.title}`);

    requestAnimationFrame(() => {
      if (this.elements.nextBtn) this.elements.nextBtn.focus();
    });
  }

  place() {
    if (!this.active || !this.elements.overlay) return;
    const step = this.steps[this.currentIndex];
    if (!step) return;

    this.elements.tooltip.classList.add('is-visible');

    if (step.isRecap || !step.id) {
      this.elements.overlay.classList.add('is-visible');
      this.elements.spotlight.classList.remove('is-visible');
      this.elements.tooltip.classList.add('is-centered');
      this.elements.tooltip.classList.remove('has-arrow', 'tour-arrow--up', 'tour-arrow--down');
      this.elements.tooltip.style.top = '';
      this.elements.tooltip.style.left = '';
      return;
    }

    this.elements.overlay.classList.remove('is-visible');
    this.elements.tooltip.classList.remove('is-centered');

    const target = document.querySelector(`[data-tour-id="${step.id}"]`);
    if (!target) {
      console.warn(`Tour target not found: ${step.id}`);
      this.elements.overlay.classList.add('is-visible');
      this.elements.spotlight.classList.remove('is-visible');
      this.elements.tooltip.classList.add('is-centered');
      this.elements.tooltip.classList.remove('has-arrow', 'tour-arrow--up', 'tour-arrow--down');
      return;
    }

    this.scrollTargetIntoView(target);
    this.waitForScrollIdle(target, () => this.placeAroundTarget(target));
  }

  // Scroll the highlighted element into a sensible viewport slot.
  // On phones the tooltip is pinned to the bottom 12px, so centering the
  // target hides it behind the tooltip — push it to the upper third instead.
  scrollTargetIntoView(target) {
    const behavior = this.reduceMotion ? 'auto' : 'smooth';
    const isMobile = window.innerWidth <= 640;
    const rect = target.getBoundingClientRect();
    const vh = window.innerHeight;
    const targetAbsTop = rect.top + window.pageYOffset;

    let offset;
    if (isMobile) {
      // Park top of target at ~18% of viewport, leaving room for the
      // bottom-pinned tooltip card.
      offset = Math.max(72, Math.round(vh * 0.18));
    } else {
      // Centered when it fits; otherwise leave a healthy top margin.
      offset = Math.max(80, Math.round((vh - rect.height) / 2));
    }

    window.scrollTo({ top: Math.max(0, targetAbsTop - offset), behavior });
  }

  // Wait until the target's rect has been stable for two consecutive frames
  // before placing the tooltip — replaces the old fixed 380ms timeout.
  waitForScrollIdle(target, callback) {
    if (this.reduceMotion) { callback(); return; }
    let lastTop = null;
    let stable = 0;
    let frames = 0;
    const maxFrames = 60; // ~1s safety cap @ 60fps
    const tick = () => {
      if (!this.active) return;
      frames++;
      const top = target.getBoundingClientRect().top;
      if (lastTop !== null && Math.abs(top - lastTop) < 0.5) {
        stable++;
        if (stable >= 2) { callback(); return; }
      } else {
        stable = 0;
      }
      lastTop = top;
      if (frames >= maxFrames) { callback(); return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  placeAroundTarget(target) {
    if (!this.active || !target) return;

    const rect = target.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const padding = 12;

    const top = Math.max(rect.top - padding, 12);
    const bottom = Math.min(rect.bottom + padding, vh - 12);
    const left = Math.max(rect.left - padding, 12);
    const right = Math.min(rect.right + padding, vw - 12);
    const height = Math.max(bottom - top, 40);
    const width = Math.max(right - left, 40);

    this.elements.spotlight.classList.add('is-visible');
    this.elements.spotlight.style.top = `${top}px`;
    this.elements.spotlight.style.left = `${left}px`;
    this.elements.spotlight.style.width = `${width}px`;
    this.elements.spotlight.style.height = `${height}px`;

    const tipRect = this.elements.tooltip.getBoundingClientRect();
    const tipWidth = tipRect.width || 360;
    const tipHeight = tipRect.height || 220;
    const gap = 16;

    const spaceBelow = vh - bottom;
    const spaceAbove = top;

    let tipTop;
    let placement; // 'below' | 'above' | 'pinned'
    if (spaceBelow >= tipHeight + gap + 12) {
      tipTop = bottom + gap;
      placement = 'below';
    } else if (spaceAbove >= tipHeight + gap + 12) {
      tipTop = top - tipHeight - gap;
      placement = 'above';
    } else {
      tipTop = Math.max(12, vh - tipHeight - 12);
      placement = 'pinned';
    }

    let tipLeft = left + (width - tipWidth) / 2;
    tipLeft = Math.max(12, Math.min(tipLeft, vw - tipWidth - 12));

    this.elements.tooltip.style.top = `${tipTop}px`;
    this.elements.tooltip.style.left = `${tipLeft}px`;

    this.updateArrow(placement, { top, bottom, left, right, tipTop, tipHeight });
  }

  // Drives the small caret on the tooltip pointing at the spotlight.
  // Direction: 'up' if tooltip is below the spotlight, 'down' if above.
  // Horizontal position: the spotlight's center, clamped inside the tooltip.
  updateArrow(placement, geom) {
    const tt = this.elements.tooltip;
    if (!tt) return;
    tt.classList.remove('has-arrow', 'tour-arrow--up', 'tour-arrow--down');

    let direction;
    if (placement === 'below') {
      direction = 'up';
    } else if (placement === 'above') {
      direction = 'down';
    } else {
      // Pinned (no vertical room either side) — arrow points toward whichever
      // side the spotlight sits on relative to the tooltip.
      const spotCenterY = (geom.top + geom.bottom) / 2;
      direction = spotCenterY < geom.tipTop ? 'up' : 'down';
    }

    requestAnimationFrame(() => {
      if (!this.active || !this.elements.tooltip) return;
      const actual = this.elements.tooltip.getBoundingClientRect();
      const spotCenterX = (geom.left + geom.right) / 2;
      const minX = 20;
      const maxX = Math.max(minX + 1, actual.width - 20);
      const arrowX = Math.max(minX, Math.min(spotCenterX - actual.left, maxX));
      this.elements.tooltip.style.setProperty('--arrow-x', `${arrowX}px`);
      this.elements.tooltip.classList.add('has-arrow', `tour-arrow--${direction}`);
    });
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
  try {
    // Initialize mobile navigation
    new MobileNavigation();

    // Initialize dashboard if present
    new DashboardManager();

    // Initialize scroll animations
    new ScrollAnimations();

    // Initialize smooth scrolling
    initSmoothScroll();

    // Initialize backend showcase interactions
    new BackendShowcase();

    // Initialize platform lab interactions
    new PlatformLab();

    // Initialize learning library sections
    safeQueryAll('[data-library-track]').forEach(section => {
      const library = new LearningLibrary(section);
      library.init();
    });

    // Initialize site tour (only on pages with tour targets)
    if (safeQuery('[data-tour-id]')) {
      new SiteTour();
    }

    // Monitor performance (development only)
    if (window.location.hostname === 'localhost') {
      new PerformanceMonitor();
    }
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

// Wait for DOM to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ============================================================================
// EXPORT FOR TESTING (if using modules)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MobileNavigation,
    DashboardManager,
    ScrollAnimations,
    debounce
  };
}
