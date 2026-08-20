import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import TreeCategoryLayer from './TreeCategoryLayer.jsx';
import { CATEGORIES, LOCATIONS, BOARD_CENTER, BOARD_ZOOM } from './categories.js';

const DATA_URL = '/treeviewer/board-trees.geojson';
const COMMUNITY_BOARD_URL = '/treeviewer/community-board.geojson';
const WARDS_URL = '/treeviewer/wards.geojson';
const SYDENHAM_URL = '/treeviewer/sydenham-boundary.geojson';

// interactive:false on all of these - they're decorative only. Without it,
// `fill: false` alone does NOT stop Leaflet's canvas hit-test from treating
// clicks anywhere in the polygon's interior as a hit (not just near the
// edge), and since these layers get redrawn on top of the tree markers'
// shared canvas after every location switch, they were silently swallowing
// clicks meant for trees underneath - anywhere inside the current board/ward
// outline, not just near its edge.
const BOARD_STYLE = { color: '#3a4a3d', weight: 2, dashArray: '2 6', fill: false, interactive: false };
const WARD_STYLE = { color: '#5a6b60', weight: 1.5, dashArray: '6 5', fill: false, interactive: false };
const WARD_STYLE_ACTIVE = { color: '#20241f', weight: 2.5, dashArray: null, fill: false, interactive: false };
const SYDENHAM_STYLE = { color: '#e5622b', weight: 3, fill: false, interactive: false };

// Draw order matters for overlapping points: list background/context
// categories first so the "removed since 2016" / "planted since 2016" story
// layers land on top when a viewer has everything switched on.
const DRAW_ORDER = ['current', 'planted-since-2016', 'removed-since-2016'];

function fetchJson(url) {
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  });
}

// Fits the map to whichever area boundary is currently selected (board, one
// ward, or Sydenham), rather than guessing static center/zoom values for each.
function FitBoundsOnLoad({ boundary }) {
  const map = useMap();
  useEffect(() => {
    if (!boundary) return;
    const layer = L.geoJSON(boundary);
    map.fitBounds(layer.getBounds(), { padding: [16, 16] });
  }, [boundary, map]);
  return null;
}

export default function TreeViewer() {
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [allFeatures, setAllFeatures] = useState(null);
  const [boardBoundary, setBoardBoundary] = useState(null);
  const [wardsBoundary, setWardsBoundary] = useState(null);
  const [sydenhamBoundary, setSydenhamBoundary] = useState(null);
  const [on, setOn] = useState(() =>
    Object.fromEntries(CATEGORIES.map((c) => [c.key, c.defaultOn]))
  );
  const [selectedLocation, setSelectedLocation] = useState('board');
  const [excludeCCCReserve, setExcludeCCCReserve] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchJson(DATA_URL)
      .then((geojson) => {
        if (!cancelled) {
          setAllFeatures(geojson.features);
          setStatus('ready');
        }
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    // Boundaries are decorative/filtering context - fine to fail silently.
    fetchJson(COMMUNITY_BOARD_URL).then((gj) => !cancelled && setBoardBoundary(gj)).catch(() => {});
    fetchJson(WARDS_URL).then((gj) => !cancelled && setWardsBoundary(gj)).catch(() => {});
    fetchJson(SYDENHAM_URL).then((gj) => !cancelled && setSydenhamBoundary(gj)).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const featuresByCategory = useMemo(() => {
    if (!allFeatures) return null;
    let scoped;
    if (selectedLocation === 'sydenham') {
      scoped = allFeatures.filter((f) => f.properties.inSydenham);
    } else if (selectedLocation === 'board') {
      // A handful of trees just outside the official board polygon were kept
      // in the dataset only so the Sydenham view doesn't lose them at its
      // edge (see the filter script's boundary union) - ward is null for
      // those, so exclude them here to stay true to the board's real extent.
      scoped = allFeatures.filter((f) => f.properties.ward !== null);
    } else {
      scoped = allFeatures.filter((f) => f.properties.ward === selectedLocation);
    }
    if (excludeCCCReserve) scoped = scoped.filter((f) => !f.properties.nearCCCReserveLand);
    const byCategory = {};
    for (const c of CATEGORIES) byCategory[c.key] = [];
    for (const f of scoped) {
      const key = f.properties.category;
      if (byCategory[key]) byCategory[key].push(f);
    }
    return byCategory;
  }, [allFeatures, selectedLocation, excludeCCCReserve]);

  const counts = useMemo(() => {
    if (!featuresByCategory) return null;
    return Object.fromEntries(CATEGORIES.map((c) => [c.key, featuresByCategory[c.key].length]));
  }, [featuresByCategory]);

  // Straight-line projection from the last 10 years' net change (removed
  // minus planted, both since 2016) applied to the current established-tree
  // stock, run out to zero. "current" here deliberately means the pre-2016
  // established count only, not current+planted-since-2016 - young
  // replacement plantings aren't equivalent mature canopy for decades, which
  // is the whole point of the underlying submission this tool supports.
  const depletionYears = useMemo(() => {
    if (!counts) return null;
    const current = counts['current'];
    const removed = counts['removed-since-2016'];
    const planted = counts['planted-since-2016'];
    const annualNetLoss = (removed - planted) / 10;
    if (annualNetLoss <= 0 || current <= 0) return null;
    return Math.round(current / annualNetLoss);
  }, [counts]);

  const wardStyleFor = (wardName) => (wardName === selectedLocation ? WARD_STYLE_ACTIVE : WARD_STYLE);

  // Fit/zoom follows the location picker: whole board, one ward, or Sydenham.
  const fitTarget = useMemo(() => {
    if (selectedLocation === 'sydenham') return sydenhamBoundary;
    if (selectedLocation === 'board' || !wardsBoundary) return boardBoundary;
    const wardFeature = wardsBoundary.features.find((f) => f.properties.WardNameDescription === selectedLocation);
    return wardFeature ? { type: 'FeatureCollection', features: [wardFeature] } : boardBoundary;
  }, [selectedLocation, boardBoundary, wardsBoundary, sydenhamBoundary]);

  return (
    <div className="tv-root">
      <MapContainer
        center={BOARD_CENTER}
        zoom={BOARD_ZOOM}
        preferCanvas
        className="tv-map"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={20}
        />
        <FitBoundsOnLoad boundary={fitTarget} />
        {selectedLocation === 'sydenham' ? (
          sydenhamBoundary && <GeoJSON data={sydenhamBoundary} style={SYDENHAM_STYLE} />
        ) : (
          <>
            {boardBoundary && <GeoJSON data={boardBoundary} style={BOARD_STYLE} />}
            {wardsBoundary && (
              <GeoJSON
                key={selectedLocation}
                data={wardsBoundary}
                style={(feature) => wardStyleFor(feature.properties.WardNameDescription)}
              />
            )}
          </>
        )}
        {featuresByCategory && DRAW_ORDER.map((key) => {
          const cat = CATEGORIES.find((c) => c.key === key);
          return (
            <TreeCategoryLayer
              key={key}
              features={featuresByCategory[key]}
              color={cat.color}
              visible={on[key]}
            />
          );
        })}
      </MapContainer>

      {status === 'loading' && (
        <div className="tv-status">Loading tree data…</div>
      )}
      {status === 'error' && (
        <div className="tv-status tv-status-error">Couldn't load tree data. Try reloading the page.</div>
      )}

      <button
        className="tv-panel-toggle"
        onClick={() => setPanelOpen((v) => !v)}
        aria-expanded={panelOpen}
        aria-label={panelOpen ? 'Hide layers panel' : 'Show layers panel'}
      >
        {panelOpen ? '✕' : '☰'}
      </button>

      <div className={`tv-panel ${panelOpen ? 'tv-panel-open' : ''}`}>
        <h1>Waihoro Spreydon-Cashmere-Heathcote Community Board Street Trees</h1>
        <p className="tv-subtitle">Christchurch City Council open data</p>

        <div className="tv-location-select">
          <label htmlFor="tv-location">Location</label>
          <select id="tv-location" value={selectedLocation} onChange={(e) => setSelectedLocation(e.target.value)}>
            {LOCATIONS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
        </div>

        <label className="tv-checkbox-row">
          <input
            type="checkbox"
            checked={excludeCCCReserve}
            onChange={() => setExcludeCCCReserve((v) => !v)}
          />
          <span>Exclude trees in parks, reserves, river margins and state highways</span>
        </label>

        {excludeCCCReserve && depletionYears != null && (
          <p className="tv-projection">
            For the current region, at the current rate, no street trees will remain in <strong>{depletionYears} years</strong>.
          </p>
        )}

        <div className="tv-toggles">
          {CATEGORIES.map((c) => (
            <label key={c.key} className="tv-toggle">
              <input
                type="checkbox"
                checked={on[c.key]}
                onChange={() => setOn((prev) => ({ ...prev, [c.key]: !prev[c.key] }))}
              />
              <span className="tv-swatch" style={{ background: c.color }} />
              <span className="tv-toggle-label">{c.label}</span>
              <span className="tv-toggle-count">{counts ? counts[c.key].toLocaleString() : '…'}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
