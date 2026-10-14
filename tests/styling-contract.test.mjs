import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import postcss from "postcss";
import ts from "typescript";

const stylesheet = /\.(?:css|scss|sass|less|styl)(?:[?#]|$)/i;
const allowedBaseSelectors = new Set([
  "*",
  "html",
  "body",
  "button",
  "a",
  "input",
  "textarea",
  "button:disabled",
  "button:focus-visible",
  "a:focus-visible",
  "a:hover",
  "h1",
  "h2",
  "h3",
  "p",
  "svg",
  "input::placeholder",
  "textarea::placeholder",
]);

function assertStylesheetInventory(files) {
  assert.deepEqual(
    files.filter((file) => stylesheet.test(file)).sort(),
    ["app/globals.css", "vendor/shadcn-tailwind-4.13.0.css"],
    "All first-party presentation belongs in utilities and one minimal entry; page sheets/modules cannot return",
  );
}
function assertGlobalEntry(source) {
  const ast = postcss.parse(source);
  assert(
    source.includes('@import "tailwindcss"'),
    "The entry retains the pinned Tailwind compiler import",
  );
  const imports = [];
  ast.walkAtRules("import", (rule) => imports.push(rule.params));
  assert.deepEqual(
    imports.sort(),
    [
      '"../vendor/shadcn-tailwind-4.13.0.css"',
      '"tailwindcss"',
      '"tw-animate-css"',
    ],
    "Every global stylesheet import needs an explicit compiler/vendor purpose",
  );
  ast.walkAtRules((rule) =>
    assert(
      !["apply", "utility"].includes(rule.name),
      "Semantic page recipes must not return as @apply or @utility blocks",
    ),
  );
  ast.walkRules((rule) => {
    const selectors = rule.selector
      .split(",")
      .map((selector) => selector.trim());
    const tokenRule =
      selectors.every((selector) =>
        [":root", ".dark", "html.dark", "html"].includes(selector),
      ) &&
      rule.nodes.every(
        (node) =>
          node.type === "comment" ||
          (node.type === "decl" && node.prop.startsWith("--")),
      );
    if (tokenRule) return;
    let keyframe = false,
      base = false;
    for (let parent = rule.parent; parent; parent = parent.parent) {
      if (parent.type === "atrule" && /keyframes$/.test(parent.name))
        keyframe = true;
      if (
        parent.type === "atrule" &&
        parent.name === "layer" &&
        parent.params === "base"
      )
        base = true;
    }
    assert(
      keyframe || base,
      `Residual rule needs a global base/keyframe/token purpose: ${rule.selector}`,
    );
    if (base)
      assert(
        selectors.every((selector) => allowedBaseSelectors.has(selector)),
        `First-party component selectors cannot hide in the global base layer: ${rule.selector}`,
      );
  });
}
function assertSourceStyling(file, source) {
  const ast = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let chartStyleElements = 0;
  function visit(node) {
    const declaration =
      ts.isImportDeclaration(node) || ts.isExportDeclaration(node);
    const specifier = declaration
      ? node.moduleSpecifier
      : ts.isCallExpression(node) &&
          (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(node.expression) &&
              node.expression.text === "require"))
        ? node.arguments[0]
        : undefined;
    if (
      specifier &&
      ts.isStringLiteralLike(specifier) &&
      stylesheet.test(specifier.text)
    )
      assert(
        ts.isImportDeclaration(node) &&
          file === "app/[locale]/layout.tsx" &&
          specifier.text === "../globals.css",
        `Unexpected first-party stylesheet import in ${file}: ${specifier.text}`,
      );

    const jsxStyle =
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(ast) === "style";
    const factoryStyle =
      ts.isCallExpression(node) &&
      (ts.isPropertyAccessExpression(node.expression)
        ? ["createElement", "createElementNS"].includes(
            node.expression.name.text,
          )
        : ts.isIdentifier(node.expression) &&
          node.expression.text === "createElement") &&
      node.arguments.some(
        (argument, index) =>
          index < 2 &&
          ts.isStringLiteralLike(argument) &&
          argument.text === "style",
      );
    if (jsxStyle || factoryStyle) {
      let boundary = node.parent;
      while (boundary && !ts.isVariableDeclaration(boundary))
        boundary = boundary.parent;
      // The pinned chart component emits per-instance color custom properties.
      // Email HTML strings and dynamic provider/image/widget style attributes
      // are separate runtime contracts, not first-party stylesheet elements.
      assert(
        jsxStyle &&
          file === "components/ui/chart.tsx" &&
          boundary?.name.getText(ast) === "ChartStyle" &&
          ++chartStyleElements === 1,
        `Unexpected first-party runtime style element in ${file}`,
      );
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}

const files = [];
for (const file of execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean)) {
  try {
    const source = await readFile(join(process.cwd(), file), "utf8");
    files.push(file);
    if (
      /\.[cm]?[jt]sx?$/.test(file) &&
      !/^(tests|scripts|examples|vendor)\//.test(file)
    )
      assertSourceStyling(file, source);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
assertStylesheetInventory(files);
const source = await readFile("app/globals.css", "utf8");
assertGlobalEntry(source);
assertSourceStyling("app/[locale]/layout.tsx", 'import "../globals.css";');
assertSourceStyling(
  "components/runtime-image.tsx",
  'export const Image = ({url}) => <div style={{backgroundImage: `url("${url}")`}} />;',
);
assertSourceStyling(
  "lib/source-example.ts",
  '// import "./unused.css";\nexport const example = "A style element";',
);
assertSourceStyling(
  "lib/email-content.ts",
  "export const email = `<html><head><style>body { margin:0 }</style></head></html>`;",
);

// Negative fixtures prove that a second presentation path cannot bypass the
// ownership contract through another folder, global layer or runtime element.
const escaped = [];
for (const [name, validate, message] of [
  [
    "attribute page selector",
    () =>
      assertGlobalEntry(
        source + '\n@layer base { [data-page="catalogue"] { padding: 99px; } }',
      ),
    /component selectors/,
  ],
  [
    "structural page selector",
    () =>
      assertGlobalEntry(
        source + "\n@layer base { main > section { padding: 99px; } }",
      ),
    /component selectors/,
  ],
  [
    "external first-party stylesheet",
    () => assertStylesheetInventory([...files, "lib/page-patch.css"]),
    /page sheets/,
  ],
  [
    "global patch import",
    () => assertGlobalEntry(source + '\n@import "../lib/page-patch.css";'),
    /stylesheet import/,
  ],
  [
    "library stylesheet import",
    () =>
      assertSourceStyling(
        "lib/page.tsx",
        'import "./page-patch.css"; export const Page = () => <main />;',
      ),
    /stylesheet import/,
  ],
  [
    "stylesheet re-export",
    () =>
      assertSourceStyling(
        "lib/page.ts",
        'export {default} from "./page-patch.css";',
      ),
    /stylesheet import/,
  ],
  [
    "dynamic stylesheet import",
    () =>
      assertSourceStyling("lib/page.ts", 'const patch = import("./page.css");'),
    /stylesheet import/,
  ],
  [
    "required stylesheet",
    () =>
      assertSourceStyling(
        "lib/page.cjs",
        'const patch = require("./page.css");',
      ),
    /stylesheet import/,
  ],
  [
    "runtime style element",
    () =>
      assertSourceStyling(
        "components/page.tsx",
        'export const Page = () => <style>{"main { padding:99px }"}</style>;',
      ),
    /runtime style/,
  ],
  [
    "runtime style factory",
    () =>
      assertSourceStyling(
        "components/page.tsx",
        'export const Page = () => React.createElement("style", null, "main { padding:99px }");',
      ),
    /runtime style/,
  ],
  [
    "DOM style factory",
    () =>
      assertSourceStyling(
        "lib/page.ts",
        'export const patch = document.createElement("style");',
      ),
    /runtime style/,
  ],
  [
    "additional chart style element",
    () =>
      assertSourceStyling(
        "components/ui/chart.tsx",
        "const ChartStyle = () => <><style /><style /></>;",
      ),
    /runtime style/,
  ],
]) {
  try {
    validate();
    escaped.push(name);
  } catch (error) {
    assert.match(error.message, message, name);
  }
}
assert.deepEqual(
  escaped,
  [],
  "Presentation ownership bypasses must be rejected",
);
console.log(
  "Styling ownership: one Tailwind entry with reviewed tokens, global base rules and keyframes; no page/module CSS or semantic recipes",
);
