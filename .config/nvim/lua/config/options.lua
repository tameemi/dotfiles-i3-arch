-- Options are automatically loaded before lazy.nvim startup
-- Default options that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/options.lua
-- Add any additional options here
--

vim.g.mapleader = " "

vim.opt.termguicolors = true

-- removes the cursor line
vim.opt.guicursor = ""

vim.opt.tabstop = 2
vim.opt.softtabstop = 2
vim.opt.shiftwidth = 2
vim.opt.expandtab = true
vim.opt.smartindent = true

-- wrap line
vim.opt.wrap = true

vim.opt.number = true

vim.opt.title = false

-- vim.opt.autoindent = true
vim.opt.hlsearch = true
vim.opt.incsearch = true
vim.opt.backup = false
vim.opt.undodir = os.getenv("HOME") .. "/.nvim/undodir"
vim.opt.undofile = true

vim.opt.showcmd = true
vim.opt.cmdheight = 1
vim.opt.laststatus = 2

vim.opt.signcolumn = "yes"
vim.opt.scrolloff = 10
vim.opt.updatetime = 50
vim.opt.colorcolumn = "80"
-- vim.opt.shell = "fish"

vim.opt.backupskip = { "/tmp/*", "/private/tmp/*" }
vim.opt.inccommand = "split"
vim.opt.ignorecase = true -- Case insensitive searching UNLESS /C or capital in search
vim.opt.smarttab = true
vim.opt.breakindent = true
-- vim.opt.wrap = false -- No Wrap lines
vim.opt.backspace = { "start", "eol", "indent" }
vim.opt.path:append({ "**" }) -- Finding files - Search down into subfolders
vim.opt.wildignore:append({ "*/node_modules/*" })
vim.opt.splitbelow = true -- Put new windows below current
vim.opt.splitright = true -- Put new windows right of current
vim.opt.splitkeep = "cursor"
--vim.opt.mouse = ""

vim.g.snacks_animate = false

-- remove folders from netrew
vim.g.netrw_list_hide = [[^\.\.\=/\=$,.DS_Store,.next,.idea,.git,node_modules,*\.o,*\.pyc,.*\.swp]]
--
vim.g.netrw_keepdir = 0
-- vim.g.netrw_list_hide = '^\.git$|^\.gitignore$|^\.DS_Store$|^\.vscode$|node_modules$'

-- Patterns for hiding files, e.g. node_modules
-- NOTE: this works by reading '.gitignore' file
vim.cmd([[
  if exists('*netrw_gitignore#Hide')
    call netrw_gitignore#Hide()
  endif
]])

-- vim.g.netrw_list_hide = vim.fn["netrw_gitignore#Hide"]()
-- neeeded to prevent some copy errors
-- vim.g.netrw_keepdir = 0

-- needed for tmux weird behavior
-- vim.opt.timeoutlen = 100
vim.opt.ttimeoutlen = 0

-- Add asterisks in block comments
vim.opt.formatoptions:append({ "r" })

-- vim.cmd([[au BufNewFile,BufRead *.astro setf astro]])
-- vim.cmd([[au BufNewFile,BufRead Podfile setf ruby]])

vim.opt.mousescroll = "ver:2,hor:6"

if vim.fn.has("nvim-0.8") == 1 then
  vim.opt.cmdheight = 0
end
