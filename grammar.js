// Tree-sitter grammar for Svod — the engineering-calculation language.
//
// This grammar is maintained alongside the language and kept in sync with its
// reference parser; a CI check parses every *.svod sample and fails on ERROR.
//
// Accepted divergences from the reference grammar (documented in README.md):
//   * `input` is a keyword here (contextual in the reference grammar);
//   * identifiers cover Latin, Greek and Cyrillic scripts (the reference
//     grammar allows any ALPHABETIC plus emoji);
//   * the multi-word unit `мм рт.ст.` is not recognised as a unit suffix.

// Latin (incl. Latin-1 and Latin Extended), Greek, Cyrillic.
const LETTER = 'A-Za-z\\u00C0-\\u024F\\u0370-\\u03FF\\u0400-\\u04FF';
const DIGIT = '0-9';

// Numeric fragments shared by `integer` and `float`; `_` is a digit separator.
const DIGITS = `[${DIGIT}]+(?:_[${DIGIT}]+)*`;
const FRACTION = `\\.[${DIGIT}]+(?:_[${DIGIT}]+)*`;
const EXPONENT = `[eE][+-]?[${DIGIT}]+`;

const nameRegex = new RegExp(`[${LETTER}#][${LETTER}${DIGIT}_']*`, 'u');
const integerRegex = new RegExp(DIGITS);
const floatRegex = new RegExp(`${DIGITS}${FRACTION}(?:${EXPONENT})?`);
const floatExponentRegex = new RegExp(`${DIGITS}${EXPONENT}`);

// A Lua-style `--[=…=[ … ]=…=]` comment at the given `=` nesting level. The
// content alternation rejects any closing delimiter of that level.
function blockCommentRegex(level) {
  const eq = '='.repeat(level);
  const content = ['[^\\]]'];
  for (let i = 0; i <= level; i++) {
    content.push(`\\]${'='.repeat(i)}${i < level ? '[^=]' : '[^\\]]'}`);
  }
  return new RegExp(`--\\[${eq}\\[(?:${content.join('|')})*\\]${eq}\\]`);
}

module.exports = grammar({
  name: 'svod',

  word: $ => $.name,

  extras: $ => [/\s+/, $.line_comment, $.block_comment],

  // The unit literal is external because it must not cross a line break (see
  // src/scanner.c); a regular token cannot see the newline that extras skip.
  externals: $ => [$.unit],



  rules: {
    program: $ => repeat(choice($.statement, $.test_declaration)),

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
        $.assignment,
        $._value_expression,
      ),
      optional(';'),
    ),

    // --- Declarations -----------------------------------------------------

    // `input name [as unit] [= value] [desc "<description>"]`
    input_declaration: $ => seq(
      'input',
      field('name', $.name),
      optional(field('unit', $.unit_annotation)),
      optional(choice(
        seq($._assign_op, field('value', $._decl_value)),
        $.description_clause,
      )),
    ),

    // `const name as unit [= value] [desc "<description>"]`.
    // A `const` requires the `as` annotation; a plain `const name = value` falls
    // through to `const_assignment`. `prec(3)` puts the declaration before the
    // assignment, matching the reference grammar's rule order.
    const_declaration: $ => prec(3, seq(
      'const',
      field('name', $.name),
      field('unit', $.unit_annotation),
      optional(seq($._assign_op, field('value', $._decl_value))),
    )),

    // `desc "<text>"` — the trailing variable description.
    description_clause: $ => seq('desc', field('description', $.string)),

    // `as unit` / `as unitless` — the reference-unit annotation.
    unit_annotation: $ => seq('as', choice('unitless', $.unit)),

    // `unit name = value`
    unit_declaration: $ => seq(
      'unit',
      field('name', $.name),
      '=',
      field('value', $._assignment_rhs),
    ),

    // `const name = value [desc "<description>"]`
    const_assignment: $ => prec(2, seq(
      'const',
      field('name', $.identifier),
      $._assign_op,
      field('value', $._decl_value),
    )),

    // `name = value [desc "<description>"]`. The description attaches to the
    // outermost assignment; a chained value is a nested `assignment` with no
    // description slot, so `x = a = 1 desc "…"` does not parse.
    assignment: $ => prec(1, seq(
      field('name', $.identifier),
      $._assign_op,
      field('value', choice($.assignment, $._decl_value)),
    )),

    _assign_op: $ => choice('=', '&='),

    // Right-hand side of a `unit` declaration: a value expression, or another
    // assignment (chaining). A `unit` has no description slot.
    _assignment_rhs: $ => choice($.assignment, $._value_expression),

    // A value head: an expression with an optional `in` conversion. The target
    // is a unit literal or a user-defined unit name, exposed under `target`.
    // (`unit` is taken by the `as` annotation on declarations and by the unit
    // suffix on atoms, so the conversion needs its own field name.)
    _value_head: $ => seq(
      $._expression,
      optional(seq('in', field('target', choice($.unit, $.name)))),
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

    // A top-level test block: `test "name" <statements> end`. Tests are not
    // statements (the reference grammar keeps them out of `stmt_body`), so
    // they only appear at the program level.
    test_declaration: $ => seq(
      'test',
      field('name', $.string),
      repeat($.statement),
      'end',
      optional(';'),
    ),

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

    // Precedence from lowest to highest; `prec.left` makes them associative.
    binary_expression: $ => {
      const level = (precedence, operator) => prec.left(precedence, seq(
        field('left', $._expression),
        field('operator', operator),
        field('right', $._expression),
      ));
      return choice(
        level(1, $.or_operator),
        level(2, $.and_operator),
        level(3, $.comparison_operator),
        level(4, $.additive_operator),
        level(5, $.multiplicative_operator),
        level(6, $.power_operator),
      );
    },

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
      blockCommentRegex(0),
      blockCommentRegex(1),
      blockCommentRegex(2),
      blockCommentRegex(3),
    ))),

    // --- Lexical ----------------------------------------------------------

    // A reference/assignment target: `name [as unit]`. The `as` annotation is
    // only valid on an assignment target; an expression reference is a plain
    // name. Descriptions are a trailing `desc "…"` clause, not part of the
    // target.
    identifier: $ => seq(
      field('name', $.name),
      optional(field('unit', $.unit_annotation)),
    ),

    name: $ => token(nameRegex),

    string: $ => token(choice(
      seq('"', /[^"]*/, '"'),
      seq("'", /[^']*/, "'"),
    )),

    integer: $ => token(integerRegex),

    float: $ => token(choice(floatRegex, floatExponentRegex)),
  },
});

function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}
