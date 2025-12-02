import fetch from "node-fetch";
import fs from "fs";

const LIST_URL =
  "https://ll.thespacedevs.com/2.2.0/launch/?mode=list&limit=10&location__ids=12,27&ordering=net";

// Helper to safely read nested paths
function safe(obj, path) {
  return path.split(".").reduce((o, p) => (o ? o[p] : undefined), obj);
}

// Extract booster info from detailed launch object
function extractBoosters(launch) {
  const candidates = [
    safe(launch, "rocket.firststages"),
    safe(launch, "rocket.firststage"),
    safe(launch, "rocket.first_stage"),
    safe(launch, "rocket.first_stage_cores"),
    safe(launch, "rocket.stages.first_stage"),
    safe(launch, "first_stage"),
  ];

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

async function fetchLaunchList() {
  console.log("🔄 Fetching LL2 launch list…");
  const res = await fetch(LIST_URL);
  if (!res.ok) throw new Error("Failed launch list");
  const data = await res.json();
  return data.results || [];
}

// Fetch detailed record for each launch
async function fetchDetails(id) {
  const url = `https://ll.thespacedevs.com/2.2.0/launch/${id}/?mode=detailed`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn("⚠️ Failed detailed fetch for", id);
    return null;
  }
  return await res.json();
}

function simplify(d) {
  return {
    id: d.id,
    name: d.name || "",
    net: d.net || null,
    window_start: d.window_start || null,
    window_end: d.window_end || null,
    provider: d.launch_service_provider?.name || "",
    vehicle: d.rocket?.configuration?.full_name || "",
    orbit: d.mission?.orbit?.name || "",
    probability: d.probability,
    status: d.status?.name || "",
    image: d.image || null,
    pad: d.pad?.name || "",
    location: d.pad?.location?.name || "",
    direction: d.mission?.orbit?.abbrev || "",
    agency_launches_this_year: d.agency_launch_attempt_count_year || null,

    // ⭐ NEW
    net_precision: d.net_precision?.abbrev || null,

    // ⭐ NEW
    boosters: extractBoosters(d)
  };
}

async function main() {
  try {
    const list = await fetchLaunchList();

    console.log(`📄 ${list.length} launches found`);
    const detailed = [];

    // Fetch each launch fully
    for (const l of list) {
      const d = await fetchDetails(l.id);
      if (d) detailed.push(simplify(d));
    }

    const output = {
      timestamp: new Date().toISOString(),
      launches: detailed
    };

    fs.writeFileSync("launches.json", JSON.stringify(output, null, 2));
    console.log("✅ launches.json updated!");

  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

main();
