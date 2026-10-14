import postcss from "postcss";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const normalizedCache = new Map();
const cssom = createRequire(require.resolve("jsdom/package.json"))(
  "@acemir/cssom",
);
const { transform } = createRequire(require.resolve("vite/package.json"))(
  "lightningcss",
);

export function matchesViewport(
  query,
  {
    width = 1280,
    height = 900,
    coarsePointer = false,
    reducedMotion = false,
    reducedTransparency = false,
  } = {},
) {
  return query.split(",").some((branch) => {
    let matches = !/forced-colors:\s*active/.test(branch);
    for (const [, operator, axis, value, unit] of branch.matchAll(
      /\((min|max)-(width|height):\s*([\d.]+)(px|rem)\)/g,
    )) {
      const actual = axis === "width" ? width : height,
        expected = Number(value) * (unit === "rem" ? 16 : 1);
      matches &&= operator === "min" ? actual >= expected : actual <= expected;
    }
    for (const [, axis, operator, value, unit] of branch.matchAll(
      /\(\s*(width|height)\s*(<=|>=|<|>)\s*([\d.]+)(px|rem)\s*\)/g,
    )) {
      const actual = axis === "width" ? width : height,
        expected = Number(value) * (unit === "rem" ? 16 : 1);
      matches &&=
        operator === "<="
          ? actual <= expected
          : operator === ">="
            ? actual >= expected
            : operator === "<"
              ? actual < expected
              : actual > expected;
    }
    if (/\(pointer:\s*coarse\)/.test(branch)) matches &&= coarsePointer;
    if (/\(hover:\s*none\)/.test(branch)) matches &&= coarsePointer;
    if (/\(hover:\s*hover\)/.test(branch)) matches &&= !coarsePointer;
    if (/\(prefers-reduced-motion:\s*reduce\)/.test(branch))
      matches &&= reducedMotion;
    if (/\(prefers-reduced-transparency:\s*reduce\)/.test(branch))
      matches &&= reducedTransparency;
    return matches;
  });
}

function replaceVariables(value, variables) {
  for (
    let iteration = 0;
    iteration < 12 && value.includes("var(");
    iteration++
  ) {
    const previous = value;
    value = value.replace(
      /var\((--[\w-]+)(?:,\s*([^()]*))?\)/g,
      (match, name, fallback) => variables[name] ?? fallback ?? match,
    );
    if (value === previous) break;
  }
  return value;
}

function classAttributes(selector) {
  let result = "",
    quote = null,
    brackets = 0;
  for (let index = 0; index < selector.length;) {
    const char = selector[index];
    if (quote) {
      result += char;
      if (char === "\\" && index + 1 < selector.length) {
        result += selector[++index];
      } else if (char === quote) quote = null;
      index++;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      result += char;
      index++;
      continue;
    }
    if (char === "[") brackets++;
    if (char === "]") brackets--;
    if (char === "." && brackets === 0) {
      const token = selector
        .slice(index + 1)
        .match(/^(?:\\[0-9a-fA-F]{1,6}\s?|\\.|[\w-])+/)?.[0];
      if (token) {
        const name = token.replace(
          /\\([0-9a-fA-F]{1,6})\s?|\\(.)/g,
          (_, hex, escaped) =>
            hex ? String.fromCodePoint(parseInt(hex, 16)) : escaped,
        );
        result += "[class~=" + JSON.stringify(name) + "]";
        index += token.length + 1;
        continue;
      }
    }
    result += char;
    index++;
  }
  return result;
}

function absoluteValues(value) {
  value = value.replace(
    /(-?[\d.]+)rem\b/g,
    (_, number) => Number(number) * 16 + "px",
  );
  for (let iteration = 0; iteration < 8; iteration++) {
    const previous = value;
    value = value
      .replace(
        /calc\(\s*(-?[\d.]+)(px)?\s*([+*/-])\s*(-?[\d.]+)(px)?\s*\)/g,
        (match, first, firstUnit, operator, second, secondUnit) => {
          if (
            (operator === "+" || operator === "-") &&
            firstUnit !== secondUnit &&
            Number(first) !== 0 &&
            Number(second) !== 0
          )
            return match;
          if (operator === "*" && firstUnit && secondUnit) return match;
          const a = Number(first),
            b = Number(second);
          const result =
            operator === "+"
              ? a + b
              : operator === "-"
                ? a - b
                : operator === "*"
                  ? a * b
                  : a / b;
          if (!Number.isFinite(result)) return match;
          return (
            String(result) +
            (operator === "/" && firstUnit === secondUnit
              ? ""
              : (firstUnit ?? secondUnit ?? ""))
          );
        },
      )
      .replace(/calc\(\s*(-?[\d.]+(?:px)?)\s*\)/g, "$1");
    if (value === previous) break;
  }
  return value;
}

// jsdom omits layout, cascade layers, @property defaults and variable resolution.
// This adapter preserves named layer precedence (reversed for !important), lowers
// selector nesting and resolves fixed declaration values only. Its synthetic IDs
// make layer precedence outrank ordinary selector specificity while keeping order
// within a layer. Native browser QA remains authoritative for actual geometry,
// media/preferences, focus and selectors unsupported by the locked jsdom parser.
export function cssForDom(css, options = {}) {
  const { dark = false, ...viewport } = options;
  // Stylesheets must retain rules for future DOM and state changes.
  // DOM-dependent pruning would hide the actual compiled utility contracts.
  delete viewport.document;
  const cacheKey = JSON.stringify({ dark, ...viewport });
  const cached = normalizedCache.get(css)?.get(cacheKey);
  if (cached !== undefined) return cached;
  const lowered = transform({
    filename: "style-fixture.css",
    code: Buffer.from(css),
    targets: { chrome: 80 << 16 },
    minify: false,
  }).code.toString();
  const root = postcss.parse(lowered),
    variables = {},
    layers = [],
    layerByRule = new WeakMap();
  root.walkAtRules("layer", (rule) => {
    for (const name of postcss.list.comma(rule.params))
      if (!layers.includes(name)) layers.push(name);
  });
  root.walkRules((rule) => {
    let layer = null;
    for (let parent = rule.parent; parent; parent = parent.parent)
      if (parent.type === "atrule" && parent.name === "layer") {
        layer = parent.params;
        break;
      }
    layerByRule.set(rule, layer);
  });
  root.walkAtRules("property", (rule) => {
    const initial = rule.nodes?.find(
      (node) => node.type === "decl" && node.prop === "initial-value",
    );
    if (initial) variables[rule.params] = initial.value;
  });
  function normalize(container) {
    for (const rule of [...(container.nodes ?? [])]) {
      if (rule.nodes) normalize(rule);
      if (rule.type !== "atrule") continue;
      if (rule.name === "layer") {
        if (rule.nodes) rule.replaceWith(...rule.nodes);
        else rule.remove();
      } else if (rule.name === "media") {
        if (matchesViewport(rule.params, viewport))
          rule.replaceWith(...rule.nodes);
        else rule.remove();
      } else if (rule.name === "supports") {
        if (
          /^not\b/.test(rule.params) ||
          !/color-mix|animation-timeline/.test(rule.params)
        )
          rule.replaceWith(...rule.nodes);
        else rule.remove();
      } else if (
        ["property", "keyframes", "-webkit-keyframes"].includes(rule.name)
      )
        rule.remove();
    }
  }
  normalize(root);
  const priority = (rule) =>
    layerByRule.get(rule) === null
      ? layers.length
      : layers.indexOf(layerByRule.get(rule));
  const rules = [];
  root.walkRules((rule) => {
    rules.push(rule);
  });
  rules.sort((a, b) => priority(a) - priority(b));
  for (const rule of rules) {
    if (
      postcss.list
        .comma(rule.selector)
        .some(
          (selector) =>
            selector === ":root" ||
            selector === "html" ||
            (dark && ["html.dark", ".dark"].includes(selector)),
        )
    ) {
      for (const node of rule.nodes)
        if (node.type === "decl" && node.prop.startsWith("--"))
          variables[node.prop] = node.value;
    }
  }
  const output = [],
    importantOutput = [];
  for (const rule of rules) {
    const localVariables = { ...variables };
    for (const node of rule.nodes)
      if (node.type === "decl" && node.prop.startsWith("--"))
        localVariables[node.prop] = node.value;
    for (const important of [false, true]) {
      const copy = rule.clone();
      copy.walkDecls((declaration) => {
        if (!!declaration.important !== important) {
          declaration.remove();
          return;
        }
        declaration.value = absoluteValues(
          replaceVariables(declaration.value, localVariables),
        );
        if (!declaration.value.trim()) declaration.remove();
      });
      if (!copy.nodes.length) continue;
      const weight = important
        ? layers.length - priority(rule)
        : priority(rule) + 1;
      const suffix = ":not(#riparim-fixture-layer)".repeat(weight * 2);
      copy.selector = postcss.list
        .comma(copy.selector)
        .map((originalSelector) => {
          const selector = classAttributes(originalSelector);
          const pseudo = selector.search(
            /(?<!\\)::[a-zA-Z-]+|(?<!\\):(?:before|after|first-line|first-letter)\b/,
          );
          return pseudo >= 0
            ? selector.slice(0, pseudo) + suffix + selector.slice(pseudo)
            : selector + suffix;
        })
        .join(",");
      if (
        copy.selector.includes(":is()") ||
        cssom.parse(copy.toString()).cssRules.length === 0
      )
        continue;
      if (important)
        importantOutput.push({
          css: copy.toString(),
          priority: priority(rule),
        });
      else output.push(copy.toString());
    }
  }
  output.push(
    ...importantOutput
      .sort((a, b) => b.priority - a.priority)
      .map((rule) => rule.css),
  );
  // Lower resolved static color-mix values with the same locked minifier. This
  // does not invent colors; declarations retaining runtime variables stay intact.
  const normalized = postcss.parse(
    transform({
      filename: "normalized-style-fixture.css",
      code: Buffer.from(output.join("\n")),
      targets: { chrome: 80 << 16 },
      minify: false,
    }).code.toString(),
  );
  normalized.walkDecls((declaration) => {
    // jsdom retains an inherited font shorthand over later longhands. Lower the
    // shorthand in place so its original cascade order and importance survive.
    if (declaration.prop === "font" && declaration.value === "inherit") {
      for (const prop of [
        "font-family",
        "font-size",
        "font-weight",
        "font-style",
        "font-stretch",
        "font-variant",
        "line-height",
      ])
        declaration.cloneBefore({ prop, value: "inherit" });
      declaration.remove();
      return;
    }
    if (
      declaration.value === "0" &&
      /^border(?:-(?:top-left|top-right|bottom-left|bottom-right))?-radius$/.test(
        declaration.prop,
      )
    )
      declaration.value = "0px";
    if (!declaration.value.trim()) declaration.remove();
  });
  normalized.walkRules((rule) => {
    if (rule.selector.includes(":is()")) rule.remove();
  });
  const result = normalized
    .toString()
    .replace(/:(?:-webkit-any|-moz-any)\(/g, ":is(");
  if (!normalizedCache.has(css)) normalizedCache.set(css, new Map());
  normalizedCache.get(css).set(cacheKey, result);
  return result;
}
