import { unstable_startWorker } from "wrangler";
import { appendFileSync } from "node:fs";
import path from "node:path";

const [config, persist, portText, registry] = process.argv.slice(2);
const port = Number(portText);
if (!config || !persist || !registry || !Number.isInteger(port) || port < 1 || port > 65535) {
  process.stderr.write("[QA_WORKER_START_FAILED] INVALID_ARGUMENTS\n");
  process.exitCode = 2;
} else {
  let worker;
  const eventsPath = path.join(path.dirname(registry), "worker-events.jsonl");
  const startedAt = Date.now();
  const record = (type, details = {}) => {
    try { appendFileSync(eventsPath, `${JSON.stringify({ at: new Date().toISOString(), elapsedMs: Date.now() - startedAt, type, ...details })}\n`, { mode: 0o600 }); } catch { /* diagnostics must not affect the worker */ }
  };
  let signalResolve;
  const shutdownSignal = new Promise(resolve => { signalResolve = resolve; });
  process.once("SIGINT", signalResolve);
  process.once("SIGTERM", signalResolve);
  process.stdin.setEncoding("utf8");
  let commandBuffer = "";
  process.stdin.on("data", chunk => {
    commandBuffer = (commandBuffer + chunk).slice(-128);
    const commands = commandBuffer.split(/\r?\n/u);
    commandBuffer = commands.pop() ?? "";
    if (commands.includes("STOP")) signalResolve();
  });
  try {
    const deadline = Date.now() + 90_000;
    worker = await unstable_startWorker({
      config,
      dev: {
        watch: false,
        remote: false,
        persist,
        server: { hostname: "127.0.0.1", port },
        inspector: false,
        registry,
      },
    });
    let reloadInProgress = false;
    let lastReloadAt = Date.now();
    for (const event of ["bundleStart", "bundleComplete", "reloadStart", "reloadComplete"]) {
      worker.raw.on(event, () => {
        if (event === "reloadStart") reloadInProgress = true;
        if (event === "reloadComplete") reloadInProgress = false;
        lastReloadAt = Date.now();
        record(event);
      });
    }
    worker.raw.on("error", event => {
      const source = ["ConfigController", "BundlerController", "LocalRuntimeController", "RemoteRuntimeController", "ProxyWorker", "InspectorProxyWorker", "MultiworkerRuntimeController", "ProxyController"].includes(event?.source) ? event.source : "OTHER";
      const reason = ["restart", "reload", "error", "exception"].find(value => String(event?.reason ?? "").toLowerCase().includes(value)) ?? "OTHER";
      record("error", { source, reason });
    });
    await Promise.all([worker.ready, worker.url]);
    lastReloadAt = Date.now();
    while (Date.now() < deadline) {
      if (!reloadInProgress && Date.now() - lastReloadAt >= 1500) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (reloadInProgress || Date.now() >= deadline) throw new Error("QA worker did not stabilize before deadline");
    process.stdout.write("[QA_WORKER_READY]\n");
    record("ready");
    await shutdownSignal;
    await worker.dispose();
  } catch {
    process.stderr.write("[QA_WORKER_START_FAILED] START_OR_RUNTIME_ERROR\n");
    try { await worker?.dispose(); } catch { /* only dispose this worker */ }
    process.exitCode = 1;
  }
}
