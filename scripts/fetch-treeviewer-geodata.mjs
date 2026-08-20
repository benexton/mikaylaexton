// Fetches the raw CRoSL (parks/reserves/river) and road-centerline geometry
// needed to compute the "near CCC/TBD-managed land" exclusion flag. Saves to
// scripts/.geodata-cache/ (gitignored, intermediate - not shipped, not the
// tree data itself). Re-run only if the board area or data sources change.
//
// Usage: node scripts/fetch-treeviewer-geodata.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cacheDir = join(__dirname, '.geodata-cache');
mkdirSync(cacheDir, { recursive: true });

// Same board bounding box used to size the fetches in the earlier count check.
const BBOX = '172.56848842582394,-43.613328154457996,172.8081105287102,-43.53991247460931';

async function fetchPaginated(baseUrl, outFields, where, label) {
  const pageSize = 1000;
  let offset = 0;
  const features = [];
  while (true) {
    const params = new URLSearchParams({
      geometry: BBOX, geometryType: 'esriGeometryEnvelope', inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects', outFields, where,
      returnGeometry: 'true', geometryPrecision: '6',
      resultOffset: String(offset), resultRecordCount: String(pageSize), f: 'geojson',
    });
    const res = await fetch(`${baseUrl}/query?${params}`);
    const json = await res.json();
    if (!json.features) {
      console.error(`${label}: unexpected response`, JSON.stringify(json).slice(0, 300));
      break;
    }
    features.push(...json.features);
    console.log(`${label}: fetched ${features.length} so far...`);
    if (json.features.length < pageSize) break;
    offset += pageSize;
  }
  return features;
}

// LINZ Central Record of State Land - CCC-managed and "To Be Determined"
// parcels double as a direct park/reserve/river layer (per the user's
// alternative-approach idea, cross-checked against the Canterbury Maps
// viewer at https://linz.maps.arcgis.com/apps/webappviewer/index.html?id=8501fe601f7648718d0e3a2f3f1ed216).
// Department Of Conservation added after checking: several stretches of the
// Heathcote River's actual reserve corridor (e.g. around Wilsons Road South/
// Riverlaw Terrace, gazetted "RECREATION RESERVE") are DOC-managed, not CCC -
// omitting it left real river-corridor trees unflagged.
const crsl = await fetchPaginated(
  'https://services.arcgis.com/xdsHIIxuCWByZiCB/arcgis/rest/services/CRoSL_Layer_N/FeatureServer/0',
  'Managed_By,Statutory_Actions,Common_Name,Gov_Type',
  "Managed_By='Christchurch City Council' OR Managed_By='To Be Determined' OR Managed_By='Department Of Conservation'",
  'crsl'
);
console.log(`crsl: ${crsl.length} CCC/TBD/DOC-managed parcels in bbox.`);
writeFileSync(join(cacheDir, 'crsl.geojson'), JSON.stringify({ type: 'FeatureCollection', features: crsl }));

// Roads: within-bbox count was 1690, under the 2000 maxRecordCount, so one
// shot with a bbox filter rather than the resultOffset paginator.
const roadsRes = await fetch(
  `https://gis.ccc.govt.nz/arcgis/rest/services/Hosted/BaseMapStreetCenterLine/FeatureServer/0/query?geometry=${BBOX}&geometryType=esriGeometryEnvelope&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=streetcentrelineid&returnGeometry=true&geometryPrecision=6&f=geojson`
);
const roadsJson = await roadsRes.json();
console.log(`roads: fetched ${roadsJson.features?.length ?? 0}`);
writeFileSync(join(cacheDir, 'roads.geojson'), JSON.stringify(roadsJson));

// Actual river channel polygons (CCC watercourse asset data) - a direct,
// independent source for "is this near the river", since CRoSL's land-parcel
// coverage along the riverbanks turned out patchy even with DOC included
// (long stretches of the Heathcote/Opawaho River had no CRoSL record on
// either bank).
const river = await fetchPaginated(
  'https://gis.ecan.govt.nz/arcgis/rest/services/CCC/CCC_WaterCourse/MapServer/19',
  'WaterCourseSegmentName,WaterCourseName',
  "WaterCourseName LIKE '%Heathcote%' OR WaterCourseName LIKE '%Opawaho%' OR WaterCourseName LIKE '%Opawa%'",
  'river'
);
console.log(`river: ${river.length} Heathcote/Opawaho channel segments.`);
writeFileSync(join(cacheDir, 'heathcote-river.geojson'), JSON.stringify({ type: 'FeatureCollection', features: river }));

console.log('Done.');
