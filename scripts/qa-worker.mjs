import { unstable_startWorker } from "wrangler";

const [config, persist, portText, registry] = process.argv.slice(2);
const port = Number(portText);
if (!config || !persist || !registry || !Number.isInteger(port) || port < 1 || port > 65535) {
  process.stderr.write("[QA_WORKER_START_FAILED] INVALID_ARGUMENTS\n");
  process.exitCode = 2;
} else {
  let worker;
  let signalResolve;
  const shutdownSignal = new Promise(resolve => { signalResolve = resolve; });
  process.once("SIGINT", signalResolve);
  process.once("SIGTERM", signalResolve);
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
    worker.raw.on("reloadStart", () => { reloadInProgress = true; lastReloadAt = Date.now(); });
    worker.raw.on("reloadComplete", () => { reloadInProgress = false; lastReloadAt = Date.now(); });
    await Promise.all([worker.ready, worker.url]);
    lastReloadAt = Date.now();
    while (Date.now() < deadline) {
      if (!reloadInProgress && Date.now() - lastReloadAt >= 1500) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (reloadInProgress || Date.now() >= deadline) throw new Error("QA worker did not stabilize before deadline");
    process.stdout.write("[QA_WORKER_READY]\n");
    await shutdownSignal;
    await worker.dispose();
  } catch {
    process.stderr.write("[QA_WORKER_START_FAILED] START_OR_RUNTIME_ERROR\n");
    try { await worker?.dispose(); } catch { /* only dispose this worker */ }
    process.exitCode = 1;
  }
}
