import { prepareVerificationNodeBuild } from "./helpers/node-build.mjs";
import { runSuites } from "./helpers/suite-runner.mjs";
import { selectSuites } from "./helpers/suite-registry.mjs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { group: { type: "string", default: "all" } },
});
const root = fileURLToPath(new URL("../", import.meta.url));
const runtime = new URL("../.test-runtime/", import.meta.url);
const suites = selectSuites(values.group);
process.exitCode = await runSuites({
  cwd: root,
  runtime,
  contract: fileURLToPath(
    new URL("../scripts/check-i18n.mjs", import.meta.url),
  ),
  beforeSuites: suites.includes("node-runtime.test.mjs")
    ? async (run) => {
        if (!Object.hasOwn(process.env, "RIPARIM_NODE_PREBUILT")) {
          const code = await run(
            fileURLToPath(
              new URL("../scripts/build-node.mjs", import.meta.url),
            ),
          );
          if (code) return;
          process.env.RIPARIM_NODE_PREBUILT = root;
        }
        await prepareVerificationNodeBuild(root);
      }
    : undefined,
  suites: suites.map((suite) => fileURLToPath(new URL(suite, import.meta.url))),
});
