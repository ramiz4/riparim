import { posix } from "node:path";

// Vinext beta.5 externalizes this generated sidecar relative to its entry.
// A lazy fetch handler lives in a nested chunk, so preserve that same target.
export function vinextLazyHandler() {
  return {
    name: "riparim:vinext-lazy-handler",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      if (this.environment.name !== "rsc") return;
      for (const output of Object.values(bundle))
        if (output.type === "chunk") {
          const relative = posix.relative(
            posix.dirname(output.fileName),
            "vinext-client-assets.js",
          );
          output.code = output.code.replace(
            /(["'])\.\/vinext-client-assets\.js\1/g,
            JSON.stringify(
              relative.startsWith(".") ? relative : "./" + relative,
            ),
          );
        }
    },
  };
}
