export function createVinextNavigationChunkGroup() {
  // Rolldown can merge this dynamic import into the browser entry and remove
  // exports that Link reads from its module namespace. Keep that boundary until
  // the bundler preserves it; minSize prevents Vinext's small-chunk merging.
  return {
    name: "vinext-navigation",
    test: /[/\\]vinext[/\\]dist[/\\]shims[/\\]navigation\.js$/,
    minSize: 0,
  };
}

/** @returns {import("vite").Plugin} */
export function vinextNavigation() {
  return {
    name: "riparim:vinext-navigation",
    apply: "build",
    enforce: "post",
    configEnvironment(name) {
      if (name !== "client") return;
      // Append after Vinext's framework groups so React keeps its existing chunk.
      return {
        build: {
          rolldownOptions: {
            output: {
              codeSplitting: { groups: [createVinextNavigationChunkGroup(), {name: "link", test: /[/\\]vinext[/\\]dist[/\\]shims[/\\]link\.js$/, minSize: 0}] },
            },
          },
        },
      };
    },
  };
}
