import fetch from "node-fetch";
import fs from "fs";

const LL2_URL = "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?format=json&limit=30";

function simplifyLaunch(l) {
  return {
    id: l.id,
    name: l.name,
    net: l.net,
    window_start: l.window_start,
    window_end: l.window_end,
    provider: l.launch_service_provider?.name || "",
    vehicle: l.rocket?.configuration?.full_name || "",
    orbit: l.mission?.orbit?.name || "",
    probability: l.probability ?? null,
    status: l.status?.name || "",
    image: l.image || "",
    pad: l.pad?.name || "",
    location: l.pad?.location?.name || "",
    direction: null, // your webpage fills this in
    agency_launches_this_year: l.agency_launch_attempt_count_year
  };
}

async function main() {
  try {
    const res = await fetch(LL2_URL);
    const data = await res.json();

    const spaceCoast = data.results.filter(l => {
      const loc = l.pad?.location?.name?.toLowerCase() || "";
      return loc.includes("kennedy") || loc.includes("canaveral");
    });

    const simplified = {
      timestamp: new Date().toISOString(),
      launches: spaceCoast
    };

    fs.writeFileSync("launches.json", JSON.stringify(simplified, null, 2));
    console.log("✔ launches.json updated");
  } catch (err) {
    console.error("Error fetching LL2:", err);
    process.exit(1);
  }
}

main();
