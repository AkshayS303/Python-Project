# pyrefly: ignore [missing-import]
import numpy as np
from typing import Dict, Any, List, Tuple

def round_val(val: Any, decimals: int = 4) -> float:
    """Rounds float and handles near-zero float artifacts."""
    fval = float(val)
    if abs(fval) < 1e-10:
        return 0.0
    return float(round(fval, decimals))

def format_matrix(M: np.ndarray, decimals: int = 4) -> List[List[float]]:
    """Converts numpy matrix to nested list with clean rounding."""
    return [[round_val(val, decimals) for val in row] for row in M]

def solve_gaussian_elimination(A_in: List[List[float]], B_in: List[float], tol: float = 1e-7) -> Dict[str, Any]:
    """
    Solves Ax = B using Gaussian Elimination with partial pivoting and back-substitution.
    Captures step-by-step row operations.
    """
    A = np.array(A_in, dtype=float)
    B = np.array(B_in, dtype=float)
    
    if A.size == 0 or B.size == 0:
        return {"status": "Error", "message": "Empty matrix provided", "steps": []}
    
    # Augmented matrix M = [A | B]
    M = np.hstack([A, B.reshape(-1, 1)])
    rows, cols = M.shape
    num_vars = cols - 1
    steps = []
    
    steps.append({
        "title": "Initial Augmented Matrix [A | B]",
        "description": "Constructed augmented matrix combining coefficient matrix A and constants B.",
        "matrix": format_matrix(M),
        "type": "initial"
    })
    
    pivot_row = 0
    for col in range(num_vars):
        if pivot_row >= rows:
            break
            
        # Partial pivoting
        max_idx = np.argmax(np.abs(M[pivot_row:, col])) + pivot_row
        if np.abs(M[max_idx, col]) > tol:
            if max_idx != pivot_row:
                M[[pivot_row, max_idx]] = M[[max_idx, pivot_row]]
                steps.append({
                    "title": f"Row Swap: R{pivot_row+1} ↔ R{max_idx+1}",
                    "description": f"Swapped Row {pivot_row+1} with Row {max_idx+1} to place largest pivot magnitude ({round_val(M[pivot_row, col])}) on the diagonal.",
                    "matrix": format_matrix(M),
                    "type": "pivot_swap"
                })
            
            # Forward elimination for rows below pivot
            pivot_val = M[pivot_row, col]
            for r in range(pivot_row + 1, rows):
                if np.abs(M[r, col]) > tol:
                    factor = M[r, col] / pivot_val
                    M[r] -= factor * M[pivot_row]
                    steps.append({
                        "title": f"Elimination: R{r+1} ← R{r+1} - ({round_val(factor)}) × R{pivot_row+1}",
                        "description": f"Eliminated coefficient at row {r+1}, col {col+1}.",
                        "matrix": format_matrix(M),
                        "type": "elimination"
                    })
            pivot_row += 1

    # Clean zero threshold
    M[np.abs(M) < tol] = 0.0

    # Rank checking (Rouché–Capelli Theorem)
    rank_A = 0
    rank_aug = 0
    for r in range(rows):
        if not np.allclose(M[r, :num_vars], 0, atol=tol):
            rank_A += 1
        if not np.allclose(M[r, :], 0, atol=tol):
            rank_aug += 1

    result: Dict[str, Any] = {
        "method": "Gaussian Elimination (REF + Back Substitution)",
        "rank_A": rank_A,
        "rank_augmented": rank_aug,
        "num_variables": num_vars,
        "final_echelon_matrix": format_matrix(M),
        "steps": steps
    }

    if rank_A < rank_aug:
        result["status"] = "No Solution (Inconsistent)"
        result["message"] = f"Inconsistent system: rank(A) = {rank_A} < rank([A|B]) = {rank_aug}. The equations contradict each other."
        result["solution"] = None
        return result
    elif rank_A < num_vars:
        result["status"] = "Infinite Solutions (Underdetermined)"
        result["message"] = f"Underdetermined system: rank(A) = {rank_A} < number of variables = {num_vars}. There are free parameters."
        result["solution"] = None
        return result

    # Back-substitution
    solutions = np.zeros(num_vars)
    back_sub_steps = []
    for i in range(num_vars - 1, -1, -1):
        if np.abs(M[i, i]) < tol:
            result["status"] = "No Unique Solution"
            result["solution"] = None
            return result
        
        sum_known = np.dot(M[i, i + 1:num_vars], solutions[i + 1:num_vars])
        solutions[i] = (M[i, -1] - sum_known) / M[i, i]
        back_sub_steps.append({
            "variable_index": i,
            "expression": f"x_{i+1} = ({round_val(M[i, -1])} - {round_val(sum_known)}) / {round_val(M[i, i])} = {round_val(solutions[i])}"
        })

    result["status"] = "Unique Solution"
    result["solution"] = [round_val(s) for s in solutions]
    result["back_substitution_steps"] = back_sub_steps
    return result

def solve_gauss_jordan(A_in: List[List[float]], B_in: List[float], tol: float = 1e-7) -> Dict[str, Any]:
    """
    Solves Ax = B using Gauss-Jordan Elimination (Reduced Row Echelon Form - RREF).
    """
    A = np.array(A_in, dtype=float)
    B = np.array(B_in, dtype=float)
    
    M = np.hstack([A, B.reshape(-1, 1)])
    rows, cols = M.shape
    num_vars = cols - 1
    steps = []
    
    steps.append({
        "title": "Initial Augmented Matrix [A | B]",
        "description": "Starting augmented matrix before Gauss-Jordan reduction.",
        "matrix": format_matrix(M),
        "type": "initial"
    })
    
    lead = 0
    for r in range(rows):
        if lead >= num_vars:
            break
        i = r
        while np.abs(M[i, lead]) < tol:
            i += 1
            if i == rows:
                i = r
                lead += 1
                if lead == num_vars:
                    break
        if lead == num_vars:
            break
            
        if i != r:
            M[[i, r]] = M[[r, i]]
            steps.append({
                "title": f"Row Swap: R{r+1} ↔ R{i+1}",
                "description": f"Moved non-zero pivot into row {r+1}.",
                "matrix": format_matrix(M),
                "type": "pivot_swap"
            })
            
        pivot_val = M[r, lead]
        if np.abs(pivot_val) > tol:
            # Scale pivot row to 1
            M[r] = M[r] / pivot_val
            steps.append({
                "title": f"Scale Pivot Row: R{r+1} ← R{r+1} / {round_val(pivot_val)}",
                "description": f"Normalized pivot element at ({r+1}, {lead+1}) to 1.",
                "matrix": format_matrix(M),
                "type": "scale"
            })
            
            # Eliminate all other rows (above and below)
            for other_r in range(rows):
                if other_r != r and np.abs(M[other_r, lead]) > tol:
                    factor = M[other_r, lead]
                    M[other_r] -= factor * M[r]
                    steps.append({
                        "title": f"Elimination: R{other_r+1} ← R{other_r+1} - ({round_val(factor)}) × R{r+1}",
                        "description": f"Zeroed out column {lead+1} in row {other_r+1}.",
                        "matrix": format_matrix(M),
                        "type": "elimination"
                    })
        lead += 1

    M[np.abs(M) < tol] = 0.0

    rank_A = sum(1 for r in range(rows) if not np.allclose(M[r, :num_vars], 0, atol=tol))
    rank_aug = sum(1 for r in range(rows) if not np.allclose(M[r, :], 0, atol=tol))

    result: Dict[str, Any] = {
        "method": "Gauss-Jordan Elimination (RREF)",
        "rank_A": rank_A,
        "rank_augmented": rank_aug,
        "num_variables": num_vars,
        "final_echelon_matrix": format_matrix(M),
        "steps": steps
    }

    if rank_A < rank_aug:
        result["status"] = "No Solution (Inconsistent)"
        result["message"] = "Contradiction found in reduced echelon form."
        result["solution"] = None
    elif rank_A < num_vars:
        result["status"] = "Infinite Solutions (Underdetermined)"
        result["message"] = "Fewer independent pivot rows than variables."
        result["solution"] = None
    else:
        result["status"] = "Unique Solution"
        solutions = [round_val(M[i, -1]) for i in range(num_vars)]
        result["solution"] = solutions

    return result

def solve_cramers_rule(A_in: List[List[float]], B_in: List[float]) -> Dict[str, Any]:
    """
    Solves Ax = B using Cramer's Rule via determinants.
    Only applicable for square systems (n x n).
    """
    A = np.array(A_in, dtype=float)
    B = np.array(B_in, dtype=float)
    rows, cols = A.shape

    if rows != cols:
        return {
            "method": "Cramer's Rule",
            "status": "Inapplicable",
            "message": f"Cramer's Rule requires a square matrix (n x n). Matrix is {rows}x{cols}.",
            "solution": None,
            "steps": []
        }

    det_A = np.linalg.det(A)
    steps = []

    steps.append({
        "title": "Compute Main Determinant det(A)",
        "description": f"Calculated det(A) = {round_val(det_A)}",
        "det_value": round_val(det_A),
        "matrix": format_matrix(A)
    })

    if abs(det_A) < 1e-7:
        return {
            "method": "Cramer's Rule",
            "status": "Determinant is Zero",
            "message": "det(A) = 0. Cramer's Rule cannot be used because division by zero would occur (system is either inconsistent or has infinite solutions).",
            "det_A": round_val(det_A),
            "solution": None,
            "steps": steps
        }

    solutions = []
    det_sub_list = []
    for j in range(cols):
        A_sub = A.copy()
        A_sub[:, j] = B
        det_sub = np.linalg.det(A_sub)
        val = det_sub / det_A
        solutions.append(round_val(val))
        det_sub_list.append(round_val(det_sub))
        steps.append({
            "title": f"Substitute Column {j+1} with Vector B & Compute det(A_{j+1})",
            "description": f"det(A_{j+1}) = {round_val(det_sub)} → x_{j+1} = det(A_{j+1}) / det(A) = {round_val(det_sub)} / {round_val(det_A)} = {round_val(val)}",
            "det_value": round_val(det_sub),
            "matrix": format_matrix(A_sub),
            "variable_result": round_val(val)
        })

    return {
        "method": "Cramer's Rule",
        "status": "Unique Solution",
        "det_A": round_val(det_A),
        "sub_determinants": det_sub_list,
        "solution": solutions,
        "steps": steps
    }

def solve_matrix_inversion(A_in: List[List[float]], B_in: List[float]) -> Dict[str, Any]:
    """
    Solves Ax = B using Matrix Inversion method: X = A^(-1) * B.
    """
    A = np.array(A_in, dtype=float)
    B = np.array(B_in, dtype=float)
    rows, cols = A.shape

    if rows != cols:
        return {
            "method": "Matrix Inversion (A⁻¹B)",
            "status": "Inapplicable",
            "message": f"Matrix must be square to have an inverse. Given dimensions: {rows}x{cols}.",
            "solution": None,
            "steps": []
        }

    det_A = np.linalg.det(A)
    steps = []

    steps.append({
        "title": "Check Determinant det(A)",
        "description": f"det(A) = {round_val(det_A)}. Must be non-zero for inverse A⁻¹ to exist.",
        "matrix": format_matrix(A)
    })

    if abs(det_A) < 1e-7:
        return {
            "method": "Matrix Inversion (A⁻¹B)",
            "status": "Singular Matrix",
            "message": "det(A) = 0. The matrix is singular and has no inverse. Cannot solve via X = A⁻¹B.",
            "solution": None,
            "steps": steps
        }

    try:
        A_inv = np.linalg.inv(A)
        steps.append({
            "title": "Calculate Inverse Matrix A⁻¹",
            "description": "Computed inverse matrix A⁻¹.",
            "matrix": format_matrix(A_inv)
        })

        X = np.dot(A_inv, B)
        steps.append({
            "title": "Multiply X = A⁻¹ × B",
            "description": "Matrix product of A⁻¹ and vector B yields the solution vector X.",
            "solution": [round_val(x) for x in X]
        })

        return {
            "method": "Matrix Inversion (A⁻¹B)",
            "status": "Unique Solution",
            "det_A": round_val(det_A),
            "inverse_matrix": format_matrix(A_inv),
            "solution": [round_val(x) for x in X],
            "steps": steps
        }
    except Exception as e:
        return {
            "method": "Matrix Inversion (A⁻¹B)",
            "status": "Error",
            "message": str(e),
            "solution": None,
            "steps": steps
        }

def solve_jacobi_iteration(
    A_in: List[List[float]],
    B_in: List[float],
    num_iterations: int = 15,
    tol: float = 1e-7
) -> Dict[str, Any]:
    """
    Solves Ax = B using the Jacobi Iterative Method with statistical convergence analysis.
    Features:
      - Diagonal non-zero and strict dominance verification
      - Row Echelon Form & rank consistency test
      - Complete iteration trajectory history
      - Statistical summary (variance, standard deviation per variable)
      - Running std dev vs. variance crossover profile
      - 3D coordinate trajectory points
    """
    A = np.array(A_in, dtype=float)
    B = np.array(B_in, dtype=float).reshape(-1, 1)
    
    if A.size == 0 or B.size == 0:
        return {"status": "Error", "message": "Empty matrix provided", "steps": []}
    
    rows, cols = A.shape
    if rows != cols:
        return {
            "method": "Jacobi Iterative Method",
            "status": "Inapplicable",
            "message": f"Jacobi method requires a square system (n x n). Provided matrix is {rows}x{cols}.",
            "solution": None,
            "steps": []
        }
    
    m = cols
    n = rows
    steps = []
    
    # 1. Determinant test
    det_A = float(np.linalg.det(A))
    steps.append({
        "title": "Check Determinant det(A)",
        "description": f"Determinant det(A) = {round_val(det_A)}. {'Condition Passed: det(A) != 0.' if abs(det_A) > tol else 'Warning: det(A) == 0 (system may have no or infinite solutions).'}",
        "matrix": format_matrix(A)
    })
    
    # 2. Augmented matrix & Row Echelon Form rank check
    augmented_matrix = np.hstack((A, B))
    REF = augmented_matrix.copy()
    pivot_row = 0
    for col in range(m):
        if pivot_row >= n:
            break
        max_idx = np.argmax(abs(REF[pivot_row:n, col])) + pivot_row
        if np.isclose(REF[max_idx, col], 0.0, atol=tol):
            continue
        REF[[pivot_row, max_idx]] = REF[[max_idx, pivot_row]]
        for r in range(pivot_row + 1, n):
            factor = REF[r, col] / REF[pivot_row, col]
            REF[r] = REF[r] - factor * REF[pivot_row]
        pivot_row += 1
    REF[np.abs(REF) < tol] = 0.0
    
    rank_A = sum(1 for r in range(n) if not np.allclose(REF[r, :-1], 0.0, atol=tol))
    rank_aug = sum(1 for r in range(n) if not np.allclose(REF[r, :], 0.0, atol=tol))
    
    steps.append({
        "title": "Row Echelon Form & Rank Analysis",
        "description": f"Rank(A) = {rank_A}, Rank([A|B]) = {rank_aug}. {'Unique solution exists.' if rank_A == rank_aug == m else 'System is singular/inconsistent.'}",
        "matrix": format_matrix(REF)
    })
    
    if rank_A < rank_aug:
        return {
            "method": "Jacobi Iterative Method",
            "status": "No Solution (Inconsistent)",
            "message": f"Inconsistent system: rank(A) = {rank_A} < rank([A|B]) = {rank_aug}.",
            "rank_A": rank_A,
            "rank_augmented": rank_aug,
            "num_variables": m,
            "solution": None,
            "steps": steps
        }
    
    # 3. Check for zero diagonals
    for i in range(n):
        if np.isclose(A[i, i], 0.0, atol=tol):
            return {
                "method": "Jacobi Iterative Method",
                "status": "Zero Diagonal Error",
                "message": f"Main diagonal element A[{i+1}][{i+1}] is zero. Division by zero in Jacobi formula.",
                "rank_A": rank_A,
                "rank_augmented": rank_aug,
                "num_variables": m,
                "solution": None,
                "steps": steps
            }
            
    # Check diagonal dominance: |A_ii| > sum_{j != i} |A_ij|
    is_diagonally_dominant = True
    dominance_details = []
    for i in range(n):
        diag = abs(A[i, i])
        off_diag_sum = sum(abs(A[i, j]) for j in range(m) if j != i)
        is_dom = bool(diag > off_diag_sum)
        if not is_dom:
            is_diagonally_dominant = False
        dominance_details.append({
            "row": int(i + 1),
            "diagonal": float(round_val(diag)),
            "off_diagonal_sum": float(round_val(off_diag_sum)),
            "dominant": bool(is_dom)
        })
    is_diagonally_dominant = bool(is_diagonally_dominant)
    
    if num_iterations <= 0:
        num_iterations = 15
        
    # 4. Jacobi Iterative Loop
    history = np.zeros((num_iterations + 1, m))
    x_current = np.zeros(m)
    history[0] = x_current.copy()
    
    converged = False
    actual_iterations = 0
    prev_diff = None
    divergence_streak = 0
    
    for k in range(num_iterations):
        actual_iterations = k + 1
        x_next = np.zeros(m)
        step_eqs = []
        for i in range(n):
            sigma = sum(A[i, j] * x_current[j] for j in range(m) if j != i)
            x_next[i] = (B[i, 0] - sigma) / A[i, i]
            step_eqs.append(f"x_{i+1}^({k+1}) = ({round_val(B[i, 0])} - {round_val(sigma)}) / {round_val(A[i, i])} = {round_val(x_next[i])}")
            
        history[k + 1] = x_next.copy()
        
        diff = float(np.max(np.abs(x_next - x_current)))
        
        # Check divergence:
        # Either numbers grow gigantic, OR consecutive step difference grows on a non-dominant matrix
        if prev_diff is not None and diff > prev_diff * 1.05 and not is_diagonally_dominant:
            divergence_streak += 1
        else:
            divergence_streak = 0
            
        prev_diff = diff
        curr_norm = float(np.max(np.abs(x_next)))
        max_b = max(float(np.max(np.abs(B))), 1.0)
        
        is_diverging = (
            np.any(np.isnan(x_next)) or 
            curr_norm > 1e6 or 
            divergence_streak >= 3 or 
            (k >= 2 and not is_diagonally_dominant and curr_norm > max_b * 3)
        )
        
        if is_diverging:
            return {
                "method": "Jacobi Iterative Method",
                "status": "Diverged (Non-Diagonally Dominant)",
                "message": f"Jacobi method diverged at iteration {k+1}. The system is not diagonally dominant (|A_ii| <= sum|A_ij|) and consecutive errors grew ({round_val(diff, 2)}). Please switch to Gaussian Elimination to calculate the exact solution.",
                "rank_A": int(rank_A),
                "rank_augmented": int(rank_aug),
                "num_variables": int(m),
                "det_A": float(round_val(det_A)),
                "is_diagonally_dominant": bool(is_diagonally_dominant),
                "dominance_details": dominance_details,
                "solution": None,
                "is_diverged": True,
                "history": [[float(round_val(val)) for val in row] for row in history[:k+2]],
                "steps": steps
            }
            
        steps.append({
            "title": f"Jacobi Iteration k = {k + 1}",
            "description": "; ".join(step_eqs),
            "vector": [round_val(val) for val in x_next]
        })
        
        x_current = x_next.copy()
        if diff < tol:
            converged = True
            break
            
    # Trim history if converged early
    history = history[:actual_iterations + 1]
    
    # 5. Statistical Summary Across Iterations
    statistics = []
    for idx in range(m):
        var_values = history[:, idx]
        variance = float(np.var(var_values))
        std_dev = float(np.std(var_values))
        statistics.append({
            "variable_index": idx,
            "variance": round_val(variance, 6),
            "std_deviation": round_val(std_dev, 6)
        })
        
    # 6. Running Statistical Crossover Analysis
    crossover_data = {
        "steps": [],
        "series": []
    }
    
    if len(history) >= 3:
        running_steps = np.arange(2, len(history) + 1)
        crossover_data["steps"] = [int(s - 1) for s in running_steps]
        
        for v in range(min(m, 4)):
            run_var = []
            run_std = []
            for step in running_steps:
                subset = history[:step, v]
                run_var.append(float(np.var(subset)))
                run_std.append(float(np.std(subset)))
                
            # Detect exact crossovers where diff changes sign
            diff_arr = np.array(run_std) - np.array(run_var)
            var_crossovers = []
            for c in range(len(diff_arr) - 1):
                if diff_arr[c] * diff_arr[c + 1] <= 0:
                    crossover_iter = int(running_steps[c] - 1)
                    crossover_val = float(round_val(run_std[c], 4))
                    var_crossovers.append({
                        "iteration": int(crossover_iter),
                        "value": float(crossover_val)
                    })
                    
            crossover_data["series"].append({
                "variable_index": int(v),
                "run_std": [float(round_val(s, 4)) for s in run_std],
                "run_var": [float(round_val(v_val, 4)) for v_val in run_var],
                "crossovers": var_crossovers
            })
            
    # 7. 3D Trajectory Data
    trajectory_3d = {
        "iterations": [int(i) for i in range(len(history))],
        "x": [float(round_val(v)) for v in history[:, 0]],
        "y": [float(round_val(v)) for v in history[:, 1]] if m > 1 else [0.0] * len(history),
        "z": [float(round_val(v)) for v in history[:, 2]] if m > 2 else [0.0] * len(history),
    }
    
    final_solutions = [float(round_val(s)) for s in x_current]
    
    # If matrix was not diagonally dominant and failed to converge, do not present divergent numbers as a valid solution
    has_valid_solution = converged or is_diagonally_dominant
    status_label = "Unique Solution (Converged)" if converged else ("Unique Solution" if is_diagonally_dominant else "Diverged / Failed to Converge")
    
    return {
        "method": "Jacobi Iterative Method",
        "status": status_label,
        "is_diverged": not has_valid_solution,
        "message": f"{'Converged within tolerance' if converged else f'Executed {actual_iterations} iterations'}. Matrix is {'strictly diagonally dominant (convergence guaranteed)' if is_diagonally_dominant else 'not strictly diagonally dominant (diverged; switch to Gaussian Elimination for exact solution)'}.",
        "rank_A": int(rank_A),
        "rank_augmented": int(rank_aug),
        "num_variables": int(m),
        "det_A": float(round_val(det_A)),
        "is_diagonally_dominant": bool(is_diagonally_dominant),
        "dominance_details": dominance_details,
        "iterations_completed": int(actual_iterations),
        "solution": final_solutions if has_valid_solution else None,
        "history": [[float(round_val(val)) for val in row] for row in history],
        "statistics": statistics,
        "crossover_data": crossover_data,
        "trajectory_3d": trajectory_3d,
        "steps": steps
    }
