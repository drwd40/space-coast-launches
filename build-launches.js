import fetch from "node-fetch";
import fs from "fs";

const LL2_URL =
  "https://ll.thespacedevs.com/2.2.0/launch/?mode=detailed&limit=10&location__ids=12,27&ordering=net";

function safeGet(obj, path) {
  return path.split(".").reduce((o, p) => (o ? o[p] : null), obj);
}

function extractBoosters(l) {
  const candidates = [
    safeGet(l, "rocket.firststage"),
    safeGet(l, "rocket.firststages"),
    safeGet(l, "rocket.first_stage"),
    safeGet(l, "rocket.stages.first_stage")
  ];

  const stages = candidates.flat().filter(Boolean);
  if (!stages.length) return [];

  return stages.map(fs => {
    const landing = fs.landing || {};
    return {
      core: fs.launcher?.serial_number || null,
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
    direction: l.mission?.orbit?.name || "",
    agency_launches_this_year: l.agency_launch_attempt_count_year || null,

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
    console.log("✅ launches.json updated with booster recovery info!");
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

main();
