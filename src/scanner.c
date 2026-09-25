#include "tree_sitter/parser.h"

#include <stdbool.h>
#include <string.h>

// External scanner for unit literals.
//
// The grammar attaches an optional unit suffix to a numeric atom (`1500 кН`,
// `0.3 м`, `50 %`, `1500кН`). Unlike an ordinary token, the suffix must stay on
// the same line as the number: `a = 1\nb = 2` must be two statements, not a
// quantity with unit `b`. Because the lexer skips whitespace (including
// newlines) as trivia before regular tokens, a plain token cannot tell the
// difference; the scanner sees the whitespace and rejects a unit that would
// cross a line break.
//
// The same token is used for dimension declarations (`input t as мм desc толщина`) and unit
// conversions (`x in МПа`), where the suffix is written on the same line as the
// preceding `:` / `in` anyway.
//
// A bare keyword must not be mistaken for a unit (`17 mod 5`, `1 and 2`,
// `x = 5 in МПа`), so the scanner rejects reserved words.

enum TokenType {
  UNIT,
};

static bool is_unit_start(int32_t c) {
  return (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') ||
         (c >= 0x00C0 && c <= 0x024F) || (c >= 0x0370 && c <= 0x03FF) ||
         (c >= 0x0400 && c <= 0x04FF) || c == '%' || c == 0x00B0; // °
}

static bool is_unit_char(int32_t c) {
  return is_unit_start(c) || (c >= '0' && c <= '9') || c == '_';
}

static bool is_digit(int32_t c) { return c >= '0' && c <= '9'; }

// Reserved words, mirroring the string literals in grammar.js. A keyword must
// never be consumed as a unit suffix (`17 mod 5`, `1 and 2`, `x = 5 in МПа`),
// so this list has to stay in sync with the grammar.
typedef struct {
  const char *word;
  int len;
} keyword;

static bool is_keyword(const char *word, int len) {
  static const keyword keywords[] = {
      {"if", 2},       {"then", 4},     {"elseif", 6},  {"else", 4},
      {"end", 3},      {"begin", 5},    {"and", 3},     {"or", 2},
      {"not", 3},      {"mod", 3},      {"nil", 3},     {"true", 4},
      {"false", 5},    {"where", 5},    {"match", 5},   {"case", 4},
      {"const", 5},    {"in", 2},       {"unit", 4},    {"input", 5},
      {"as", 2},       {"unitless", 8}, {"desc", 4},    {"test", 4},
  };
  for (size_t i = 0; i < sizeof(keywords) / sizeof(keywords[0]); i++) {
    if (keywords[i].len == len && strncmp(keywords[i].word, word, len) == 0) {
      return true;
    }
  }
  return false;
}

// Consume an optional `^<exponent>` after a unit atom.
static void consume_exponent(TSLexer *lexer) {
  if (lexer->lookahead != '^') {
    return;
  }
  lexer->advance(lexer, false);
  if (lexer->lookahead == '(') {
    lexer->advance(lexer, false);
  }
  if (lexer->lookahead == '-' || lexer->lookahead == '+') {
    lexer->advance(lexer, false);
  }
  while (is_digit(lexer->lookahead)) {
    lexer->advance(lexer, false);
  }
  if (lexer->lookahead == '.') {
    lexer->advance(lexer, false);
    while (is_digit(lexer->lookahead)) {
      lexer->advance(lexer, false);
    }
  }
  if (lexer->lookahead == '/') {
    lexer->advance(lexer, false);
    while (is_digit(lexer->lookahead)) {
      lexer->advance(lexer, false);
    }
  }
  if (lexer->lookahead == ')') {
    lexer->advance(lexer, false);
  }
}

// Consume `<unit-atom>`; the lookahead must be a unit start. `word` captures the
// leading ASCII letters (for the keyword check); non-ASCII input marks `*ascii`
// as false.
static void consume_unit_atom(TSLexer *lexer, char *word, int *word_len,
                              bool *ascii) {
  do {
    if (lexer->lookahead < 128) {
      if (*word_len < 15) {
        word[(*word_len)++] = (char)lexer->lookahead;
      }
    } else {
      *ascii = false;
    }
    lexer->advance(lexer, false);
  } while (is_unit_char(lexer->lookahead));
  consume_exponent(lexer);
}

void *tree_sitter_svod_external_scanner_create(void) { return NULL; }

void tree_sitter_svod_external_scanner_destroy(void *payload) {
  (void)payload;
}

unsigned tree_sitter_svod_external_scanner_serialize(void *payload,
                                                     char *buffer) {
  (void)payload;
  (void)buffer;
  return 0;
}

void tree_sitter_svod_external_scanner_deserialize(void *payload,
                                                   const char *buffer,
                                                   unsigned length) {
  (void)payload;
  (void)buffer;
  (void)length;
}

bool tree_sitter_svod_external_scanner_scan(void *payload, TSLexer *lexer,
                                            const bool *valid_symbols) {
  (void)payload;

  if (!valid_symbols[UNIT]) {
    return false;
  }

  // Skip horizontal whitespace so `10 мм` works; a line break forbids a unit.
  while (lexer->lookahead == ' ' || lexer->lookahead == '\t') {
    lexer->advance(lexer, true);
  }
  if (lexer->eof(lexer) || lexer->lookahead == '\n' ||
      lexer->lookahead == '\r') {
    return false;
  }
  if (!is_unit_start(lexer->lookahead)) {
    return false;
  }

  char word[16] = {0};
  int word_len = 0;
  bool ascii = true;
  consume_unit_atom(lexer, word, &word_len, &ascii);
  lexer->mark_end(lexer);

  bool composite = lexer->lookahead == '*' || lexer->lookahead == 0x00B7 ||
                   lexer->lookahead == '/';
  if (ascii && !composite && is_keyword(word, word_len)) {
    return false;
  }

  // Composite units: `кН/м`, `Н*м`, `Вт/м*°C`. An operator is only part of the
  // unit when followed by another unit atom (so `м*3` stays arithmetic).
  while (composite) {
    lexer->advance(lexer, false);
    if (!is_unit_start(lexer->lookahead)) {
      break;
    }
    consume_unit_atom(lexer, word, &word_len, &ascii);
    lexer->mark_end(lexer);
    composite = lexer->lookahead == '*' || lexer->lookahead == 0x00B7 ||
                lexer->lookahead == '/';
  }

  lexer->result_symbol = UNIT;
  return true;
}
