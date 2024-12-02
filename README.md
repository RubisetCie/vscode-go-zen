# Go for Visual Studio Code

The [VS Code Go extension] provides rich language support for the [Go programming language](https://golang.org/).

## Requirements

* Visual Studio Code 1.75 or newer (or editors compatible with VS Code 1.75+ APIs)
* Go 1.21 or newer.

## Quick Start

To get started with Go Lang:

1.  Install [Go](https://go.dev) 1.21 or newer if you haven't already.

1.  Install the [VS Code Go extension].

1.  Open any Go file or go.mod file to automatically activate the extension. The [Go status bar](https://github.com/golang/vscode-go/wiki/ui) appears in the bottom right corner of the window and displays your Go version.

1.  The extension depends on `go`, `gopls` (the Go language server), and optional
    tools depending on your settings. If `gopls` is missing, the extension will
    try to install it. The :zap: sign next to the Go version indicates
    the language server is running, and you are ready to go.

## Code of Conduct

This project follows the [Go Community Code of Conduct](https://golang.org/conduct). If you encounter a conduct-related issue, please mail conduct@golang.org.

## License

[MIT](LICENSE)

[VS Code Go extension]: https://github.com/RubisetCie/vscode-go-zen/releases
