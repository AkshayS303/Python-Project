import os
import sys
import json
from typing import List, Optional, Dict, Any
from pathlib import Path

# Add current dir to sys.path
BASE_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE_DIR))

from matrix_engine import (
    solve_gaussian_elimination,
    solve_gauss_jordan,
    solve_cramers_rule,
    solve_matrix_inversion,
    format_matrix
)
from ai_parser import parse_word_problem_with_gemini

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse, JSONResponse
    from fastapi.middleware.cors import CORSMiddleware
    from pydantic import BaseModel

    app = FastAPI(title="MatSolve", description="Universal Linear System & Word Problem Solver")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    class MatrixSolveRequest(BaseModel):
        matrix_a: List[List[float]]
        vector_b: List[float]
        method: str = "gaussian"  # gaussian, gauss_jordan, cramer, inversion
        variable_labels: Optional[List[str]] = None

    class WordProblemRequest(BaseModel):
        problem: str
        method: str = "gaussian"
        api_key: Optional[str] = None

    def execute_solver(method: str, matrix_a: List[List[float]], vector_b: List[float], labels: Optional[List[str]] = None) -> Dict[str, Any]:
        method = method.lower()
        if method == "gauss_jordan":
            res = solve_gauss_jordan(matrix_a, vector_b)
        elif method == "cramer":
            res = solve_cramers_rule(matrix_a, vector_b)
        elif method == "inversion":
            res = solve_matrix_inversion(matrix_a, vector_b)
        else:
            res = solve_gaussian_elimination(matrix_a, vector_b)

        # Attach variable labels if provided
        cols = len(matrix_a[0]) if matrix_a and len(matrix_a) > 0 else 0
        if not labels or len(labels) != cols:
            labels = [f"x{i+1}" for i in range(cols)]
        res["variable_labels"] = labels
        return res

    @app.post("/api/solve/matrix")
    async def solve_matrix_endpoint(req: MatrixSolveRequest):
        try:
            result = execute_solver(req.method, req.matrix_a, req.vector_b, req.variable_labels)
            return JSONResponse(content=result)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    @app.post("/api/solve/word-problem")
    async def solve_word_problem_endpoint(req: WordProblemRequest):
        if not req.problem.strip():
            raise HTTPException(status_code=400, detail="Word problem cannot be empty.")
        
        # 1. Parse using Gemini
        ai_result = parse_word_problem_with_gemini(req.problem, req.api_key)
        if not ai_result.get("success"):
            return JSONResponse(status_code=422, content={
                "status": "AI Parsing Error",
                "error": ai_result.get("error", "Failed to extract mathematical equations from prompt.")
            })
        
        matrix_a = ai_result["matrix_a"]
        vector_b = ai_result["vector_b"]
        labels = ai_result["variable_labels"]
        explanations = ai_result["explanation_of_equations"]

        # 2. Solve matrix
        solve_result = execute_solver(req.method, matrix_a, vector_b, labels)
        solve_result["ai_parsed"] = {
            "matrix_a": matrix_a,
            "vector_b": vector_b,
            "variable_labels": labels,
            "explanation_of_equations": explanations,
            "source": ai_result.get("source", "Google Gemini")
        }
        return JSONResponse(content=solve_result)

    @app.get("/api/health")
    async def health_check():
        return {"status": "ok", "app": "MatSolve Linear Equation Solver"}

    # Mount static assets
    static_dir = BASE_DIR / "static"
    if static_dir.exists():
        app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

    @app.get("/")
    async def serve_index():
        index_file = BASE_DIR / "static" / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        return {"message": "MatSolve Backend is active. static/index.html not found."}

    if __name__ == "__main__":
        import uvicorn
        port = int(os.environ.get("PORT", 8000))
        print(f"[*] Starting MatSolve Server on http://localhost:{port}")
        uvicorn.run("server:app", host="127.0.0.1", port=port, reload=True)

except ImportError:
    # Minimal fallback server using built-in http.server if dependencies are pending
    from http.server import HTTPServer, SimpleHTTPRequestHandler
    import urllib.parse

    class FallbackHandler(SimpleHTTPRequestHandler):
        def do_GET(self):
            if self.path == "/" or self.path == "":
                self.path = "/static/index.html"
            elif not self.path.startswith("/static/"):
                self.path = "/static" + self.path
            return super().do_GET()

    if __name__ == "__main__":
        port = 8000
        print(f"[*] Serving static files on http://localhost:{port}")
        httpd = HTTPServer(("127.0.0.1", port), FallbackHandler)
        httpd.serve_forever()
