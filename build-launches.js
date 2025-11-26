import fetch from "node-fetch";
import fs from "fs";

const LL2_URL =
  "https://ll.thespacedevs.com/2.2.0/launch/?mode=detailed&limit=10&location__ids=12,27&ordering=net";

// Helper to safely read nested paths
function safe(obj, path) {
  return path.split(".").reduce((o, p) => (o ? o[p] : undefined), obj);
}

// Try all known LL2 booster locations
function extractBoosters(launch) {
  const candidates = [
    safe(launch, "rocket.firststage"),
    safe(launch, "rocket.firststages"),
    safe(launch, "rocket.first_stage"),
    safe(launch, "rocket.first_stages"),
    safe(launch, "rocket.first_stage_cores"),
    safe(launch, "rocket.stages.first_stage"),
    safe(launch, "rocket.firststage.core"),
    safe(launch, "firststage"),          // very old LL2
    safe(launch, "first_stage"),
  ];

  // Flatten and remove nulls
  const stages = candidates.flat().filter(Boolean);
  if (!stages.length) return [];

  return stages.map((fs) => {
    const landing = fs.landing || {};

    return {
      core: fs.launcher?.serial_number || fs.core || null,
      landing_attempt: landing.attempt ?? null,
      landing_success: landing.success ?? null,
      landing_type: landing.type || null,
      landing_location: landing.location?.name || null
    };
  });
}

async function fetchLaunches() {
  console.log("🔄 Fetching Launch Library 2…");
  const res = await fetch(LL2_URL);
  if (!res.ok) throw new Error("Failed to fetch LL2");
  const data = await res.json();
  return data.results || [];
}

function simplify(launches) {
  return launches.map((l) => ({
    id: l.id,
    name: l.name || "",
    net: l.net || null,
    window_start: l.window_start || null,
    window_end: l.window_end || null,
    provider: l.launch_service_provider?.name || "",
    vehicle: l.rocket?.configuration?.full_name || "",
    orbit: l.mission?.orbit?.name || "",
    probability: l.probability,
    status: l.status?.name || "",
    image: l.image || null,
    pad: l.pad?.name || "",
    location: l.pad?.location?.name || "",
    direction: l.mission?.orbit?.abbrev || "",
    agency_launches_this_year: l.agency_launch_attempt_count_year || null,

    // NEW booster block (safe, optional)
    boosters: extractBoosters(l)
  }));
}

async function main() {
  try {
    const launches = await fetchLaunches();
    const simplified = simplify(launches);

    const output = {
      timestamp: new Date().toISOString(),
      launches: simplified
    };

    fs.writeFileSync("launches.json", JSON.stringify(output, null, 2));
    console.log("✅ launches.json updated!");
  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

main();
