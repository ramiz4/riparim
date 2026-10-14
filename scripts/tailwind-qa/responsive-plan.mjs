export function responsivePlan() {
  const cases = [];
  const add = (scene, width, height = 900) => {
    cases.push({
      scene,
      width,
      height,
      theme: "light",
      locale: "en",
      state: "ready",
      role: "admin",
    });
  };
  // The header/landing share narrow layout and very wide legacy boundaries.
  for (const boundary of [360, 380, 480, 540, 1600])
    for (const width of [boundary - 1, boundary, boundary + 1])
      add("landing", width);
  for (const [scene, boundary] of [
    ["business", 600],
    ["admin-auth", 900],
    ["profile", 960],
  ])
    for (const width of [boundary - 1, boundary, boundary + 1])
      add(scene, width);
  // <=600 is static; >=601 enables mobile docking. Scroll interaction and
  // <=520 overlay padding are captured separately through their real triggers.
  for (const height of [599, 600, 601, 602]) add("catalogue", 390, height);
  return cases;
}
