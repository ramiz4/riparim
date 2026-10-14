# Tailwind presentation checks

This local harness renders actual application components with fictional records,
intercepted API responses and blocked external providers. It is for comparing an
immutable pre-migration bundle with the current bundle in a real browser. It does
not publish a site or change account, workshop or evidence data.

The server initializes a seeded random sequence before either fixture bundle so
partner cards have the same order. This changes only the isolated fixture
environment; the frozen application bundle/CSS and production selection remain
unchanged.

```sh
node scripts/tailwind-qa/build.mjs before
node scripts/tailwind-qa/build.mjs after
node scripts/tailwind-qa/server.mjs
```

Capture `before` on the original source before editing it. Its existing manifest
prevents rebuilding that baseline. Generated bundles, hashes, native geometry and
detail reports live under the ignored `.sites-runtime/tailwind-qa` directory.
Preserve that directory with the task evidence before removing a worktree.

Open `http://127.0.0.1:4196` in the project's required browser profile. Select the
same scene, locale, role, state, theme and CSS viewport for each pair. Record and
save geometry after fonts and content are ready. Open overlays through their real
triggers before measuring them. `Capture baseline matrix` repeats saved ordinary
baseline cases against the selected build and saves detailed element snapshots.
`Capture responsive matrix` adds adjacent legacy width/height boundaries. Overlays
and business editors require separate manual captures through real triggers. Use
browser controls for keyboard interaction, zoom and media preference emulation.
Keep preference-emulation reports separate from the ordinary matrix.

```sh
node scripts/tailwind-qa/compare.mjs
```

Comparison requires both sides of every case, identical content/state metadata,
no fixture failures or page overflow, geometry within 0.5 CSS pixels and matching
painted style values. Zero-width borders and unused foreground colors on empty
decorative switch thumbs cannot paint and are normalized; their geometry and
painted background remain checked. Inspect screenshots and detailed snapshots for
differences that coarse geometry does not describe.

The harness is complementary to the normal test groups and all three production
builds. It does not prove framework hydration, server authorization, real provider
shadow DOM, mobile Safari or physical safe-area rendering. Verify actual built
application navigation/hydration separately and keep these limits in the handover.

## Styling boundaries

Application layout, typography, surfaces and states use literal Tailwind classes
in JSX or coherent recipes in `lib/presentation.ts` and the owning component.
`app/globals.css` is the only first-party entry: imports, effective theme/layout
tokens, exact inclusive media variants, layered element/accessibility defaults
and two drawer keyframes. The reduced-motion shutdown is its only use of
`!important`. `tests/styling-contract.test.mjs` guards this inventory, imports,
base selectors and runtime style elements with negative fixtures.

Unchanged separate contracts are the pinned shadcn/animation vendor imports,
standalone email HTML and provider-owned shadow content. Google host variables
use literal arbitrary-property utilities. Existing runtime values remain at
their boundaries: the workshop image URL; chart colors and its single generated
color-variable style element; progress percentage; sidebar width/skeleton values;
Sonner variables; and ToggleGroup spacing. These do not replace page stylesheets.

The compiled-style test helper uses the pinned Tailwind/PostCSS compiler and
production Lightning CSS transform. Its jsdom adapter resolves layers, media and
variables for computed-style contracts, including future state changes; it is
not a layout engine. Native browser geometry is authoritative.
