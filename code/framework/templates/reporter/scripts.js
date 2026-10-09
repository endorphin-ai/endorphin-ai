/**
 * Endorphin AI Test Report JavaScript
 * Handles interactive functionality for the HTML report
 */

/* global Chart */

class TestReportViewer {
  constructor() {
    this.testData = [];
    this.currentTestIndex = null;
    this.durationChart = null;
    this.chartOptions = { view: 'top50', sortBy: 'duration' };
    this.tableSortOrder = {};
    this.init();
  }

  /**
   * Initialize the report viewer
   */
  init() {
    this.loadTestData();
    this.attachEventListeners();
    this.animateCards();
    this.initializeCharts();
  }

  /**
   * Load test data from the embedded JSON
   */
  loadTestData() {
    try {
      const testDataElement = document.getElementById('test-data');
      if (testDataElement && testDataElement.textContent) {
        this.testData = JSON.parse(testDataElement.textContent);
        console.log('Loaded test data:', this.testData.length, 'results');
      }
    } catch (error) {
      console.error('Failed to load test data:', error);
      this.testData = [];
    }
  }

  /**
   * Attach event listeners to interactive elements
   */
  attachEventListeners() {
    // View details buttons
    document.querySelectorAll('.view-details-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const resultIndex = parseInt(btn.getAttribute('data-result-index'));
        this.showTestDetails(resultIndex);
      });
    });

    // Table sorting
    this.attachTableSortingListeners();

    // Test result rows (clickable)
    document.querySelectorAll('.test-result-row').forEach((row) => {
      row.addEventListener('click', () => {
        const resultIndex = parseInt(row.getAttribute('data-result-index'));
        this.showTestDetails(resultIndex);
      });
    });

    // Search functionality
    const searchInput = document.getElementById('test-search');
    const clearSearchBtn = document.getElementById('clear-search');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.filterResults(e.target.value, this.currentFilter);
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        this.filterResults('', this.currentFilter);
        searchInput.focus();
      });
    }

    // Filter buttons
    document.querySelectorAll('[data-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        // Remove active class from all filter buttons
        document.querySelectorAll('[data-filter]').forEach((b) => b.classList.remove('active'));
        // Add active class to clicked button
        btn.classList.add('active');

        const filter = btn.getAttribute('data-filter');
        this.currentFilter = filter;
        const searchTerm = searchInput ? searchInput.value : '';
        this.filterResults(searchTerm, filter);
      });
    });

    // Export and print buttons
    const exportBtn = document.getElementById('export-json');
    const printBtn = document.getElementById('print-report');

    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportToJson();
      });
    }

    if (printBtn) {
      printBtn.addEventListener('click', () => {
        this.printReport();
      });
    }

    // Modal events
    const testDetailsModal = document.getElementById('testDetailsModal');
    if (testDetailsModal) {
      testDetailsModal.addEventListener('shown.bs.modal', () => {
        this.animateTimeline();
      });
      
      // Ensure backdrop is properly cleaned up when modal is hidden
      testDetailsModal.addEventListener('hidden.bs.modal', () => {
        // Remove any lingering modal backdrops
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
          backdrop.remove();
        });
        // Ensure body scroll is restored
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('padding-right');
      });
    }
    
    // Handle screenshot modal backdrop cleanup
    const screenshotModal = document.getElementById('screenshotModal');
    if (screenshotModal) {
      screenshotModal.addEventListener('hidden.bs.modal', () => {
        // Remove any lingering modal backdrops
        document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
          backdrop.remove();
        });
        // Ensure body scroll is restored
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('padding-right');
      });
    }

    // Screenshot click events will be attached dynamically

    // Initialize filter state
    this.currentFilter = 'all';
  }

  /**
   * Show detailed test information in modal
   */
  showTestDetails(resultIndex) {
    if (!this.testData[resultIndex]) {
      console.error('Test result not found:', resultIndex);
      return;
    }

    this.currentTestIndex = resultIndex;
    const result = this.testData[resultIndex];
    const session = result.session;
    const summary = result.summary;

    // Populate modal fields
    this.updateModalField('modal-test-id', session.testId);
    this.updateModalField('modal-test-name', session.testName);
    this.updateModalField('modal-status', this.formatStatus(session.status), true); // true for HTML
    this.updateModalField('modal-duration', `${session.duration || 0}ms`);
    this.updateModalField('modal-start-time', this.formatDateTime(session.startTime));
    this.updateModalField('modal-end-time', this.formatDateTime(session.endTime));
    this.updateModalField('modal-total-steps', session.steps ? session.steps.length : 0);
    this.updateModalField('modal-screenshots', result.screenshots ? result.screenshots.length : 0);
    
    // Populate token usage fields
    const tokenSummary = session.tokenSummary || summary.tokenSummary || {};
    this.updateModalField('modal-total-tokens', (tokenSummary.totalTokens || 0).toLocaleString());
    this.updateModalField('modal-total-cost', `$${(tokenSummary.totalCost || 0).toFixed(4)}`);
    this.updateModalField('modal-ai-calls', tokenSummary.aiCalls || 0);
    this.updateModalField('modal-model', tokenSummary.model || 'N/A');

    // Populate test conclusion
    const conclusion = session.conclusion || session.finalResult || 'No conclusion available';
    this.updateModalField('modal-conclusion', conclusion);

    // Populate setup and data generation results
    this.populateSetupAndDataResults(session);

    // Populate steps timeline
    this.populateStepsTimeline(session.steps || []);
    this.populateAgentHistoryTimeline(session.agentHistory || []);

    // Populate screenshots gallery
    this.populateScreenshotsGallery(result);

    // Show modal
    const modalElement = document.getElementById('testDetailsModal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    modal.show();
  }

  /**
   * Update a modal field with content
   */
  updateModalField(fieldId, value, isHtml = false) {
    const element = document.getElementById(fieldId);
    if (element) {
      if (isHtml) {
        element.innerHTML = value;
      } else {
        element.textContent = value;
      }
    }
  }

  /**
   * Populate setup and data generation results
   */
  populateSetupAndDataResults(session) {
    const setupDataSection = document.getElementById('setup-data-section');
    const hasSetup = session.setupResult;
    const hasDataGeneration = session.dataGenerationResult;
    
    // Show or hide the entire section
    if (hasSetup || hasDataGeneration) {
      setupDataSection.style.display = 'block';
    } else {
      setupDataSection.style.display = 'none';
      return;
    }

    // Populate setup results
    if (hasSetup) {
      const setup = session.setupResult;
      this.updateModalField('modal-setup-status', this.formatStatus(setup.success ? 'SUCCESS' : 'FAILED'), true);
      this.updateModalField('modal-setup-time', `${setup.executionTime || 0}ms`);
      this.updateModalField('modal-setup-has-data', setup.data ? 'Yes' : 'No');
      
      // Show/hide error row
      const errorRow = document.getElementById('modal-setup-error-row');
      if (!setup.success && setup.error) {
        errorRow.style.display = 'table-row';
        this.updateModalField('modal-setup-error', setup.error.message || setup.error);
      } else {
        errorRow.style.display = 'none';
      }

      // Show/hide setup data viewer
      const dataViewer = document.getElementById('setup-data-viewer');
      const dataContent = document.getElementById('setup-data-content');
      if (setup.data) {
        dataViewer.style.display = 'block';
        dataContent.textContent = JSON.stringify(setup.data, null, 2);
      } else {
        dataViewer.style.display = 'none';
      }
    }

    // Populate data generation results
    if (hasDataGeneration) {
      const dataGen = session.dataGenerationResult;
      this.updateModalField('modal-data-status', this.formatStatus(dataGen.success ? 'SUCCESS' : 'FAILED'), true);
      this.updateModalField('modal-data-time', `${dataGen.executionTime || 0}ms`);
      this.updateModalField('modal-data-tokens', dataGen.tokenUsage ? dataGen.tokenUsage.totalTokens.toLocaleString() : 'N/A');
      this.updateModalField('modal-data-cost', dataGen.tokenUsage ? `$${dataGen.tokenUsage.cost.toFixed(4)}` : 'N/A');
      
      // Show/hide error row
      const errorRow = document.getElementById('modal-data-error-row');
      if (!dataGen.success && dataGen.error) {
        errorRow.style.display = 'table-row';
        this.updateModalField('modal-data-error', dataGen.error.message || dataGen.error);
      } else {
        errorRow.style.display = 'none';
      }

      // Show/hide generated data viewer
      const dataViewer = document.getElementById('generated-data-viewer');
      const dataContent = document.getElementById('generated-data-content');
      if (dataGen.data) {
        dataViewer.style.display = 'block';
        dataContent.textContent = JSON.stringify(dataGen.data, null, 2);
      } else {
        dataViewer.style.display = 'none';
      }
    }
  }

  /**
   * Populate the steps timeline
   */
  populateStepsTimeline(steps) {
    const timeline = document.getElementById('steps-timeline');
    if (!timeline) return;

    timeline.innerHTML = '';

    if (!steps || steps.length === 0) {
      timeline.innerHTML = '<div class="text-muted text-center">No steps recorded</div>';
      return;
    }

    // Check if this is a multi-user test by looking for userId in steps
    const hasMultipleUsers = steps.some(step => step.userId);
    const isMultiUser = hasMultipleUsers && new Set(steps.filter(s => s.userId).map(s => s.userId)).size > 1;

    if (isMultiUser) {
      this.populateMultiUserStepsTimeline(steps, timeline);
    } else {
      // Single user timeline (existing behavior)
      steps.forEach((step, index) => {
        const stepElement = this.createStepElement(step, index);
        timeline.appendChild(stepElement);
      });
    }
  }

  /**
   * Populate the agent history timeline
   */
  populateAgentHistoryTimeline(agentHistory) {
    const timeline = document.getElementById('agent-history-timeline');
    if (!timeline) return;

    timeline.innerHTML = '';

    if (!agentHistory || agentHistory.length === 0) {
      timeline.innerHTML = '<div class="text-muted text-center">No agent decisions recorded</div>';
      return;
    }

    // Check if this is a multi-user test by looking for userId in agent history
    const hasMultipleUsers = agentHistory.some(entry => entry.userId);
    const isMultiUser = hasMultipleUsers && new Set(agentHistory.filter(e => e.userId).map(e => e.userId)).size > 1;

    if (isMultiUser) {
      this.populateMultiUserAgentHistoryTimeline(agentHistory, timeline);
    } else {
      // Single user timeline (existing behavior)
      agentHistory.forEach((entry, index) => {
        const historyElement = this.createAgentHistoryElement(entry, index);
        timeline.appendChild(historyElement);
      });
    }
  }

  /**
   * Create an agent history element for the timeline
   */
  createAgentHistoryElement(entry, index, showUserLabel = false) {
    const historyDiv = document.createElement('div');
    
    // Determine the type of AI call for styling
    const isToolSelection = entry.thinking?.includes('Tool Selection');
    const isDataGeneration = entry.thinking?.includes('Data Generation');
    const isValidation = entry.thinking?.includes('Validation Agent');
    const isReasoning = entry.thinking?.includes('Agent Reasoning');
    
    // Set appropriate styling based on call type
    let borderColor = 'border-primary';
    let icon = '🤖';
    let badgeClass = 'bg-primary';
    let callType = 'Agent Decision';
    
    if (isToolSelection) {
      borderColor = 'border-success';
      icon = '🔧';
      badgeClass = 'bg-success';
      callType = 'Tool Selection';
    } else if (isDataGeneration) {
      borderColor = 'border-info';
      icon = '📊';
      badgeClass = 'bg-info';
      callType = 'Data Generation';
    } else if (isValidation) {
      borderColor = 'border-warning';
      icon = '🔍';
      badgeClass = 'bg-warning';
      callType = 'Validation';
    } else if (isReasoning) {
      borderColor = 'border-secondary';
      icon = '💭';
      badgeClass = 'bg-secondary';
      callType = 'Reasoning';
    }
    
    historyDiv.className = `agent-history-item border-start border-3 ${borderColor} mb-3`;
    const userLabel = showUserLabel && entry.userId ? `<span class="badge bg-info ms-2">${entry.userId.toUpperCase()}</span>` : '';

    historyDiv.innerHTML = `
      <div class="agent-history-content p-3">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <h6 class="mb-0">
            ${icon} ${callType} #${entry.historyId}${userLabel}
            <span class="badge ${badgeClass} ms-2 small">${entry.tokenUsage?.totalTokens || 0} tokens</span>
          </h6>
          <small class="text-muted">${this.formatDateTime(entry.timestamp)}</small>
        </div>
        
        <div class="agent-thinking">
          <strong>🎯 Context:</strong> ${this.escapeHtml(entry.context || entry.thinking)}
        </div>
        
        <div class="mt-2">
          <strong>📨 Input:</strong>
          <div class="bg-light p-2 mt-1 small" style="border-radius: 4px; max-height: 100px; overflow-y: auto;">
            ${this.escapeHtml(entry.prompt)}
          </div>
        </div>
        
        <div class="mt-2">
          <strong>🤖 Response:</strong>
          <div class="bg-light p-2 mt-1 small" style="border-radius: 4px; max-height: 100px; overflow-y: auto;">
            ${this.escapeHtml(entry.response)}
          </div>
        </div>
        
        <div class="agent-token-info mt-2">
          <strong>💰 Token Usage:</strong> ${entry.tokenUsage.totalTokens.toLocaleString()} tokens 
          (${entry.tokenUsage.promptTokens} prompt + ${entry.tokenUsage.responseTokens} response) 
          • Cost: $${entry.tokenUsage.cost.toFixed(4)} 
          • Model: ${entry.tokenUsage.model}
          • Duration: ${entry.duration}ms
        </div>
        
        ${entry.context ? `
          <div class="mt-2">
            <small class="text-muted"><strong>Context:</strong> ${this.escapeHtml(entry.context)}</small>
          </div>
        ` : ''}
      </div>
    `;

    return historyDiv;
  }

  /**
   * Create a step element for the timeline
   */
  createStepElement(step, index, showUserLabel = false) {
    const stepDiv = document.createElement('div');
    stepDiv.className = `timeline-item ${step.status.toLowerCase()}`;

    const statusClass = step.status === 'SUCCESS' ? 'status-success' : 'status-failure';
    const userLabel = showUserLabel && step.userId ? `<span class="badge bg-info ms-2">${step.userId.toUpperCase()}</span>` : '';

    stepDiv.innerHTML = `
      <div class="timeline-content">
        <div class="timeline-header">
          <span class="timeline-step-number">Step ${step.stepNumber}${userLabel}</span>
          <span class="timeline-timestamp">${this.formatDateTime(step.timestamp)}</span>
        </div>
        <div class="timeline-description">
          ${this.escapeHtml(step.description)}
        </div>
        ${
          step.result
            ? `
          <div class="timeline-result">
            <strong>Result:</strong> ${this.escapeHtml(step.result)}
          </div>
        `
            : ''
        }
        ${
          step.toolName
            ? `
          <div class="timeline-tool-call">
            <strong>Tool:</strong> ${this.escapeHtml(step.toolName)}
            ${step.toolArgs ? `<br><strong>Args:</strong> ${this.escapeHtml(JSON.stringify(step.toolArgs, null, 2))}` : ''}
          </div>
        `
            : ''
        }
        ${
          step.screenshots && step.screenshots.length > 0
            ? `
          <div class="mt-2">
            <small class="text-muted">Screenshots (${step.screenshots.length}):</small>
            <div class="step-screenshots mt-1" data-step-number="${step.stepNumber}">
              <!-- Screenshots will be added dynamically -->
            </div>
          </div>
        `
            : ''
        }
      </div>
    `;

    // Add step screenshots after creating the element
    if (step.screenshots && step.screenshots.length > 0) {
      const screenshotsContainer = stepDiv.querySelector('.step-screenshots');
      if (screenshotsContainer) {
        step.screenshots.forEach((screenshot, idx) => {
          const imgPath =
            typeof screenshot === 'object' && screenshot.filepath
              ? screenshot.filepath
              : `screenshots/${screenshot}`;
          const imgName =
            typeof screenshot === 'object' && screenshot.filename
              ? screenshot.filename
              : screenshot;
          const imgDesc =
            typeof screenshot === 'object' && screenshot.description
              ? screenshot.description
              : `Screenshot ${idx + 1}`;

          const img = document.createElement('img');
          img.src = imgPath;
          img.alt = imgDesc;
          img.title = imgDesc;
          img.className = 'step-screenshot-thumb me-2 mb-1';
          img.style.cssText =
            'max-width: 100px; max-height: 60px; cursor: pointer; border: 1px solid #ddd; border-radius: 4px;';

          img.addEventListener('click', () => {
            this.showScreenshot(imgPath, imgName);
          });

          screenshotsContainer.appendChild(img);
        });
      }
    }

    return stepDiv;
  }

  /**
   * Populate the screenshots gallery
   */
  populateScreenshotsGallery(result) {
    const gallery = document.getElementById('screenshots-gallery');
    if (!gallery) return;

    gallery.innerHTML = '';

    if (!result.screenshots || result.screenshots.length === 0) {
      gallery.innerHTML =
        '<div class="col-12 text-muted text-center">No screenshots available</div>';
      return;
    }

    result.screenshots.forEach((screenshot, index) => {
      const screenshotElement = this.createScreenshotElement(screenshot, result.resultDir, index);
      gallery.appendChild(screenshotElement);
    });
  }

  /**
   * Create a screenshot element for the gallery
   */
  createScreenshotElement(screenshot, resultDir, index) {
    const col = document.createElement('div');
    col.className = 'col-md-3 col-sm-4 col-6 mb-3';

    const screenshotPath = `screenshots/${screenshot}`;

    col.innerHTML = `
      <div class="card">
        <img src="${screenshotPath}" 
             class="card-img-top screenshot-thumbnail" 
             alt="Screenshot ${index + 1}"
             data-screenshot="${screenshotPath}"
             data-screenshot-name="${this.escapeHtml(screenshot)}">
        <div class="card-body p-2">
          <small class="text-muted">${this.escapeHtml(screenshot)}</small>
        </div>
      </div>
    `;

    // Add click event to thumbnail
    const thumbnail = col.querySelector('.screenshot-thumbnail');
    thumbnail.addEventListener('click', () => {
      this.showScreenshot(screenshotPath, screenshot);
    });

    return col;
  }

  /**
   * Show a screenshot in the screenshot modal
   */
  showScreenshot(screenshotPath, screenshotName) {
    const viewer = document.getElementById('screenshot-viewer');
    const info = document.getElementById('screenshot-info');

    if (viewer) {
      viewer.src = screenshotPath;
      viewer.alt = screenshotName;
    }

    if (info) {
      info.textContent = screenshotName;
    }

    const modalElement = document.getElementById('screenshotModal');
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    modal.show();
  }

  /**
   * Format status with appropriate styling
   */
  formatStatus(status) {
    const statusClass = status === 'SUCCESS' ? 'badge bg-success' : 'badge bg-danger';
    const statusIcon = status === 'SUCCESS' ? '✓' : '✗';
    return `<span class="${statusClass}">${statusIcon} ${status}</span>`;
  }

  /**
   * Format datetime for display
   */
  formatDateTime(dateTimeString) {
    if (!dateTimeString) return 'N/A';

    try {
      const date = new Date(dateTimeString);
      return date.toLocaleString();
    } catch (error) {
      return dateTimeString;
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    if (typeof text !== 'string') {
      return String(text);
    }

    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Animate cards on page load
   */
  animateCards() {
    const cards = document.querySelectorAll('.card');
    cards.forEach((card, index) => {
      setTimeout(() => {
        card.classList.add('fade-in');
      }, index * 100);
    });
  }

  /**
   * Attach table sorting event listeners
   */
  attachTableSortingListeners() {
    document.querySelectorAll('.sortable').forEach(header => {
      header.addEventListener('click', () => {
        const sortBy = header.getAttribute('data-sort');
        this.sortTable(sortBy);
      });
    });
  }

  /**
   * Sort table by specified column
   */
  sortTable(sortBy) {
    const table = document.getElementById('results-table');
    const tbody = document.getElementById('results-table-body');
    
    if (!table || !tbody) return;

    // Toggle sort order for this column
    this.tableSortOrder[sortBy] = this.tableSortOrder[sortBy] === 'asc' ? 'desc' : 'asc';
    const isAscending = this.tableSortOrder[sortBy] === 'asc';

    // Get all rows
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    // Sort rows based on the column data
    rows.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case 'duration':
          aValue = this.extractDurationValue(a);
          bValue = this.extractDurationValue(b);
          break;
        case 'tokens':
          aValue = this.extractTokenValue(a);
          bValue = this.extractTokenValue(b);
          break;
        case 'cost':
          aValue = this.extractCostValue(a);
          bValue = this.extractCostValue(b);
          break;
        default:
          return 0;
      }

      if (isAscending) {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });

    // Clear table body and re-append sorted rows
    tbody.innerHTML = '';
    rows.forEach(row => tbody.appendChild(row));

    // Update header indicators
    this.updateSortIndicators(sortBy, isAscending);
  }

  /**
   * Extract duration value from table row for sorting
   */
  extractDurationValue(row) {
    const durationCell = row.children[2]; // Duration is 3rd column (0-indexed)
    if (!durationCell) return 0;
    
    const text = durationCell.textContent.trim();
    // Extract number from formats like "34.379s" or "1m 23s"
    if (text.includes('m')) {
      const parts = text.split('m');
      const minutes = parseFloat(parts[0]) || 0;
      const seconds = parseFloat(parts[1].replace('s', '')) || 0;
      return minutes * 60 + seconds;
    } else {
      return parseFloat(text.replace('s', '')) || 0;
    }
  }

  /**
   * Extract token value from table row for sorting
   */
  extractTokenValue(row) {
    const tokenCell = row.children[3]; // Tokens is 4th column (0-indexed)
    if (!tokenCell) return 0;
    
    const badgeElement = tokenCell.querySelector('.badge');
    if (badgeElement) {
      const text = badgeElement.textContent.trim();
      return parseInt(text.replace(/,/g, '')) || 0;
    }
    return 0;
  }

  /**
   * Extract cost value from table row for sorting
   */
  extractCostValue(row) {
    const costCell = row.children[4]; // Cost is 5th column (0-indexed)
    if (!costCell) return 0;
    
    const badgeElement = costCell.querySelector('.badge');
    if (badgeElement) {
      const text = badgeElement.textContent.trim();
      return parseFloat(text.replace('$', '')) || 0;
    }
    return 0;
  }

  /**
   * Update sort indicators in table headers
   */
  updateSortIndicators(sortBy, isAscending) {
    // Reset all indicators
    document.querySelectorAll('.sortable i').forEach(icon => {
      icon.className = 'bi bi-arrow-down-up ms-1';
    });

    // Set indicator for current sort column
    const currentHeader = document.querySelector(`[data-sort="${sortBy}"] i`);
    if (currentHeader) {
      if (isAscending) {
        currentHeader.className = 'bi bi-arrow-up ms-1';
      } else {
        currentHeader.className = 'bi bi-arrow-down ms-1';
      }
    }
  }

  /**
   * Initialize charts for the statistics tab
   */
  initializeCharts() {
    // Initialize on tab switch to statistics
    const statisticsTab = document.getElementById('statistics-tab');
    if (statisticsTab) {
      statisticsTab.addEventListener('shown.bs.tab', () => {
        // Small delay to ensure tab is fully rendered
        setTimeout(() => {
          this.createDurationChart();
          this.attachChartEventListeners();
        }, 100);
      });
    }
  }

  /**
   * Attach event listeners for chart controls
   */
  attachChartEventListeners() {
    // Chart view controls
    document.getElementById('chart-view-top50')?.addEventListener('click', () => {
      this.updateChart({ view: 'top50' });
    });
    
    document.getElementById('chart-view-all')?.addEventListener('click', () => {
      this.updateChart({ view: 'all' });
    });
    
    document.getElementById('chart-sort-duration')?.addEventListener('click', () => {
      this.updateChart({ sortBy: 'duration' });
    });
    
    document.getElementById('chart-sort-name')?.addEventListener('click', () => {
      this.updateChart({ sortBy: 'name' });
    });
  }

  /**
   * Update chart with new options
   */
  updateChart(options = {}) {
    if (this.durationChart) {
      this.durationChart.destroy();
      this.durationChart = null;
    }
    
    this.chartOptions = { 
      ...this.chartOptions, 
      ...options 
    };
    
    this.createDurationChart();
    
    // Update active button states
    const controls = document.querySelectorAll('#chart-controls button');
    controls.forEach(btn => btn.classList.remove('active'));
    
    if (options.view === 'top50') {
      document.getElementById('chart-view-top50')?.classList.add('active');
    } else if (options.view === 'all') {
      document.getElementById('chart-view-all')?.classList.add('active');
    }
  }

  /**
   * Create test duration chart
   */
  createDurationChart() {
    const canvas = document.getElementById('durationChart');
    if (!canvas || this.durationChart) {
      return; // Chart already exists or canvas not found
    }

    console.log('Creating duration chart with test data:', this.testData.length, 'results');

    if (this.testData.length === 0) {
      console.warn('No test data available for chart');
      const ctx = canvas.getContext('2d');
      this.durationChart = typeof Chart !== 'undefined' ? new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['No Data'],
          datasets: [{
            label: 'No test data available',
            data: [0],
            backgroundColor: ['#cccccc']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'No test data available'
            }
          }
        }
      }) : null;
      return;
    }

    // Group tests by name and calculate average duration
    const testGroups = {};
    this.testData.forEach(result => {
      // Extract test data from the correct structure
      const session = result.session || result;
      
      // Try multiple ways to get test name
      const testName = session.testName || 
                      session.testId ||
                      result.testName ||
                      result.testId ||
                      result.summary?.testName ||
                      result.summary?.testId ||
                      'Unknown Test';
      
      if (!testGroups[testName]) {
        testGroups[testName] = {
          durations: [],
          totalDuration: 0,
          count: 0,
          rawDurations: []
        };
      }
      
      // Try multiple ways to get duration (session structure has priority)
      let duration = session.duration || 
                     result.duration || 
                     result.summary?.duration || 
                     session.executionTime ||
                     result.executionTime ||
                     0;
      
      // Convert duration to number if it's a string
      if (typeof duration === 'string') {
        duration = parseFloat(duration) || 0;
      }
      
      console.log(`Test: ${testName}, Duration: ${duration}ms, Session:`, session, 'Result:', result);
      
      if (duration > 0) { // Only add tests with valid duration
        testGroups[testName].durations.push(duration);
        testGroups[testName].totalDuration += duration;
        testGroups[testName].count++;
        testGroups[testName].rawDurations.push(duration);
      } else {
        console.warn(`Test ${testName} has invalid duration: ${duration}`);
      }
    });

    console.log('Test groups found:', Object.keys(testGroups).length, testGroups);

    if (Object.keys(testGroups).length === 0) {
      console.warn('No test groups found after processing');
      // Create a simple test chart for debugging
      const ctx = canvas.getContext('2d');
      this.durationChart = typeof Chart !== 'undefined' ? new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Sample Test'],
          datasets: [{
            label: 'Duration (seconds)',
            data: [20],
            backgroundColor: ['#007bff'],
            indexAxis: 'y'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: 'y',
          plugins: {
            title: {
              display: true,
              text: 'Sample Chart - No test data processed'
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Duration (seconds)'
              }
            },
            y: {
              title: {
                display: true,
                text: 'Test Name'
              }
            }
          }
        }
      }) : null;
      return;
    }

    // Prepare chart data - sort based on user preference
    const sortedTests = Object.entries(testGroups)
      .map(([name, group]) => ({
        name,
        avgDuration: group.totalDuration / group.count,
        count: group.count,
        maxDuration: Math.max(...group.rawDurations),
        minDuration: Math.min(...group.rawDurations)
      }));

    // Apply sorting based on user preference
    if (this.chartOptions.sortBy === 'duration') {
      sortedTests.sort((a, b) => b.avgDuration - a.avgDuration); // Sort by duration descending
    } else if (this.chartOptions.sortBy === 'name') {
      sortedTests.sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically
    }

    // Handle view options - top 50 vs all tests
    let displayTests;
    let chartTitle;
    
    if (this.chartOptions.view === 'top50' && sortedTests.length > 50) {
      displayTests = sortedTests.slice(0, 50);
      chartTitle = `Test Duration Analysis (Top 50 of ${sortedTests.length} tests)`;
    } else {
      displayTests = sortedTests;
      chartTitle = `Test Duration Analysis (${sortedTests.length} tests)`;
      
      // For very large numbers of tests, limit to 200 for performance
      if (displayTests.length > 200) {
        displayTests = displayTests.slice(0, 200);
        chartTitle = `Test Duration Analysis (Top 200 of ${sortedTests.length} tests)`;
      }
    }
    
    const labels = displayTests.map(test => {
      // Truncate long test names for better display
      const maxLength = 25;
      return test.name.length > maxLength ? 
        `${test.name.substring(0, maxLength)  }...` : 
        test.name;
    });
    
    const avgDurations = displayTests.map(test => (test.avgDuration / 1000).toFixed(2)); // Convert to seconds

    // Create gradient colors based on duration (red for slow, green for fast)
    const maxDuration = Math.max(...displayTests.map(t => t.avgDuration));
    const colors = displayTests.map(test => {
      const ratio = test.avgDuration / maxDuration;
      const hue = (1 - ratio) * 120; // 120 = green, 0 = red
      return `hsla(${hue}, 70%, 60%, 0.8)`;
    });

    // Canvas will use container height from CSS
    console.log(`Preparing chart for ${displayTests.length} tests with title: ${chartTitle}`);

    const ctx = canvas.getContext('2d');
    this.durationChart = typeof Chart !== 'undefined' ? new Chart(ctx, {
      type: 'bar', // Use bar chart with indexAxis: 'y' for horizontal bars
      data: {
        labels,
        datasets: [{
          label: 'Average Duration (seconds)',
          data: avgDurations,
          backgroundColor: colors,
          borderColor: colors.map(color => color.replace('0.8', '1')),
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y', // Chart.js 3+ syntax for horizontal bars
        layout: {
          padding: {
            left: 10,
            right: 30,
            top: 10,
            bottom: 10
          }
        },
        plugins: {
          title: {
            display: true,
            text: chartTitle
          },
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              title(context) {
                const index = context[0].dataIndex;
                return displayTests[index].name; // Show full name in tooltip
              },
              label(context) {
                const index = context.dataIndex;
                const test = displayTests[index];
                return [
                  `Average: ${context.parsed.x}s`,
                  `Runs: ${test.count}`,
                  `Min: ${(test.minDuration / 1000).toFixed(2)}s`,
                  `Max: ${(test.maxDuration / 1000).toFixed(2)}s`
                ];
              }
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Average Duration (seconds)'
            }
          },
          y: {
            title: {
              display: true,
              text: 'Test Name'
            },
            ticks: {
              maxRotation: 0,
              minRotation: 0,
              font: {
                size: 11
              }
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    }) : null;

    // Update chart info
    const chartInfo = document.getElementById('chart-info');
    if (chartInfo) {
      const sortText = this.chartOptions.sortBy === 'duration' ? 'sorted by duration' : 'sorted alphabetically';
      chartInfo.innerHTML = `<small class="text-muted">Showing ${displayTests.length} of ${sortedTests.length} tests, ${sortText}</small>`;
    }

    console.log('Duration chart created successfully');
  }

  /**
   * Animate timeline items when modal is shown
   */
  animateTimeline() {
    const timelineItems = document.querySelectorAll('.timeline-item');
    timelineItems.forEach((item, index) => {
      setTimeout(() => {
        item.classList.add('slide-in');
      }, index * 150);
    });
  }

  /**
   * Filter table rows based on search input and status filter
   */
  filterResults(searchTerm = '', statusFilter = 'all') {
    const rows = document.querySelectorAll('.test-result-row');
    const lowerSearchTerm = searchTerm.toLowerCase();
    let visibleCount = 0;
    const totalCount = rows.length;

    rows.forEach((row) => {
      const testId = row.querySelector('strong').textContent.toLowerCase();
      const testName = row.querySelector('.text-muted').textContent.toLowerCase();
      const statusElement = row.querySelector('.badge');
      const status = statusElement ? statusElement.textContent.trim() : '';

      // Check search term match
      const searchMatch =
        !searchTerm || testId.includes(lowerSearchTerm) || testName.includes(lowerSearchTerm);

      // Check status filter match
      let statusMatch = true;
      if (statusFilter === 'passed') {
        statusMatch = status.includes('Passed');
      } else if (statusFilter === 'failed') {
        statusMatch = status.includes('Failed');
      }

      const shouldShow = searchMatch && statusMatch;
      row.style.display = shouldShow ? '' : 'none';

      // Add highlight class for search matches
      if (shouldShow && searchTerm) {
        row.classList.add('highlight');
      } else {
        row.classList.remove('highlight');
      }

      if (shouldShow) visibleCount++;
    });

    // Update search results info
    this.updateSearchResultsInfo(visibleCount, totalCount, searchTerm, statusFilter);

    // Scroll to first visible result if searching
    if (searchTerm && visibleCount > 0) {
      const firstVisibleRow = document.querySelector(
        '.test-result-row[style=""], .test-result-row:not([style*="none"])'
      );
      if (firstVisibleRow) {
        firstVisibleRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  /**
   * Update the search results information display
   */
  updateSearchResultsInfo(visibleCount, totalCount, searchTerm, statusFilter) {
    const infoElement = document.getElementById('search-results-info');
    if (!infoElement) return;

    let message = '';

    if (searchTerm && statusFilter !== 'all') {
      message = `Showing ${visibleCount} of ${totalCount} tests matching "${searchTerm}" with status "${statusFilter}"`;
    } else if (searchTerm) {
      message = `Showing ${visibleCount} of ${totalCount} tests matching "${searchTerm}"`;
    } else if (statusFilter !== 'all') {
      message = `Showing ${visibleCount} of ${totalCount} ${statusFilter} tests`;
    } else {
      message = `Showing all ${totalCount} test results`;
    }

    infoElement.textContent = message;

    // Add highlight class if filtering is active
    if (searchTerm || statusFilter !== 'all') {
      infoElement.classList.add('text-primary');
      infoElement.classList.remove('text-muted');
    } else {
      infoElement.classList.add('text-muted');
      infoElement.classList.remove('text-primary');
    }
  }

  /**
   * Export report data to JSON
   */
  exportToJson() {
    const dataStr = JSON.stringify(this.testData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `endorphin-test-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Print the report
   */
  printReport() {
    window.print();
  }

  /**
   * Populate multi-user steps timeline with user sections
   */
  populateMultiUserStepsTimeline(steps, timeline) {
    // Group steps by user
    const userSteps = {};
    const nonUserSteps = [];
    
    steps.forEach(step => {
      if (step.userId) {
        if (!userSteps[step.userId]) {
          userSteps[step.userId] = [];
        }
        userSteps[step.userId].push(step);
      } else {
        nonUserSteps.push(step);
      }
    });
    
    // Add non-user steps first (setup, global steps)
    if (nonUserSteps.length > 0) {
      const globalSection = document.createElement('div');
      globalSection.className = 'user-section mb-4';
      globalSection.innerHTML = `
        <h6 class="mb-3">
          <span class="badge bg-secondary">🌍 GLOBAL</span>
          Global Steps (${nonUserSteps.length})
        </h6>
      `;
      
      nonUserSteps.forEach(step => {
        const stepElement = this.createStepElement(step, step.stepNumber - 1, false);
        globalSection.appendChild(stepElement);
      });
      
      timeline.appendChild(globalSection);
    }
    
    // Add sections for each user
    Object.keys(userSteps).sort().forEach(userId => {
      const userSection = document.createElement('div');
      userSection.className = 'user-section mb-4';
      userSection.innerHTML = `
        <h6 class="mb-3">
          <span class="badge bg-primary">👤 ${userId.toUpperCase()}</span>
          User Steps (${userSteps[userId].length})
        </h6>
      `;
      
      userSteps[userId].forEach(step => {
        const stepElement = this.createStepElement(step, step.stepNumber - 1, false);
        userSection.appendChild(stepElement);
      });
      
      timeline.appendChild(userSection);
    });
  }

  /**
   * Populate multi-user agent history timeline with user sections
   */
  populateMultiUserAgentHistoryTimeline(agentHistory, timeline) {
    // Group history by user
    const userHistory = {};
    const nonUserHistory = [];
    
    agentHistory.forEach(entry => {
      if (entry.userId) {
        if (!userHistory[entry.userId]) {
          userHistory[entry.userId] = [];
        }
        userHistory[entry.userId].push(entry);
      } else {
        nonUserHistory.push(entry);
      }
    });
    
    // Add non-user history first (setup, global decisions)
    if (nonUserHistory.length > 0) {
      const globalSection = document.createElement('div');
      globalSection.className = 'user-section mb-4';
      globalSection.innerHTML = `
        <h6 class="mb-3">
          <span class="badge bg-secondary">🌍 GLOBAL</span>
          Global Agent Decisions (${nonUserHistory.length})
        </h6>
      `;
      
      nonUserHistory.forEach(entry => {
        const historyElement = this.createAgentHistoryElement(entry, entry.historyId - 1, false);
        globalSection.appendChild(historyElement);
      });
      
      timeline.appendChild(globalSection);
    }
    
    // Add sections for each user
    Object.keys(userHistory).sort().forEach(userId => {
      const userSection = document.createElement('div');
      userSection.className = 'user-section mb-4';
      userSection.innerHTML = `
        <h6 class="mb-3">
          <span class="badge bg-primary">🤖 ${userId.toUpperCase()}</span>
          Agent Decisions (${userHistory[userId].length})
        </h6>
      `;
      
      userHistory[userId].forEach(entry => {
        const historyElement = this.createAgentHistoryElement(entry, entry.historyId - 1, false);
        userSection.appendChild(historyElement);
      });
      
      timeline.appendChild(userSection);
    });
  }
}

// Utility functions for additional features
class ReportUtils {
  /**
   * Copy text to clipboard
   */
  static copyToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          ReportUtils.showToast('Copied to clipboard');
        })
        .catch((err) => {
          console.error('Failed to copy:', err);
        });
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        ReportUtils.showToast('Copied to clipboard');
      } catch (err) {
        console.error('Failed to copy:', err);
      }
      document.body.removeChild(textArea);
    }
  }

  /**
   * Show a toast notification
   */
  static showToast(message, type = 'success') {
    // Create toast element if it doesn't exist
    let toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
      toastContainer.style.zIndex = '9999';
      document.body.appendChild(toastContainer);
    }

    const toastId = `toast-${Date.now()}`;
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `toast align-items-center text-white bg-${type} border-0`;
    toast.setAttribute('role', 'alert');

    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">${message}</div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    `;

    toastContainer.appendChild(toast);

    const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
    bsToast.show();

    // Remove toast element after it's hidden
    toast.addEventListener('hidden.bs.toast', () => {
      toast.remove();
    });
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  /**
   * Generate a random color for charts/visualizations
   */
  static generateColor(index) {
    const colors = [
      '#0066cc',
      '#28a745',
      '#dc3545',
      '#ffc107',
      '#17a2b8',
      '#6f42c1',
      '#e83e8c',
      '#fd7e14',
      '#20c997',
      '#6c757d',
    ];
    return colors[index % colors.length];
  }
}

// Initialize the report viewer when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.reportViewer = new TestReportViewer();

  // Add keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + E to export
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
      e.preventDefault();
      window.reportViewer.exportToJson();
    }

    // Ctrl/Cmd + P to print
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      window.reportViewer.printReport();
    }

    // Ctrl/Cmd + F to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      const searchInput = document.getElementById('test-search');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }

    // Escape to clear search
    if (e.key === 'Escape') {
      const searchInput = document.getElementById('test-search');
      if (searchInput && searchInput.value) {
        searchInput.value = '';
        window.reportViewer.filterResults('', window.reportViewer.currentFilter);
      }
    }

    // Number keys to select filters (1=All, 2=Passed, 3=Failed)
    if (e.key >= '1' && e.key <= '3' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      const filterButtons = document.querySelectorAll('[data-filter]');
      const index = parseInt(e.key) - 1;
      if (filterButtons[index]) {
        filterButtons[index].click();
      }
    }
  });
});

/**
 * Global function to show test details by sessionId
 * Called by View Details buttons in the report
 */
function showTestDetails(sessionId) {
  if (window.reportViewer && window.reportViewer.testData) {
    // Find the test result index by sessionId
    const index = window.reportViewer.testData.findIndex(
      result => result.session?.sessionId === sessionId || result.summary?.sessionId === sessionId
    );
    
    if (index !== -1) {
      window.reportViewer.showTestDetails(index);
    } else {
      console.error('Test result not found for sessionId:', sessionId);
      alert(`Test details not found for session: ${sessionId}`);
    }
  } else {
    console.error('Report viewer not initialized');
  }
}


// Make function available globally
window.showTestDetails = showTestDetails;

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { TestReportViewer, ReportUtils, showTestDetails };
}
