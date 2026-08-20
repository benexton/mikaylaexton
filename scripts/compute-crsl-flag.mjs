// Adds `nearCCCReserveLand` to every tree in board-trees.geojson: true when
// the nearest parcel to the tree is a park/reserve/river-margin parcel -
// LINZ's Central Record of State Land (CRoSL) managed by "Christchurch City
// Council", "To Be Determined", or "Department Of Conservation" (several
// stretches of actual river-reserve corridor, e.g. around Wilsons Road South,
// are DOC-managed rather than CCC), plus scripts/manual-reserve-additions.geojson
// for specific parcels confirmed CCC-managed on the ground but genuinely
// absent from CRoSL entirely (e.g. the school-adjacent reserve near Ombersley
// Terrace/St Martins - verified there's no CRoSL record there at all, not
// just a different managing agency).
//
// Data: scripts/.geodata-cache/crsl.geojson, fetched from LINZ's public
// CRoSL_Layer_N FeatureServer (the same source backing
// https://linz.maps.arcgis.com/apps/webappviewer/index.html?id=8501fe601f7648718d0e3a2f3f1ed216).
//
// Usage: node scripts/compute-crsl-flag.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const cacheDir = join(__dirname, '.geodata-cache');
const treesPath = join(root, 'public/treeviewer/board-trees.geojson');

// A board-wide audit of all proximity-only (non-inside) matches found the
// distance histogram bottoms out at 8-10m then climbs back up toward 20m -
// the climb is trees on the far side of a road from a park (NZ suburban
// road+verge widths commonly land in the 15-20m band), not trees genuinely
// adjacent to one. 10m sits at that trough: it keeps the genuine near-edge
// matches while dropping the across-the-road false positives (e.g. Cameron
// St, Austin St, tree 31582 near Humboldt St/Jacksons Creek).
const NEARBY_THRESHOLD_M = 10;

console.log('Loading geodata...');
const crslRaw = JSON.parse(readFileSync(join(cacheDir, 'crsl.geojson'), 'utf-8')).features;
const roads = JSON.parse(readFileSync(join(cacheDir, 'roads.geojson'), 'utf-8')).features;
const manualAdditions = JSON.parse(readFileSync(join(root, 'scripts/manual-reserve-additions.geojson'), 'utf-8')).features;
// Opposite of manualAdditions: specific CRoSL parcels confirmed NOT to be a
// real park/reserve despite passing the Managed_By check (e.g. a tiny
// unlabeled CCC-titled walkway strip near Humboldt Street that was wrongly
// excluding nearby street trees) - a point inside the parcel to exclude.
const manualExclusionPoints = JSON.parse(readFileSync(join(root, 'scripts/manual-reserve-exclusions.geojson'), 'utf-8')).features
  .map((f) => f.geometry.coordinates);
// The actual river channel polygon (CCC's own watercourse asset data) rather
// than relying on whoever legally manages the land beside it - CRoSL's land-
// parcel coverage along the riverbanks turned out to be patchy even with
// DOC included (several long stretches of the Heathcote/Opawaho River had no
// CRoSL record on either bank at all), so this is a second, independent and
// more direct source for "is this near the river" specifically.
const riverSegments = JSON.parse(readFileSync(join(cacheDir, 'heathcote-river.geojson'), 'utf-8')).features;
const trees = JSON.parse(readFileSync(treesPath, 'utf-8'));
console.log(`Loaded ${crslRaw.length} CCC/TBD/DOC-managed CRoSL parcels, ${roads.length} road features, ${manualAdditions.length} manual additions, ${riverSegments.length} river channel segments, ${trees.features.length} trees.`);

const LAT0 = -43.55;
const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LNG = 111320 * Math.cos((LAT0 * Math.PI) / 180);

const CELL_DEG = 0.001;
const cellKey = (cx, cy) => `${cx},${cy}`;
function cellsForBbox(minLng, minLat, maxLng, maxLat) {
  const cells = [];
  const x0 = Math.floor(minLng / CELL_DEG), x1 = Math.floor(maxLng / CELL_DEG);
  const y0 = Math.floor(minLat / CELL_DEG), y1 = Math.floor(maxLat / CELL_DEG);
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) cells.push(cellKey(x, y));
  return cells;
}
function ringBbox(ring) {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}
function geometryPolygons(geom) {
  if (geom.type === 'Polygon') return [geom.coordinates];
  if (geom.type === 'MultiPolygon') return geom.coordinates;
  return [];
}
function geometryBbox(geom) {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const rings of geometryPolygons(geom)) {
    const [a, b, c, d] = ringBbox(rings[0]);
    if (a < minLng) minLng = a; if (c > maxLng) maxLng = c;
    if (b < minLat) minLat = b; if (d > maxLat) maxLat = d;
  }
  return [minLng, minLat, maxLng, maxLat];
}
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    const intersects = (yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
function pointInGeometry(lng, lat, geom) {
  for (const rings of geometryPolygons(geom)) {
    if (!pointInRing(lng, lat, rings[0])) continue;
    let inHole = false;
    for (let h = 1; h < rings.length; h++) {
      if (pointInRing(lng, lat, rings[h])) { inHole = true; break; }
    }
    if (!inHole) return true;
  }
  return false;
}
function distPointToSegM(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const nx = ax + t * dx, ny = ay + t * dy;
  const ddx = (px - nx) * M_PER_DEG_LNG, ddy = (py - ny) * M_PER_DEG_LAT;
  return Math.sqrt(ddx * ddx + ddy * ddy);
}
function distPointToGeometryM(lng, lat, geom) {
  if (pointInGeometry(lng, lat, geom)) return 0;
  let best = Infinity;
  for (const rings of geometryPolygons(geom)) {
    for (const ring of rings) {
      for (let i = 0; i < ring.length - 1; i++) {
        const d = distPointToSegM(lng, lat, ring[i][0], ring[i][1], ring[i + 1][0], ring[i + 1][1]);
        if (d < best) best = d;
      }
    }
  }
  return best;
}

function buildGridIndex(features) {
  const grid = new Map();
  const entries = features.map((f, i) => ({ f, i, bbox: geometryBbox(f.geometry) }));
  for (const e of entries) {
    const [minLng, minLat, maxLng, maxLat] = e.bbox;
    // Guards only against the one pathological case actually seen (a
    // non-contiguous multi-parcel title spanning ~150km across the whole
    // region) - 0.1deg (~11km) still comfortably excludes that while no
    // longer dropping legitimately large single reserves (e.g. a Port Hills
    // reserve whose bbox came in at 0.0207deg, just over an earlier 0.02
    // cutoff, silently vanished from the index entirely).
    if (maxLng - minLng > 0.1 || maxLat - minLat > 0.1) continue;
    for (const key of cellsForBbox(...e.bbox)) {
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(e);
    }
  }
  return grid;
}

function candidatesNear(grid, lng, lat, ringSize) {
  const cx = Math.floor(lng / CELL_DEG), cy = Math.floor(lat / CELL_DEG);
  const out = [];
  for (let dx = -ringSize; dx <= ringSize; dx++) {
    for (let dy = -ringSize; dy <= ringSize; dy++) {
      const bucket = grid.get(cellKey(cx + dx, cy + dy));
      if (bucket) out.push(...bucket);
    }
  }
  return out;
}

// Single ring is sufficient - see compute-reserve-flag.mjs for why (cell size
// ~111m is much larger than the 20m threshold).
function nearestDistance(grid, lng, lat) {
  let best = Infinity;
  for (const c of candidatesNear(grid, lng, lat, 1)) {
    const d = distPointToGeometryM(lng, lat, c.f.geometry);
    if (d < best) best = d;
  }
  return best;
}

console.log('Indexing CRoSL parcels...');
const crslGrid = buildGridIndex(crslRaw);

// Roads themselves are "Managed by: Christchurch City Council"/"To Be
// Determined" state land in CRoSL too - a plain nearest-CRSL-parcel check
// would flag almost every street tree just for standing next to the road
// it's planted on. Excludes any CRoSL parcel that's explicitly gazetted for
// street/road purposes, OR (only for small, road-strip-sized parcels) that an
// actual road centreline runs through it. The size cap matters: large
// reserves legitimately have roads winding through or along them (e.g.
// Victoria Park's scenic drives) - blanket-excluding a whole multi-hectare
// park because ONE road passes through part of it was throwing out real
// parkland, not just road corridors.
const ROAD_STRIP_MAX_AREA_M2 = 5000; // 0.5ha - generous for a berm/road-reserve, well under any real park
function approxAreaM2(geom) {
  let total = 0;
  for (const rings of geometryPolygons(geom)) {
    const ring = rings[0];
    let a = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    }
    total += Math.abs(a / 2) * M_PER_DEG_LNG * M_PER_DEG_LAT;
  }
  return total;
}

// Anchored to right after a "[CREATE]"/"[REFERENCED]" tag - a loose
// "contains STREET/ROAD anywhere" match caught reserves whose NAME just
// references a bordering road (e.g. "[CREATE] RECREATION RESERVE [CASHMERE
// ROAD AND VALLEY ROAD RECREATION RESERVE] ...", a real park, not a road).
const ROAD_PURPOSE_RE = /\[(?:CREATE|REFERENCED)\]\s*(PURPOSES OF A (?:PUBLIC )?STREET|ROAD RESERVE|ROAD DIVERSION|ROADWAY|LEGAL ROAD)/;
const roadCorridorIndices = new Set();
crslRaw.forEach((f, i) => {
  const sa = (f.properties.Statutory_Actions || '').toUpperCase();
  if (ROAD_PURPOSE_RE.test(sa)) {
    roadCorridorIndices.add(i);
  }
});

// Drainage/stormwater parcels are a mixed bag: some are genuinely gazetted
// "Local Purpose (Drainage) Reserve" - real reserve land, keep those - while
// others are plain Public Works Act easement transfers ("LAND FOR DRAINAGE
// PURPOSES...TRANSFERRED TO CHRISTCHURCH CITY COUNCIL", "DRAINAGE WORKS...")
// with no reserve classification at all, i.e. a stormwater pipe corridor
// under someone's back fence, not parkland. The word "RESERVE" is what
// distinguishes them in practice across every example checked.
const utilityEasementIndices = new Set();
crslRaw.forEach((f, i) => {
  const sa = (f.properties.Statutory_Actions || '').toUpperCase();
  if (sa.includes('DRAINAGE') && !sa.includes('RESERVE')) {
    utilityEasementIndices.add(i);
  }
});
const smallParcelIndices = new Set(
  crslRaw.map((f, i) => i).filter((i) => approxAreaM2(crslRaw[i].geometry) <= ROAD_STRIP_MAX_AREA_M2)
);
let roadMidpointsChecked = 0;
for (const r of roads) {
  const coords = r.geometry.type === 'LineString' ? [r.geometry.coordinates] : r.geometry.coordinates;
  for (const line of coords) {
    for (let i = 0; i < line.length - 1; i++) {
      const mx = (line[i][0] + line[i + 1][0]) / 2, my = (line[i][1] + line[i + 1][1]) / 2;
      roadMidpointsChecked++;
      for (const c of candidatesNear(crslGrid, mx, my, 1)) {
        if (!roadCorridorIndices.has(c.i) && smallParcelIndices.has(c.i) && pointInGeometry(mx, my, c.f.geometry)) {
          roadCorridorIndices.add(c.i);
        }
      }
    }
  }
}
console.log(`${roadMidpointsChecked} road-segment midpoints checked; ${roadCorridorIndices.size}/${crslRaw.length} CRoSL parcels identified as road corridors and excluded.`);
console.log(`${utilityEasementIndices.size} CRoSL parcels identified as non-reserve drainage/utility easements and excluded.`);

const manualExclusionIndices = new Set(
  crslRaw.map((f, i) => i).filter((i) =>
    manualExclusionPoints.some(([lng, lat]) => pointInGeometry(lng, lat, crslRaw[i].geometry))
  )
);
console.log(`${manualExclusionIndices.size} CRoSL parcels manually excluded (confirmed not real parks despite passing Managed_By).`);

const crsl = crslRaw
  .filter((_, i) => !roadCorridorIndices.has(i) && !utilityEasementIndices.has(i) && !manualExclusionIndices.has(i))
  .concat(manualAdditions, riverSegments);
console.log(`${crsl.length} genuine park/reserve/river parcels (CRoSL minus road corridors, utility easements, and manual exclusions, plus manual additions and the river channel).`);
const reserveGrid = buildGridIndex(crsl);

// Confirmed on the ground (user review) as entirely reserve/park-adjacent
// despite a meaningful fraction sitting further than NEARBY_THRESHOLD_M from
// any tracked CRoSL/river polygon - flagged outright by siteName rather than
// distance. Exact-match only (e.g. not "Bridle Path Road", a distinct
// siteName already mostly-correct via the normal distance check).
const SITE_NAME_OVERRIDES = new Set([
  'The Zig Zag',
  'Bridle Path',
  'Shalamar Drive',
  'Cashmere Riverbank Reserve',
]);

console.log('Computing nearCCCReserveLand for each tree...');
let flagged = 0;
for (const f of trees.features) {
  if (SITE_NAME_OVERRIDES.has(f.properties.siteName)) {
    f.properties.nearCCCReserveLand = true;
    flagged++;
    continue;
  }
  // NZTA-owned trees are motorway/state-highway corridor plantings (e.g.
  // Tunnel Road, Curletts Road, the Southern Motorway) - not a street tree
  // fronting a property either, so they count the same as parks/reserves
  // regardless of distance to any CRoSL/river polygon.
  if (f.properties.ownership === 'NZTA') {
    f.properties.nearCCCReserveLand = true;
    flagged++;
    continue;
  }
  const [lng, lat] = f.geometry.coordinates;
  const dist = nearestDistance(reserveGrid, lng, lat);
  const near = dist <= NEARBY_THRESHOLD_M;
  f.properties.nearCCCReserveLand = near;
  if (near) flagged++;
}

console.log({ flagged, total: trees.features.length });

writeFileSync(treesPath, JSON.stringify(trees));
console.log(`Wrote ${treesPath}`);
