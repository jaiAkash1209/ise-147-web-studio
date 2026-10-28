# ISE 14.7 Web Studio

A browser-based prototype inspired by the Xilinx ISE 14.7 Project Navigator layout for Windows 10 era projects.

## Open it

Serve this folder with a static web server, for example from PowerShell:

```powershell
py -m http.server 8000
```

Then open `http://localhost:8000`. It has no build step or package dependencies. The same static files can be uploaded to a static hosting provider.

## GitHub Pages

The repository includes a GitHub Actions workflow at `.github/workflows/pages.yml`. Push to the `main` branch to publish the site. In the repository's **Settings → Pages**, set the build and deployment source to **GitHub Actions**. The workflow deploys only `index.html`, `app.js`, and `styles.css`.

## Included

- Project Navigator style source tree, process list, editor, and Console/Errors/Warnings panels.
- New project and add source dialogs for VHDL and Verilog.
- Source editing, line numbers, tab indentation, save, and project settings.
- Project persistence in the current browser's local storage.
- A project library for keeping multiple projects in one browser.
- Import/export for moving project JSON files between browsers.
- A lightweight structure check for basic HDL declarations, block counts, and balanced parentheses/brackets.

## Scope

This prototype does not include AMD/Xilinx source code, licenses, device databases, XST synthesis, implementation, ISim, iMPACT, or bitstream generation. The browser structure check is a convenience and does not validate HDL semantics or replace ISE. Those stages need an authorized compatible toolchain or a separate HDL backend. By default, project data lives in the browser that created it; use Export/Import to move it between browsers. The static app is ready to be hosted, but it is not yet published or a hosted multi-user service.

