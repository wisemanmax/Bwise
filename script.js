// Improved script.js with error handling, performance optimizations, and accessibility

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

class DashboardManager {
  constructor() {
    this.currentView = 'monthly';
    this.animationTimeout = null;
    this.data = {
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
    };

    this.viewButtons = safeQueryAll('.demo-btn');
    
    if (this.viewButtons.length === 0) {
      console.info('Dashboard not present on this page');
      return;
    }

    this.init();
  }

  init() {
    // Setup button event listeners
    this.viewButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;
        if (view) this.setView(view);
      });
    });

    // Keyboard navigation for buttons
    this.setupKeyboardNavigation();
  }

  setupKeyboardNavigation() {
    this.viewButtons.forEach((btn, index) => {
      btn.addEventListener('keydown', (e) => {
        let targetIndex;
        
        switch(e.key) {
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
    if (!this.data[view]) {
      console.error(`Invalid view: ${view}`);
      return;
    }

    this.currentView = view;
    
    try {
      this.updateMetrics(this.data[view]);
      this.updateButtons(view);
      this.animateCards();
      
      // Announce change to screen readers
      const viewName = view.charAt(0).toUpperCase() + view.slice(1);
      announceToScreenReader(`${viewName} view selected`);
    } catch (error) {
      console.error('Error updating dashboard view:', error);
      announceToScreenReader('Error updating dashboard');
    }
  }

  updateMetrics(data) {
    Object.entries(data).forEach(([key, values]) => {
      const valueElement = document.getElementById(key);
      const changeElement = document.getElementById(`${key}Change`);

      if (valueElement) {
        // Add transition for smooth value change
        valueElement.style.transition = 'opacity 0.2s';
        valueElement.style.opacity = '0.5';
        
        setTimeout(() => {
          valueElement.textContent = values.value;
          valueElement.style.opacity = '1';
        }, 100);
      }

      if (changeElement) {
        changeElement.textContent = values.change;
      }
    });
  }

  updateButtons(activeView) {
    this.viewButtons.forEach(btn => {
      const isActive = btn.dataset.view === activeView;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  animateCards() {
    // Clear existing timeout
    clearTimeout(this.animationTimeout);

    // Debounce animation to prevent spam
    this.animationTimeout = setTimeout(() => {
      const cards = safeQueryAll('.metric-card');
      cards.forEach((card, index) => {
        card.classList.remove('pulse');
        
        // Force reflow
        void card.offsetWidth;
        
        // Stagger animations
        setTimeout(() => {
          card.classList.add('pulse');
        }, index * 50);
      });
    }, 100);
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
