# MatSolve — Universal Linear Equation & Word Problem Solver

MatSolve turns plain-English word problems and raw augmented matrices into solved
linear systems, showing every row operation along the way. The maths is deterministic
(Python + NumPy); Gemini is only used to translate words into equations.

- **Two input modes** — describe a problem in natural language, or type coefficients
  straight into the augmented matrix `[A | B]` (2×2 up to 5×5).
- **Five solvers** — Gaussian elimination, Gauss-Jordan, Cramer's rule, matrix
  inversion, and Jacobi iteration with convergence analytics.
- **Never blocked** — cached/offline parsing, preset matching, and a complete
  in-browser solver keep the demo alive even without a network or a Gemini key.
- **No build step** — plain HTML/CSS/JS served by FastAPI; one command to run.

---

## Contents

- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Using the app](#using-the-app)
- [Presets](#presets)
- [Solver methods](#solver-methods)
- [API reference](#api-reference)
- [Project structure](#project-structure)
- [Resilience model](#resilience-model)
- [Accessibility & design](#accessibility--design)
- [Troubleshooting](#troubleshooting)
- [Further documentation](#further-documentation)

---

## Quick start

### Requirements

| Requirement | Notes |
| --- | --- |
| Python 3.10+ | 3.12 is what `run.bat` looks for first |
| pip | Installs the packages in `requirements.txt` |
| A modern browser | Chrome, Edge, Firefox or Safari |

Optional: a Gemini API key for live word-problem parsing (see
[Configuration](#configuration)). Direct-matrix solving, the offline parser and the
classroom presets all work without one.

### Windows — one click

```bat
run.bat
```

`run.bat` installs the dependencies quietly, then starts the server.

### Any platform — manual

```bash
python -m pip install -r requirements.txt
python server.py
```

Then open **<http://localhost:8000>**.

The server runs with `reload=True`, so edits to Python, JS, CSS or HTML are picked
up on refresh (Python changes restart the worker automatically).

### Packages

```
fastapi>=0.110.0      uvicorn>=0.28.0       numpy>=1.26.0
pydantic>=2.6.0       google-genai>=0.1.0   python-dotenv>=1.0.0
```

---

## Configuration

Both settings are optional and read from the environment (or a `.env` file in the
project root, loaded automatically by `python-dotenv`).

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | *(empty)* | Server-side key used to parse free-form word problems |
| `PORT` | `8000` | Port the FastAPI server binds to |

Create `.env` next to `server.py`:

```ini
GEMINI_API_KEY=your-key-here
PORT=8000
```

`.env` and `.env.*` are git-ignored (`.env.example` is the allowed template), so a
real key is never committed. The key must never be hardcoded — `ai_parser.py` reads
it from the environment only.

You can also paste a key at runtime through the **key button in the header**
(the modal saves it to `localStorage` and sends it with each request as
`api_key`), which overrides the server default for that browser.

---

## Using the app

### Word problem mode

1. Paste a problem, or click a sample chip (farm animals, investment return,
   bakery production, chemistry mixture).
2. Pick a solution method.
3. **Calculate solution.**

Gemini extracts the variables, coefficient matrix and constants, then the chosen
solver runs and the results view shows the status, ranks, resolved values, a value
profile chart, the AI formulation breakdown, and every row operation.

### Direct matrix mode

1. Choose a system size (2×2 – 5×5), or load a preset such as *Jacobi dominant*.
2. Type coefficients into the bracketed grid — the live equation preview updates
   as you type.
3. Pick a method and solve.

### What the results view shows

| Section | Contents |
| --- | --- |
| Status ticket | Unique / infinite / inconsistent / divergent, plus `rank(A)`, `rank([A\|B])` and variable count |
| Resolved values | One card per variable, with a copy button |
| Value profile | Chart.js bar chart (hidden automatically when there is no unique solution) |
| Jacobi analytics | Diagonal-dominance verdict and pivot table, σ²/σ dispersion cards, trajectory chart, σ vs σ² crossover chart, iteration history table |
| Steps | Expandable accordion of every row operation with matrix snapshots |

Inconsistent systems get the deep-mocha ticket and no value cards; diverging Jacobi
runs explain the `|A_ii| ≤ ∑|A_ij|` condition and offer a one-click switch back to
Gaussian elimination.

---

## Presets

**Word problems** — matched by keyword (also used as an offline fallback):

| Preset | System extracted |
| --- | --- |
| Farm animals | chickens + cows = 35, 2·chickens + 4·cows = 94 |
| Investment return | bond + fund = 10000, 0.04·bond + 0.07·fund = 580 |
| Bakery production | 200·croissants + 150·buns = 5500, 50·croissants + 30·buns = 1350 |
| Chemistry mixture | s10 + s20 = 100, 0.10·s10 + 0.20·s20 = 14 |

**Matrices** — loaded into the direct grid:

| Preset | Matrix `A` | `B` | Behaviour |
| --- | --- | --- | --- |
| Unique 3×3 | `[[2,1,-1],[-3,-1,2],[-2,1,2]]` | `[8,-11,-3]` | One solution `[2, 3, -1]` |
| Jacobi dominant | `[[10,-1,2],[-1,11,-1],[2,-1,10]]` | `[6,25,-11]` | Auto-selects Jacobi; guaranteed convergence |
| No solution | `[[1,2,-1],[2,4,-2],[3,1,1]]` | `[5,12,4]` | Inconsistent |
| Infinite | `[[1,2,3],[2,4,6],[1,1,1]]` | `[6,12,3]` | Underdetermined |
| Identity | `[[1,0,0],[0,1,0],[0,0,1]]` | `[4,-2,9]` | Trivial diagonal system |

---

## Solver methods

`method` is one of `gaussian`, `gauss_jordan`, `cramer`, `inversion`, `jacobi`.

| Method | Idea | Requirement |
| --- | --- | --- |
| `gaussian` | Forward elimination with partial pivoting, then back-substitution (REF) | Any square system |
| `gauss_jordan` | Normalise pivots and eliminate both directions (RREF) | Any square system |
| `cramer` | `xᵢ = det(Aᵢ) / det(A)` with sub-determinant breakdown | Square, `det(A) ≠ 0` |
| `inversion` | `X = A⁻¹B` via adjugate/inverse | Square, `det(A) ≠ 0` |
| `jacobi` | Fixed-point iteration with diagonal-dominance checks | Non-zero diagonal; convergence best when strictly diagonally dominant |

Every direct solver returns `steps` (title, description, matrix snapshot), rank
analysis and the final solution. Jacobi additionally returns `history`,
`statistics`, `dominance_details`, `crossover_data`, `trajectory_3d`,
`is_diagonally_dominant`, `is_diverged` and `iterations_completed`.

Jacobi iteration:

```
x_i^(k+1) = (b_i − Σ_{j≠i} A_ij · x_j^(k)) / A_ii        x^(0) = 0
```

Convergence is guaranteed when the matrix is strictly diagonally dominant
(`|A_ii| > Σ_{j≠i} |A_ij|`, Gershgorin). Non-dominant systems are detected and
flag divergence instead of silently returning garbage.

---

## API reference

The FastAPI app exposes four routes; the frontend is the only client.

### `POST /api/solve/matrix`

```json
{
  "matrix_a": [[2, 1, -1], [-3, -1, 2], [-2, 1, 2]],
  "vector_b": [8, -11, -3],
  "method": "gaussian",
  "num_iterations": 15,
  "variable_labels": ["x1", "x2", "x3"]
}
```

| Field | Type | Required | Default |
| --- | --- | --- | --- |
| `matrix_a` | `number[][]` | yes | — |
| `vector_b` | `number[]` | yes | — |
| `method` | `string` | no | `gaussian` |
| `num_iterations` | `int` | no | `15` |
| `variable_labels` | `string[]` | no | `x1…xn` |

Example response (trimmed):

```json
{
  "method": "Gaussian Elimination (REF + Back Substitution)",
  "status": "Unique Solution",
  "solution": [2.0, 3.0, -1.0],
  "rank_A": 3,
  "rank_augmented": 3,
  "num_variables": 3,
  "variable_labels": ["x1", "x2", "x3"],
  "final_echelon_matrix": [[1, 0, 0, 2], [0, 1, 0, 3], [0, 0, 1, -1]],
  "steps": [{ "type": "...", "title": "...", "description": "...", "matrix": [] }],
  "back_substitution_steps": []
}
```

Statuses you may see: `Unique Solution`, `Unique Solution (Converged)`,
`Infinite Solutions (Underdetermined)`, `No Solution (Inconsistent)`,
`Singular Matrix`, `Diverged / Failed to Converge`.

Errors return `400` with `{"detail": "..."}` for malformed or unsolvable input.

### `POST /api/solve/word-problem`

```json
{ "problem": "A farmer has chickens and cows...", "method": "gaussian", "num_iterations": 15, "api_key": null }
```

Adds an `ai_parsed` block (`matrix_a`, `vector_b`, `variable_labels`,
`explanation_of_equations`, `source`) to the solve response. Returns `422` when the
text cannot be converted into equations and `400` when solving fails afterwards.

### `GET /api/health`

```json
{ "status": "ok", "app": "MatSolve Linear Equation Solver" }
```

### `GET /`

Serves `static/index.html`; assets live under `/static/*`.

Quick check:

```bash
curl -X POST http://localhost:8000/api/solve/matrix \
  -H "Content-Type: application/json" \
  -d '{"matrix_a": [[2,1,-1],[-3,-1,2],[-2,1,2]], "vector_b": [8,-11,-3], "method": "gaussian"}'
```

PowerShell equivalent:

```powershell
Invoke-RestMethod -Method Post -Uri http://localhost:8000/api/solve/matrix `
  -ContentType "application/json" `
  -Body '{"matrix_a": [[2,1,-1],[-3,-1,2],[-2,1,2]], "vector_b": [8,-11,-3], "method": "gaussian"}'
```

---

## Project structure

```
Python-Project/
├── server.py                        FastAPI app: routes, validation, static serving
├── matrix_engine.py                 Deterministic solvers + Jacobi analytics
├── ai_parser.py                     Gemini word-problem parser, cache, offline + preset fallbacks
├── static/
│   ├── index.html                   Single-page UI (paper-and-ink design system)
│   ├── style.css                    Role-token palette, layout, responsive + a11y states
│   └── app.js                       UI controller, Chart.js views, in-browser fallback solvers
├── requirements.txt                 Python dependencies
├── run.bat                          Windows launcher (installs deps, starts server)
├── README.md                        This guide
├── test_sanitizer.py                Manual check of the sanitizer + parser
├── PROJECT_IMPROVEMENTS_SUMMARY.txt Changelog, feature overview, presentation notes
├── Python project code.pdf          Original project brief
└── .env                             Local secrets (git-ignored, not committed)
```

---

## Resilience model

Word-problem parsing (`ai_parser.py`) tries, in order:

1. In-memory cache — instant repeat answers.
2. Deterministic offline regex parser — no network at all.
3. Keyword preset matcher — the four classroom demos.
4. Gemini SDK cascade across six models, with exponential backoff on `503`/`429`.
5. Direct REST HTTP fallback if the SDK is unavailable.

The browser mirrors this: `solveWordProblemAPI` falls back to a local preset solver,
and `solveMatrixAPI` falls back to in-browser Jacobi/Gaussian implementations if the
API is unreachable. If FastAPI is not installed at all, `server.py` degrades to
`http.server` and still serves the static UI (without the `/api` routes). Chart.js
is optional too — if the CDN is blocked, charts hide and the numbers still render.

---

## Accessibility & design

- Paper-and-ink theme: ash-grey canvas, deep-mocha outlines, hard offset shadows,
  role-based colour tokens (`--ink`, `--paper`, `--accent`, `--accent-2`, `--accent-3`).
  Grey olive is decorative only because it fails small-text contrast.
- WCAG-AA contrast measured for every text-on-surface pairing.
- Skip link, visible focus rings, ARIA tabs with arrow-key/Home/End navigation,
  `aria-live` status updates and descriptive labels on matrix inputs.
- Focus-trapped API-key modal (Escape closes, focus returns to the opener).
- Responsive at 1180 / 1080 / 760 / 480 px; the matrix grid scrolls safely on phones.
- `prefers-reduced-motion` and `forced-colors` fallbacks.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Address already in use` | Another server holds port 8000 — stop it, or set `PORT` before starting |
| Word problems fail but matrices solve | No usable Gemini key or quota exhausted; set `GEMINI_API_KEY`, or use a preset/simple numeric problem that hits the offline parser |
| `422` from the word-problem route | The text contained no extractable linear equations — rewrite it as explicit equations/quantities |
| Charts missing | Chart.js CDN blocked; results still work (charts are progressive enhancement) |
| Blank page served without API behaviour | FastAPI dependencies are missing and the fallback static server is active — run `python -m pip install -r requirements.txt` |
| Fonts/icons look plain | Google Fonts / Font Awesome CDNs are unreachable; layout still holds |

---

## Further documentation

- `PROJECT_IMPROVEMENTS_SUMMARY.txt` — chronological changelog, current feature
  overview and presentation talking points (kept up to date with every change).
- `test_sanitizer.py` — prints the sanitised text and parsed matrix for a sample
  problem; useful after touching `ai_parser.py`.

MatSolve runs entirely on your machine: no database, no build step, no telemetry.
The only outbound calls are to Google Fonts / Font Awesome / Chart.js CDNs and,
when a key is configured, the Gemini API.
