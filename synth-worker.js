const YOSYS_URL = "https://cdn.jsdelivr.net/npm/@yowasp/yosys@0.70.62-dev.1236/gen/bundle.js";

self.onmessage = async event => {
  const { sources, topModule, targetFamily } = event.data;
  const decoder = new TextDecoder("utf-8");
  let output = "";

  const forwardOutput = bytes => {
    if (bytes === null) {
      const tail = decoder.decode();
      if (tail) {
        output += tail;
        self.postMessage({ type: "output", text: tail });
      }
      return;
    }
    const text = decoder.decode(bytes, { stream: true });
    if (text) {
      output += text;
      self.postMessage({ type: "output", text });
    }
  };

  try {
    if (!Array.isArray(sources) || sources.length === 0) throw new Error("There are no Verilog source files to synthesize.");
    if (!/^[A-Za-z_][A-Za-z0-9_$]*$/.test(topModule || "")) throw new Error("The selected top module name is not a valid Verilog identifier.");

    self.postMessage({ type: "status", message: "Loading the browser synthesis engine…" });
    const { runYosys } = await import(YOSYS_URL);

    const filesIn = {};
    const inputNames = sources.map((source, index) => {
      const safeName = String(source.name || `source_${index}.v`).replace(/[\\/\r\n]/g, "_");
      const name = safeName || `source_${index}.v`;
      filesIn[name] = String(source.content || "");
      return `"${name.replace(/\\/g, "\\\\").replace(/"/g, "\\\"")}"`;
    });
    const supportedFamilies = new Set(["xc7", "xc6s", "xc6v", "xc3s"]);
    const xilinxFamily = supportedFamilies.has(targetFamily) ? targetFamily : null;
    const script = [
      `read_verilog -sv ${inputNames.join(" ")}`,
      `hierarchy -check -top ${topModule}`,
      xilinxFamily
        ? `synth_xilinx -family ${xilinxFamily} -top ${topModule} -ise -edif ise-netlist.edif -json ise-netlist.json`
        : `synth -top ${topModule}; stat; write_json ise-netlist.json`
    ].join("; ");
    self.postMessage({ type: "status", message: xilinxFamily ? `Mapping for Xilinx ${xilinxFamily}…` : "Running generic Yosys synthesis…" });
    const filesOut = await runYosys(["-p", script], filesIn, {
      stdout: forwardOutput,
      stderr: forwardOutput,
      decodeASCII: true,
      fetchProgress: ({ totalLength, doneLength }) => {
        self.postMessage({ type: "progress", totalLength, doneLength });
      }
    });
    if (typeof filesOut["ise-netlist.json"] !== "string") throw new Error("Yosys finished without producing a readable JSON netlist.");
    if (xilinxFamily && typeof filesOut["ise-netlist.edif"] !== "string") throw new Error("Yosys did not produce the requested ISE-compatible EDIF netlist.");
    self.postMessage({
      type: "done",
      netlist: filesOut["ise-netlist.json"],
      edif: typeof filesOut["ise-netlist.edif"] === "string" ? filesOut["ise-netlist.edif"] : null,
      targetFamily: xilinxFamily,
      output
    });
  } catch (error) {
    const tail = decoder.decode();
    if (tail) {
      output += tail;
      self.postMessage({ type: "output", text: tail });
    }
    self.postMessage({ type: "error", message: error?.message || String(error), output });
  }
};
