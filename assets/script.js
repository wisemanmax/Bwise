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

const jsonCache = {};

async function loadJsonData(source) {
  if (!source) {
    throw new Error('Missing data source');
  }
  if (jsonCache[source]) {
    return jsonCache[source];
  }
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(`Data fetch failed: ${response.status}`);
  }
  const data = await response.json();
  jsonCache[source] = data;
  return data;
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
    this.sections = safeQueryAll('.demo-section');
    this.dataSource = '../assets/data/dashboard-metrics.json';

    if (this.sections.length === 0) {
      console.info('Dashboard not present on this page');
      return;
    }

    this.init();
  }

  async init() {
    try {
      this.dataSets = await loadJsonData(this.dataSource);
    } catch (error) {
      console.error('Unable to load dashboard metrics data', error);
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
    this.dataSource = '../assets/data/backend-showcase.json';
    this.kpiValues = {};
    this.summaryText = {};
    this.logStreamMessages = [];
    this.auditLogEntries = [];

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

  async init() {
    try {
      const data = await loadJsonData(this.dataSource);
      this.kpiValues = data.kpis || {};
      this.summaryText = data.summaries || {};
      this.logStreamMessages = data.logStream || [];
      this.auditLogEntries = data.auditLog || [];
    } catch (error) {
      console.error('Backend showcase data failed to load', error);
    }

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

    this.applyFilter(this.currentFilter);
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
      const text = this.summaryText[this.currentFilter] || this.summaryText.all;
      if (text) {
        this.summary.textContent = text;
      }
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
    const messages = this.logStreamMessages;
    if (!this.logStream || messages.length === 0) return;

    this.logStream.textContent = messages.join('\n');

    let offset = 0;
    setInterval(() => {
      if (!this.logStream) return;
      offset = (offset + 1) % messages.length;
      const output = messages.slice(offset).concat(messages.slice(0, offset)).join('\n');
      this.logStream.textContent = output;
    }, 6000);
  }

  startAuditLogRotation() {
    const entries = this.auditLogEntries;
    if (!this.auditLog || entries.length === 0) return;

    this.auditLog.textContent = entries.join('\n');

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
    this.dataSource = '../assets/data/platform-lab.json';
    this.kpiValues = {};
    this.summaryText = {};
    this.promptData = {};

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

  async init() {
    try {
      const data = await loadJsonData(this.dataSource);
      this.kpiValues = data.kpis || {};
      this.summaryText = data.summaries || {};
      this.promptData = data.prompts || {};
    } catch (error) {
      console.error('Platform lab data failed to load', error);
    }

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
    return loadJsonData(source);
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
