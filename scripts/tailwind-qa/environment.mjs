// Stable partner-card ordering is a fixture property, not a production change.
export const fixtureEnvironmentScript = `Math.random = (() => {
  let seed = 196;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
})();`;

export function withFixtureEnvironment(html) {
  return html.replace(
    '<script type="module" src="fixture.js">',
    '<script src="/fixture-environment.js"></script><script type="module" src="fixture.js">',
  );
}
