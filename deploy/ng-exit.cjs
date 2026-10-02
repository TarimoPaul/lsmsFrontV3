// Preloaded by deploy/Dockerfile (NODE_OPTIONS=--require) for the `ng build` step.
//
// With @angular/build 21.2.24 + esbuild 0.28.1 a finished `ng build` never exits:
// the esbuild service child process stays referenced after the bundle is written,
// so a docker build would hang forever. The Angular CLI sets `process.exitCode`
// only once its command has fully completed — that is the signal used here to
// exit with the CLI's own result (0 = ok, non-zero = build/budget error).
const { isMainThread } = require('node:worker_threads');

if (isMainThread) {
  const timer = setInterval(() => {
    if (process.exitCode === undefined) return;
    clearInterval(timer);
    // Short grace so stdout/stderr are flushed.
    setTimeout(() => process.exit(process.exitCode), 1000);
  }, 500);
  timer.unref();
}
