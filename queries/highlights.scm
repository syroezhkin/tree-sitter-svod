; Comments
(line_comment) @comment
(block_comment) @comment

; Descriptions are free-form labels (`x : толщина стенки`)
(description) @comment

; Strings and numbers
(string) @string
(integer) @number
(float) @number
(boolean) @boolean
(nil) @constant.builtin

; Units
(unit) @type

; Built-in constants (`#c`, `#pi`, `#g`)
((name) @constant.builtin
  (#match? @constant.builtin "^#"))

; Keywords
[
  "input"
  "const"
  "unit"
  "if"
  "then"
  "elseif"
  "else"
  "end"
  "begin"
  "match"
  "case"
  "where"
  "in"
] @keyword

; Functions
(call_expression
  function: (name) @function.call)

((call_expression
   function: (name) @function.builtin)
  (#any-of? @function.builtin
    "choice" "check" "include" "table" "image"
    "sqrt" "abs" "min" "max" "round" "floor" "ceil" "avg"
    "sin" "cos" "tan" "exp" "log" "pow" "to_degrees"))

; Variables
(identifier
  name: (name) @variable)

(input_declaration
  name: (name) @variable)
(const_declaration
  name: (name) @variable)
(unit_declaration
  name: (name) @variable)

; Operators
(binary_expression
  operator: (_) @operator)
(unary_expression
  operator: (_) @operator)

[
  "="
  "&="
] @operator

; Punctuation
["(" ")"] @punctuation.bracket
["," ";"] @punctuation.delimiter
":" @punctuation.delimiter
