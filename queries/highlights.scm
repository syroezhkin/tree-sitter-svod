; Comments
(line_comment) @comment
(block_comment) @comment

; Descriptions are free-form docstrings (`x = 5 desc толщина стенки`)
(description) @string.documentation

; Strings and numbers
(string) @string
(integer) @number
(float) @number
(boolean) @boolean
(nil) @constant.builtin

; Units
(unit) @type

; Keywords
[
  "input"
  "const"
  "unit"
  "unitless"
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
  "as"
  "desc"
] @keyword

; Functions
(call_expression
  function: (name) @function.call)

; Variables
(identifier
  name: (name) @variable)

(input_declaration
  name: (name) @variable)
(const_declaration
  name: (name) @variable)
(unit_declaration
  name: (name) @type)

; Built-in constants (`#c`, `#pi`, `#g`). This rule comes after the variable
; patterns on purpose: a later capture wins, and `#`-names also match
; `(identifier name: (name) @variable)`.
((name) @constant.builtin
  (#match? @constant.builtin "^#"))

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
