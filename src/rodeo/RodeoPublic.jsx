import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Polyline, CircleMarker, Marker, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { rodeo, RODEO_SNAPSHOT_URL, RODEO_COMMENT_FN_URL, RODEO_TURNSTILE_SITE_KEY, RODEO_ANON_KEY, TEAMS, COLLECTIVE_COLOR, sortWaypoints, fmtWaypointDate, isNewWaypoint } from './rodeoSupabase.js';

const INTRO = [
  {
    title: 'The premise',
    hero: true,
    body: (
      <>
        <p>Welcome to The Rodeo. A stack of sealed envelopes control our life across a continent over the next 3 weeks.</p>
        <p>At each stop we tear open an envelope, learn our next destination, and split into two teams: Ben &amp; John versus Miki &amp; Bruce. Each pair races there however they dare. Fastest pair wins two points. Cheapest pair wins one. Every new country we drag ourselves through is worth one more (each country only scores once).</p>
        <p>Then we reunite, compare disasters, and open the next envelope. Casablanca to Constantinople, six different legs, three weeks, and one Bosphorus at the end.</p>
      </>
    ),
    // Shorter, screen-fitting version for phones - the desktop copy above
    // reads fine with room to spare, but is a lot of scrolling on mobile.
    mobileBody: (
      <>
        <p>Sealed envelopes control our life across a continent for the next 3 weeks.</p>
        <p>Each stop we open one, learn the destination, and split into two teams: Ben &amp; John vs Miki &amp; Bruce. Fastest pair wins 2 points; cheapest pair and every new country crossed win 1 each.</p>
        <p>Then we reunite and open the next envelope. Casablanca to Constantinople, six legs, one Bosphorus at the end.</p>
      </>
    ),
    button: 'Next',
  },
  {
    title: 'How to watch the carnage',
    hero: true,
    body: (
      <>
        <p>Dots on the map are us: two dotted trails, one per team, curving apart between stops. A dot that is half blue, half orange is a checkpoint both teams have reached.</p>
        <p>The timeline runs down the middle, Ben &amp; John on the left, Miki &amp; Bruce on the right, and every so often the lanes merge into one card: that is a leg we travelled together, no points at stake, just snacks.</p>
        <p>Hover a dot for the gist, tap it for the full story. The scoreboard keeps the peace.</p>
      </>
    ),
    // "Hover" doesn't mean anything on a touchscreen, so the mobile copy
    // drops it rather than just trimming words.
    mobileBody: (
      <>
        <p>Dots on the map are us - one trail per team, curving apart between stops. A half blue, half orange dot is a checkpoint we've both reached.</p>
        <p>The timeline runs Ben &amp; John on the left, Miki &amp; Bruce on the right. Where the lanes merge into one card, that's a leg we travelled together - no points, just snacks.</p>
        <p>Tap a dot for the full story.</p>
      </>
    ),
    button: "Let's go!",
  },
];

// Remembers (per browser) that the intro has been dismissed, so returning
// visitors land straight on the map. Storage can throw (private windows,
// blocked site data), in which case the intro just shows every visit.
const INTRO_SEEN_KEY = 'rodeo-intro-seen';
function introSeen() {
  try { return localStorage.getItem(INTRO_SEEN_KEY) === '1'; } catch { return false; }
}
function markIntroSeen() {
  try { localStorage.setItem(INTRO_SEEN_KEY, '1'); } catch { /* storage unavailable */ }
}

// Mirrors rodeo.css's 760px mobile breakpoint, for the handful of things
// (like which intro copy to show) that need to branch in JS, not just CSS.
function useIsMobile() {
  const query = '(max-width: 760px)';
  const [mobile, setMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
}

function legTime(u) {
  if (u?.duration_minutes == null) return null;
  const h = Math.floor(u.duration_minutes / 60), m = u.duration_minutes % 60;
  return `${h ? h + 'h' : ''}${m ? ' ' + m + 'm' : (h ? '' : '0m')}`.trim();
}
function html(md) { return { __html: DOMPurify.sanitize(marked.parse(md || '')) }; }

// Markdown flattened to plain text, for the short teaser on a timeline tile.
// DOMParser builds an inert document, so nothing in it runs or loads.
function plainText(md) {
  const spaced = marked.parse(md || '').replace(/<\/(p|li|h[1-6]|blockquote)>|<br\s*\/?>/g, ' ');
  return (new DOMParser().parseFromString(spaced, 'text/html').body.textContent || '').replace(/\s+/g, ' ').trim();
}

// Teaser on a timeline tile: the opening lines only, so the full story (and
// any waypoints) is a reason to open the leg.
function TileTeaser({ md }) {
  const text = plainText(md);
  return text ? <p className="rodeo-excerpt">{text}</p> : null;
}

// Shown while a pair has their clock running and hasn't arrived yet.
function RoadBadge() {
  return <span className="rodeo-road-badge"><i aria-hidden="true" />On the road</span>;
}

// Footer on a timeline tile: flags extra waypoints to read and invites a tap.
function TileMore({ u }) {
  const n = u?.waypoints?.length ?? 0;
  if (!n && !u?.body) return null;
  const fresh = (u.waypoints ?? []).some((w) => isNewWaypoint(w.arrived_at));
  return (
    <div className="rodeo-tile-more">
      {n > 0 && (
        <span className="rodeo-tile-wp">
          📍 {n} more {n === 1 ? 'update' : 'updates'}
          {fresh && <span className="rodeo-new-badge">New</span>}
        </span>
      )}
      <span className="rodeo-tile-cta">Read more →</span>
    </div>
  );
}

// Raw spend never reaches the snapshot - only this per-leg comparison does.
function spendLine(summary) {
  if (!summary) return null;
  const amt = Math.round((summary.per_person_nzd_minor ?? 0) / 100);
  if (!summary.more || amt === 0) return 'Both pairs spent about the same per person on this leg';
  return `${TEAMS[summary.more].name} spent NZ$${amt.toLocaleString()} more per person on this leg`;
}

// Mirrors TIME_POINTS / MONEY_POINTS in supabase/functions/rodeo-publish.
const TIME_PTS = 2;
const MONEY_PTS = 1;

// How a team scored this leg. Anything that earned points is ringed in gold
// with its +points: the time (only when fastest), a trophy for the cheapest
// pair, and the countries crossed (only first-time crossings score).
function ScoreChips({ leg, team, u, listCountries = false }) {
  const won = leg.winners ?? {};
  const time = legTime(u);
  const nCountries = u.countries?.length ?? 0;
  // Older snapshots predate new_countries, when every crossing scored.
  const scored = u.new_countries ?? u.countries ?? [];
  const countryPts = scored.length;
  const countryList = (u.countries ?? []).map((c) => (scored.includes(c) ? c : `${c} (again)`)).join(', ');
  if (!time && !u.time_sealed && !nCountries && won.money !== team) return null;
  return (
    <div className="rodeo-score-chips">
      {!time && u.time_sealed && (
        <span className="rodeo-score-chip" title="Leg times are revealed once both pairs have arrived">⏱ sealed</span>
      )}
      {time && (
        <span className={`rodeo-score-chip${won.time === team ? ' win' : ''}`}
          title={won.time === team ? 'Fastest pair this leg' : undefined}>
          ⏱ {time}{won.time === team && <b>+{TIME_PTS}</b>}
        </span>
      )}
      {won.money === team && (
        <span className="rodeo-score-chip win" title="Cheapest pair this leg">🏆 Cheapest<b>+{MONEY_PTS}</b></span>
      )}
      {nCountries > 0 && (
        <span className={`rodeo-score-chip${countryPts ? ' win' : ''}`}
          title={countryPts < nCountries ? 'Each country only scores the first time a pair crosses it' : 'One point per new country'}>
          🌍 {listCountries ? countryList : `${countryPts} new ${countryPts === 1 ? 'country' : 'countries'}`}
          {countryPts > 0 && <b>+{countryPts}</b>}
        </span>
      )}
    </div>
  );
}

// Points by category, shown above the timeline.
function ScoreboardBreakdown({ data }) {
  const breakdown = data.scoreboard_breakdown;
  if (!breakdown) return null;
  return (
    <div className="rodeo-scorecard">
      {['ben', 'miki'].map((tk) => {
        const b = breakdown?.[tk];
        return (
          <div key={tk} className="rodeo-scorecard-team" style={{ borderColor: TEAMS[tk].color }}>
            <h3 style={{ color: TEAMS[tk].color }}>{TEAMS[tk].name}</h3>
            <div className="rodeo-scorecard-pts">
              <span>⏱ {b?.time ?? 0} pts fastest</span>
              <span>💸 {b?.money ?? 0} pts cheapest</span>
              <span>🌍 {b?.countries ?? 0} pts countries</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- map geometry -----------------------------------------------------------
const BOW = 0.16;           // curve bow as a fraction of segment length

// Quadratic bezier through consecutive points, bowed to one side per team.
function curved(points, teamKey) {
  if (points.length < 2) return points;
  const sign = teamKey === 'ben' ? -1 : 1;
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [y0, x0] = points[i], [y1, x1] = points[i + 1];
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const dx = x1 - x0, dy = y1 - y0;
    const cx = mx + sign * BOW * -dy, cy = my + sign * BOW * dx; // perpendicular control point
    const steps = 22;
    for (let t = 0; t <= steps; t++) {
      const k = t / steps, ik = 1 - k;
      const x = ik * ik * x0 + 2 * ik * k * cx + k * k * x1;
      const y = ik * ik * y0 + 2 * ik * k * cy + k * k * y1;
      out.push([y, x]);
    }
  }
  return out;
}

// OpenFreeMap vector basemap (no key) with every label forced to the English
// name, falling back to the Latin transliteration and then the local name.
const ENGLISH_NAME = ['coalesce', ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']];
function EnglishBasemap() {
  const map = useMap();
  useEffect(() => {
    let layer;
    let cancelled = false;
    (async () => {
      const [{ default: L }, style] = await Promise.all([
        import('leaflet'),
        fetch('https://tiles.openfreemap.org/styles/liberty').then((r) => r.json()),
        import('@maplibre/maplibre-gl-leaflet'),
      ]);
      if (cancelled) return;
      for (const l of style.layers) {
        const tf = l.layout?.['text-field'];
        if (Array.isArray(tf) && JSON.stringify(tf).includes('name')) l.layout['text-field'] = ENGLISH_NAME;
      }
      layer = L.maplibreGL({ style, attribution: '&copy; OpenStreetMap contributors &copy; OpenFreeMap' });
      layer.addTo(map);
    })().catch(() => {});
    return () => { cancelled = true; if (layer) map.removeLayer(layer); };
  }, [map]);
  return null;
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const lats = points.map((p) => p[0]), lngs = points.map((p) => p[1]);
    map.fitBounds([[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
      { padding: [60, 60], maxZoom: 6 });
  }, [points, map]);
  return null;
}

// Belt-and-braces alongside the modal's own scroll fix: while a modal (intro
// or leg detail) is open, the map underneath can't be dragged/zoomed even if
// a touch somehow lands on it, so a scroll gesture on the card never bleeds
// through to pan the map behind it.
function MapLock({ active }) {
  const map = useMap();
  useEffect(() => {
    const controls = [map.dragging, map.touchZoom, map.scrollWheelZoom, map.doubleClickZoom];
    controls.forEach((c) => (active ? c.disable() : c.enable()));
  }, [active, map]);
  return null;
}

// Leaflet sizes its internal canvas/panes once, from its container's pixel
// size at mount - it doesn't know when that size later changes for reasons
// outside its control (a web font swapping in and nudging the header's
// height, a mobile browser's address bar collapsing and changing 100dvh,
// rotating the device). When that happens without an explicit invalidateSize
// call, the map keeps rendering at its old (wrong) size, which is what makes
// the zoom control and attribution appear to float over content above the
// map - they're positioned correctly *within a stale-sized container*.
// Watching the container directly, rather than only window resize, catches
// every case that can shrink or grow it, whatever the cause.
function MapResizeSync() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(container);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

// Nudge apart any dots that would render on top of (or overlapping) one another,
// working in screen pixels at the current zoom so distinct-but-close updates stay
// legible whether you're zoomed out over the whole trip or in on one city.
const DOT_GAP = 4; // px left between the edges of two resolved dots
function declutter(map, zoom, markers) {
  const pts = markers.map((m) => map.project(m.pt, zoom));
  for (let iter = 0; iter < 48; iter++) {
    let moved = false;
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        let dx = pts[j].x - pts[i].x, dy = pts[j].y - pts[i].y;
        let dist = Math.hypot(dx, dy);
        const minDist = markers[i].radius + markers[j].radius + DOT_GAP;
        if (dist < minDist) {
          moved = true;
          if (dist < 0.01) { dx = 1; dy = 0; dist = 1; }
          const push = (minDist - dist) / 2, ux = dx / dist, uy = dy / dist;
          pts[i].x -= ux * push; pts[i].y -= uy * push;
          pts[j].x += ux * push; pts[j].y += uy * push;
        }
      }
    }
    if (!moved) break;
  }
  return markers.map((m, i) => {
    const ll = map.unproject(pts[i], zoom);
    return { ...m, pt: [ll.lat, ll.lng] };
  });
}

// Where both teams have reached the same checkpoint, the two arrival dots
// collapse into one bigger two-tone dot for as long as they'd otherwise touch.
// Zoom in far enough and they part again, each at its true spot - the dots
// are never nudged away from where the team actually was.
const BOTH_STOP_RADIUS = 10;
function mergeStops(map, zoom, markers) {
  const arrivals = new Map(); // legIndex -> { ben, miki } arrival markers
  markers.forEach((m) => {
    if (!m.stop || m.teams.length !== 1) return;
    const pair = arrivals.get(m.legIndex) ?? {};
    pair[m.teams[0]] = m;
    arrivals.set(m.legIndex, pair);
  });
  const merged = new Set();
  const both = [];
  arrivals.forEach(({ ben, miki }) => {
    if (!ben || !miki) return;
    const a = map.project(ben.pt, zoom), b = map.project(miki.pt, zoom);
    if (a.distanceTo(b) >= ben.radius + miki.radius + DOT_GAP) return;
    const mid = map.unproject(a.add(b).divideBy(2), zoom);
    merged.add(ben); merged.add(miki);
    both.push({
      key: `both-${ben.key}`, pt: [mid.lat, mid.lng], legIndex: ben.legIndex, stop: true, radius: BOTH_STOP_RADIUS,
      teams: ['ben', 'miki'], together: false, heading: ben.place,
      pulse: [...ben.pulse, ...miki.pulse],
      parts: [ben, miki].map((m) => ({ ...m.parts[0], label: m.parts[0].detail })),
    });
  });
  return [...markers.filter((m) => !merged.has(m)), ...both];
}

// Left half Ben & John, right half Miki & Bruce (the timeline's lanes). A
// reunion leg gets a gold ring instead of white. Icons are cached so a
// re-render hands Leaflet the same object and the dot isn't rebuilt.
const splitIcons = new Map();
function splitIcon(radius, together) {
  const k = `${radius}-${together}`;
  if (!splitIcons.has(k)) {
    const d = radius * 2;
    splitIcons.set(k, L.divIcon({
      className: 'rodeo-split-icon',
      html: `<span class="rodeo-split${together ? ' together' : ''}" style="--a:${TEAMS.ben.color};--b:${TEAMS.miki.color};--ring:${COLLECTIVE_COLOR}"></span>`,
      iconSize: [d, d], iconAnchor: [radius, radius], tooltipAnchor: [radius + 2, 0],
    }));
  }
  return splitIcons.get(k);
}

function DotTooltip({ m }) {
  const photos = m.parts.map((p) => p.photo).filter(Boolean);
  const seen = !m.pulse.length ? null
    : m.teams.length === 1 ? 'Last seen here, on the road'
    : m.pulse.length > 1 ? 'Both pairs last seen here, on the road'
    : `${TEAMS[m.pulse[0]].name} last seen here, on the road`;
  return (
    <>
      {photos.length === 1 && <img className="rodeo-tooltip-thumb" src={photos[0]} alt="" />}
      {photos.length > 1 && (
        <div className="rodeo-tooltip-photos">
          {photos.map((src, i) => <img key={i} className="rodeo-tooltip-thumb" src={src} alt="" />)}
        </div>
      )}
      {m.heading && <><b>{m.heading}</b><br /></>}
      {m.parts.map((p, i) => (
        <div key={i}>
          {p.team && <><b style={{ color: TEAMS[p.team].color }}>{TEAMS[p.team].name}</b><br /></>}
          {p.label}
        </div>
      ))}
      {seen && <em>{seen}</em>}
    </>
  );
}

function Markers({ markers, onSelect }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);
    return () => map.off('zoomend', onZoom);
  }, [map]);

  const placed = useMemo(() => declutter(map, zoom, mergeStops(map, zoom, markers)), [map, zoom, markers]);

  // A pulsing ring sits under the dot of each pair that's on the road (two,
  // staggered, when both are). It's laid out from the decluttered position,
  // so it stays on its dot, and it's not interactive, so taps still reach the dot.
  return placed.flatMap((m) => [
    ...m.pulse.map((tk, i) => (
      <CircleMarker key={`${m.key}-pulse-${tk}`} center={m.pt} radius={m.radius + 5 + i * 4}
        pathOptions={{ color: TEAMS[tk].color, weight: 3, fill: false, interactive: false, className: i ? 'rodeo-pulse alt' : 'rodeo-pulse' }} />
    )),
    m.teams.length > 1 ? (
      <Marker key={m.key} position={m.pt} icon={splitIcon(m.radius, m.together)}
        eventHandlers={{ click: () => onSelect(m.legIndex) }}>
        <Tooltip><DotTooltip m={m} /></Tooltip>
      </Marker>
    ) : (
      <CircleMarker key={m.key} center={m.pt} radius={m.radius}
        pathOptions={{ color: '#fff', weight: 2, fillColor: TEAMS[m.teams[0]].color, fillOpacity: 1 }}
        eventHandlers={{ click: () => onSelect(m.legIndex) }}>
        <Tooltip><DotTooltip m={m} /></Tooltip>
      </CircleMarker>
    ),
  ]);
}

export default function RodeoPublic() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [step, setStep] = useState(0);
  const [intro, setIntro] = useState(() => !introSeen());
  const [bannerOpen, setBannerOpen] = useState(true);
  const [view, setView] = useState('map');
  const [newestFirst, setNewestFirst] = useState(true);
  const [openLeg, setOpenLeg] = useState(null);
  const isMobile = useIsMobile();

  function closeIntro() {
    markIntroSeen();
    setIntro(false);
  }

  useEffect(() => {
    fetch(RODEO_SNAPSHOT_URL)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(setData)
      .catch(() => setErr('Nothing has been published yet - check back soon.'));
  }, []);

  // Flatten a leg update into its orderable dots: waypoints (oldest first)
  // first, the leg summary itself last (it's written once, at the end).
  function updatePoints(u) {
    const pts = sortWaypoints(u.waypoints)
      .filter((w) => w.lat != null && w.lng != null)
      .map((w) => ({ ...w, isWaypoint: true }));
    if (u.lat != null && u.lng != null) pts.push({ ...u, isWaypoint: false });
    return pts;
  }

  // point per team per leg (collective legs contribute a shared point to both);
  // a leg can now contribute several points per team, one per waypoint plus the summary.
  // ptKey names a point by its leg and place in that leg's order, so the same
  // spot can be recognised across both teams' paths and the collective list.
  const teamPaths = useMemo(() => {
    const paths = { ben: [], miki: [] };
    if (!data) return paths;
    data.legs.forEach((leg, li) => {
      const collective = leg.updates.find((u) => u.team == null);
      ['ben', 'miki'].forEach((tk) => {
        const u = leg.scope === 'together' ? collective : leg.updates.find((x) => x.team === tk);
        if (!u) return;
        updatePoints(u).forEach((point, pi) => {
          paths[tk].push({ pt: [point.lat, point.lng], legIndex: li, team: tk, u, point, ptKey: `${li}:${pi}` });
        });
      });
    });
    return paths;
  }, [data]);

  const collectivePoints = useMemo(() => {
    if (!data) return [];
    const out = [];
    data.legs.forEach((leg, li) => {
      if (leg.scope !== 'together') return;
      const u = leg.updates.find((x) => x.team == null);
      if (!u) return;
      updatePoints(u).forEach((point, pi) => out.push({ pt: [point.lat, point.lng], legIndex: li, u, point, ptKey: `${li}:${pi}` }));
    });
    return out;
  }, [data]);

  const allPoints = useMemo(
    () => [...teamPaths.ben.map((p) => p.pt), ...teamPaths.miki.map((p) => p.pt), ...collectivePoints.map((p) => p.pt)],
    [teamPaths, collectivePoints]
  );

  const markers = useMemo(() => {
    const out = [];
    if (!data) return out;
    // While a pair is on the road, ring their latest known position: their
    // newest waypoint on the current leg, else where the previous leg left them.
    // The leg's own summary pin doesn't count - that's the destination.
    function lastSeenKey(tk) {
      const li = data.legs.reduce((acc, l, i) => (l.on_the_road?.[tk] ? i : acc), -1);
      let key = null;
      if (li >= 0) {
        teamPaths[tk].forEach((p) => {
          if (p.legIndex === li ? p.point.isWaypoint : p.legIndex < li) key = p.ptKey;
        });
      }
      return key;
    }
    const seen = { ben: lastSeenKey('ben'), miki: lastSeenKey('miki') };

    // Race legs: a dot per team per point. Where both teams reached the same
    // stop, <Markers> merges the two arrival dots into one two-tone dot.
    ['ben', 'miki'].forEach((tk) => {
      teamPaths[tk].forEach((p) => {
        if (p.u.team == null) return; // reunion legs are drawn once, below
        const place = [p.point.place_city, p.point.place_country].filter(Boolean).join(', ');
        const stop = !p.point.isWaypoint;
        const toPlace = data.legs[p.legIndex].to_place;
        const label = stop ? `${toPlace}${p.point.title ? ` - ${p.point.title}` : ''}` : (p.point.title || place);
        out.push({
          key: `${tk}-${p.ptKey}`, pt: p.pt, legIndex: p.legIndex, stop, radius: stop ? 7 : 5,
          teams: [tk], together: false, place: toPlace,
          pulse: seen[tk] === p.ptKey ? [tk] : [],
          parts: [{ team: tk, label, detail: stop ? (p.point.title || '') : label, photo: p.point.photos?.[0]?.url }],
        });
      });
    });
    // Reunion legs: both teams are there, so one two-tone dot (gold-ringed).
    collectivePoints.forEach((p) => {
      const place = [p.point.place_city, p.point.place_country].filter(Boolean).join(', ');
      const stop = !p.point.isWaypoint;
      const label = stop ? data.legs[p.legIndex].to_place : (p.point.title || place);
      out.push({
        key: `c-${p.ptKey}`, pt: p.pt, legIndex: p.legIndex, stop, radius: stop ? BOTH_STOP_RADIUS : 7,
        teams: ['ben', 'miki'], together: true, heading: 'Together',
        pulse: ['ben', 'miki'].filter((tk) => seen[tk] === p.ptKey),
        parts: [{ team: null, label, photo: p.point.photos?.[0]?.url }],
      });
    });
    return out;
  }, [teamPaths, collectivePoints, data]);

  // Same outer shell (and same 100dvh sizing) as the loaded view below, so
  // there's no height mismatch/jump between the loading and loaded states on
  // mobile, where 100vh alone can disagree with the actual visible viewport.
  if (err) return <div className="rodeo-public map-view"><div className="rodeo-empty"><p>{err}</p></div></div>;
  if (!data) return <div className="rodeo-public map-view"><div className="rodeo-loading">Loading the Rodeo...</div></div>;

  // Leg 0 holds the pre-trip updates; the first real envelope is Leg 1, and
  // opening it (in HQ) republishes the snapshot, which retires the banner.
  const preTrip = !data.legs.some((l) => l.leg_no > 0);

  const leader = data.scoreboard.ben === data.scoreboard.miki ? null
    : (data.scoreboard.ben > data.scoreboard.miki ? 'ben' : 'miki');

  // Legs arrive in leg_no order. li stays each leg's index in data.legs (it's
  // what openLeg points at) however the timeline is ordered.
  const legsShown = data.legs.map((leg, li) => [leg, li]);
  if (newestFirst) legsShown.reverse();

  return (
    <div className={`rodeo-public${view === 'map' ? ' map-view' : ''}`}>
      {intro && (
        <div className="rodeo-modal-backdrop">
          <div className={`rodeo-modal ${INTRO[step].hero ? 'hero' : ''}`}>
            {INTRO[step].hero && <img className="rodeo-modal-hero" src="/rodeo-hero.png" alt="Ben, Miki, John and Bruce in front of Istanbul and European landmarks" />}
            <div className="rodeo-modal-body">
              <button className="rodeo-x" onClick={closeIntro} aria-label="Skip intro">×</button>
              <span className="rodeo-kicker">The Rodeo: Bosphorus or Bust</span>
              <h2>{INTRO[step].title}</h2>
              <div className="rodeo-modal-copy">{(isMobile && INTRO[step].mobileBody) || INTRO[step].body}</div>
              <button className="rodeo-btn big" onClick={() => (step < INTRO.length - 1 ? setStep(step + 1) : closeIntro())}>
                {INTRO[step].button}
              </button>
              <div className="rodeo-dots">{INTRO.map((_, i) => <span key={i} className={i === step ? 'on' : ''} />)}</div>
            </div>
          </div>
        </div>
      )}

      <header className="rodeo-header">
        <div className="rodeo-score" style={{ borderBottomColor: TEAMS.ben.color }}>
          <span className="rodeo-score-name" style={{ color: TEAMS.ben.color }}>
            {leader === 'ben' ? '👑 ' : ''}{TEAMS.ben.name}
          </span>
          <span className="rodeo-score-num">{data.scoreboard.ben}</span>
        </div>
        <div className="rodeo-masthead">
          <span className="rodeo-kicker">The Rodeo</span>
          <h1>Bosphorus or Bust</h1>
        </div>
        <div className="rodeo-score" style={{ borderBottomColor: TEAMS.miki.color }}>
          <span className="rodeo-score-name" style={{ color: TEAMS.miki.color }}>
            {leader === 'miki' ? '👑 ' : ''}{TEAMS.miki.name}
          </span>
          <span className="rodeo-score-num">{data.scoreboard.miki}</span>
        </div>
      </header>

      <div className="rodeo-toggle">
        <button className={view === 'map' ? 'on' : ''} onClick={() => setView('map')}>Map</button>
        <button className={view === 'timeline' ? 'on' : ''} onClick={() => setView('timeline')}>Timeline</button>
      </div>

      {view === 'map' && (
        <div className="rodeo-map">
          {/* Space is held while the intro is up (just hidden), so the map
              doesn't change size the moment the intro closes. */}
          {bannerOpen && preTrip && (
            <div className={`rodeo-trip-banner${intro ? ' waiting' : ''}`} role="status">
              <p>
                The trip commences on 23 October in Casablanca. In the meantime, check out the{' '}
                <button type="button" className="rodeo-trip-link" onClick={() => setView('timeline')}>timeline view</button>
                {' '}for some pre-trip updates.
              </p>
              <button type="button" className="rodeo-trip-x" onClick={() => setBannerOpen(false)} aria-label="Dismiss banner">×</button>
            </div>
          )}
          <MapContainer center={[37, 10]} zoom={4} scrollWheelZoom style={{ flex: '1 1 auto', minHeight: 0, width: '100%' }}>
            <EnglishBasemap />
            <FitBounds points={allPoints} />
            {['ben', 'miki'].map((tk) => (
              <Polyline key={tk} positions={curved(teamPaths[tk].map((p) => p.pt), tk)}
                pathOptions={{ color: TEAMS[tk].color, weight: 2.5, dashArray: '2 8', lineCap: 'round' }} />
            ))}
            <Markers markers={markers} onSelect={setOpenLeg} />
            <MapLock active={intro || openLeg != null} />
            <MapResizeSync />
          </MapContainer>
          <p className="rodeo-map-note">Tap any dot for the full story. A half-and-half dot is a checkpoint both teams have reached; the trails curve apart in between.</p>
        </div>
      )}

      {view === 'timeline' && (
        <div className="rodeo-timeline">
          <ScoreboardBreakdown data={data} />
          <div className="rodeo-order" role="group" aria-label="Order of legs">
            <button type="button" className={newestFirst ? 'on' : ''} aria-pressed={newestFirst} onClick={() => setNewestFirst(true)}>Latest first</button>
            <button type="button" className={newestFirst ? '' : 'on'} aria-pressed={!newestFirst} onClick={() => setNewestFirst(false)}>Oldest first</button>
          </div>
          <div className="rodeo-spine" />
          {legsShown.map(([leg, li]) => {
            if (leg.scope === 'together') {
              const u = leg.updates.find((x) => x.team == null);
              return (
                <div key={li} className="rodeo-leg together">
                  <div className="rodeo-merge-card" onClick={() => setOpenLeg(li)}>
                    <span className="rodeo-leg-tag">Leg {leg.leg_no} · together</span>
                    <h3>{leg.to_place}{u?.title ? `: ${u.title}` : ''}</h3>
                    {(u?.best_meal || u?.worst_meal) && (
                      <div className="rodeo-stats">
                        {u.best_meal && <span>🍽️ Best: {u.best_meal}</span>}
                        {u.worst_meal && <span>🤢 Worst: {u.worst_meal}</span>}
                      </div>
                    )}
                    <PhotoThumb photos={u?.photos} />
                    <TileTeaser md={u?.body} />
                    <TileMore u={u} />
                    <span className="rodeo-nopoints">reunion leg · no points</span>
                  </div>
                </div>
              );
            }
            return (
              <div key={li} className="rodeo-leg race">
                <span className="rodeo-leg-marker">Leg {leg.leg_no}</span>
                {['ben', 'miki'].map((tk) => {
                  const u = leg.updates.find((x) => x.team === tk);
                  const road = !!leg.on_the_road?.[tk];
                  return (
                    <div key={tk} className={`rodeo-card side-${TEAMS[tk].side}`}
                      style={{ borderColor: TEAMS[tk].color }} onClick={() => u && setOpenLeg(li)}>
                      {!u ? (
                        <p className="rodeo-pending">
                          {road ? <><RoadBadge /> {TEAMS[tk].name}: no story yet.</> : `${TEAMS[tk].name} has not filed yet.`}
                        </p>
                      ) : (
                        <>
                          <div className="rodeo-card-head">
                            <span style={{ color: TEAMS[tk].color }}>{TEAMS[tk].name}{road && <RoadBadge />}</span>
                            <span className="rodeo-leg-pts">{leg.points?.[tk] ?? 0} pts</span>
                          </div>
                          {u.title && <h3>{u.title}</h3>}
                          <ScoreChips leg={leg} team={tk} u={u} />
                          {(u.best_meal || u.worst_meal) && (
                            <div className="rodeo-stats">
                              {u.best_meal && <span>🍽️ Best: {u.best_meal}</span>}
                              {u.worst_meal && <span>🤢 Worst: {u.worst_meal}</span>}
                            </div>
                          )}
                          <PhotoThumb photos={u.photos} />
                          <TileTeaser md={u.body} />
                          <TileMore u={u} />
                        </>
                      )}
                    </div>
                  );
                })}
                {spendLine(leg.spend_summary) && <p className="rodeo-spend-line">💸 {spendLine(leg.spend_summary)}</p>}
              </div>
            );
          })}
        </div>
      )}

      {openLeg != null && (
        <LegDetail key={openLeg} leg={data.legs[openLeg]} onClose={() => setOpenLeg(null)} />
      )}
    </div>
  );
}

// Single representative photo, used anywhere space is tight (timeline cards,
// merge cards). A badge shows how many more are in the full gallery.
function PhotoThumb({ photos }) {
  if (!photos?.length) return null;
  return (
    <div className="rodeo-thumb">
      <img src={photos[0].url} alt={photos[0].caption || ''} loading="lazy" />
      {photos.length > 1 && <span className="rodeo-thumb-count">+{photos.length - 1}</span>}
    </div>
  );
}

// Full gallery for the leg detail modal: one photo at a time, with prev/next
// arrows and a thumbnail strip to jump directly to any photo.
function PhotoCarousel({ photos }) {
  const [idx, setIdx] = useState(0);
  if (!photos?.length) return null;
  const i = Math.min(idx, photos.length - 1);
  const photo = photos[i];
  const go = (d) => setIdx((idx + d + photos.length) % photos.length);
  return (
    <div className="rodeo-carousel">
      <div className="rodeo-carousel-frame">
        {photos.length > 1 && (
          <button type="button" className="rodeo-carousel-nav prev" onClick={() => go(-1)} aria-label="Previous photo">‹</button>
        )}
        <img src={photo.url} alt={photo.caption || ''} />
        {photos.length > 1 && (
          <button type="button" className="rodeo-carousel-nav next" onClick={() => go(1)} aria-label="Next photo">›</button>
        )}
        {photos.length > 1 && <span className="rodeo-carousel-count">{i + 1} / {photos.length}</span>}
      </div>
      {photo.caption && <p className="rodeo-carousel-caption">{photo.caption}</p>}
      {photos.length > 1 && (
        <div className="rodeo-carousel-thumbs">
          {photos.map((p, pi) => (
            <button key={pi} type="button" className={`rodeo-carousel-thumb${pi === i ? ' on' : ''}`} onClick={() => setIdx(pi)}>
              <img src={p.url} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Public comments on a leg, Turnstile-verified and moderated (see
// supabase/functions/rodeo-comment). Reads live from Supabase (not the static
// snapshot) so approving a comment or reply needs no republish.
function Comments({ legId }) {
  const [comments, setComments] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const widgetRef = useRef(null);
  const widgetId = useRef(null);

  useEffect(() => {
    let cancelled = false;
    rodeo.from('rodeo_comments')
      .select('id,author_name,body,created_at,reply_body,replied_at,replied_by')
      .eq('leg_id', legId).eq('published', true)
      .order('created_at', { ascending: true })
      .then(({ data }) => { if (!cancelled) { setComments(data ?? []); setLoaded(true); } });
    return () => { cancelled = true; };
  }, [legId]);

  // The Turnstile script loads async, so it may not be there yet if a leg is
  // opened straight after the page loads - wait for it (up to ~15s).
  useEffect(() => {
    if (!RODEO_TURNSTILE_SITE_KEY) return;
    let tries = 0;
    const tryRender = () => {
      if (!widgetRef.current || !window.turnstile) return false;
      // Even 'flexible' won't go under 300px, which overflows a phone's
      // narrow comment form; shrink the whole widget to fit instead.
      const room = widgetRef.current.clientWidth;
      if (room && room < 300) widgetRef.current.style.zoom = String(room / 300);
      widgetId.current = window.turnstile.render(widgetRef.current, {
        sitekey: RODEO_TURNSTILE_SITE_KEY,
        size: 'flexible', // fills the form's width instead of a fixed 300px
        callback: (t) => setToken(t),
      });
      return true;
    };
    const timer = tryRender() ? null : setInterval(() => {
      if (tryRender() || ++tries > 60) clearInterval(timer);
    }, 250);
    return () => {
      if (timer) clearInterval(timer);
      if (widgetId.current != null) window.turnstile?.remove(widgetId.current);
    };
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!body.trim()) { setStatus('Say something first.'); return; }
    if (!token) { setStatus('Please complete the check above.'); return; }
    setBusy(true); setStatus('');
    try {
      const res = await fetch(RODEO_COMMENT_FN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: RODEO_ANON_KEY,
          Authorization: `Bearer ${RODEO_ANON_KEY}`,
        },
        body: JSON.stringify({ leg_id: legId, author_name: name, body, turnstileToken: token }),
      });
      const result = await res.json();
      if (!res.ok || !result.ok) throw new Error(result.error || 'Could not post comment.');
      setBody('');
      setStatus("Thanks! Your comment is held for a quick check before it appears.");
      if (widgetId.current != null && window.turnstile) window.turnstile.reset(widgetId.current);
      setToken('');
    } catch (err) {
      setStatus(err.message || 'Could not post comment.');
    }
    setBusy(false);
  }

  return (
    <div className="rodeo-comments">
      <h4>Comments</h4>
      {loaded && comments.length === 0 && <p className="rodeo-muted">No comments yet - be the first.</p>}
      {comments.length > 0 && (
        <ul className="rodeo-comment-list">
          {comments.map((c) => (
            <li key={c.id} className="rodeo-comment">
              <b>{c.author_name || 'Someone'}</b>
              <p>{c.body}</p>
              {c.reply_body && (
                <div className="rodeo-comment-reply">
                  <b>{c.replied_by || 'Reply'}</b>
                  <p>{c.reply_body}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <form className="rodeo-comment-form" onSubmit={submit}>
        <input placeholder="Your name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        <textarea rows={2} placeholder="Leave a comment..." value={body} onChange={(e) => setBody(e.target.value)} />
        {RODEO_TURNSTILE_SITE_KEY && <div ref={widgetRef} />}
        <button type="submit" className="rodeo-btn ghost small" disabled={busy}>{busy ? 'Posting...' : 'Post comment'}</button>
        {status && <p className="rodeo-fx-preview">{status}</p>}
      </form>
    </div>
  );
}

function LegDetail({ leg, onClose }) {
  const ups = leg.updates.filter((u) => u.team != null || leg.scope === 'together');
  return (
    <div className="rodeo-modal-backdrop" onClick={onClose}>
      <div className="rodeo-modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="rodeo-modal-body">
          <button className="rodeo-x" onClick={onClose} aria-label="Close">×</button>
          <span className="rodeo-kicker">Leg {leg.leg_no}{leg.scope === 'together' ? ' · together' : ''}</span>
          <h2>{leg.from_place ? `${leg.from_place} to ` : ''}{leg.to_place}</h2>
          <div className={`rodeo-detail-grid ${ups.length > 1 ? 'two' : 'one'}`}>
            {ups.map((u, i) => {
              const t = u.team ? TEAMS[u.team] : { name: 'Everyone', color: COLLECTIVE_COLOR };
              return (
                <div key={i} className="rodeo-detail-col" style={{ borderColor: t.color }}>
                  <h3 style={{ color: t.color }}>
                    {t.name}{u.team && leg.points ? ` · ${leg.points[u.team] ?? 0} pts` : ''}
                    {u.team && leg.on_the_road?.[u.team] && <RoadBadge />}
                  </h3>
                  {u.team && <ScoreChips leg={leg} team={u.team} u={u} listCountries />}
                  <div className="rodeo-stats">
                    {!u.team && legTime(u) && <span>⏱ {legTime(u)}</span>}
                    {!u.team && u.countries?.length > 0 && <span>🌍 {u.countries.join(', ')}</span>}
                    {u.best_meal && <span>🍽️ Best: {u.best_meal}</span>}
                    {u.worst_meal && <span>🤢 Worst: {u.worst_meal}</span>}
                  </div>
                  {u.body && <div className="rodeo-body" dangerouslySetInnerHTML={html(u.body)} />}
                  <PhotoCarousel photos={u.photos} />
                  {u.waypoints?.length > 0 && (
                    <div className="rodeo-waypoints-stack">
                      {sortWaypoints(u.waypoints).map((w, wi) => (
                        <div key={wi} className="rodeo-waypoint-card">
                          {w.title && <h4>{w.title}{isNewWaypoint(w.arrived_at) && <span className="rodeo-new-badge">New</span>}</h4>}
                          {(w.place_city || w.place_country || w.arrived_at) && (
                            <p className="rodeo-waypoint-place">
                              {[[w.place_city, w.place_country].filter(Boolean).join(', '), fmtWaypointDate(w.arrived_at)].filter(Boolean).join(' · ')}
                            </p>
                          )}
                          {w.body && <div className="rodeo-body" dangerouslySetInnerHTML={html(w.body)} />}
                          <PhotoCarousel photos={w.photos} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {spendLine(leg.spend_summary) && <p className="rodeo-spend-line">💸 {spendLine(leg.spend_summary)}</p>}
          <Comments legId={leg.id} />
        </div>
      </div>
    </div>
  );
}
