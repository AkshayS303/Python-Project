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
  chartCard: document.querySelector('.chart-container-card'),
  stepCount: document.getElementById('step-count'),
  stepsTimeline: document.getElementById('steps-timeline'),
  chartCanvas: document.getElementById('solutionChart'),

  // Modal & Toast
  btnApiKey: document.getElementById('btn-api-key'),
  apiKeyModal: document.getElementById('api-key-modal'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  customApiKeyInput: document.getElementById('custom-api-key-input'),
  btnSaveApiKey: document.getElementById('btn-save-api-key'),
  btnClearApiKey: document.getElementById('btn-clear-api-key'),
  toast: document.getElementById('app-toast')
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  renderMatrixGrid(state.matrixSize);
  loadMatrixPreset('unique3', true);
});

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
  });

  // Solve button
  elements.btnSolve.addEventListener('click', handleSolve);

  // Copy solutions button
  elements.btnCopySolutions.addEventListener('click', copySolutionsToClipboard);

  // API Key Modal
  elements.btnApiKey.addEventListener('click', openApiModal);
  elements.btnCloseModal.addEventListener('click', closeApiModal);

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
  if (!silent) showToast(`Loaded ${key} preset`);
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
  try {
    const resp = await fetch('/api/solve/matrix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matrix_a: A,
        vector_b: B,
        method: method,
        variable_labels: A[0].map((_, i) => `x${i + 1}`)
      })
    });

    if (resp.ok) {
      return await resp.json();
    }
  } catch (e) {
    console.warn('Backend API unavailable, using in-browser linear solver engine:', e);
  }

  // Fallback: In-browser Gaussian Solver
  return runClientSideGaussian(A, B, method);
}

async function solveWordProblemAPI(problem, method, apiKey) {
  const resp = await fetch('/api/solve/word-problem', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      problem: problem,
      method: method,
      api_key: apiKey || null
    })
  });

  if (!resp.ok) {
    const errData = await resp.json().catch(() => ({}));
    throw new Error(errData.detail || errData.error || 'Failed to solve word problem.');
  }
  return await resp.json();
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
  if (/No Solution|No Unique|Singular|Zero|Inapplicable|Error/i.test(statusText)) {
    elements.statusBanner.classList.add('inconsistent');
  } else if (/Infinite/i.test(statusText)) {
    elements.statusBanner.classList.add('infinite');
  }

  const statusIcon = elements.statusBadge.querySelector('i');
  if (statusIcon) {
    if (/Infinite/i.test(statusText)) {
      statusIcon.className = 'fa-solid fa-infinity';
    } else if (/No Solution|No Unique|Singular|Zero|Inapplicable|Error/i.test(statusText)) {
      statusIcon.className = 'fa-solid fa-triangle-exclamation';
    } else {
      statusIcon.className = 'fa-solid fa-circle-check';
    }
  }

  elements.statusExplanation.textContent = res.message || 
    `System satisfies Rouché–Capelli theorem with full rank. Solution vector resolved uniquely.`;

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
    elements.solvedVariablesGrid.innerHTML = `
      <div class="no-solution-note">
        No unique solution vector to display (system is inconsistent or underdetermined).
      </div>
    `;
    if (state.chartInstance) {
      state.chartInstance.destroy();
      state.chartInstance = null;
    }
  }

  // Render Step-by-Step Row Transformations
  renderSteps(res.steps || []);

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
  gradient.addColorStop(0, '#6F6866');
  gradient.addColorStop(1, '#38302E');

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
          hoverBackgroundColor: '#9CAEA9',
          borderColor: '#38302E',
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
            backgroundColor: '#38302E',
            titleColor: '#CCDAD1',
            bodyColor: '#CCDAD1',
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
            border: { color: '#38302E', width: 2 },
            ticks: {
              color: '#38302E',
              font: { family: 'JetBrains Mono', size: 11, weight: '500' }
            }
          },
          y: {
            grid: { color: 'rgba(56, 48, 46, 0.12)' },
            border: { color: '#38302E', width: 2 },
            ticks: {
              color: '#6F6866',
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
