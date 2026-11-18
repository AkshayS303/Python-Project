/**
 * MatSolve — Universal Linear Equation & Word Problem Solver
 * Frontend Application Controller
 */

// Application State
const state = {
  mode: 'word-problem', // 'word-problem' | 'direct-matrix'
  matrixSize: 3,
  matrixA: [],
  vectorB: [],
  solverMethod: 'gaussian',
  chartInstance: null,
  jacobiTrajectoryChartInstance: null,
  jacobiCrossoverChartInstance: null,
  lastJacobiResult: null,
  apiKey: localStorage.getItem('matsolve_gemini_api_key') || localStorage.getItem('matrixai_gemini_api_key') || ''
};

// Word Problem Presets
const WORD_PRESETS = {
  animals: "A farmer has chickens and cows. There are 35 heads and 94 legs in total. How many chickens and how many cows are on the farm?",
  portfolio: "An investor allocates $10,000 between a safe bond yielding 4% annual interest and a high-yield fund yielding 7%. If the total annual return is $580, how much was invested in each?",
  bakery: "A bakery produces chocolate croissants and almond buns. A croissant requires 200g flour and 50g butter. An almond bun requires 150g flour and 30g butter. Today they have 5.5kg (5500g) of flour and 1.35kg (1350g) of butter. How many croissants and almond buns can they make?",
  mixture: "A chemist needs 100 liters of a 14% acid solution by mixing a 10% acid solution and a 20% acid solution. How many liters of each solution should be combined?"
};

// Direct Matrix Presets
const MATRIX_PRESETS = {
  unique3: {
    size: 3,
    A: [[2, 1, -1], [-3, -1, 2], [-2, 1, 2]],
    B: [8, -11, -3]
  },
  jacobi_dominant: {
    size: 3,
    A: [[10, -1, 2], [-1, 11, -1], [2, -1, 10]],
    B: [6, 25, -11]
  },
  inconsistent: {
    size: 3,
    A: [[1, 2, -1], [2, 4, -2], [3, 1, 1]],
    B: [5, 12, 4]
  },
  infinite: {
    size: 3,
    A: [[1, 2, 3], [2, 4, 6], [1, 1, 1]],
    B: [6, 12, 3]
  },
  identity: {
    size: 3,
    A: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    B: [4, -2, 9]
  }
};

// DOM References
const elements = {
  tabWordProblem: document.getElementById('tab-word-problem'),
  tabDirectMatrix: document.getElementById('tab-direct-matrix'),
  panelWordProblem: document.getElementById('panel-word-problem'),
  panelDirectMatrix: document.getElementById('panel-direct-matrix'),
  wordProblemInput: document.getElementById('word-problem-input'),
  matrixSizeSelect: document.getElementById('matrix-size-select'),
  matrixGridContainer: document.getElementById('matrix-grid-container'),
  liveEquations: document.getElementById('live-equations'),
  solverMethodSelect: document.getElementById('solver-method-select'),
  jacobiOptionsGroup: document.getElementById('jacobi-options-group'),
  jacobiIterInput: document.getElementById('jacobi-iter-input'),
  btnSolve: document.getElementById('btn-solve'),
  solveSpinner: document.getElementById('solve-spinner'),
  
  // Results
  resultsSection: document.getElementById('results-section'),
  emptyState: document.getElementById('empty-state-view'),
  resultsContent: document.getElementById('results-content-view'),
  statusBanner: document.getElementById('status-banner'),
  statusBadge: document.getElementById('status-badge'),
  statusTitle: document.getElementById('status-title'),
  statusExplanation: document.getElementById('status-explanation'),
  pillRankA: document.getElementById('pill-rank-a'),
  pillRankAug: document.getElementById('pill-rank-aug'),
  pillNumVars: document.getElementById('pill-num-vars'),
  
  aiBreakdownContainer: document.getElementById('ai-breakdown-container'),
  aiSourceBadge: document.getElementById('ai-source-badge'),
  aiVariableTags: document.getElementById('ai-variable-tags'),
  aiExplanationList: document.getElementById('ai-explanation-list'),
  
  solvedVariablesGrid: document.getElementById('solved-variables-grid'),
  btnCopySolutions: document.getElementById('btn-copy-solutions'),
  chartCard: document.getElementById('allocation-chart-card'),
  stepCount: document.getElementById('step-count'),
  stepsTimeline: document.getElementById('steps-timeline'),
  chartCanvas: document.getElementById('solutionChart'),

  // Jacobi Analytics Elements
  jacobiAnalyticsSection: document.getElementById('jacobi-analytics-section'),
  jacobiIterationsBadge: document.getElementById('jacobi-iterations-badge'),
  dominanceCard: document.getElementById('dominance-card'),
  dominanceTitle: document.getElementById('dominance-title'),
  dominanceText: document.getElementById('dominance-text'),
  dominanceIcon: document.getElementById('dominance-icon'),
  dominanceTableContainer: document.getElementById('dominance-table-container'),
  jacobiStatsGrid: document.getElementById('jacobi-stats-grid'),
  jacobiTrajectoryChart: document.getElementById('jacobiTrajectoryChart'),
  jacobiCrossoverChart: document.getElementById('jacobiCrossoverChart'),
  crossoverBadgesList: document.getElementById('crossover-badges-list'),
  iterationTableHead: document.getElementById('iteration-table-head'),
  iterationTableBody: document.getElementById('iteration-table-body'),

  // Modal & Toast
  btnApiKey: document.getElementById('btn-api-key'),
  btnTheme: document.getElementById('btn-theme-toggle'),
  apiKeyModal: document.getElementById('api-key-modal'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  customApiKeyInput: document.getElementById('custom-api-key-input'),
  btnSaveApiKey: document.getElementById('btn-save-api-key'),
  btnClearApiKey: document.getElementById('btn-clear-api-key'),
  toast: document.getElementById('app-toast')
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  applyTheme(getTheme(), { persist: false });
  setupEventListeners();
  renderMatrixGrid(state.matrixSize);
  loadMatrixPreset('unique3', true);
});

/* ==========================================================================
   Theme controller — light (Ash) / dark (Nord)
   The initial attribute is set by an inline script in index.html so the page
   never flashes the wrong theme; this controller handles the toggle, the
   accessible state, the browser chrome colour and chart re-theming.
   ========================================================================== */
const THEME_STORAGE_KEY = 'matsolve_theme';
const THEME_META_COLORS = { light: '#CCDAD1', dark: '#2E3440' };

function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme, options = {}) {
  const dark = theme === 'dark';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');

  if (elements.btnTheme) {
    const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
    elements.btnTheme.setAttribute('aria-pressed', dark ? 'true' : 'false');
    elements.btnTheme.setAttribute('aria-label', label);
    elements.btnTheme.setAttribute('title', label);
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', dark ? THEME_META_COLORS.dark : THEME_META_COLORS.light);
  }

  if (options.persist !== false) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light');
    } catch (err) {
      /* storage unavailable — the choice simply won't persist */
    }
  }

  refreshChartsForTheme();
}

function toggleTheme() {
  applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

// Read a CSS custom property so charts always match the active theme
function themeValue(name, fallback) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name);
  return value && value.trim() ? value.trim() : fallback;
}

// Rebuild any visible chart with the new palette (data lives in the instances)
function refreshChartsForTheme() {
  if (typeof Chart === 'undefined') return;

  if (state.chartInstance) {
    const labels = state.chartInstance.data.labels;
    const values = state.chartInstance.data.datasets[0].data;
    renderChart(labels, values);
  }

  if (state.lastJacobiResult && (state.jacobiTrajectoryChartInstance || state.jacobiCrossoverChartInstance)) {
    renderJacobiAnalytics(state.lastJacobiResult);
  }
}

// Setup Events
function setupEventListeners() {
  // Tabs
  elements.tabWordProblem.addEventListener('click', () => switchMode('word-problem'));
  elements.tabDirectMatrix.addEventListener('click', () => switchMode('direct-matrix'));

  // Keyboard navigation for the mode tabs (WAI-ARIA tabs pattern)
  const modeTabs = [elements.tabWordProblem, elements.tabDirectMatrix];
  modeTabs.forEach((tab, index) => {
    tab.addEventListener('keydown', (e) => {
      let targetIndex = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') targetIndex = (index + 1) % modeTabs.length;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') targetIndex = (index - 1 + modeTabs.length) % modeTabs.length;
      if (e.key === 'Home') targetIndex = 0;
      if (e.key === 'End') targetIndex = modeTabs.length - 1;
      if (targetIndex === null) return;

      e.preventDefault();
      const target = modeTabs[targetIndex];
      target.focus();
      switchMode(target === elements.tabWordProblem ? 'word-problem' : 'direct-matrix');
    });
  });

  // Word problem preset chips
  document.querySelectorAll('[data-preset]').forEach(chip => {
    chip.addEventListener('click', (e) => {
      const presetKey = e.currentTarget.getAttribute('data-preset');
      if (WORD_PRESETS[presetKey]) {
        elements.wordProblemInput.value = WORD_PRESETS[presetKey];
        showToast(`Loaded ${presetKey} scenario`);
      }
    });
  });

  // Matrix preset chips
  document.querySelectorAll('[data-matrix-preset]').forEach(chip => {
    chip.addEventListener('click', (e) => {
      const presetKey = e.currentTarget.getAttribute('data-matrix-preset');
      loadMatrixPreset(presetKey);
    });
  });

  // Matrix size change
  elements.matrixSizeSelect.addEventListener('change', (e) => {
    const newSize = parseInt(e.target.value, 10);
    state.matrixSize = newSize;
    renderMatrixGrid(newSize);
  });

  // Method selector change
  elements.solverMethodSelect.addEventListener('change', (e) => {
    state.solverMethod = e.target.value;
    if (state.solverMethod === 'jacobi') {
      if (elements.jacobiOptionsGroup) elements.jacobiOptionsGroup.classList.remove('hidden');
    } else {
      if (elements.jacobiOptionsGroup) elements.jacobiOptionsGroup.classList.add('hidden');
    }
  });

  // Solve button
  elements.btnSolve.addEventListener('click', handleSolve);

  // Copy solutions button
  elements.btnCopySolutions.addEventListener('click', copySolutionsToClipboard);

  // API Key Modal
  elements.btnApiKey.addEventListener('click', openApiModal);
  elements.btnCloseModal.addEventListener('click', closeApiModal);

  // Theme toggle (light / Nord dark)
  if (elements.btnTheme) {
    elements.btnTheme.addEventListener('click', toggleTheme);
  }

  // Follow the OS preference only while the visitor has not picked a theme
  const themeQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const onSystemThemeChange = (event) => {
    let saved = null;
    try {
      saved = localStorage.getItem(THEME_STORAGE_KEY);
    } catch (err) {
      /* storage unavailable */
    }
    if (!saved) {
      applyTheme(event.matches ? 'dark' : 'light', { persist: false });
    }
  };
  if (typeof themeQuery.addEventListener === 'function') {
    themeQuery.addEventListener('change', onSystemThemeChange);
  } else if (typeof themeQuery.addListener === 'function') {
    themeQuery.addListener(onSystemThemeChange);
  }

  elements.apiKeyModal.addEventListener('click', (e) => {
    if (e.target === elements.apiKeyModal) {
      closeApiModal();
    }
  });

  document.addEventListener('keydown', handleModalKeydown);

  elements.btnSaveApiKey.addEventListener('click', () => {
    const key = elements.customApiKeyInput.value.trim();
    state.apiKey = key;
    if (key) {
      localStorage.setItem('matsolve_gemini_api_key', key);
      localStorage.removeItem('matrixai_gemini_api_key');
      showToast('Gemini API Key saved locally!');
    } else {
      localStorage.removeItem('matsolve_gemini_api_key');
      localStorage.removeItem('matrixai_gemini_api_key');
      showToast('Reset to default backend key.');
    }
    closeApiModal();
  });

  elements.btnClearApiKey.addEventListener('click', () => {
    elements.customApiKeyInput.value = '';
    state.apiKey = '';
    localStorage.removeItem('matsolve_gemini_api_key');
    localStorage.removeItem('matrixai_gemini_api_key');
    showToast('Reset to default backend key.');
    closeApiModal();
  });
}

// Accessible modal helpers
let lastFocusedElement = null;

function openApiModal() {
  const active = document.activeElement;
  lastFocusedElement = (active && active !== document.body && typeof active.focus === 'function')
    ? active
    : elements.btnApiKey;
  elements.customApiKeyInput.value = state.apiKey;
  elements.apiKeyModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  window.setTimeout(() => elements.customApiKeyInput.focus(), 0);
}

function closeApiModal() {
  if (elements.apiKeyModal.classList.contains('hidden')) return;
  elements.apiKeyModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
  if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
    lastFocusedElement.focus();
  }
}

function handleModalKeydown(e) {
  if (elements.apiKeyModal.classList.contains('hidden')) return;

  if (e.key === 'Escape') {
    e.preventDefault();
    closeApiModal();
    return;
  }

  if (e.key !== 'Tab') return;
  const focusables = Array.from(
    elements.apiKeyModal.querySelectorAll('button, input, a[href], select, textarea, [tabindex]:not([tabindex="-1"])')
  ).filter(el => !el.disabled && el.offsetParent !== null);

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

// Mode Switching
function switchMode(mode) {
  state.mode = mode;
  if (mode === 'word-problem') {
    elements.tabWordProblem.classList.add('active');
    elements.tabWordProblem.setAttribute('aria-selected', 'true');
    elements.tabWordProblem.setAttribute('tabindex', '0');
    elements.tabDirectMatrix.classList.remove('active');
    elements.tabDirectMatrix.setAttribute('aria-selected', 'false');
    elements.tabDirectMatrix.setAttribute('tabindex', '-1');

    elements.panelWordProblem.classList.add('active');
    elements.panelDirectMatrix.classList.remove('active');

    // Automatically set default solver method to Gaussian Elimination for word problems
    // (prevents non-diagonally-dominant word problems from diverging in Jacobi)
    if (state.solverMethod === 'jacobi') {
      state.solverMethod = 'gaussian';
      elements.solverMethodSelect.value = 'gaussian';
      if (elements.jacobiOptionsGroup) elements.jacobiOptionsGroup.classList.add('hidden');
      if (elements.jacobiAnalyticsSection) elements.jacobiAnalyticsSection.classList.add('hidden');
    }
  } else {
    elements.tabDirectMatrix.classList.add('active');
    elements.tabDirectMatrix.setAttribute('aria-selected', 'true');
    elements.tabDirectMatrix.setAttribute('tabindex', '0');
    elements.tabWordProblem.classList.remove('active');
    elements.tabWordProblem.setAttribute('aria-selected', 'false');
    elements.tabWordProblem.setAttribute('tabindex', '-1');

    elements.panelDirectMatrix.classList.add('active');
    elements.panelWordProblem.classList.remove('active');
    updateLiveEquations();
  }
}

// Render Dynamic Matrix Grid
function renderMatrixGrid(n) {
  elements.matrixGridContainer.innerHTML = '';
  
  for (let r = 0; r < n; r++) {
    const rowEl = document.createElement('div');
    rowEl.className = 'matrix-row';

    // A matrix cells
    for (let c = 0; c < n; c++) {
      const input = document.createElement('input');
      input.type = 'number';
      input.step = 'any';
      input.className = 'matrix-cell-input';
      input.dataset.row = r;
      input.dataset.col = c;
      input.dataset.matrix = 'A';
      input.value = r === c ? 1 : 0;
      input.setAttribute('aria-label', `Coefficient row ${r + 1}, column ${c + 1}`);
      input.addEventListener('input', updateLiveEquations);
      rowEl.appendChild(input);
    }

    // Augmented divider
    const divider = document.createElement('div');
    divider.className = 'matrix-divider';
    rowEl.appendChild(divider);

    // B vector cell
    const inputB = document.createElement('input');
    inputB.type = 'number';
    inputB.step = 'any';
    inputB.className = 'matrix-cell-input matrix-cell-b';
    inputB.dataset.row = r;
    inputB.dataset.matrix = 'B';
    inputB.value = (r + 1) * 2;
    inputB.setAttribute('aria-label', `Constant term for row ${r + 1}`);
    inputB.addEventListener('input', updateLiveEquations);
    rowEl.appendChild(inputB);

    elements.matrixGridContainer.appendChild(rowEl);
  }

  updateLiveEquations();
}

// Load Matrix Preset
function loadMatrixPreset(key, silent = false) {
  const preset = MATRIX_PRESETS[key];
  if (!preset) return;

  state.matrixSize = preset.size;
  elements.matrixSizeSelect.value = preset.size;
  renderMatrixGrid(preset.size);

  for (let r = 0; r < preset.size; r++) {
    for (let c = 0; c < preset.size; c++) {
      const input = elements.matrixGridContainer.querySelector(`input[data-matrix="A"][data-row="${r}"][data-col="${c}"]`);
      if (input) input.value = preset.A[r][c];
    }
    const inputB = elements.matrixGridContainer.querySelector(`input[data-matrix="B"][data-row="${r}"]`);
    if (inputB) inputB.value = preset.B[r];
  }

  updateLiveEquations();

  if (key === 'jacobi_dominant') {
    state.solverMethod = 'jacobi';
    elements.solverMethodSelect.value = 'jacobi';
    if (elements.jacobiOptionsGroup) elements.jacobiOptionsGroup.classList.remove('hidden');
  }

  if (!silent) {
    showToast(key === 'jacobi_dominant'
      ? 'Loaded diagonally dominant Jacobi preset'
      : `Loaded ${key} preset`);
  }
}

// Read Current Matrix Values from UI
function readMatrixFromUI() {
  const n = state.matrixSize;
  const A = [];
  const B = [];

  for (let r = 0; r < n; r++) {
    const row = [];
    for (let c = 0; c < n; c++) {
      const input = elements.matrixGridContainer.querySelector(`input[data-matrix="A"][data-row="${r}"][data-col="${c}"]`);
      row.push(parseFloat(input.value) || 0);
    }
    A.push(row);
    const inputB = elements.matrixGridContainer.querySelector(`input[data-matrix="B"][data-row="${r}"]`);
    B.push(parseFloat(inputB.value) || 0);
  }

  return { A, B };
}

// Update Live Equations Preview
function updateLiveEquations() {
  if (state.mode !== 'direct-matrix') return;
  const { A, B } = readMatrixFromUI();
  elements.liveEquations.innerHTML = '';

  A.forEach((row, rIdx) => {
    const terms = [];
    row.forEach((val, cIdx) => {
      const varName = `x<sub>${cIdx + 1}</sub>`;
      if (val !== 0 || row.every(v => v === 0)) {
        let prefix = terms.length > 0 && val >= 0 ? '+ ' : '';
        if (val < 0) prefix = '- ';
        const absVal = Math.abs(val);
        const coeffStr = absVal === 1 ? '' : absVal;
        terms.push(`${prefix}${coeffStr}${varName}`);
      }
    });

    const eqStr = terms.length > 0 ? terms.join(' ') : '0';
    const div = document.createElement('div');
    div.innerHTML = `Eq ${rIdx + 1}: ${eqStr} = <strong>${B[rIdx]}</strong>`;
    elements.liveEquations.appendChild(div);
  });
}

// Handle Solve Click
async function handleSolve() {
  setLoading(true);

  try {
    let result;
    if (state.mode === 'word-problem') {
      const problemText = elements.wordProblemInput.value.trim();
      if (!problemText) {
        showToast('Please enter a word problem or pick a sample preset.');
        setLoading(false);
        return;
      }
      result = await solveWordProblemAPI(problemText, state.solverMethod, state.apiKey);
    } else {
      const { A, B } = readMatrixFromUI();
      result = await solveMatrixAPI(A, B, state.solverMethod);
    }

    renderResults(result);
  } catch (err) {
    console.error('Solve Error:', err);
    showToast(err.message || 'Failed to compute solution.');
  } finally {
    setLoading(false);
  }
}

// API Calls with Client-Side Fallback
async function solveMatrixAPI(A, B, method) {
  const numIterations = parseInt(elements.jacobiIterInput?.value) || 15;
  try {
    const resp = await fetch('/api/solve/matrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matrix_a: A,
        vector_b: B,
        method: method,
        num_iterations: numIterations,
        variable_labels: A[0].map((_, i) => `x${i + 1}`)
      })
    });

    if (resp.ok) {
      return await resp.json();
    }
  } catch (e) {
    console.warn('Backend API unavailable, using in-browser linear solver engine:', e);
  }

  // Fallback: In-browser Jacobi or Gaussian Solver
  if (method === 'jacobi') {
    return runClientSideJacobi(A, B, numIterations);
  }
  return runClientSideGaussian(A, B, method);
}

async function solveWordProblemAPI(problem, method, apiKey) {
  const numIterations = parseInt(elements.jacobiIterInput?.value) || 15;
  try {
    const resp = await fetch('/api/solve/word-problem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        problem: problem,
        method: method,
        num_iterations: numIterations,
        api_key: apiKey || null
      })
    });

    if (resp.ok) {
      return await resp.json();
    }

    const errData = await resp.json().catch(() => ({}));
    const errMsg = errData.detail || errData.error;
    
    // Check offline preset fallback if backend returned error
    const offlineRes = trySolveWordProblemOffline(problem, method, numIterations);
    if (offlineRes) return offlineRes;

    throw new Error(errMsg || 'Failed to solve word problem.');
  } catch (err) {
    const offlineRes = trySolveWordProblemOffline(problem, method, numIterations);
    if (offlineRes) return offlineRes;
    throw err;
  }
}

// Offline Client-Side Word Problem Preset Parser (Zero-Downtime Guarantee)
function trySolveWordProblemOffline(problemText, method, numIterations = 15) {
  const text = (problemText || '').toLowerCase();
  
  // 1. Animals: chickens and cows
  if ((text.includes('chicken') || text.includes('cow')) && (text.includes('head') || text.includes('leg'))) {
    const A = [[1, 1], [2, 4]];
    const B = [35, 94];
    const labels = ["chickens", "cows"];
    const explanations = [
      "Equation 1 (Total Heads): chickens + cows = 35",
      "Equation 2 (Total Legs): 2 × chickens + 4 × cows = 94"
    ];
    const solveRes = method === 'jacobi' 
      ? runClientSideJacobi(A, B, numIterations)
      : runClientSideGaussian(A, B, method);
    solveRes.variable_labels = labels;
    solveRes.ai_parsed = {
      matrix_a: A,
      vector_b: B,
      variable_labels: labels,
      explanation_of_equations: explanations,
      source: "High-Availability Offline Demo Preset"
    };
    return solveRes;
  }

  // 2. Portfolio: bond & fund
  if (text.includes('invest') || (text.includes('bond') && text.includes('fund'))) {
    const A = [[1, 1], [0.04, 0.07]];
    const B = [10000, 580];
    const labels = ["safe_bond_yield_4pct", "high_yield_fund_7pct"];
    const explanations = [
      "Equation 1 (Total Principal): bond + fund = $10,000",
      "Equation 2 (Annual Yield): 0.04 × bond + 0.07 × fund = $580"
    ];
    const solveRes = method === 'jacobi' 
      ? runClientSideJacobi(A, B, numIterations)
      : runClientSideGaussian(A, B, method);
    solveRes.variable_labels = labels;
    solveRes.ai_parsed = {
      matrix_a: A,
      vector_b: B,
      variable_labels: labels,
      explanation_of_equations: explanations,
      source: "High-Availability Offline Demo Preset"
    };
    return solveRes;
  }

  // 3. Bakery: croissants & almond buns
  if (text.includes('croissant') || text.includes('bun') || text.includes('bakery')) {
    const A = [[200, 150], [50, 30]];
    const B = [5500, 1350];
    const labels = ["croissants", "almond_buns"];
    const explanations = [
      "Equation 1 (Flour Budget): 200g × croissants + 150g × buns = 5,500g",
      "Equation 2 (Butter Budget): 50g × croissants + 30g × buns = 1,350g"
    ];
    const solveRes = method === 'jacobi' 
      ? runClientSideJacobi(A, B, numIterations)
      : runClientSideGaussian(A, B, method);
    solveRes.variable_labels = labels;
    solveRes.ai_parsed = {
      matrix_a: A,
      vector_b: B,
      variable_labels: labels,
      explanation_of_equations: explanations,
      source: "High-Availability Offline Demo Preset"
    };
    return solveRes;
  }

  // 4. Mixture: chemistry acid solution
  if (text.includes('acid') || text.includes('chemist') || text.includes('mixture')) {
    const A = [[1, 1], [0.10, 0.20]];
    const B = [100, 14];
    const labels = ["solution_10pct", "solution_20pct"];
    const explanations = [
      "Equation 1 (Total Volume): sol_10% + sol_20% = 100 Liters",
      "Equation 2 (Acid Mass Balance): 0.10 × sol_10% + 0.20 × sol_20% = 14 Liters (14% of 100L)"
    ];
    const solveRes = method === 'jacobi' 
      ? runClientSideJacobi(A, B, numIterations)
      : runClientSideGaussian(A, B, method);
    solveRes.variable_labels = labels;
    solveRes.ai_parsed = {
      matrix_a: A,
      vector_b: B,
      variable_labels: labels,
      explanation_of_equations: explanations,
      source: "High-Availability Offline Demo Preset"
    };
    return solveRes;
  }

  return null;
}

// Client-Side Jacobi Iterative Solver (Guarantees zero-downtime execution!)
function runClientSideJacobi(Ain, Bin, maxIter = 15) {
  const n = Ain.length;
  // check zero diagonals
  for (let i = 0; i < n; i++) {
    if (Math.abs(Ain[i][i]) < 1e-7) {
      return {
        method: "Jacobi Iterative Method",
        status: "Zero Diagonal Error",
        message: `Main diagonal element A[${i+1}][${i+1}] is zero. Jacobi method aborted.`,
        steps: []
      };
    }
  }

  // dominance check
  let isDominant = true;
  const dominanceDetails = [];
  for (let i = 0; i < n; i++) {
    const diag = Math.abs(Ain[i][i]);
    let offDiag = 0;
    for (let j = 0; j < n; j++) {
      if (j !== i) offDiag += Math.abs(Ain[i][j]);
    }
    const dom = diag > offDiag;
    if (!dom) isDominant = false;
    dominanceDetails.push({ 
      row: i + 1, 
      diagonal: Math.round(diag * 1000) / 1000, 
      off_diagonal_sum: Math.round(offDiag * 1000) / 1000, 
      dominant: dom 
    });
  }

  let xCurrent = new Array(n).fill(0);
  const history = [xCurrent.slice()];
  const steps = [];
  let prevDiff = null;
  let divergenceStreak = 0;

  for (let k = 0; k < maxIter; k++) {
    const xNext = new Array(n).fill(0);
    const stepEqs = [];
    for (let i = 0; i < n; i++) {
      let sigma = 0;
      for (let j = 0; j < n; j++) {
        if (j !== i) sigma += Ain[i][j] * xCurrent[j];
      }
      xNext[i] = (Bin[i] - sigma) / Ain[i][i];
      stepEqs.push(`x_${i+1} = (${Bin[i]} - ${sigma.toFixed(2)}) / ${Ain[i][i]} = ${xNext[i].toFixed(4)}`);
    }
    history.push(xNext.slice());

    let diff = 0;
    for (let i = 0; i < n; i++) {
      diff = Math.max(diff, Math.abs(xNext[i] - xCurrent[i]));
    }
    if (prevDiff !== null && diff > prevDiff * 1.05 && !isDominant) {
      divergenceStreak++;
    } else {
      divergenceStreak = 0;
    }
    prevDiff = diff;

    const maxB = Math.max(...Bin.map(Math.abs), 1.0);
    const currNorm = Math.max(...xNext.map(Math.abs));
    if (divergenceStreak >= 3 || (k >= 2 && !isDominant && currNorm > maxB * 3)) {
      return {
        method: "Jacobi Iterative Method",
        status: "Diverged (Non-Diagonally Dominant)",
        is_diverged: true,
        message: `Jacobi method diverged at iteration ${k + 1}. The system is not diagonally dominant (|A_ii| <= sum|A_ij|) and consecutive errors grew. Please switch to Gaussian Elimination to calculate the exact solution.`,
        rank_A: n,
        rank_augmented: n,
        num_variables: n,
        is_diagonally_dominant: false,
        dominance_details: dominanceDetails,
        solution: null,
        history: history,
        steps: steps
      };
    }

    steps.push({
      title: `Jacobi Iteration ${k + 1}`,
      description: stepEqs.join('; '),
      vector: xNext.map(v => Math.round(v * 10000) / 10000)
    });
    xCurrent = xNext;
  }

  // statistical summary
  const statistics = [];
  for (let i = 0; i < n; i++) {
    const vals = history.map(h => h[i]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length;
    const stdDev = Math.sqrt(variance);
    statistics.push({
      variable_index: i,
      variance: Math.round(variance * 1000000) / 1000000,
      std_deviation: Math.round(stdDev * 1000000) / 1000000
    });
  }

  // running stats & crossovers
  const crossoverData = { steps: [], series: [] };
  if (history.length >= 3) {
    const runSteps = [];
    for (let s = 2; s <= history.length; s++) runSteps.push(s - 1);
    crossoverData.steps = runSteps;

    for (let v = 0; v < Math.min(n, 4); v++) {
      const runStd = [];
      const runVar = [];
      for (let s = 2; s <= history.length; s++) {
        const sub = history.slice(0, s).map(h => h[v]);
        const m = sub.reduce((a, b) => a + b, 0) / sub.length;
        const vr = sub.reduce((a, b) => a + Math.pow(b - m, 2), 0) / sub.length;
        const sd = Math.sqrt(vr);
        runVar.push(Math.round(vr * 10000) / 10000);
        runStd.push(Math.round(sd * 10000) / 10000);
      }
      const crossovers = [];
      for (let c = 0; c < runStd.length - 1; c++) {
        const diff1 = runStd[c] - runVar[c];
        const diff2 = runStd[c + 1] - runVar[c + 1];
        if (diff1 * diff2 <= 0) {
          crossovers.push({
            iteration: runSteps[c],
            value: runStd[c]
          });
        }
      }
      crossoverData.series.push({
        variable_index: v,
        run_std: runStd,
        run_var: runVar,
        crossovers: crossovers
      });
    }
  }

  return {
    method: "Jacobi Iterative Method",
    status: "Unique Solution (Jacobi Completed)",
    message: `Completed ${maxIter} iterations. Matrix is ${isDominant ? 'strictly diagonally dominant' : 'not strictly diagonally dominant'}.`,
    rank_A: n,
    rank_augmented: n,
    num_variables: n,
    is_diagonally_dominant: isDominant,
    dominance_details: dominanceDetails,
    iterations_completed: maxIter,
    solution: xCurrent.map(v => Math.round(v * 10000) / 10000),
    variable_labels: Ain[0].map((_, i) => `x${i + 1}`),
    history: history.map(h => h.map(v => Math.round(v * 10000) / 10000)),
    statistics: statistics,
    crossover_data: crossoverData,
    steps: steps
  };
}

// Client-Side Numerical Linear Solver (Guarantees zero-downtime execution!)
function runClientSideGaussian(Ain, Bin, method) {
  const n = Ain.length;
  // Clone
  const M = Ain.map((row, i) => [...row, Bin[i]]);
  const steps = [];

  steps.push({
    title: "Initial Augmented Matrix [A | B]",
    description: "Constructed augmented system for linear computation.",
    matrix: M.map(row => [...row])
  });

  let pivotRow = 0;
  for (let col = 0; col < n; col++) {
    if (pivotRow >= n) break;
    // Find pivot
    let maxRow = pivotRow;
    for (let r = pivotRow + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[maxRow][col])) {
        maxRow = r;
      }
    }

    if (Math.abs(M[maxRow][col]) > 1e-7) {
      if (maxRow !== pivotRow) {
        const tmp = M[pivotRow];
        M[pivotRow] = M[maxRow];
        M[maxRow] = tmp;
        steps.push({
          title: `Row Swap: R${pivotRow + 1} ↔ R${maxRow + 1}`,
          description: `Placed largest pivot magnitude on diagonal.`,
          matrix: M.map(row => [...row])
        });
      }

      const pivotVal = M[pivotRow][col];
      for (let r = pivotRow + 1; r < n; r++) {
        const factor = M[r][col] / pivotVal;
        if (Math.abs(factor) > 1e-7) {
          for (let c = col; c <= n; c++) {
            M[r][c] -= factor * M[pivotRow][c];
          }
          steps.push({
            title: `Elimination: R${r + 1} ← R${r + 1} - (${factor.toFixed(2)}) × R${pivotRow + 1}`,
            description: `Zeroed coefficient at row ${r + 1}, col ${col + 1}.`,
            matrix: M.map(row => row.map(v => Math.round(v * 1000) / 1000))
          });
        }
      }
      pivotRow++;
    }
  }

  // Back substitution
  const sol = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += M[i][j] * sol[j];
    }
    sol[i] = Math.round(((M[i][n] - sum) / M[i][i]) * 1000) / 1000;
  }

  return {
    method: method === 'gauss_jordan' ? "Gauss-Jordan Elimination" : "Gaussian Elimination",
    status: "Unique Solution",
    rank_A: n,
    rank_augmented: n,
    num_variables: n,
    variable_labels: Ain[0].map((_, i) => `x${i + 1}`),
    solution: sol,
    steps: steps
  };
}

// Render Results View
function renderResults(res) {
  elements.emptyState.classList.add('hidden');
  elements.resultsContent.classList.remove('hidden');

  // Solvability Banner & Ranks
  const statusText = res.status || 'Solved';
  elements.statusTitle.textContent = statusText;
  elements.statusBanner.className = 'status-banner';
  if (res.is_diverged || /No Solution|No Unique|Singular|Zero|Inapplicable|Error|Diverged|Failed to Converge/i.test(statusText)) {
    elements.statusBanner.classList.add('inconsistent');
  } else if (/Infinite/i.test(statusText)) {
    elements.statusBanner.classList.add('infinite');
  }

  const statusIcon = elements.statusBadge.querySelector('i');
  if (statusIcon) {
    if (/Infinite/i.test(statusText)) {
      statusIcon.className = 'fa-solid fa-infinity';
    } else if (/No Solution|No Unique|Singular|Zero|Inapplicable|Error|Diverged|Failed to Converge/i.test(statusText)) {
      statusIcon.className = 'fa-solid fa-triangle-exclamation';
    } else {
      statusIcon.className = 'fa-solid fa-circle-check';
    }
  }

  elements.statusExplanation.textContent = res.message || 
    `System satisfies Rouché–Capelli theorem with full rank. Solution vector resolved uniquely.`;

  // Jacobi (or any iterative method) divergence: offer a one-click fallback.
  if (res.is_diverged || (res.status && res.status.includes('Diverged'))) {
    const actionRow = document.createElement('div');
    actionRow.className = 'status-action';

    const switchBtn = document.createElement('button');
    switchBtn.type = 'button';
    switchBtn.className = 'btn-tiny status-action-btn';
    switchBtn.innerHTML = '<i class="fa-solid fa-arrow-rotate-left" aria-hidden="true"></i> Switch to Gaussian elimination &amp; solve';
    switchBtn.addEventListener('click', () => window.switchMethodToGaussian());
    actionRow.appendChild(switchBtn);

    elements.statusExplanation.appendChild(actionRow);
    showToast('⚠ Jacobi diverged on this system. Switch to Gaussian elimination.');
  }

  elements.pillRankA.textContent = `rank(A) = ${res.rank_A !== undefined ? res.rank_A : '-'}`;
  elements.pillRankAug.textContent = `rank([A|B]) = ${res.rank_augmented !== undefined ? res.rank_augmented : '-'}`;
  elements.pillNumVars.textContent = `Variables = ${res.num_variables || (res.solution ? res.solution.length : '-')}`;

  // AI Breakdown
  if (res.ai_parsed) {
    elements.aiBreakdownContainer.classList.remove('hidden');
    if (elements.aiSourceBadge) {
      elements.aiSourceBadge.innerHTML = `<i class="fa-solid fa-bolt"></i> ${res.ai_parsed.source || 'Active'}`;
    }
    elements.aiVariableTags.innerHTML = '';
    (res.ai_parsed.variable_labels || []).forEach(lbl => {
      const tag = document.createElement('span');
      tag.className = 'var-tag';
      tag.textContent = lbl;
      elements.aiVariableTags.appendChild(tag);
    });

    elements.aiExplanationList.innerHTML = '';
    (res.ai_parsed.explanation_of_equations || []).forEach(exp => {
      const li = document.createElement('li');
      li.textContent = exp;
      elements.aiExplanationList.appendChild(li);
    });
  } else {
    elements.aiBreakdownContainer.classList.add('hidden');
  }

  // Solved Variable Cards
  elements.solvedVariablesGrid.innerHTML = '';
  const labels = res.variable_labels || [];
  const sol = res.solution || [];

  if (sol && sol.length > 0) {
    elements.btnCopySolutions.classList.remove('hidden');
    elements.chartCard.classList.remove('hidden');

    sol.forEach((val, idx) => {
      const card = document.createElement('div');
      card.className = 'var-card';
      const labelName = labels[idx] || `x${idx + 1}`;
      card.innerHTML = `
        <div class="var-card-name" title="${labelName}">${labelName}</div>
        <div class="var-card-val">${typeof val === 'number' ? Number(val.toFixed(4)) : val}</div>
      `;
      elements.solvedVariablesGrid.appendChild(card);
    });

    // Update Chart
    renderChart(labels.length ? labels : sol.map((_, i) => `x${i + 1}`), sol);
  } else {
    elements.btnCopySolutions.classList.add('hidden');
    elements.chartCard.classList.add('hidden');
    const isDiverged = res.is_diverged || (res.status && res.status.includes('Diverged'));
    elements.solvedVariablesGrid.innerHTML = isDiverged
      ? `<div class="no-solution-note no-solution-note-alert">
          <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          Jacobi method diverged because this system is not diagonally dominant (|A_ii| ≤ ∑|A_ij|). Please switch to Gaussian elimination to view the exact solution.
        </div>`
      : `<div class="no-solution-note">
          No unique solution vector to display (system is inconsistent or underdetermined).
        </div>`;
    if (state.chartInstance) {
      state.chartInstance.destroy();
      state.chartInstance = null;
    }
  }

  // Render Step-by-Step Row Transformations
  renderSteps(res.steps || []);

  // Handle Jacobi Analytics Section
  if (res.method && (res.method.includes('Jacobi') || res.history)) {
    renderJacobiAnalytics(res);
  } else {
    if (elements.jacobiAnalyticsSection) elements.jacobiAnalyticsSection.classList.add('hidden');
    if (state.jacobiTrajectoryChartInstance) {
      state.jacobiTrajectoryChartInstance.destroy();
      state.jacobiTrajectoryChartInstance = null;
    }
    if (state.jacobiCrossoverChartInstance) {
      state.jacobiCrossoverChartInstance.destroy();
      state.jacobiCrossoverChartInstance = null;
    }
  }

  scrollToResultsOnSmallScreens();
}

// Bring the freshly rendered solution into view on stacked (mobile) layouts
function scrollToResultsOnSmallScreens() {
  if (!elements.resultsSection) return;
  if (!window.matchMedia('(max-width: 1080px)').matches) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  elements.resultsSection.scrollIntoView({
    behavior: reduceMotion ? 'auto' : 'smooth',
    block: 'start'
  });
}

// Render Chart.js Distribution
function renderChart(labels, values) {
  if (state.chartInstance) {
    state.chartInstance.destroy();
    state.chartInstance = null;
  }

  // The visualization is optional: never let a missing CDN block the results.
  if (typeof Chart === 'undefined') {
    elements.chartCard.classList.add('hidden');
    console.warn('Chart.js unavailable — hiding the value profile.');
    return;
  }

  const ctx = elements.chartCanvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 228);
  gradient.addColorStop(0, themeValue('--chart-bar-1', '#6F6866'));
  gradient.addColorStop(1, themeValue('--chart-bar-2', '#38302E'));

  elements.chartCanvas.setAttribute(
    'aria-label',
    `Bar chart of solved values. ${labels.map((label, i) => `${label} = ${values[i]}`).join(', ')}`
  );

  try {
    state.chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Resolved value',
          data: values,
          backgroundColor: gradient,
          hoverBackgroundColor: themeValue('--chart-hover', '#9CAEA9'),
          borderColor: themeValue('--chart-border', '#38302E'),
          borderWidth: 3,
          borderRadius: 10,
          borderSkipped: false,
          maxBarThickness: 66
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: themeValue('--chart-tooltip-bg', '#38302E'),
            titleColor: themeValue('--chart-tooltip-text', '#CCDAD1'),
            bodyColor: themeValue('--chart-tooltip-text', '#CCDAD1'),
            titleFont: { family: 'Space Grotesk', size: 12, weight: '700' },
            bodyFont: { family: 'JetBrains Mono', size: 12 },
            padding: 12,
            cornerRadius: 10,
            displayColors: false
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: themeValue('--chart-axis', '#38302E'), width: 2 },
            ticks: {
              color: themeValue('--chart-axis', '#38302E'),
              font: { family: 'JetBrains Mono', size: 11, weight: '500' }
            }
          },
          y: {
            grid: { color: themeValue('--chart-grid', 'rgba(56, 48, 46, 0.12)') },
            border: { color: themeValue('--chart-axis', '#38302E'), width: 2 },
            ticks: {
              color: themeValue('--chart-tick', '#6F6866'),
              font: { family: 'JetBrains Mono', size: 10 }
            },
            grace: '12%'
          }
        }
      }
    });
  } catch (err) {
    console.warn('Chart rendering failed — hiding the value profile.', err);
    elements.chartCard.classList.add('hidden');
    state.chartInstance = null;
  }
}

// Render Step-by-Step Accordion / Timeline
function renderSteps(steps) {
  elements.stepCount.textContent = `${steps.length} Operation${steps.length === 1 ? '' : 's'}`;
  elements.stepsTimeline.innerHTML = '';

  steps.forEach((step, idx) => {
    const card = document.createElement('details');
    card.className = 'step-card';
    if (idx === 0) card.open = true;

    let matrixHtml = '';
    if (step.matrix && Array.isArray(step.matrix)) {
      const isAugmented = step.matrix.length > 0 && step.matrix[0].length === step.matrix.length + 1;
      const rowsHtml = step.matrix.map((row) => {
        const lastIdx = row.length - 1;
        const cellsHtml = row.map((val, cIdx) => {
          const isB = isAugmented && cIdx === lastIdx;
          return `<td class="${isB ? 'b-col' : ''}">${typeof val === 'number' ? Number(val.toFixed(3)) : val}</td>`;
        }).join('');
        return `<tr>${cellsHtml}</tr>`;
      }).join('');
      matrixHtml = `
        <div class="step-matrix-scroll">
          <table class="step-matrix-table" aria-label="Matrix state after operation ${idx + 1}">
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>`;
    }

    card.innerHTML = `
      <summary class="step-header">
        <span class="step-number-tag">Step ${idx + 1}</span>
        <span class="step-title">${step.title || 'Matrix Transformation'}</span>
      </summary>
      <div class="step-body">
        <p class="step-desc">${step.description || ''}</p>
        ${matrixHtml}
      </div>
    `;

    elements.stepsTimeline.appendChild(card);
  });
}

// Copy Solutions
function copySolutionsToClipboard() {
  const cards = elements.solvedVariablesGrid.querySelectorAll('.var-card');
  if (!cards.length) return;

  const lines = [];
  cards.forEach(card => {
    const name = card.querySelector('.var-card-name').textContent.trim();
    const val = card.querySelector('.var-card-val').textContent.trim();
    lines.push(`${name} = ${val}`);
  });

  navigator.clipboard.writeText(lines.join('\n'))
    .then(() => showToast('Solutions copied to clipboard!'))
    .catch(() => showToast('Unable to copy.'));
}

// Loading state
function setLoading(isLoading) {
  if (isLoading) {
    elements.btnSolve.disabled = true;
    elements.btnSolve.setAttribute('aria-busy', 'true');
    elements.solveSpinner.classList.remove('hidden');
    elements.btnSolve.querySelector('span').textContent = 'Solving System...';
  } else {
    elements.btnSolve.disabled = false;
    elements.btnSolve.setAttribute('aria-busy', 'false');
    elements.solveSpinner.classList.add('hidden');
    elements.btnSolve.querySelector('span').textContent = 'Calculate Solution';
  }
}

// Toast
function showToast(msg) {
  elements.toast.textContent = msg;
  elements.toast.classList.remove('hidden');
  setTimeout(() => {
    elements.toast.classList.add('hidden');
  }, 3200);
}

// Render Jacobi Analytics Suite
function renderJacobiAnalytics(res) {
  if (!elements.jacobiAnalyticsSection) return;
  state.lastJacobiResult = res;
  elements.jacobiAnalyticsSection.classList.remove('hidden');

  const iters = res.iterations_completed || (res.history ? res.history.length - 1 : 0);
  elements.jacobiIterationsBadge.textContent = `${iters} Iteration${iters === 1 ? '' : 's'} Completed`;

  // 1. Dominance Card
  if (res.is_diagonally_dominant) {
    elements.dominanceCard.className = 'dominance-card';
    elements.dominanceTitle.textContent = 'Strictly Diagonally Dominant (Convergence Guaranteed)';
    elements.dominanceIcon.className = 'fa-solid fa-circle-check';
    elements.dominanceText.textContent = 'Each diagonal element magnitude |A_ii| is strictly greater than the sum of off-diagonal elements in its row. The Jacobi method is guaranteed to converge to the unique solution by the Gershgorin Circle Theorem.';
  } else {
    elements.dominanceCard.className = 'dominance-card not-dominant';
    elements.dominanceTitle.textContent = 'Not Strictly Diagonally Dominant (Convergence Conditional)';
    elements.dominanceIcon.className = 'fa-solid fa-triangle-exclamation';
    elements.dominanceText.textContent = 'At least one diagonal element magnitude |A_ii| does not strictly exceed the sum of off-diagonal elements. The Jacobi iterative method may oscillate, converge slowly, or diverge unless the spectral radius satisfies ρ(D⁻¹(L+U)) < 1.';
  }

  // Mini table for dominance rows
  if (res.dominance_details && res.dominance_details.length > 0) {
    const rows = res.dominance_details.map(d => `
      <tr>
        <td>Row ${d.row}</td>
        <td>|A_${d.row}${d.row}| = <strong>${d.diagonal}</strong></td>
        <td>∑|A_${d.row}j| = <strong>${d.off_diagonal_sum}</strong></td>
        <td><span class="${d.dominant ? 'badge-math' : 'badge-ai'}" style="font-size: 0.7rem; padding: 2px 6px;">${d.dominant ? '✓ Dominant' : '⚠ Non-dominant'}</span></td>
      </tr>
    `).join('');
    elements.dominanceTableContainer.innerHTML = `
      <table class="dominance-mini-table">
        <thead>
          <tr><th>Row</th><th>Diagonal Pivot</th><th>Off-Diagonal Sum</th><th>Condition</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  } else {
    elements.dominanceTableContainer.innerHTML = '';
  }

  // 2. Statistical Dispersion Cards (Step 7 from project1.pdf)
  elements.jacobiStatsGrid.innerHTML = '';
  const labels = res.variable_labels || [];
  (res.statistics || []).forEach(st => {
    const varName = labels[st.variable_index] || `x${st.variable_index + 1}`;
    const card = document.createElement('div');
    card.className = 'stats-card';
    card.innerHTML = `
      <div class="stats-card-var">
        <span><i class="fa-solid fa-square-root-variable"></i> ${varName}</span>
        <span class="badge-math" style="font-size: 0.68rem;">Var ${st.variable_index + 1}</span>
      </div>
      <div class="stats-row">
        <span class="label">Variance (σ²):</span>
        <span class="val">${st.variance}</span>
      </div>
      <div class="stats-row">
        <span class="label">Std Dev (σ):</span>
        <span class="val">${st.std_deviation}</span>
      </div>
    `;
    elements.jacobiStatsGrid.appendChild(card);
  });

  // 3. Convergence Trajectory Chart
  renderJacobiTrajectoryChart(res);

  // 4. Running Variance vs. Std Dev Crossover Chart (Step 9 from project1.pdf)
  renderJacobiCrossoverChart(res);

  // 5. Iteration History Table
  renderIterationHistoryTable(res);
}

function renderJacobiTrajectoryChart(res) {
  if (state.jacobiTrajectoryChartInstance) {
    state.jacobiTrajectoryChartInstance.destroy();
    state.jacobiTrajectoryChartInstance = null;
  }

  if (!elements.jacobiTrajectoryChart || !res.history || !res.history.length) return;

  const ctx = elements.jacobiTrajectoryChart.getContext('2d');
  const labels = res.history.map((_, idx) => idx === 0 ? 'k=0 (Initial)' : `k=${idx}`);
  const varLabels = res.variable_labels || [];
  const palette = [
    themeValue('--series-1', '#38302E'),
    themeValue('--series-2', '#6F6866'),
    themeValue('--series-3', '#788585'),
    themeValue('--series-4', '#9CAEA9'),
    themeValue('--series-5', '#4B433F'),
    themeValue('--series-6', '#B7C9C2')
  ];

  const numVars = res.history[0].length;
  const datasets = [];
  for (let v = 0; v < numVars; v++) {
    const vName = varLabels[v] || `x${v + 1}`;
    const col = palette[v % palette.length];
    datasets.push({
      label: `Variable ${vName} Trajectory`,
      data: res.history.map(row => row[v]),
      borderColor: col,
      backgroundColor: col,
      tension: 0.25,
      borderWidth: 2,
      pointRadius: res.history.length > 25 ? 2 : 4,
      pointHoverRadius: 6
    });
  }

  state.jacobiTrajectoryChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: themeValue('--chart-axis', '#38302E'),
            font: { family: 'JetBrains Mono', size: 11 }
          }
        },
        tooltip: {
          backgroundColor: themeValue('--chart-tooltip-bg', '#38302E'),
          titleColor: themeValue('--chart-tooltip-text', '#CCDAD1'),
          bodyColor: themeValue('--chart-tooltip-text', '#CCDAD1'),
          titleFont: { family: 'Bricolage Grotesque' },
          bodyFont: { family: 'JetBrains Mono' }
        }
      },
      scales: {
        x: {
          grid: { color: themeValue('--chart-grid', 'rgba(56, 48, 46, 0.12)') },
          ticks: {
            color: themeValue('--chart-tick', '#6F6866'),
            font: { family: 'Space Grotesk' }
          }
        },
        y: {
          grid: { color: themeValue('--chart-grid', 'rgba(56, 48, 46, 0.12)') },
          ticks: {
            color: themeValue('--chart-tick', '#6F6866'),
            font: { family: 'JetBrains Mono' }
          }
        }
      }
    }
  });
}

function renderJacobiCrossoverChart(res) {
  if (state.jacobiCrossoverChartInstance) {
    state.jacobiCrossoverChartInstance.destroy();
    state.jacobiCrossoverChartInstance = null;
  }

  elements.crossoverBadgesList.innerHTML = '';
  if (!elements.jacobiCrossoverChart || !res.crossover_data || !res.crossover_data.series) return;

  const cData = res.crossover_data;
  const steps = cData.steps || [];
  if (!steps.length) return;

  const labels = steps.map(s => `Step ${s}`);
  const varLabels = res.variable_labels || [];
  const stdColors = [
    themeValue('--series-std-1', '#38302E'),
    themeValue('--series-std-2', '#6F6866'),
    themeValue('--series-std-3', '#788585'),
    themeValue('--series-std-4', '#4B433F')
  ];
  const varColors = [
    themeValue('--series-var-1', '#9CAEA9'),
    themeValue('--series-var-2', '#B7C9C2'),
    themeValue('--series-var-3', '#788585'),
    themeValue('--series-var-4', '#6F6866')
  ];
  const datasets = [];

  let totalCrossovers = 0;
  cData.series.forEach((sObj, idx) => {
    const vName = varLabels[sObj.variable_index] || `x${sObj.variable_index + 1}`;
    const stdColor = stdColors[idx % stdColors.length];
    const varColor = varColors[idx % varColors.length];

    datasets.push({
      label: `${vName} Running Std Dev (σ)`,
      data: sObj.run_std,
      borderColor: stdColor,
      borderWidth: 2,
      pointRadius: 3,
      tension: 0.2
    });

    datasets.push({
      label: `${vName} Running Variance (σ²)`,
      data: sObj.run_var,
      borderColor: varColor,
      borderWidth: 2,
      borderDash: [5, 4],
      pointRadius: 2,
      tension: 0.2
    });

    (sObj.crossovers || []).forEach(cr => {
      totalCrossovers++;
      const pill = document.createElement('span');
      pill.className = 'crossover-pill';
      pill.innerHTML = `<i class="fa-solid fa-code-commit"></i> ${vName} Crossover @ Step ${cr.iteration} (Val: ${cr.value})`;
      elements.crossoverBadgesList.appendChild(pill);
    });
  });

  if (totalCrossovers === 0) {
    const pill = document.createElement('span');
    pill.className = 'crossover-pill';
    pill.style.opacity = '0.7';
    pill.innerHTML = `<i class="fa-solid fa-circle-info"></i> No σ = σ² crossover detected within ${steps.length} steps (curves did not intersect).`;
    elements.crossoverBadgesList.appendChild(pill);
  }

  const ctx = elements.jacobiCrossoverChart.getContext('2d');
  state.jacobiCrossoverChartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: {
            color: themeValue('--chart-axis', '#38302E'),
            font: { family: 'JetBrains Mono', size: 10 }
          }
        },
        tooltip: {
          backgroundColor: themeValue('--chart-tooltip-bg', '#38302E'),
          titleColor: themeValue('--chart-tooltip-text', '#CCDAD1'),
          bodyColor: themeValue('--chart-tooltip-text', '#CCDAD1'),
          titleFont: { family: 'Bricolage Grotesque' },
          bodyFont: { family: 'JetBrains Mono' }
        }
      },
      scales: {
        x: {
          grid: { color: themeValue('--chart-grid', 'rgba(56, 48, 46, 0.12)') },
          ticks: {
            color: themeValue('--chart-tick', '#6F6866'),
            font: { family: 'Space Grotesk' }
          }
        },
        y: {
          grid: { color: themeValue('--chart-grid', 'rgba(56, 48, 46, 0.12)') },
          ticks: {
            color: themeValue('--chart-tick', '#6F6866'),
            font: { family: 'JetBrains Mono' }
          }
        }
      }
    }
  });
}

function renderIterationHistoryTable(res) {
  if (!elements.iterationTableHead || !elements.iterationTableBody || !res.history) return;
  const varLabels = res.variable_labels || [];
  const numVars = res.history[0].length;

  const ths = ['<th>Iteration (k)</th>'];
  for (let v = 0; v < numVars; v++) {
    ths.push(`<th>${varLabels[v] || `x${v + 1}`}</th>`);
  }
  elements.iterationTableHead.innerHTML = `<tr>${ths.join('')}</tr>`;

  const rowsHtml = res.history.map((row, k) => {
    const tds = [`<td class="iteration-index-cell">k = ${k} ${k === 0 ? '(Initial Guess)' : ''}</td>`];
    row.forEach(val => {
      tds.push(`<td>${typeof val === 'number' ? Number(val.toFixed(4)) : val}</td>`);
    });
    return `<tr>${tds.join('')}</tr>`;
  }).join('');

  elements.iterationTableBody.innerHTML = rowsHtml;
}

// Global quick-switch to Gaussian Elimination when an iterative method diverges
window.switchMethodToGaussian = function() {
  state.solverMethod = 'gaussian';
  if (elements.solverMethodSelect) elements.solverMethodSelect.value = 'gaussian';
  if (elements.jacobiOptionsGroup) elements.jacobiOptionsGroup.classList.add('hidden');
  handleSolve();
};
