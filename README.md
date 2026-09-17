# tree-sitter-svod

Грамматика [tree-sitter](https://tree-sitter.github.io/tree-sitter/) для языка
инженерных расчётов **svod**.

Поддерживается вместе с языком и используется редакторами для подсветки,
отступов, фолдинга и навигации.

## Установка в Neovim

Требуется [nvim-treesitter](https://github.com/nvim-treesitter/nvim-treesitter)
(ветка `main`, свежий Neovim), `tree-sitter` CLI и C-компилятор.

### Из GitHub (рекомендуется)

Добавьте в свой конфиг (например, `lua/plugins/svod.lua`):

```lua
require("nvim-treesitter.parsers").svod = {
  install_info = {
    url = "https://github.com/syroezhkin/tree-sitter-svod",
    revision = "v0.1.0",
    queries = "queries",
  },
}

vim.treesitter.language.register("svod", "svod")
vim.filetype.add({ extension = { svod = "svod" } })

return { "nvim-treesitter/nvim-treesitter" }
```

Затем `:TSInstall svod` — парсер скачается и соберётся, запросы установятся
автоматически. После смены `revision` обновите парсер через `:TSUpdate`.

### Из локальной копии

Если репозиторий уже склонирован, укажите путь к нему:

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

Затем `:TSInstall svod` (после правок грамматики — `:TSInstall! svod`).

Откройте любой `*.svod` — подсветка, отступы и фолдинг включатся автоматически.
`src/` уже сгенерирован, поэтому Node на машине пользователя не нужен.

## Сборка из исходников

Нужны `tree-sitter` CLI (пин в `package.json`) и C-компилятор.

```sh
tree-sitter generate      # grammar.js -> src/
tree-sitter build         # -> parser.so (для Neovim)
tree-sitter test          # corpus-тесты
tree-sitter parse file.svod
```

`src/` коммитится, чтобы установка не требовала Node. После правки `grammar.js`
обязательно перегенерировать и закоммитить `src/` (это проверяет CI).

## Запросы

| Файл | Назначение |
|---|---|
| `queries/highlights.scm` | подсветка |
| `queries/indents.scm` | автоотступы |
| `queries/folds.scm` | сворачивание |
| `queries/locals.scm` | области видимости |
| `queries/textobjects.scm` | текстовые объекты |

## Отличия от эталонной грамматики

Полной эквивалентности нет; расхождения осознанные:

- `input` — ключевое слово (в эталонной грамматике контекстное;
  `input = 5` не распарсится);
- `description` — однострочный (в эталонной грамматике может переноситься);
- идентификаторы покрывают латиницу, греческий и кириллицу (в эталонной
  грамматике — любой `ALPHABETIC` и эмодзи);
- составная единица `мм рт.ст.` не распознаётся как суффикс величины.

Единица измерения после числа не может переноситься на следующую строку
(`a = 1\nb = 2` — два оператора); это обеспечивает внешний сканер
`src/scanner.c`.

## Лицензия

MIT — см. [LICENSE](LICENSE).
