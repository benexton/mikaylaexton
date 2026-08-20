// Shared between TreeViewer's overlay panel and TreeLayer's marker styling -
// keep colour/label/order in one place.
export const CATEGORIES = [
  { key: 'removed-since-2016', label: 'Removed since 2016', color: '#d64545', defaultOn: true },
  { key: 'planted-since-2016', label: 'Planted since 2016', color: '#2f9e6e', defaultOn: true },
  { key: 'current', label: 'Other mature trees', color: '#8a9a8e', defaultOn: true },
];

// "board" and "sydenham" are handled specially in TreeViewer (whole area / the
// inSydenham flag); the rest match a tree's `ward` property directly.
export const LOCATIONS = [
  { key: 'board', label: 'Community Board Area' },
  { key: 'Spreydon', label: 'Spreydon' },
  { key: 'Heathcote', label: 'Heathcote' },
  { key: 'Cashmere', label: 'Cashmere' },
  { key: 'sydenham', label: 'Sydenham (Case Study)' },
];

// Fallback only - the map fits to the community board's actual bounds once
// that boundary geojson loads (see FitBoundsOnLoad in TreeViewer.jsx).
export const BOARD_CENTER = [-43.5766, 172.6883];
export const BOARD_ZOOM = 12;
