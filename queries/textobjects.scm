; Functions
(call_expression) @function.outer
(call_expression
  arguments: (arguments) @function.inner)
(arguments) @parameter.outer
(arguments (_) @parameter.inner)

; Conditionals
(if_expression) @conditional.outer
(elseif_clause) @conditional.inner
(match_expression) @conditional.outer
(case_clause) @conditional.inner

; Blocks
(block) @block.outer
(parenthesized_expression) @block.inner
(where_clause) @block.outer

; Comments
(line_comment) @comment.outer
(block_comment) @comment.outer
