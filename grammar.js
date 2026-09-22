// Tree-sitter grammar for Svod — the engineering-calculation language.
//
// This grammar is maintained alongside the language and kept in sync with its
// reference parser; a CI check parses every *.svod sample and fails on ERROR.
//
// Accepted divergences from the reference grammar (documented in README.md):
//   * `input` is a keyword here (contextual in the reference grammar);
//   * `description` is a single-line token that does not stop at a `--`
//     comment, a block-closing keyword, or a `where` clause (put `where` on
//     its own line after a description);
//   * identifiers cover Latin, Greek and Cyrillic scripts (the reference
//     grammar allows any ALPHABETIC plus emoji);
//   * the multi-word unit `мм рт.ст.` is not recognised as a unit suffix.

// Latin (incl. Latin-1 and Latin Extended), Greek, Cyrillic.
const LETTER = 'A-Za-z\\u00C0-\\u024F\\u0370-\\u03FF\\u0400-\\u04FF';
const DIGIT = '0-9';

const nameRegex = new RegExp(`[${LETTER}#][${LETTER}${DIGIT}_']*`, 'u');

module.exports = grammar({
  name: 'svod',

  word: $ => $.name,

  extras: $ => [/\s+/, $.line_comment, $.block_comment],

  // The unit literal is external because it must not cross a line break (see
  // src/scanner.c); a regular token cannot see the newline that extras skip.
  externals: $ => [$.unit],



  rules: {
    program: $ => repeat($.statement),

    // A statement is a body followed by an optional `;`. The language uses
    // newline as a soft terminator; tree-sitter's greedy expressions provide
    // the same "continue across a line break if the next token extends the
    // expression" behaviour.
    //
    // A bare expression statement is a full value expression (the reference
    // grammar's `stmt_body` lists `value_expr`), so `check(…) where … end` and
    // `x in МПа` parse at statement level — otherwise `where`/`end` fall back
    // to `name` and highlight as variables.
    statement: $ => seq(
      choice(
        $.const_declaration,
        $.unit_declaration,
        $.input_declaration,
        $.const_assignment,
        $.described_assignment,
        $.assignment,
        $._value_expression,
      ),
      optional(';'),
    ),

    // --- Declarations -----------------------------------------------------

    // `input name [as unit] [= value] [desc description]`
    input_declaration: $ => seq(
      'input',
      field('name', $.name),
      optional(field('unit', $.unit_annotation)),
      optional(choice(
        seq($._assign_op, field('value', $._decl_value)),
        field('description', $.description_clause),
      )),
    ),

    // `const name as unit [= value] [desc description]`.
    // A `const` requires the `as` annotation; a plain `const name = value` falls
    // through to `const_assignment`. `prec(3)` puts the declaration before the
    // assignment, matching the reference grammar's rule order.
    const_declaration: $ => prec(3, seq(
      'const',
      field('name', $.name),
      field('unit', $.unit_annotation),
      optional(seq($._assign_op, field('value', $._decl_value))),
    )),

    // `desc <text>` — the trailing variable description.
    description_clause: $ => seq('desc', field('description', $.description)),

    // `as unit` / `as unitless` — the reference-unit annotation.
    unit_annotation: $ => seq('as', choice('unitless', $.unit)),

    // `unit name = value`
    unit_declaration: $ => seq(
      'unit',
      field('name', $.name),
      '=',
      field('value', $._assignment_rhs),
    ),

    // `const name = value [desc description]`
    const_assignment: $ => prec(2, seq(
      'const',
      field('name', $.identifier),
      $._assign_op,
      field('value', $._decl_value),
    )),

    assignment: $ => prec(1, seq(
      field('name', $.identifier),
      $._assign_op,
      field('value', $._assignment_rhs),
    )),

    // `name = value desc description` — the same as `assignment` with a
    // required description, so `desc` only attaches at the top level.
    described_assignment: $ => prec(2, seq(
      field('name', $.identifier),
      $._assign_op,
      field('value', $._described_value),
    )),

    _assign_op: $ => choice('=', '&='),

    // Right-hand side: a value expression, or another assignment (chaining).
    _assignment_rhs: $ => choice($.assignment, $._value_expression),

    // A value head: an expression with an optional `in` conversion.
    _value_head: $ => seq(
      $._expression,
      optional(seq('in', choice($.unit, $.name))),
    ),

    // A value with an optional `where` clause (expressions, args, parens).
    _value_expression: $ => seq($._value_head, optional($.where_clause)),

    // A declaration/assignment value: the head, an optional description, then
    // an optional `where` clause. The description precedes `where`, matching
    // the report layout. A chained assignment is not a value here, as in the
    // reference grammar.
    _decl_value: $ => seq(
      $._value_head,
      optional($.description_clause),
      optional($.where_clause),
    ),

    // The same, with a required description.
    _described_value: $ => seq(
      $._value_head,
      $.description_clause,
      optional($.where_clause),
    ),

    where_clause: $ => seq('where', repeat($.statement), 'end'),

    // --- Control flow -----------------------------------------------------

    if_expression: $ => seq(
      'if',
      field('condition', $._expression),
      'then',
      repeat($.statement),
      repeat($.elseif_clause),
      optional($.else_clause),
      'end',
    ),

    elseif_clause: $ => seq(
      'elseif',
      field('condition', $._expression),
      'then',
      repeat($.statement),
    ),

    else_clause: $ => seq('else', repeat($.statement)),

    match_expression: $ => seq(
      'match',
      field('value', $._expression),
      repeat1($.case_clause),
      optional($.else_clause),
      'end',
    ),

    case_clause: $ => seq(
      'case',
      commaSep1($._expression),
      optional(seq('if', field('guard', $._expression))),
      'then',
      repeat($.statement),
    ),

    block: $ => seq('begin', repeat1($.statement), 'end'),

    // --- Expressions ------------------------------------------------------

    _expression: $ => choice(
      $.binary_expression,
      $.unary_expression,
      $.call_expression,
      $.parenthesized_expression,
      $.block,
      $.if_expression,
      $.match_expression,
      $.string,
      $.atom,
      $.identifier,
    ),

    binary_expression: $ => choice(
      prec.left(1, seq(
        field('left', $._expression),
        field('operator', $.or_operator),
        field('right', $._expression),
      )),
      prec.left(2, seq(
        field('left', $._expression),
        field('operator', $.and_operator),
        field('right', $._expression),
      )),
      prec.left(3, seq(
        field('left', $._expression),
        field('operator', $.comparison_operator),
        field('right', $._expression),
      )),
      prec.left(4, seq(
        field('left', $._expression),
        field('operator', $.additive_operator),
        field('right', $._expression),
      )),
      prec.left(5, seq(
        field('left', $._expression),
        field('operator', $.multiplicative_operator),
        field('right', $._expression),
      )),
      prec.left(6, seq(
        field('left', $._expression),
        field('operator', $.power_operator),
        field('right', $._expression),
      )),
    ),

    unary_expression: $ => prec(7, seq(
      field('operator', $.unary_operator),
      field('argument', $._expression),
    )),

    or_operator: $ => 'or',
    and_operator: $ => 'and',
    unary_operator: $ => choice('not', '-', '−'),

    comparison_operator: $ => choice('==', '!=', '<=', '>=', '<', '>'),
    additive_operator: $ => choice('&+', '&-', '+', '-', '−'),
    multiplicative_operator: $ => choice('&*', '*', '/', 'mod'),
    power_operator: $ => '**',

    call_expression: $ => prec(10, seq(
      field('function', $.name),
      field('arguments', $.arguments),
    )),

    // Arguments and parenthesized expressions are full value expressions: like
    // the reference grammar, they allow `in <unit>` and `where … end`
    // (`f(x in МПа)`, `(q in кг/м) * g`).
    arguments: $ => seq('(', optional(commaSep1($._value_expression)), ')'),

    parenthesized_expression: $ => seq('(', $._value_expression, ')'),

    atom: $ => choice(
      seq(
        field('value', choice($.integer, $.float)),
        optional(field('unit', $.unit)),
      ),
      $.boolean,
      $.nil,
    ),

    boolean: $ => choice('true', 'false'),
    nil: $ => 'nil',

    // --- Comments ---------------------------------------------------------

    // `--` to the end of the line.
    line_comment: $ => token(/--[^\n]*/),

    // Lua-style `--[[ ... ]]` with up to three `=` levels. Each alternative is
    // a regular language "content contains no closing delimiter"; the `prec(1)`
    // makes a block comment win over a line comment when both could match on a
    // single line.
    block_comment: $ => token(prec(1, choice(
      /--\[\[(?:[^\]]|\][^\]])*\]\]/,
      /--\[=\[(?:[^\]]|\][^=]|\]=[^\]])*\]=\]/,
      /--\[==\[(?:[^\]]|\][^=]|\]=[^=]|\]==[^\]])*\]==\]/,
      /--\[===\[(?:[^\]]|\][^=]|\]=[^=]|\]==[^=]|\]===[^\]])*\]===\]/,
    ))),

    // --- Lexical ----------------------------------------------------------

    // A reference/assignment target: `name [as unit]`. The `as` annotation is
    // only valid on an assignment target; an expression reference is a plain
    // name. Descriptions are a trailing `desc …` clause, not part of the target.
    identifier: $ => seq(
      field('name', $.name),
      optional(field('unit', $.unit_annotation)),
    ),

    // The text after `desc`: a single-line token, stopping before a statement
    // separator (`;`). Unlike the reference grammar it does not stop at a
    // trailing `--` comment (tree-sitter regexes have no look-ahead); a comment
    // after a description is folded into it for highlighting.
    description: $ => token(/[^\n;]+/),

    name: $ => token(nameRegex),

    string: $ => token(choice(
      seq('"', /[^"]*/, '"'),
      seq("'", /[^']*/, "'"),
    )),

    integer: $ => token(/[0-9]+(?:_[0-9]+)*/),

    float: $ => token(choice(
      /[0-9]+(?:_[0-9]+)*\.[0-9]+(?:_[0-9]+)*(?:[eE][+-]?[0-9]+)?/,
      /[0-9]+(?:_[0-9]+)*[eE][+-]?[0-9]+/,
    )),
  },
});

function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}
