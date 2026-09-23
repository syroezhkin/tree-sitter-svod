# tree-sitter-svod

A [tree-sitter](https://tree-sitter.github.io/tree-sitter/) grammar for the
**svod** engineering-calculation language.

It is maintained alongside the language and used by editors for highlighting,
indentation, folding and navigation.

## Installation in Neovim

Requires [nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter)
(`main` branch, recent Neovim), the `tree-sitter` CLI and a C compiler.

### From GitHub (recommended)

Add the following to your config (for example `lua/plugins/svod.lua`):

```lua
require("nvim-treesitter.parsers").svod = {
  install_info = {
    url = "https://github.com/syroezhkin/tree-sitter-svod",
    revision = "v0.4.0",
    queries = "queries",
  },
}

vim.treesitter.language.register("svod", "svod")
vim.filetype.add({ extension = { svod = "svod" } })

return { "nvim-treesitter/nvim-treesitter" }
```

Then run `:TSInstall svod` — the parser is downloaded and built, and the queries
are installed automatically. After changing `revision`, update the parser with
`:TSUpdate`.

### From a local checkout

If you already have the repository cloned, point at its path:

```lua
local grammar = vim.env.SVOD_TS_PATH or vim.fn.expand("~/svod/tree-sitter-svod")

vim.api.nvim_create_autocmd("User", {
  pattern = "TSUpdate",
  callback = function()
    if vim.uv.fs_stat(grammar) then
      require("nvim-treesitter.parsers").svod = {
        install_info = { path = grammar, queries = "queries" },
      }
    end
  end,
})

vim.treesitter.language.register("svod", "svod")
vim.filetype.add({ extension = { svod = "svod" } })

return { "nvim-treesitter/nvim-treesitter" }
```

Then run `:TSInstall svod` (after editing the grammar, `:TSInstall! svod`).

Open any `*.svod` file — highlighting, indentation and folding turn on
automatically. `src/` is committed, so users do not need Node.

## Building from source

Requires the `tree-sitter` CLI (version pinned in `package.json`) and a C
compiler.

```sh
tree-sitter generate      # grammar.js -> src/
tree-sitter build         # -> parser.so (for Neovim)
tree-sitter test          # corpus tests
tree-sitter parse file.svod
```

`src/` is committed so that installation does not require Node. After editing
`grammar.js`, regenerate and commit `src/` (CI enforces this).

## Queries

| File | Purpose |
|---|---|
| `queries/highlights.scm` | syntax highlighting |
| `queries/indents.scm` | auto-indentation |
| `queries/folds.scm` | folding |
| `queries/locals.scm` | scopes |
| `queries/textobjects.scm` | text objects |

## Differences from the reference grammar

The grammars are not fully equivalent; the divergences are intentional:

- `input` is a keyword (it is contextual in the reference grammar, so
  `input = 5` will not parse);
- a trailing `desc …` description is a single token that runs to the end of the
  line; unlike the reference grammar it does not stop at a trailing `--` comment
  (the comment is folded into the description), at a block-closing keyword, or
  at a `where` clause — put `where` on its own line after a description;
- identifiers cover Latin, Greek and Cyrillic (the reference grammar allows any
  `ALPHABETIC` plus emoji);
- the multi-word unit `мм рт.ст.` is not recognised as a quantity suffix.

A unit cannot continue onto the next line after its number
(`a = 1\nb = 2` is two statements); this is enforced by the external scanner
`src/scanner.c`.

## License

MIT — see [LICENSE](LICENSE).
