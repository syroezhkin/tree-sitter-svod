; Definitions
(assignment
  name: (identifier
    name: (name) @local.definition))

(const_assignment
  name: (identifier
    name: (name) @local.definition))

(input_declaration
  name: (name) @local.definition)

(const_declaration
  name: (name) @local.definition)

(unit_declaration
  name: (name) @local.definition)

; References
(identifier
  name: (name) @local.reference)

; Scopes
[
  (if_expression)
  (match_expression)
  (case_clause)
  (block)
  (where_clause)
] @local.scope
