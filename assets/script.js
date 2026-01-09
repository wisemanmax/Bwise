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
    this.viewButtons = safeQueryAll('.demo-btn[data-view]', this.root);
    this.metricCards = safeQueryAll('.metric-card', this.root);

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

    // Monitor performance (development only)
    if (window.location.hostname === 'localhost') {
      new PerformanceMonitor();
    }

    console.log('✓ Portfolio initialized successfully');
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
