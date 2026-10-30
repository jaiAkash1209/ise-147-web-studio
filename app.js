(() => {
  const STORAGE_KEY = "ise-web-studio-projects-v1";
  const VHDL_STARTER = `library IEEE;\nuse IEEE.STD_LOGIC_1164.ALL;\nuse IEEE.NUMERIC_STD.ALL;\n\nentity blinky is\n  Port (\n    clk   : in  STD_LOGIC;\n    reset : in  STD_LOGIC;\n    led   : out STD_LOGIC\n  );\nend blinky;\n\narchitecture Behavioral of blinky is\n  signal counter : unsigned(23 downto 0) := (others => '0');\nbegin\n  process(clk, reset)\n  begin\n    if reset = '1' then\n      counter <= (others => '0');\n    elsif rising_edge(clk) then\n      counter <= counter + 1;\n    end if;\n  end process;\n\n  led <= counter(23);\nend Behavioral;\n`;
  const VERILOG_STARTER = `module blinky(\n  input  wire clk,\n  input  wire reset,\n  output reg  led\n);\n  reg [23:0] counter = 24'd0;\n\n  always @(posedge clk or posedge reset) begin\n    if (reset) begin\n      counter <= 24'd0;\n      led <= 1'b0;\n    end else begin\n      counter <= counter + 1'b1;\n      led <= counter[23];\n    end\n  end\nendmodule\n`;
  const DEFAULT_PROJECT = {
    id: "starter-led-blink",
    name: "led_blink",
    device: "xc6slx9-2-tqg144",
    family: "Spartan-6",
    sources: [{ name: "blinky.v", language: "Verilog", content: VERILOG_STARTER, top: true }],
    activeSource: "blinky.v"
  };

  const loadedLibrary = loadProjectLibrary();
  let projectLibrary = loadedLibrary.projects;
  let project = projectLibrary.find(item => item.id === loadedLibrary.currentId) || projectLibrary[0];
  let activeOutput = "console";
  let errorCount = 0;
  let warningCount = 0;
  let lastErrors = [];
  let lastWarnings = [];
  let lastSynthesis = null;
  let synthesisWorker = null;
  let synthesisOutput = "";
  let fontSize = 11;
  let dialogSubmitAction = null;
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const editor = $("#codeEditor");
  const lineNumbers = $("#lineNumbers");

  function createProjectId() {
    return globalThis.crypto?.randomUUID ? crypto.randomUUID() : `project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function isValidProject(value) {
    return value && typeof value.name === "string" && Array.isArray(value.sources) && value.sources.length > 0 && value.sources.every(source => source && typeof source.name === "string" && typeof source.content === "string" && ["VHDL", "Verilog"].includes(source.language));
  }

  function loadProjectLibrary() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      const projects = Array.isArray(saved?.projects) ? saved.projects.filter(isValidProject) : isValidProject(saved) ? [saved] : [];
      if (projects.length) {
        projects.forEach(item => { if (!item.id) item.id = createProjectId(); });
        return { projects, currentId: saved.currentId || saved.id || projects[0].id };
      }
    } catch (error) {
      console.warn("Could not load the saved project", error);
    }
    return { projects: [structuredClone(DEFAULT_PROJECT)], currentId: DEFAULT_PROJECT.id };
  }

  function persistProject() {
    saveActiveSource();
    if (!project.id) project.id = createProjectId();
    projectLibrary = projectLibrary.filter(item => item.id !== project.id);
    projectLibrary.push(project);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ projects: projectLibrary, currentId: project.id }));
    $("#savedIndicator").innerHTML = '<span class="saved-dot"></span>Saved in this browser';
    $("#windowTitle").textContent = `${project.name} — ISE 14.7 Web Studio`;
    $("#consoleProject").textContent = project.name;
  }

  function saveActiveSource() {
    const source = getActiveSource();
    if (source) source.content = editor.value;
  }

  function getActiveSource() {
    return project.sources.find(source => source.name === project.activeSource) || project.sources[0];
  }

  function renderProject() {
    $("#projectNameHeading").textContent = project.name;
    $("#windowTitle").textContent = `${project.name} — ISE 14.7 Web Studio`;
    $("#consoleProject").textContent = project.name;
    $("#projectTarget").textContent = `${project.device} · Synthesis/Implementation`;
    $("#deviceLabel").textContent = `${project.family} · ${project.device.split("-")[0]}`;
    const list = $("#sourceList");
    list.replaceChildren();
    project.sources.forEach(source => {
      const row = document.createElement("button");
      row.className = `source-row${source.name === project.activeSource ? " selected" : ""}`;
      row.setAttribute("role", "treeitem");
      row.innerHTML = `<span class="source-disclosure">›</span><span class="source-file-icon ${source.language.toLowerCase()}">${source.language === "VHDL" ? "V" : source.language === "Verilog" ? "V" : "C"}</span><span>${escapeHtml(source.name)}</span><span class="source-type">${source.language}</span>`;
      row.addEventListener("click", () => activateSource(source.name));
      list.append(row);
    });
    const source = getActiveSource();
    if (!source) return;
    project.activeSource = source.name;
    $("#activeTabName").textContent = source.name;
    $("#breadcrumbFile").textContent = source.name;
    $("#processTarget").textContent = source.name.replace(/\.[^.]+$/, "");
    $("#languageBadge").textContent = source.language.toUpperCase();
    $("#statusLanguage").textContent = source.language.toUpperCase();
    editor.value = source.content;
    updateLineNumbers();
    updateCursor();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }

  function activateSource(name) {
    saveActiveSource();
    project.activeSource = name;
    const source = getActiveSource();
    editor.value = source.content;
    renderProject();
    persistProject();
  }

  function updateLineNumbers() {
    const lines = Math.max(1, editor.value.split("\n").length);
    lineNumbers.textContent = Array.from({ length: lines }, (_, index) => index + 1).join("\n");
    lineNumbers.scrollTop = editor.scrollTop;
  }

  function updateCursor() {
    const before = editor.value.slice(0, editor.selectionStart);
    const line = before.split("\n").length;
    const col = before.length - before.lastIndexOf("\n");
    $("#cursorPosition").textContent = `Ln ${line}, Col ${col}`;
  }

  function addConsoleLine(kind, message) {
    const line = document.createElement("div");
    line.className = "console-line";
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    const kindClass = kind === "ERROR" ? "error" : kind === "WARNING" ? "warn" : "";
    line.innerHTML = `<span class="console-time">${now}</span><span class="console-kind ${kindClass}">${kind}</span><span>${escapeHtml(message)}</span>`;
    $("#consoleContent").append(line);
    $("#consoleContent").scrollTop = $("#consoleContent").scrollHeight;
  }

  function switchOutput(panel) {
    activeOutput = panel;
    $$(".output-tab").forEach(tab => {
      const active = tab.dataset.output === panel;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    const consoleView = $("#consoleView");
    const empty = $("#emptyOutput");
    consoleView.hidden = panel !== "console";
    empty.hidden = panel === "console";
    if (panel === "errors") renderIssues(empty, lastErrors, "ERROR", "No errors to display.");
    if (panel === "warnings") renderIssues(empty, lastWarnings, "WARNING", "No warnings to display.");
    if (panel === "synthesis") renderSynthesisResults(empty);
  }

  function renderIssues(container, messages, label, emptyMessage) {
    container.replaceChildren();
    if (!messages.length) { container.textContent = emptyMessage; return; }
    messages.forEach(message => {
      const row = document.createElement("div");
      row.className = `issue-row ${label.toLowerCase()}`;
      const tag = document.createElement("span");
      tag.className = "issue-label";
      tag.textContent = label;
      const text = document.createElement("span");
      text.textContent = message;
      row.append(tag, text);
      container.append(row);
    });
  }

  function renderSynthesisResults(container) {
    container.replaceChildren();
    if (!lastSynthesis) {
      container.textContent = "No synthesis results yet. Run Synthesize Verilog for Xilinx on a Verilog project.";
      return;
    }

    const report = document.createElement("div");
    report.className = "synthesis-report";
    const heading = document.createElement("h3");
    heading.textContent = `Synthesis complete · ${lastSynthesis.projectName}`;
    const note = document.createElement("p");
    note.textContent = lastSynthesis.targetFamily
      ? `Top module ${lastSynthesis.topModule} · mapped to Xilinx ${lastSynthesis.targetFamily} cells for ${lastSynthesis.targetLabel}. This does not place the design or generate a bitstream.`
      : `Top module ${lastSynthesis.topModule} · generic Yosys netlist because the family is not mapped by this browser flow. No bitstream is generated.`;
    const stats = document.createElement("div");
    stats.className = "synthesis-stats";
    [
      ["Top module", lastSynthesis.topModule],
      [lastSynthesis.targetFamily ? "Mapped cells" : "Generic cells", String(lastSynthesis.cellCount)],
      ["Ports", String(lastSynthesis.portCount)],
      ["Wires", String(lastSynthesis.wireCount)]
    ].forEach(([label, value]) => {
      const card = document.createElement("div");
      card.className = "synthesis-stat";
      const valueNode = document.createElement("strong");
      valueNode.textContent = value;
      const labelNode = document.createElement("span");
      labelNode.textContent = label;
      card.append(valueNode, labelNode);
      stats.append(card);
    });
    const cellsHeading = document.createElement("h4");
    cellsHeading.textContent = "Cell types";
    const cellList = document.createElement("div");
    cellList.className = "synthesis-cell-list";
    const cells = Object.entries(lastSynthesis.cellTypes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    if (!cells.length) {
      cellList.textContent = "No cells were inferred for this design.";
    } else {
      cells.slice(0, 24).forEach(([type, count]) => {
        const row = document.createElement("div");
        row.className = "synthesis-cell-row";
        const typeNode = document.createElement("code");
        typeNode.textContent = type;
        const countNode = document.createElement("span");
        countNode.textContent = String(count);
        row.append(typeNode, countNode);
        cellList.append(row);
      });
    }
    const logNote = document.createElement("p");
    logNote.className = "synthesis-log-note";
    logNote.textContent = lastSynthesis.edif
      ? "The full tool output is in the Console tab. The EDIF and JSON files are available in the upper-right buttons."
      : "The full tool output is in the Console tab. Download the JSON netlist from the upper-right button.";
    report.append(heading, note, stats, cellsHeading, cellList, logNote);
    container.append(report);
  }

  function checkSource() {
    saveActiveSource();
    const source = getActiveSource();
    if (!source) return;
    const text = editor.value;
    const failures = [];
    const normalized = text.replace(/--[^\n]*|\/\/[^\n]*/g, "");
    const moduleFound = source.language === "VHDL"
      ? /\bentity\s+[a-z][\w]*\s+is\b/i.test(normalized)
      : /\bmodule\s+[a-z][\w]*/i.test(normalized);
    if (!text.trim()) failures.push("The source file is empty.");
    if (!moduleFound) failures.push(source.language === "VHDL" ? "No VHDL entity declaration was found." : "No Verilog module declaration was found.");
    const blockPairs = source.language === "VHDL"
      ? [
          ["if", (normalized.match(/\bif\b[^\n;]*\bthen\b/gi) || []).length, (normalized.match(/\bend\s+if\b/gi) || []).length],
          ["process", (normalized.match(/\bprocess\b/gi) || []).length - (normalized.match(/\bend\s+process\b/gi) || []).length, (normalized.match(/\bend\s+process\b/gi) || []).length],
          ["case", (normalized.match(/\bcase\b[^\n;]*\bis\b/gi) || []).length, (normalized.match(/\bend\s+case\b/gi) || []).length],
          ["loop", (normalized.match(/\bloop\b/gi) || []).length - (normalized.match(/\bend\s+loop\b/gi) || []).length, (normalized.match(/\bend\s+loop\b/gi) || []).length]
        ]
      : [
          ["module", (normalized.match(/\bmodule\b/gi) || []).length, (normalized.match(/\bendmodule\b/gi) || []).length],
          ["begin", (normalized.match(/\bbegin\b/gi) || []).length, (normalized.match(/\bend\b/gi) || []).length],
          ["case", (normalized.match(/\bcase(?:z|x)?\b/gi) || []).length, (normalized.match(/\bendcase\b/gi) || []).length]
        ];
    blockPairs.forEach(([block, opening, closing]) => {
      if (opening !== closing) failures.push(`The source has ${opening} ${block} block start(s) and ${closing} matching end(s).`);
    });
    const delimiterPairs = [["(", ")"], ["[", "]"]];
    delimiterPairs.forEach(([left, right]) => {
      const leftCount = (normalized.match(new RegExp(`\\${left}`, "g")) || []).length;
      const rightCount = (normalized.match(new RegExp(`\\${right}`, "g")) || []).length;
      if (leftCount !== rightCount) failures.push(`Unbalanced ${left}${right} delimiters (${leftCount} opening, ${rightCount} closing).`);
    });
    lastErrors = failures;
    lastWarnings = [];
    errorCount = failures.length;
    $("#errorCount").textContent = errorCount;
    $("#warningCount").textContent = warningCount;
    addConsoleLine("INFO", `Starting browser structure check for ${source.name}.`);
    addConsoleLine("INFO", "This check looks for basic declarations and balanced blocks; it is not XST or ISE synthesis.");
    if (failures.length) {
      failures.forEach(message => addConsoleLine("ERROR", message));
      addConsoleLine("ERROR", `Structure check finished with ${failures.length} issue${failures.length === 1 ? "" : "s"}.`);
      switchOutput("errors");
      addConsoleLine("INFO", "Open the Errors tab to review the findings.");
    } else {
      addConsoleLine("SUCCESS", "Basic source structure looks balanced.");
      addConsoleLine("INFO", "Use AMD/Xilinx ISE or a compatible HDL toolchain for actual synthesis and implementation.");
      switchOutput("console");
    }
    persistProject();
  }

  function showDialog(title, content, submitLabel, action) {
    $("#dialogTitle").textContent = title;
    $("#dialogContent").innerHTML = content;
    $("#dialogSubmit").textContent = submitLabel;
    dialogSubmitAction = action;
    $("#dialogBackdrop").hidden = false;
    const input = $("#dialogContent input");
    if (input) { input.focus(); input.select(); }
  }

  function closeDialog() {
    $("#dialogBackdrop").hidden = true;
    dialogSubmitAction = null;
  }

  function showNewProjectDialog() {
    showDialog("New Project", `<p class="dialog-copy">Create an ISE-style FPGA project in this browser. Your project and HDL sources are stored in local browser storage.</p><label class="field">Project name<input name="projectName" value="my_fpga_project" required maxlength="48" pattern="[A-Za-z][A-Za-z0-9_]*" /><span class="field-hint">Start with a letter, then use letters, numbers, and underscores.</span></label><label class="field">Device family<select name="family"><option>Spartan-6</option><option>Spartan-3</option><option>Virtex-6</option><option>Artix-7</option></select></label><label class="field">Device<input name="device" value="xc6slx9-2-tqg144" required /></label><label class="field">Initial source language<select name="language"><option>VHDL</option><option selected>Verilog</option></select></label>`, "Create Project", form => {
      const data = new FormData(form);
      const language = data.get("language");
      const name = String(data.get("projectName")).trim();
      persistProject();
      project = { id: createProjectId(), name, family: String(data.get("family")), device: String(data.get("device")).trim(), sources: [{ name: `${name}_top.${language === "VHDL" ? "vhd" : "v"}`, language, content: language === "VHDL" ? VHDL_STARTER.replaceAll("blinky", `${name}_top`) : VERILOG_STARTER.replaceAll("blinky", `${name}_top`), top: true }], activeSource: `${name}_top.${language === "VHDL" ? "vhd" : "v"}` };
      projectLibrary.push(project);
      renderProject(); persistProject();
      $("#consoleContent").replaceChildren();
      addConsoleLine("INFO", `Project ${name} created in browser storage.`);
      addConsoleLine("INFO", "Add or edit HDL sources. Device implementation requires a compatible toolchain.");
      closeDialog();
    });
  }

  function showAddSourceDialog() {
    const current = getActiveSource();
    showDialog("Add Source", `<p class="dialog-copy">Add an HDL source file to <strong>${escapeHtml(project.name)}</strong>.</p><label class="field">File name<input name="fileName" value="module_${project.sources.length}.${current?.language === "Verilog" ? "v" : "vhd"}" required maxlength="64" /></label><label class="field">Language<select name="language"><option ${current?.language === "VHDL" ? "selected" : ""}>VHDL</option><option ${current?.language === "Verilog" ? "selected" : ""}>Verilog</option></select></label><span class="field-hint">Files stay in this browser until you export or host the app.</span>`, "Add Source", form => {
      const data = new FormData(form);
      let name = String(data.get("fileName")).trim();
      const language = String(data.get("language"));
      $("#dialogContent input").setCustomValidity("");
      if (!/\.[A-Za-z0-9]+$/.test(name)) name += language === "VHDL" ? ".vhd" : ".v";
      if (project.sources.some(source => source.name.toLowerCase() === name.toLowerCase())) {
        $("#dialogContent input").setCustomValidity("A source file with this name already exists.");
        $("#dialogContent input").reportValidity();
        return;
      }
      saveActiveSource();
      project.sources.push({ name, language, content: language === "VHDL" ? VHDL_STARTER : VERILOG_STARTER, top: false });
      project.activeSource = name;
      renderProject(); persistProject();
      addConsoleLine("INFO", `Added source ${name}.`);
      closeDialog();
    });
    const languageField = $("#dialogContent select[name=language]");
    languageField.addEventListener("change", () => {
      const fileField = $("#dialogContent input[name=fileName]");
      fileField.setCustomValidity("");
      fileField.value = fileField.value.replace(/\.[^.]+$/, languageField.value === "VHDL" ? ".vhd" : ".v");
    });
  }

  function exportProject() {
    persistProject();
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.name}.iseweb.json`;
    link.click();
    URL.revokeObjectURL(url);
    addConsoleLine("INFO", `Exported ${project.name} as a portable JSON project file.`);
  }

  function exportActiveSource() {
    saveActiveSource();
    const source = getActiveSource();
    if (!source) return;
    const blob = new Blob([source.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = source.name;
    link.click();
    URL.revokeObjectURL(url);
    persistProject();
    addConsoleLine("INFO", `Downloaded source file ${source.name}.`);
  }

  function importHdlSources() {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".v,.vh,.sv,.vhd,.vhdl,text/plain";
    input.addEventListener("change", async () => {
      const files = [...(input.files || [])];
      if (!files.length) return;
      const supported = files.filter(file => /\.(v|vh|sv|vhd|vhdl)$/i.test(file.name));
      const totalBytes = supported.reduce((total, file) => total + file.size, 0);
      if (!supported.length) {
        addConsoleLine("ERROR", "Choose Verilog (.v, .vh, .sv) or VHDL (.vhd, .vhdl) source files.");
        switchOutput("console");
        return;
      }
      if (totalBytes > 2 * 1024 * 1024) {
        addConsoleLine("ERROR", "The selected HDL files exceed the 2 MB import limit for browser storage.");
        switchOutput("console");
        return;
      }

      saveActiveSource();
      let added = 0;
      let skipped = 0;
      for (const file of supported) {
        const name = file.name.replace(/[\\/]/g, "_");
        if (project.sources.some(source => source.name.toLowerCase() === name.toLowerCase())) {
          skipped += 1;
          continue;
        }
        const language = /\.(v|vh|sv)$/i.test(name) ? "Verilog" : "VHDL";
        project.sources.push({ name, language, content: await file.text(), top: false });
        if (added === 0) project.activeSource = name;
        added += 1;
      }
      if (added) {
        renderProject();
        try {
          persistProject();
          addConsoleLine("SUCCESS", `Imported ${added} HDL source file${added === 1 ? "" : "s"} into ${project.name}.`);
        } catch (error) {
          addConsoleLine("ERROR", `Files were opened, but the browser could not save this project: ${error.message}`);
        }
      }
      if (skipped) addConsoleLine("WARNING", `${skipped} file${skipped === 1 ? " was" : "s were"} skipped because the project already has a file with that name.`);
      if (!added && !skipped) addConsoleLine("ERROR", "No supported HDL files were imported.");
      switchOutput("console");
    });
    input.click();
  }

  function importProject() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        if (file.size > 5 * 1024 * 1024) throw new Error("Project file is larger than the 5 MB browser import limit.");
        const imported = JSON.parse(await file.text());
        const valid = imported && typeof imported.name === "string" && Array.isArray(imported.sources) && imported.sources.length > 0 && imported.sources.every(source => source && typeof source.name === "string" && typeof source.content === "string" && ["VHDL", "Verilog"].includes(source.language));
        if (!valid) throw new Error("This file does not have a supported ISE Web Studio project structure.");
        persistProject();
        project = { ...imported, id: createProjectId(), family: String(imported.family || "Spartan-6"), device: String(imported.device || "xc6slx9-2-tqg144"), activeSource: imported.sources.some(source => source.name === imported.activeSource) ? imported.activeSource : imported.sources[0].name };
        projectLibrary.push(project);
        renderProject();
        persistProject();
        addConsoleLine("SUCCESS", `Imported project ${project.name}.`);
      } catch (error) {
        addConsoleLine("ERROR", `Import failed: ${error.message}`);
      }
      switchOutput("console");
    });
    input.click();
  }

  function stripVerilogComments(text) {
    return String(text).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  }

  function findDeclaredVerilogModules(sources) {
    const modules = [];
    sources.forEach(source => {
      const text = stripVerilogComments(source.content);
      const pattern = /\bmodule\s+(?:(?:automatic|static)\s+)?([A-Za-z_$][\w$]*)/g;
      for (const match of text.matchAll(pattern)) {
        if (!modules.some(module => module.name === match[1])) modules.push({ name: match[1], source });
      }
    });
    return modules;
  }

  function findTopVerilogModules(sources) {
    const modules = findDeclaredVerilogModules(sources);
    const allSourceText = sources.map(source => stripVerilogComments(source.content)).join("\n");
    const instantiated = new Set();
    modules.forEach(({ name }) => {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`\\b${escapedName}\\b\\s+(?:#\\s*\\([\\s\\S]*?\\)\\s*)?[A-Za-z_$][\\w$]*\\s*\\(`);
      if (pattern.test(allSourceText)) instantiated.add(name);
    });
    const roots = modules.filter(module => !instantiated.has(module.name));
    return roots.length ? roots : modules;
  }

  function runSynthesisProcess() {
    const sources = project.sources.filter(source => source.language === "Verilog");
    if (!sources.length) {
      addConsoleLine("WARNING", "The browser synthesis engine currently accepts Verilog/SystemVerilog sources. Add or import a Verilog source to run it.");
      switchOutput("console");
      return;
    }
    const declaredModules = findDeclaredVerilogModules(sources);
    const inferredTops = findTopVerilogModules(sources);
    if (!declaredModules.length) {
      addConsoleLine("ERROR", "No Verilog module declaration was found in the project sources.");
      switchOutput("console");
      return;
    }
    const preferredSource = sources.find(source => source.top);
    const preferredModule = preferredSource && declaredModules.find(module => module.source === preferredSource);
    if (preferredModule || declaredModules.length === 1) {
      startYosysSynthesis((preferredModule || declaredModules[0]).name, sources);
      return;
    }

    const defaultTop = inferredTops[0]?.name;
    const options = declaredModules.map(module => `<option value="${escapeHtml(module.name)}" ${module.name === defaultTop ? "selected" : ""}>${escapeHtml(module.name)}</option>`).join("");
    showDialog("Choose Top Module", `<p class="dialog-copy">More than one top-level Verilog module was found. Choose the design entry point for synthesis.</p><label class="field">Top module<select name="topModule">${options}</select></label>`, "Synthesize", form => {
      const topModule = String(new FormData(form).get("topModule"));
      closeDialog();
      startYosysSynthesis(topModule, sources);
    });
  }

  function appendToolLog(output) {
    const lines = String(output || "").replace(/\r/g, "").replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "").split("\n").filter(line => line.trim());
    const visibleLines = lines.slice(-60);
    if (lines.length > visibleLines.length) addConsoleLine("INFO", `Earlier synthesis output omitted from the visible log (${lines.length - visibleLines.length} lines).`);
    visibleLines.forEach(line => addConsoleLine("YOSYS", line));
  }

  function summarizeNetlist(netlistText, topModule, projectName, targetLabel, targetFamily, edif) {
    const netlist = JSON.parse(netlistText);
    const module = netlist.modules?.[topModule];
    if (!module) throw new Error(`The JSON netlist does not contain the selected top module “${topModule}”.`);
    const cells = Object.values(module.cells || {});
    const cellTypes = {};
    cells.forEach(cell => { cellTypes[cell.type] = (cellTypes[cell.type] || 0) + 1; });
    return {
      projectName,
      topModule,
      targetLabel,
      targetFamily: targetFamily || null,
      edif: edif || null,
      netlist: netlistText,
      cellCount: cells.length,
      portCount: Object.keys(module.ports || {}).length,
      wireCount: Object.keys(module.netnames || {}).length,
      cellTypes
    };
  }

  function startYosysSynthesis(topModule, sources) {
    if (synthesisWorker) return;
    saveActiveSource();
    try { persistProject(); } catch (error) { addConsoleLine("WARNING", `Project save failed before synthesis: ${error.message}`); }
    const sourceSnapshot = sources.map(source => ({ name: source.name, content: source.content }));
    const projectName = project.name;
    const targetLabel = `${project.family} · ${project.device}`;
    const familyKey = project.family.toLowerCase().replace(/[^a-z0-9]/g, "");
    const familyMap = { "spartan6": "xc6s", "spartan3": "xc3s", "virtex6": "xc6v", "artix7": "xc7" };
    const targetFamily = familyMap[familyKey] || null;
    synthesisOutput = "";
    lastSynthesis = null;
    $("#downloadEdif").hidden = true;
    $("#downloadNetlist").hidden = true;
    $("#synthesizeButton").disabled = true;
    $$(".process-item[data-action=synthesize]").forEach(button => { button.disabled = true; });
    switchOutput("console");
    addConsoleLine("INFO", `Starting browser synthesis for ${projectName}, top module ${topModule}.`);
    addConsoleLine("INFO", targetFamily
      ? `Yosys will map the design to the ${targetFamily} Xilinx family. The first run downloads its WebAssembly engine from jsDelivr.`
      : "Yosys will create a generic logic netlist because this project family is not mapped by the browser flow.");

    try {
      synthesisWorker = new Worker(new URL("synth-worker.js", document.baseURI), { type: "module" });
    } catch (error) {
      finishSynthesisWorker();
      addConsoleLine("ERROR", `Could not start the synthesis worker: ${error.message}`);
      switchOutput("errors");
      return;
    }

    synthesisWorker.onmessage = event => {
      const result = event.data;
      if (result.type === "output") synthesisOutput += result.text;
      if (result.type === "status") $("#footerMessage").textContent = result.message;
      if (result.type === "progress") {
        const percent = result.totalLength ? Math.min(100, Math.round(result.doneLength * 100 / result.totalLength)) : 0;
        $("#footerMessage").textContent = percent ? `Downloading Yosys: ${percent}%` : "Downloading Yosys engine…";
      }
      if (result.type === "done") {
        finishSynthesisWorker();
        appendToolLog(synthesisOutput);
        try {
          lastSynthesis = summarizeNetlist(result.netlist, topModule, projectName, targetLabel, targetFamily, result.edif);
          lastErrors = [];
          $("#errorCount").textContent = "0";
          $("#downloadNetlist").hidden = false;
          $("#downloadEdif").hidden = !lastSynthesis.edif;
          addConsoleLine("SUCCESS", `Synthesis finished: ${lastSynthesis.cellCount} cell(s), ${lastSynthesis.portCount} port(s).`);
          addConsoleLine("WARNING", "The netlist is not place-and-route output and cannot be loaded as an FPGA programming file.");
          switchOutput("synthesis");
        } catch (error) {
          lastErrors = [error.message];
          $("#errorCount").textContent = "1";
          addConsoleLine("ERROR", `Could not read the synthesis result: ${error.message}`);
          switchOutput("errors");
        }
      }
      if (result.type === "error") {
        finishSynthesisWorker();
        appendToolLog(synthesisOutput);
        lastErrors = [result.message || "Yosys synthesis failed."];
        $("#errorCount").textContent = String(lastErrors.length);
        addConsoleLine("ERROR", lastErrors[0]);
        switchOutput("errors");
      }
    };
    synthesisWorker.onerror = event => {
      finishSynthesisWorker();
      lastErrors = [event.message || "The synthesis worker stopped unexpectedly."];
      $("#errorCount").textContent = String(lastErrors.length);
      addConsoleLine("ERROR", lastErrors[0]);
      switchOutput("errors");
    };
    synthesisWorker.postMessage({ topModule, sources: sourceSnapshot, targetFamily });
  }

  function finishSynthesisWorker() {
    if (synthesisWorker) synthesisWorker.terminate();
    synthesisWorker = null;
    $("#synthesizeButton").disabled = false;
    $$(".process-item[data-action=synthesize]").forEach(button => { button.disabled = false; });
    $("#footerMessage").textContent = "ISE 14.7 style workspace · Local browser storage";
  }

  function downloadNetlist() {
    if (!lastSynthesis) return;
    const blob = new Blob([lastSynthesis.netlist], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${lastSynthesis.topModule}.yosys.json`;
    link.click();
    URL.revokeObjectURL(url);
    addConsoleLine("INFO", `Downloaded the Yosys JSON netlist for ${lastSynthesis.topModule}.`);
  }

  function downloadEdif() {
    if (!lastSynthesis?.edif) return;
    const blob = new Blob([lastSynthesis.edif], { type: "application/edif;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${lastSynthesis.topModule}.edif`;
    link.click();
    URL.revokeObjectURL(url);
    addConsoleLine("INFO", `Downloaded the Xilinx-family EDIF netlist for ${lastSynthesis.topModule}.`);
  }

  function runProcess(action) {
    if (action === "check") return checkSource();
    if (action === "synthesize") return runSynthesisProcess();
    if (action === "source") {
      addConsoleLine("INFO", `Showing ${project.activeSource} in the editor.`);
      switchOutput("console");
      return;
    }
    addConsoleLine("INFO", `${action} is an ISE workflow stage. Connect an AMD/Xilinx or compatible HDL toolchain to run this stage.`);
    switchOutput("console");
  }

  function showOpenProjectDialog() {
    const options = projectLibrary.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === project.id ? "selected" : ""}>${escapeHtml(item.name)} — ${escapeHtml(item.device || "device not set")}</option>`).join("");
    showDialog("Open Project", `<p class="dialog-copy">Choose a project saved in this browser.</p><label class="field">Project<select name="projectId">${options}</select></label>`, "Open", form => {
      const data = new FormData(form);
      const selected = projectLibrary.find(item => item.id === data.get("projectId"));
      if (!selected) return;
      persistProject();
      project = selected;
      renderProject();
      persistProject();
      closeDialog();
      addConsoleLine("INFO", `Opened project ${project.name}.`);
    });
  }

  function showMenu(name, button) {
    const actions = {
      File: [["New Project", showNewProjectDialog], ["Open Project…", showOpenProjectDialog], ["Add Source…", showAddSourceDialog], ["Import HDL File(s)…", importHdlSources], ["Save", () => { persistProject(); addConsoleLine("INFO", "Project saved in this browser."); }], ["Download Current Source…", exportActiveSource], ["Export Project…", exportProject], ["Import Project…", importProject], ["Project Library…", showOpenProjectDialog]],
      Edit: [["Undo", () => document.execCommand("undo")], ["Redo", () => document.execCommand("redo")], ["Select All", () => editor.select()]],
      Project: [["Check Source Structure", checkSource], ["Synthesize Verilog for Xilinx", () => runProcess("synthesize")], ["Implement Design", () => runProcess("Implement Design")], ["Generate Programming File", () => runProcess("Generate Programming File")]],
      View: [["Design", () => activatePanel("design")], ["Files", () => activatePanel("files")], ["Console", () => switchOutput("console")], ["Synthesis Results", () => switchOutput("synthesis")]],
      Tools: [["Check Source Structure", checkSource], ["Device and project settings", () => showProjectSettings()]],
      Window: [["Source Editor", () => editor.focus()], ["Console", () => switchOutput("console")]],
      Help: [["About this prototype", () => { addConsoleLine("INFO", "ISE 14.7 inspired browser workspace. Yosys provides open-source Xilinx-family Verilog synthesis; proprietary AMD/Xilinx tools are not bundled."); switchOutput("console"); }], ["Getting started", () => { addConsoleLine("INFO", "Import or edit Verilog sources, then run Synthesize Verilog for Xilinx. VHDL can be edited and checked, but is not handled by the current synthesis engine."); switchOutput("console"); }]]
    };
    const popup = $("#menuPopup");
    if (!popup.hidden && popup.dataset.menu === name) { popup.hidden = true; button.classList.remove("open"); return; }
    $$(".menubar>button").forEach(item => item.classList.remove("open"));
    popup.replaceChildren();
    (actions[name] || []).forEach(([label, callback], index) => {
      if (name === "File" && (index === 4 || index === 8) || name === "Project" && index === 1) {
        const divider = document.createElement("div"); divider.className = "menu-divider"; popup.append(divider);
      }
      const item = document.createElement("button"); item.textContent = label; item.addEventListener("click", () => { popup.hidden = true; button.classList.remove("open"); callback(); }); popup.append(item);
    });
    const rect = button.getBoundingClientRect();
    popup.style.left = `${Math.max(7, rect.left)}px`;
    popup.dataset.menu = name;
    popup.hidden = false;
    button.classList.add("open");
  }

  function activatePanel(panel) {
    $$(".panel-tab").forEach(tab => {
      const active = tab.dataset.panel === panel;
      tab.classList.toggle("active", active); tab.setAttribute("aria-selected", String(active));
    });
    $(".navigator-status").innerHTML = `<span class="status-led"></span>${panel[0].toUpperCase()}${panel.slice(1)} view`;
    if (panel === "files") addConsoleLine("INFO", "Files view: project sources are listed in the navigator.");
    if (panel === "libraries") addConsoleLine("INFO", "Libraries view is a visual placeholder in this browser prototype.");
  }

  function showProjectSettings() {
    showDialog("Project Settings", `<p class="dialog-copy">Review the device attached to this browser project.</p><label class="field">Project name<input name="projectName" value="${escapeHtml(project.name)}" required /></label><label class="field">Device family<input name="family" value="${escapeHtml(project.family)}" required /></label><label class="field">Device<input name="device" value="${escapeHtml(project.device)}" required /></label>`, "Apply", form => {
      const data = new FormData(form); project.name = String(data.get("projectName")).trim(); project.family = String(data.get("family")).trim(); project.device = String(data.get("device")).trim(); renderProject(); persistProject(); closeDialog();
    });
  }

  editor.addEventListener("input", () => { updateLineNumbers(); updateCursor(); $("#savedIndicator").innerHTML = '<span class="saved-dot" style="background:#d6a94d"></span>Unsaved changes'; });
  editor.addEventListener("click", updateCursor);
  editor.addEventListener("keyup", updateCursor);
  editor.addEventListener("scroll", () => { lineNumbers.scrollTop = editor.scrollTop; });
  editor.addEventListener("keydown", event => {
    if (event.key === "Tab") {
      event.preventDefault();
      const start = editor.selectionStart, end = editor.selectionEnd;
      editor.setRangeText("  ", start, end, "end");
      updateLineNumbers(); updateCursor();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") { event.preventDefault(); persistProject(); addConsoleLine("INFO", "Project saved in this browser."); }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); checkSource(); }
  });
  $("#newProjectButton").addEventListener("click", showNewProjectDialog);
  $("#addSourceButton").addEventListener("click", showAddSourceDialog);
  $("#importHdlButton").addEventListener("click", importHdlSources);
  $("#addSourceSmall").addEventListener("click", showAddSourceDialog);
  $("#saveButton").addEventListener("click", () => { persistProject(); addConsoleLine("INFO", "Project saved in this browser."); });
  $("#checkButton").addEventListener("click", checkSource);
  $("#synthesizeButton").addEventListener("click", runSynthesisProcess);
  $("#fontDown").addEventListener("click", () => { fontSize = Math.max(9, fontSize - 1); editor.style.fontSize = `${fontSize}px`; lineNumbers.style.fontSize = `${fontSize}px`; });
  $("#fontUp").addEventListener("click", () => { fontSize = Math.min(18, fontSize + 1); editor.style.fontSize = `${fontSize}px`; lineNumbers.style.fontSize = `${fontSize}px`; });
  $("#clearConsole").addEventListener("click", () => $("#consoleContent").replaceChildren());
  $("#downloadNetlist").addEventListener("click", downloadNetlist);
  $("#downloadEdif").addEventListener("click", downloadEdif);
  $$(".panel-tab").forEach(tab => tab.addEventListener("click", () => activatePanel(tab.dataset.panel)));
  $$(".output-tab").forEach(tab => tab.addEventListener("click", () => switchOutput(tab.dataset.output)));
  $$(".process-item").forEach(item => item.addEventListener("click", () => runProcess(item.dataset.action)));
  $$(".menubar>button").forEach(button => button.addEventListener("click", () => showMenu(button.dataset.menu, button)));
  $("#dialogClose").addEventListener("click", closeDialog);
  $("#dialogCancel").addEventListener("click", closeDialog);
  $("#dialogBackdrop").addEventListener("click", event => { if (event.target === $("#dialogBackdrop")) closeDialog(); });
  $("#dialogForm").addEventListener("submit", event => { event.preventDefault(); if ($("#dialogForm").reportValidity() && dialogSubmitAction) dialogSubmitAction(event.currentTarget); });
  document.addEventListener("click", event => {
    if (!event.target.closest(".menubar")) { $("#menuPopup").hidden = true; $$(".menubar>button").forEach(button => button.classList.remove("open")); }
  });

  renderProject();
  if (!$("#consoleContent").children.length) {
    addConsoleLine("INFO", "ISE 14.7 inspired workspace ready.");
    addConsoleLine("INFO", "Project data is saved locally in this browser.");
    addConsoleLine("INFO", "Verilog/SystemVerilog can be synthesized to supported Xilinx-family cells; VHDL can be edited and checked.");
    addConsoleLine("INFO", "Yosys maps supported device families and can export EDIF; it does not create a Xilinx bitstream. Import HDL from the toolbar or File menu.");
  }
})();
