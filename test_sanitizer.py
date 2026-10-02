from ai_parser import parse_word_problem_with_gemini, sanitize_math_input

test_raw = "A real estate group bought two properties. The first property costs $500,000 and the second costs $250,000. Total budget spent was $1,500,000 for 4 units total."
print("Sanitized text:", sanitize_math_input(test_raw))

res = parse_word_problem_with_gemini(test_raw)
print("Success:", res.get("success"))
print("Variables:", res.get("variable_labels"))
print("Matrix A:", res.get("matrix_a"))
print("Vector B:", res.get("vector_b"))
print("Explanations:", res.get("explanation_of_equations"))
print("Source:", res.get("source"))
