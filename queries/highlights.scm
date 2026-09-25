; Comments
(line_comment) @comment
(block_comment) @comment

; Strings and numbers
(string) @string
(integer) @number
(float) @number
(boolean) @boolean
(nil) @constant.builtin

; Descriptions are docstrings (`x = 5 desc "толщина стенки"`). This rule comes
; after `(string) @string` on purpose: a later capture wins.
(description_clause
  (string) @string.documentation)

; Units, including a user-defined unit name in an `in` conversion
; (`x in моя_единица`), which the parser cannot tell from a variable.
(unit) @type
(_ target: (name) @type)

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
  "test"
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
