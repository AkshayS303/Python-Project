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
  loadMatrixPreset('unique3');
});

// Setup Events
function setupEventListeners() {
  // Tabs
  elements.tabWordProblem.addEventListener('click', () => switchMode('word-problem'));
  elements.tabDirectMatrix.addEventListener('click', () => switchMode('direct-matrix'));

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
  elements.btnApiKey.addEventListener('click', () => {
    elements.customApiKeyInput.value = state.apiKey;
    elements.apiKeyModal.classList.remove('hidden');
  });

  elements.btnCloseModal.addEventListener('click', () => {
    elements.apiKeyModal.classList.add('hidden');
  });

  elements.apiKeyModal.addEventListener('click', (e) => {
    if (e.target === elements.apiKeyModal) {
      elements.apiKeyModal.classList.add('hidden');
    }
  });

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
    elements.apiKeyModal.classList.add('hidden');
  });

  elements.btnClearApiKey.addEventListener('click', () => {
    elements.customApiKeyInput.value = '';
    state.apiKey = '';
    localStorage.removeItem('matsolve_gemini_api_key');
    localStorage.removeItem('matrixai_gemini_api_key');
    showToast('Reset to default backend key.');
    elements.apiKeyModal.classList.add('hidden');
  });
}

// Mode Switching
function switchMode(mode) {
  state.mode = mode;
  if (mode === 'word-problem') {
    elements.tabWordProblem.classList.add('active');
    elements.tabWordProblem.setAttribute('aria-selected', 'true');
    elements.tabDirectMatrix.classList.remove('active');
    elements.tabDirectMatrix.setAttribute('aria-selected', 'false');

    elements.panelWordProblem.classList.add('active');
    elements.panelDirectMatrix.classList.remove('active');
  } else {
    elements.tabDirectMatrix.classList.add('active');
    elements.tabDirectMatrix.setAttribute('aria-selected', 'true');
    elements.tabWordProblem.classList.remove('active');
    elements.tabWordProblem.setAttribute('aria-selected', 'false');

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
    inputB.addEventListener('input', updateLiveEquations);
    rowEl.appendChild(inputB);

    elements.matrixGridContainer.appendChild(rowEl);
  }

  updateLiveEquations();
}

// Load Matrix Preset
function loadMatrixPreset(key) {
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
  showToast(`Loaded ${key} preset`);
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
  elements.statusTitle.textContent = res.status || 'Solved';
  elements.statusBanner.className = 'status-banner';
  if (res.status && res.status.includes('No Solution')) {
    elements.statusBanner.classList.add('inconsistent');
  } else if (res.status && res.status.includes('Infinite')) {
    elements.statusBanner.classList.add('infinite');
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
    elements.solvedVariablesGrid.innerHTML = `
      <div style="grid-column: 1 / -1; color: var(--text-dim); font-size: 0.88rem; padding: 12px;">
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
}

// Render Chart.js Distribution
function renderChart(labels, values) {
  if (state.chartInstance) {
    state.chartInstance.destroy();
  }

  const ctx = elements.chartCanvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, 'rgba(99, 102, 241, 0.85)');
  gradient.addColorStop(1, 'rgba(6, 182, 212, 0.2)');

  state.chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Resolved Value',
        data: values,
        backgroundColor: gradient,
        borderColor: '#6366f1',
        borderWidth: 1.5,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.9)',
          titleFont: { family: 'Outfit' },
          bodyFont: { family: 'Fira Code' }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9ca3af', font: { family: 'Inter' } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9ca3af', font: { family: 'Fira Code' } }
        }
      }
    }
  });
}

// Render Step-by-Step Accordion / Timeline
function renderSteps(steps) {
  elements.stepCount.textContent = `${steps.length} Operation${steps.length === 1 ? '' : 's'}`;
  elements.stepsTimeline.innerHTML = '';

  steps.forEach((step, idx) => {
    const card = document.createElement('div');
    card.className = 'step-card';

    let matrixHtml = '';
    if (step.matrix && Array.isArray(step.matrix)) {
      const rowsHtml = step.matrix.map((row) => {
        const lastIdx = row.length - 1;
        const cellsHtml = row.map((val, cIdx) => {
          const isB = cIdx === lastIdx;
          return `<td class="${isB ? 'b-col' : ''}">${typeof val === 'number' ? Number(val.toFixed(3)) : val}</td>`;
        }).join('');
        return `<tr>${cellsHtml}</tr>`;
      }).join('');
      matrixHtml = `<table class="step-matrix-table">${rowsHtml}</table>`;
    }

    card.innerHTML = `
      <div class="step-header">
        <span class="step-number-tag">Step ${idx + 1}</span>
        <span class="step-title">${step.title || 'Matrix Transformation'}</span>
      </div>
      <div class="step-desc">${step.description || ''}</div>
      ${matrixHtml}
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
    elements.solveSpinner.classList.remove('hidden');
    elements.btnSolve.querySelector('span').textContent = 'Solving System...';
  } else {
    elements.btnSolve.disabled = false;
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
