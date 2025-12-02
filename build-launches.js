const fetch = require("node-fetch");
const fs = require("fs");

// 1) Summary list – lightweight
const LL2_URL =
  "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?location__ids=12,27&limit=10&mode=detailed&ordering=net";

// Helper: safe nested access
function safe(obj, path) {
  return path.split(".").reduce((o, p) => (o ? o[p] : undefined), obj);
}

// 2) Fetch full detail for one launch
async function fetchDetails(id) {
  const url = `https://ll.thespacedevs.com/2.2.0/launch/${id}/?mode=detailed`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed detail fetch for " + id);
  return res.json();
}

// 3) Extract booster & landing info
function extractBoosters(l) {
  const candidateRoots = [
    safe(l, "rocket.launcher_stage"),
    safe(l, "rocket.firststage"),
    safe(l, "rocket.firststages"),
    safe(l, "firststage"),
  ];

  const stages = candidateRoots
    .flat()
    .filter(Boolean);

  return stages.map((fs) => {
    const landing = fs.landing || {};
    return {
      core: fs.launcher?.serial_number || null,
      landing_attempt: landing.attempt ?? null,
      landing_success: landing.success ?? null,
      landing_type: landing.type?.abbrev || null,
      landing_location: landing.location?.name || null
    };
  });
}

// 4) Make simplified object
function simplify(l) {
  return {
    id: l.id,
    name: l.name || "",
    net: l.net || null,
    net_precision: l.net_precision?.abbrev || null,
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

    boosters: extractBoosters(l)
  };
}

// 5) Main
async function main() {
  try {
    console.log("🔽 Fetching summary list…");
    const listRes = await fetch(LIST_URL);
    const listJson = await listRes.json();
    const summary = listJson.results || [];

    console.log(`Found ${summary.length} launches`);

    const detailed = [];
    for (const s of summary) {
      console.log("🔎 Fetching details:", s.id);
      const full = await fetchDetails(s.id);
      detailed.push(simplify(full));
    }

    const output = {
      timestamp: new Date().toISOString(),
      launches: detailed
    };

    fs.writeFileSync("launches.json", JSON.stringify(output, null, 2));
    console.log("✅ launches.json updated!");

  } catch (err) {
    console.error("❌ ERROR:", err);
    process.exit(1);
  }
}

main();
