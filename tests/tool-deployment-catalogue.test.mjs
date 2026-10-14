import assert from "node:assert/strict";
import { build } from "esbuild";

// The production deploy job installs only esbuild and Wrangler. A full app
// install in CI must not conceal runtime dependencies of the catalogue factory.
const result = await build({
  entryPoints: ["db/catalogue-import.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  metafile: true,
  plugins: [
    {
      name: "tool-only-boundary",
      setup(builder) {
        builder.onResolve({ filter: /.*/ }, (args) => {
          if (
            args.kind === "entry-point" ||
            args.path.startsWith(".") ||
            args.path.startsWith("/") ||
            args.path.startsWith("@/") ||
            args.path.startsWith("node:")
          )
            return;
          return {
            errors: [
              {
                text: `Catalogue deployment requires unavailable application dependency: ${args.path}`,
              },
            ],
          };
        });
      },
    },
  ],
});
assert(
  !Object.keys(result.metafile.inputs).some((path) =>
    path.includes("node_modules/"),
  ),
  "catalogue deployment uses no app package",
);
console.log(
  "Tool-only deployment: actual catalogue factory bundles without any application dependencies",
);
