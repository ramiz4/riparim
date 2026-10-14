import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

for (const mode of [
  "success",
  "failure",
  "concurrent-failure",
  "cleanup-failure",
  "dispose-failure",
]) {
  const result = await new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        fileURLToPath(
          new URL("./fixtures/worker-runtime.mjs", import.meta.url),
        ),
        mode,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let stdout = "",
      stderr = "",
      assertionsAt,
      timeoutReason;
    let timer = setTimeout(() => {
      timeoutReason =
        "Worker fixture did not finish its assertions within 20 seconds";
      child.kill("SIGKILL");
    }, 20000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      if (!assertionsAt && stdout.includes("Assertions finished")) {
        assertionsAt = performance.now();
        clearTimeout(timer);
        timer = setTimeout(() => {
          timeoutReason =
            "Worker did not clean up and exit within five seconds after its assertions";
          child.kill("SIGKILL");
        }, 5000);
      }
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        code,
        signal,
        stdout,
        stderr,
        timeoutReason,
        cleanupMs: performance.now() - assertionsAt,
      });
    });
  });
  assert.equal(
    result.timeoutReason,
    undefined,
    `${mode}: ${result.timeoutReason}\n${result.stdout}\n${result.stderr}`,
  );
  assert.equal(result.signal, null);
  assert.equal(result.code, mode === "success" ? 0 : 1, result.stderr);
  assert(result.cleanupMs < 5000);
  if (mode === "success") assert(result.stdout.includes("Cleanup finished"));
  else {
    assert.match(
      result.stderr,
      /AssertionError.*intentional lifecycle assertion failure/s,
      "cleanup preserves the original assertion failure and nonzero exit",
    );
    assert(result.stdout.includes("Original assertion retained"));
  }
  if (mode === "dispose-failure")
    assert(result.stdout.includes("Dispose failure retained"));
  if (mode === "cleanup-failure")
    assert(result.stdout.includes("Body cleanup failure retained"));
  console.log(
    `Worker ${mode} lifecycle: cleanup and natural process exit in ${result.cleanupMs.toFixed(0)}ms`,
  );
}
