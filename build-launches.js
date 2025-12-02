// build-launches.js — CommonJS version for GitHub Actions

const fetch = require("node-fetch");
const fs = require("fs");

// ===========================
// 1) Correct LL2 Upcoming URL
// ===========================
const UPCOMING_URL =
  "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?location__ids=12,27&limit=10&mode=detailed&ordering=net";

// Helper to safely read nested fields
function safe(obj, path) {
  return path.split(".").reduce((o, p) => (o ? o[p] : undefined), obj);
}

// Booster extraction (SpaceX only, optional fields)
function extractBoosters(launch) {
  const candidates = [
    safe(launch, "rocket.firststage"),
    safe(launch, "rocket.firststages"),
    safe(launch, "rocket.first_stage"),
    safe(launch, "rocket.first_stages"),
    safe(launch, "rocket.first_stage_cores"),
    safe(launch, "rocket.stages.first_stage"),
    safe(launch, "rocket.launcher_stage"), // the correct LL2 Falcon 9 structure
  ];

  const stages = candidates.flat().filter(Boolean);
  if (!stages.length) return [];

  return stages.map((stage) => {
    const landing = stage.landing || {};

    return {
      core: stage.launcher?.serial_number || null,
      flight: stage.launcher?.flights || null,
      landing_attempt: landing.attempt ?? null,
      landing_success: landing.success ?? null,
      landing_type: landing.type?.abbrev || landing.type?.name || null,
      landing_location: landing.location?.name || null,
      droneship: landing.location?.abbrev || null,
      description: landing.description || null,
    };
  });
}

// === Determine trajectory direction (azimuth) ===
function inferTrajectoryDirection(launch) {
  const name = launch.name?.toUpperCase() || "";
  const orbitAbbrev = launch.mission?.orbit?.abbrev?.toUpperCase() || "";
  const inclination = launch.mission?.orbit?.inclination || null;

  // 1. Starlink: infer by group number
  const starlinkMatch = name.match(/STARLINK\s+GROUP\s+(\d+)-(\d+)/i);
  if (starlinkMatch) {
    const group = parseInt(starlinkMatch[1], 10);

    // Group families
    if (group === 6 || group === 5) return "Southeast";
    if (group === 4 || group === 1) return "Northeast";
    if (group === 2) return "North-Northeast";
  }

  // 2. ISS missions (Dragon Crew or CRS)
  if (/DRAGON|CREW-|CRS-|ISS/i.test(name)) {
    return "Northeast";
  }

  // 3. GEO missions
  if (orbitAbbrev === "GEO" || orbitAbbrev === "GTO") {
    return "East";
  }

  // 4. SSO missions (polar)
  if (orbitAbbrev === "SSO" || orbitAbbrev === "POLAR") {
    return "South-Southeast";
  }

  // 5. Fallback using inclination if available
  if (inclination) {
    if (inclination < 20) return "East";
    if (inclination < 40) return "Southeast";
    if (inclination < 60) return "Northeast";
    return "North";
  }

  // 6. Unknown
  return null;
}

// Fetch LL2
async function fetchLaunches() {
  console.log("🔄 Fetching Launch Library 2 upcoming launches…");

  const res = await fetch(UPCOMING_URL);
  if (!res.ok) throw new Error("LL2 fetch failed: " + res.status);

  const json = await res.json();
  return json.results || [];
}

// Simplify the massive LL2 object
function simplify(launches) {
  return launches.map((l) => ({
    id: l.id,
    name: l.name || "",
    net: l.net || null,
    net_precision: l.net_precision?.abbrev || null,
    window_start: l.window_start || null,
    window_end: l.window_end || null,

    provider: l.launch_service_provider?.name || "",
    vehicle: l.rocket?.configuration?.full_name || "",
    orbit: l.mission?.orbit?.name || "",
    probability: l.probability ?? null,
    status: l.status?.name || "",
    image: l.image || null,

    pad: l.pad?.name || "",
    location: l.pad?.location?.name || "",
    orbit: l.mission?.orbit?.name || "",
    trajectory_direction: inferTrajectoryDirection(l),

    agency_launches_this_year: l.agency_launch_attempt_count_year || null,

    // boosters: ALWAYS extracted (may be empty array)
    boosters: extractBoosters(l),
  }));
}

// Main runner
async function main() {
  try {
    const launches = await fetchLaunches();
    const simplified = simplify(launches);

    const output = {
      timestamp: new Date().toISOString(),
      launches: simplified,
    };

    fs.writeFileSync("launches.json", JSON.stringify(output, null, 2));
    console.log("✅ launches.json updated successfully!");

  } catch (err) {
    console.error("❌ ERROR:", err);
    process.exit(1);
  }
}

main();
