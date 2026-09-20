# 💤 LazyVim

A starter template for [LazyVim](https://github.com/LazyVim/LazyVim).
Refer to the [documentation](https://lazyvim.github.io/installation) to get started.

# nvimconfig

## telescope:

#### file browser

| key                           | func                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------- |
| \f                            | Lists files in your current working directory, respects .gitignore n                                        |
| \r                            | Search for a string in your current working directory and get results live as you type, respects .gitignore |
| \\\\                          | Lists open buffers                                                                                          |
| \t                            | Lists available help tags and opens a new window with the relevant help info on `<cr>`                      |
| ;;                            | Resume the previous telescope picker                                                                        |
| \e                            | Lists Diagnostics for all open buffers or a specific buffer                                                 |
| \s                            | Lists Function names, variables, from Treesitter                                                            |
| sf                            | Open File Browser with the path of the current buffer                                                       |
| for file browser (all n mode) |                                                                                                             |
| N                             | Create a new file                                                                                           |
| h                             | Go to parent directory                                                                                      |
| /                             | Enter the insert mode to search files                                                                       |
| <C-u>                         | Move the selection 10 lines up                                                                              |
| <C-d>                         | Move the selection 10 lines down                                                                            |
| <PageUp>                      | Scroll up the preview pane                                                                                  |
| <PageDown>                    | Scroll down the preview pane                                                                                |

#### default keyaps (lazyvim.org/keymaps)
