import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

function escapeHtml(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function popupHtml(p) {
  const rows = [
    ['Species', p.commonName || p.species],
    ['Status', p.status],
    ['Planted', p.plantedDate],
    ['Observed', p.observationDate],
    ['Site', p.siteName],
    ['Ownership', p.ownership],
    ['Protection', p.protection],
  ].filter(([, v]) => v);
  return `<div class="tv-popup">${rows.map(([k, v]) => `<div class="tv-popup-row"><span>${k}</span>${escapeHtml(v)}</div>`).join('')}</div>`;
}

// Renders one category's points as a single imperative Leaflet canvas layer
// rather than a react-leaflet marker per point - with 10k+ trees, mounting a
// React component per CircleMarker is far too slow to toggle smoothly,
// especially on phones. Rebuilt whenever features/color/visible change -
// deliberately one effect, not split into "build" + "show/hide": splitting
// them meant a features change (e.g. switching the location filter) built a
// new layer but never attached it, since the attach effect only watched
// [visible, map] and neither had changed, so the map would silently go blank.
export default function TreeCategoryLayer({ features, color, visible }) {
  const map = useMap();

  useEffect(() => {
    const layer = L.geoJSON(
      { type: 'FeatureCollection', features },
      {
        // Two circles per tree: a small visible dot, plus a much larger
        // invisible one underneath that actually handles clicks/taps. Sparse
        // categories (a couple thousand points) were nearly impossible to
        // hit precisely at the old single 4px radius, while the densest
        // category (17k+ points) was so packed it was easy to click by
        // accident - splitting hit area from visual size fixes both without
        // making the map look more cluttered.
        pointToLayer: (feature, latlng) => {
          const hit = L.circleMarker(latlng, {
            radius: 12,
            weight: 0,
            opacity: 0,
            fillOpacity: 0,
          }).bindPopup(popupHtml(feature.properties));
          const dot = L.circleMarker(latlng, {
            radius: 4,
            weight: 1,
            color: '#20241f',
            opacity: 0.35,
            fillColor: color,
            fillOpacity: 0.85,
            interactive: false,
          });
          return L.layerGroup([hit, dot]);
        },
      }
    );
    if (visible) layer.addTo(map);
    return () => layer.remove();
  }, [features, color, visible, map]);

  return null;
}
