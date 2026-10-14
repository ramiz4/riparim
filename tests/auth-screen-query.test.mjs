import assert from "node:assert/strict";
import { build } from "esbuild";

const bundle = await build({
  stdin: {
    contents: `export {default as Login} from './app/[locale]/login/page';export {default as Register} from './app/[locale]/register/page';export {default as Recovery} from './app/[locale]/forgot-password/page';export {default as Reset} from './app/[locale]/reset-password/page';`,
    resolveDir: process.cwd(),
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
  plugins: [
    {
      name: "screen-boundary",
      setup(builder) {
        builder.onResolve({ filter: /^@\/app\/auth-screen$/ }, () => ({
          path: "screen",
          namespace: "fixture",
        }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          loader: "js",
          contents: "export default function AuthScreen(){}",
        }));
      },
    },
  ],
});
const screens = await import(
  "data:text/javascript;base64," +
    Buffer.from(bundle.outputFiles[0].contents).toString("base64")
);
for (const Page of Object.values(screens)) {
  const tree = await Page({
    params: Promise.resolve({ locale: "de" }),
    searchParams: Promise.resolve({
      weiter: "/sq/serviset?ort=prizren",
      fehler: "bestaetigung",
      hinweis: "email-bestaetigt",
    }),
  });
  assert.deepEqual(
    await tree.props.query,
    {
      returnTo: "/sq/serviset?ort=prizren",
      error: "confirmation",
      notice: "email-confirmed",
    },
    "Every native auth page translates public query fields into English screen props",
  );
  assert.equal(
    tree.props.searchParams,
    undefined,
    "The screen receives only its internal contract",
  );
}
for (const Page of Object.values(screens)) {
  const ambiguous = await Page({
    params: Promise.resolve({ locale: "en" }),
    searchParams: Promise.resolve({
      weiter: ["/en", "/sq"],
      fehler: ["google", "bestaetigung"],
      hinweis: ["email-bestaetigt", "passwort-geaendert"],
      token_hash: "private",
    }),
  });
  assert.deepEqual(
    ambiguous.props.query,
    { returnTo: undefined, error: undefined, notice: undefined },
    "Ambiguous fields and unrelated credentials cannot become screen state",
  );
}
console.log(
  "Auth screens: stable public queries are adapted to English internal props",
);
