# ISE 14.7 Web Studio

A browser-based prototype inspired by the Xilinx ISE 14.7 Project Navigator layout for Windows 10 era projects.

## Open it

Serve this folder with a static web server, for example from PowerShell:

```powershell
py -m http.server 8000
```

Then open `http://localhost:8000`. It has no build step or package dependencies. The same static files can be uploaded to a static hosting provider.

## GitHub Pages

The repository includes a GitHub Actions workflow at `.github/workflows/pages.yml`. Push to the `main` branch to publish the site. In the repository's **Settings → Pages**, set the build and deployment source to **GitHub Actions**. The workflow deploys the app files, including `synth-worker.js`.

## Included

- Project Navigator style source tree, process list, editor, and Console/Errors/Warnings panels.
- New project and add source dialogs for VHDL and Verilog.
- Import one or more existing `.v`, `.vh`, `.sv`, `.vhd`, or `.vhdl` files, and download the active source.
- Source editing, line numbers, tab indentation, save, and project settings.
- Project persistence in the current browser's local storage.
- A project library for keeping multiple projects in one browser.
- Import/export for moving project JSON files between browsers.
- A lightweight structure check for basic HDL declarations, block counts, and balanced parentheses/brackets.
- Browser-based Verilog/SystemVerilog synthesis with YoWASP Yosys, including Xilinx-family cell mapping, a JSON netlist, and an ISE-compatible EDIF export for supported families.

## Scope

This is an ISE 14.7-inspired browser IDE, not a replacement for AMD/Xilinx ISE. It does not include XST, Xilinx device databases, implementation/place-and-route, ISim, iMPACT, or bitstream generation. The Yosys flow accepts Verilog/SystemVerilog and maps designs to supported Xilinx families: Spartan-6, Virtex-6, Artix-7, and Spartan-3 (experimental). It exports JSON and an EDIF netlist intended for the ISE flow. Mapping is by family, not exact part/package/speed grade; the selected device still needs implementation and bitstream generation in a compatible toolchain. Other family names fall back to generic Yosys synthesis. VHDL files can be edited and structurally checked, but the included synthesis engine does not synthesize VHDL. The structure check is a convenience and does not validate HDL semantics.

The first Yosys run downloads its WebAssembly engine from jsDelivr and needs an internet connection. HDL source contents are passed to the local browser worker for synthesis. This source uses the YoWASP Yosys browser package at a pinned version. To run the app locally, serve the files over HTTP or HTTPS; module workers do not run reliably when opening `index.html` directly as a `file://` URL. By default, project data lives in the browser that created it; use Export/Import to move projects between browsers.
