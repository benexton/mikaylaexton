// One-off/rerunnable filter: trims the citywide CCC tree open-data dump down to
// the Waihoro Spreydon-Cashmere-Heathcote Community Board area (the three wards:
// Cashmere, Heathcote, Spreydon), drops unused properties (photo HTML blobs,
// internal refs, etc.), tags each tree with which ward it falls in, and adds a
// derived `category` used directly by the treeviewer UI toggle.
//
// Board/ward boundaries come from CCC's own ArcGIS server (CorporateData/Administrative,
// layers 4 and 13) - the official current (2022/2025) electoral boundaries, not a
// hand-drawn approximation. See public/treeviewer/{community-board,wards}.geojson.
//
// Usage: node scripts/filter-treeviewer-geojson.mjs
// Reads:  public/treeviewer/trees-raw.geojson   (gitignored, ~187MB citywide source)
// Writes: public/treeviewer/board-trees.geojson (committed, board-area only)

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const rawPath = join(root, 'public/treeviewer/trees-raw.geojson');
const boardBoundaryPath = join(root, 'public/treeviewer/community-board.geojson');
const wardsPath = join(root, 'public/treeviewer/wards.geojson');
const sydenhamBoundaryPath = join(root, 'public/treeviewer/sydenham-boundary.geojson');
const outPath = join(root, 'public/treeviewer/board-trees.geojson');

const CUTOFF_YEAR = 2016;

// Manual corrections for trees the council's open-data snapshot hasn't caught
// up with yet - confirmed removed on the ground but still showing as Current
// in the source dump as of the last data refresh.
const MANUAL_OVERRIDES = {
  31577: { ServiceStatus: 'Removed', ObservationDate: '2026-02-26T00:00:00Z' },
  31576: { ServiceStatus: 'Removed', ObservationDate: '2026-02-26T00:00:00Z' },
};

// Ray-casting point-in-polygon test against a single ring - no holes to worry
// about in these council boundary polygons.
function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = (yi > lat) !== (yj > lat)
      && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInFeature(lng, lat, geom) {
  const polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates; // MultiPolygon: array of polygons
  return polys.some(([outer]) => pointInRing(lng, lat, outer));
}

function loadPolygonTest(path) {
  const fc = JSON.parse(readFileSync(path, 'utf-8'));
  return (lng, lat) => fc.features.some((f) => pointInFeature(lng, lat, f.geometry));
}

function loadWardLookup(path) {
  const fc = JSON.parse(readFileSync(path, 'utf-8'));
  return (lng, lat) => {
    const match = fc.features.find((f) => pointInFeature(lng, lat, f.geometry));
    return match ? match.properties.WardNameDescription : null;
  };
}

function yearOf(dateStr) {
  if (!dateStr) return null;
  const y = new Date(dateStr).getFullYear();
  return Number.isNaN(y) ? null : y;
}

// Trim to date-only (tooltips don't need time-of-day) to shave payload size.
function dateOnly(dateStr) {
  return dateStr ? dateStr.slice(0, 10) : null;
}

// ~0.1m precision at this latitude - plenty for a suburb-scale map, and far
// smaller than the source's 14-15 decimal digits.
function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

function categorize(props) {
  const status = props.ServiceStatus;
  // Stumps are treated as removed trees (the tree itself is gone) - only the
  // stump remains, so same rules as ServiceStatus "Removed" apply.
  if (status === 'Removed' || status === 'Stump') {
    const removedYear = yearOf(props.ObservationDate);
    return removedYear !== null && removedYear >= CUTOFF_YEAR ? 'removed-since-2016' : 'removed-older';
  }
  // "Defects Liability" = newly planted, still under the planting contractor's
  // warranty period - functionally a current tree for our purposes.
  if (status === 'Current' || status === 'Special tree' || status === 'Defects Liability') {
    const plantedYear = yearOf(props.PlantedDate);
    if (plantedYear !== null && plantedYear >= CUTOFF_YEAR) return 'planted-since-2016';
    return 'current';
  }
  return 'other';
}

const insideBoard = loadPolygonTest(boardBoundaryPath);
const insideSydenham = loadPolygonTest(sydenhamBoundaryPath);
const wardOf = loadWardLookup(wardsPath);

console.log('Reading raw dataset (this is ~187MB, may take a moment)...');
const raw = JSON.parse(readFileSync(rawPath, 'utf-8'));
console.log(`Loaded ${raw.features.length} citywide tree records.`);

let overridesApplied = 0;

const filtered = raw.features
  .filter((f) => {
    // Privately-owned trees are excluded entirely - this tool is about
    // council-managed street trees, not what's on private land.
    if (f.properties.Ownership === 'Private') return false;
    const [lng, lat] = f.geometry.coordinates;
    // Union with the Sydenham boundary: the board polygon and the Sydenham
    // suburb polygon are two independently-drawn official boundaries that
    // don't perfectly align at the edges (~74 trees), and since Sydenham is
    // itself a selectable location it must never lose trees to that gap.
    return insideBoard(lng, lat) || insideSydenham(lng, lat);
  })
  .map((f) => {
    const p = { ...f.properties, ...MANUAL_OVERRIDES[f.properties.TreeID] };
    if (MANUAL_OVERRIDES[f.properties.TreeID]) overridesApplied += 1;
    const [lng, lat] = f.geometry.coordinates;
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [round6(lng), round6(lat)] },
      properties: {
        id: p.TreeID,
        status: p.ServiceStatus,
        category: categorize(p),
        ward: wardOf(lng, lat),
        inSydenham: insideSydenham(lng, lat),
        species: p.Species,
        commonName: p.CommonName,
        genus: p.Genus,
        ownership: p.Ownership,
        protection: p.Protection,
        siteName: p.SiteName,
        plantedDate: dateOnly(p.PlantedDate),
        observationDate: dateOnly(p.ObservationDate),
        heightM: p.Height,
        crownSpreadM: p.CrownSpread,
        dbhM: p.DiameterAtBreastHeight,
      },
    };
  });

console.log(`Applied ${overridesApplied} manual override(s) (expected ${Object.keys(MANUAL_OVERRIDES).length}).`);

const counts = filtered.reduce((acc, f) => {
  acc[f.properties.category] = (acc[f.properties.category] || 0) + 1;
  return acc;
}, {});
const byWard = filtered.reduce((acc, f) => {
  const w = f.properties.ward || 'unmatched';
  acc[w] = (acc[w] || 0) + 1;
  return acc;
}, {});
console.log(`Filtered to ${filtered.length} trees within the Spreydon-Cashmere-Heathcote board area.`);
console.log('By category:', counts);
console.log('By ward:', byWard);

const out = {
  type: 'FeatureCollection',
  name: 'board_trees',
  crs: raw.crs,
  features: filtered,
};

writeFileSync(outPath, JSON.stringify(out));
console.log(`Wrote ${outPath}`);
