import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { rodeo, RODEO_SNAPSHOT_URL, RODEO_COMMENT_FN_URL, RODEO_TURNSTILE_SITE_KEY, RODEO_ANON_KEY, TEAMS, COLLECTIVE_COLOR } from './rodeoSupabase.js';

const INTRO = [
  {
    title: 'The premise',
    hero: true,
    body: (
      <>
        <p>Welcome to The Rodeo. A stack of sealed envelopes control our life across a continent over the next 3 weeks.</p>
        <p>At each stop we tear open an envelope, learn our next destination, and split into two teams: Ben &amp; John versus Miki &amp; Bruce. Each pair races there however they dare. Cheapest pair wins a point. Fastest pair wins a point. Every country we drag ourselves through is worth one more.</p>
        <p>Then we reunite, compare disasters, and open the next envelope. Casablanca to Constantinople, six different legs, three weeks, and one Bosphorus at the end.</p>
      </>
    ),
    // Shorter, screen-fitting version for phones - the desktop copy above
    // reads fine with room to spare, but is a lot of scrolling on mobile.
    mobileBody: (
      <>
        <p>Sealed envelopes control our life across a continent for the next 3 weeks.</p>
        <p>Each stop we open one, learn the destination, and split into two teams: Ben &amp; John vs Miki &amp; Bruce. Cheapest pair, fastest pair, and every country crossed each win a point.</p>
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
        <p>Dots on the map are us: two dotted trails, one per team, curving apart so you can tell us apart even when we end up in the same spot.</p>
        <p>The timeline runs down the middle, Ben &amp; John on the left, Miki &amp; Bruce on the right, and every so often the lanes merge into one card: that is a leg we travelled together, no points at stake, just snacks.</p>
        <p>Hover a dot for the gist, tap it for the full story. The scoreboard keeps the peace.</p>
      </>
    ),
    // "Hover" doesn't mean anything on a touchscreen, so the mobile copy
    // drops it rather than just trimming words.
    mobileBody: (
      <>
        <p>Dots on the map are us - one trail per team, curving apart so you can tell who's who.</p>
        <p>The timeline runs Ben &amp; John on the left, Miki &amp; Bruce on the right. Where the lanes merge into one card, that's a leg we travelled together - no points, just snacks.</p>
        <p>Tap a dot for the full story.</p>
      </>
    ),
    button: "Let's go!",
  },
];

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

function money(u) {
  if (u?.money_minor == null) return null;
  const amt = `${(u.money_minor / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })} ${u.currency || ''}`.trim();
  if (u.money_nzd_minor == null || (u.currency || '').toUpperCase() === 'NZD') return amt;
  return `${amt} (≈ NZD $${(u.money_nzd_minor / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })})`;
}
function legTime(u) {
  if (u?.duration_minutes == null) return null;
  const h = Math.floor(u.duration_minutes / 60), m = u.duration_minutes % 60;
  return `${h ? h + 'h' : ''}${m ? ' ' + m + 'm' : (h ? '' : '0m')}`.trim();
}
function html(md) { return { __html: DOMPurify.sanitize(marked.parse(md || '')) }; }

function fmtNzd(minor) {
  return `$${((minor ?? 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// Points-by-category and running spend, shown above the timeline.
function ScoreboardBreakdown({ data }) {
  const breakdown = data.scoreboard_breakdown;
  const spend = data.spend_nzd_minor;
  const shared = data.shared_spend_nzd_minor;
  if (!breakdown && !spend) return null;
  return (
    <div className="rodeo-scorecard">
      {['ben', 'miki'].map((tk) => {
        const b = breakdown?.[tk];
        return (
          <div key={tk} className="rodeo-scorecard-team" style={{ borderColor: TEAMS[tk].color }}>
            <h3 style={{ color: TEAMS[tk].color }}>{TEAMS[tk].name}</h3>
            <div className="rodeo-scorecard-pts">
              <span>💸 {b?.money ?? 0} cheapest</span>
              <span>⏱ {b?.time ?? 0} fastest</span>
              <span>🌍 {b?.countries ?? 0} countries</span>
            </div>
            <div className="rodeo-scorecard-spend">Spent so far: {fmtNzd(spend?.[tk])} NZD</div>
          </div>
        );
      })}
      {shared > 0 && (
        <p className="rodeo-scorecard-shared">+ {fmtNzd(shared)} NZD spent together, not attributed to either team</p>
      )}
    </div>
  );
}

// ---- map geometry -----------------------------------------------------------
const OFFSET = 0.22;        // degrees each team is nudged so co-located dots split
const BOW = 0.16;           // curve bow as a fraction of segment length

function offsetPoint(lat, lng, teamKey) {
  const s = teamKey === 'ben' ? -1 : 1;
  return [lat + s * OFFSET, lng + s * OFFSET];
}

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

function Markers({ markers, onSelect }) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useEffect(() => {
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);
    return () => map.off('zoomend', onZoom);
  }, [map]);

  const placed = useMemo(() => declutter(map, zoom, markers), [map, zoom, markers]);

  return placed.map((m) => (
    <CircleMarker key={m.key} center={m.pt} radius={m.radius}
      pathOptions={{ color: '#fff', weight: 2, fillColor: m.color, fillOpacity: 1 }}
      eventHandlers={{ click: () => onSelect(m.legIndex) }}>
      <Tooltip>{m.tooltip}</Tooltip>
    </CircleMarker>
  ));
}

export default function RodeoPublic() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [step, setStep] = useState(0);
  const [intro, setIntro] = useState(true);
  const [view, setView] = useState('map');
  const [openLeg, setOpenLeg] = useState(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetch(RODEO_SNAPSHOT_URL)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(setData)
      .catch(() => setErr('The snapshot has not been published yet. Run the "Publish Rodeo snapshot" Action.'));
  }, []);

  // Flatten a leg update into its orderable dots: waypoints (as dropped)
  // first, the leg summary itself last (it's written once, at the end).
  function updatePoints(u) {
    const pts = (u.waypoints || [])
      .filter((w) => w.lat != null && w.lng != null)
      .map((w) => ({ ...w, isWaypoint: true }));
    if (u.lat != null && u.lng != null) pts.push({ ...u, isWaypoint: false });
    return pts;
  }

  // point per team per leg (collective legs contribute a shared point to both);
  // a leg can now contribute several points per team, one per waypoint plus the summary.
  const teamPaths = useMemo(() => {
    const paths = { ben: [], miki: [] };
    if (!data) return paths;
    data.legs.forEach((leg, li) => {
      const collective = leg.updates.find((u) => u.team == null);
      ['ben', 'miki'].forEach((tk) => {
        const u = leg.scope === 'together' ? collective : leg.updates.find((x) => x.team === tk);
        if (!u) return;
        updatePoints(u).forEach((point) => {
          paths[tk].push({ pt: offsetPoint(point.lat, point.lng, tk), legIndex: li, team: tk, u, point });
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
      updatePoints(u).forEach((point) => out.push({ pt: [point.lat, point.lng], legIndex: li, u, point }));
    });
    return out;
  }, [data]);

  const allPoints = useMemo(
    () => [...teamPaths.ben.map((p) => p.pt), ...teamPaths.miki.map((p) => p.pt), ...collectivePoints.map((p) => p.pt)],
    [teamPaths, collectivePoints]
  );

  const markers = useMemo(() => {
    const out = [];
    ['ben', 'miki'].forEach((tk) => {
      teamPaths[tk].forEach((p, i) => {
        const place = [p.point.place_city, p.point.place_country].filter(Boolean).join(', ');
        const label = p.point.isWaypoint
          ? (p.point.title || place)
          : `${data.legs[p.legIndex].to_place}${p.point.title ? ` - ${p.point.title}` : ''}`;
        out.push({
          key: `${tk}-${i}`, pt: p.pt, radius: p.point.isWaypoint ? 5 : 7, color: TEAMS[tk].color, legIndex: p.legIndex,
          tooltip: (
            <>
              {p.point.photos?.[0] && <img className="rodeo-tooltip-thumb" src={p.point.photos[0].url} alt="" />}
              <b style={{ color: TEAMS[tk].color }}>{TEAMS[tk].name}</b><br />
              {label}
            </>
          ),
        });
      });
    });
    collectivePoints.forEach((p, i) => {
      const place = [p.point.place_city, p.point.place_country].filter(Boolean).join(', ');
      const label = p.point.isWaypoint ? (p.point.title || place) : data.legs[p.legIndex].to_place;
      out.push({
        key: `c-${i}`, pt: p.pt, radius: p.point.isWaypoint ? 6 : 8, color: COLLECTIVE_COLOR, legIndex: p.legIndex,
        tooltip: (
          <>
            {p.point.photos?.[0] && <img className="rodeo-tooltip-thumb" src={p.point.photos[0].url} alt="" />}
            <b>Together</b><br />{label}
          </>
        ),
      });
    });
    return out;
  }, [teamPaths, collectivePoints, data]);

  // Same outer shell (and same 100dvh sizing) as the loaded view below, so
  // there's no height mismatch/jump between the loading and loaded states on
  // mobile, where 100vh alone can disagree with the actual visible viewport.
  if (err) return <div className="rodeo-public map-view"><div className="rodeo-empty"><p>{err}</p></div></div>;
  if (!data) return <div className="rodeo-public map-view"><div className="rodeo-loading">Loading the Rodeo...</div></div>;

  const leader = data.scoreboard.ben === data.scoreboard.miki ? null
    : (data.scoreboard.ben > data.scoreboard.miki ? 'ben' : 'miki');

  return (
    <div className={`rodeo-public${view === 'map' ? ' map-view' : ''}`}>
      {intro && (
        <div className="rodeo-modal-backdrop">
          <div className={`rodeo-modal ${INTRO[step].hero ? 'hero' : ''}`}>
            {INTRO[step].hero && <img className="rodeo-modal-hero" src="/rodeo-hero.png" alt="Ben, Miki, John and Bruce in front of Istanbul and European landmarks" />}
            <div className="rodeo-modal-body">
              <button className="rodeo-x" onClick={() => setIntro(false)} aria-label="Skip intro">×</button>
              <span className="rodeo-kicker">The Rodeo: Bosphorus or Bust</span>
              <h2>{INTRO[step].title}</h2>
              <div className="rodeo-modal-copy">{(isMobile && INTRO[step].mobileBody) || INTRO[step].body}</div>
              <button className="rodeo-btn big" onClick={() => (step < INTRO.length - 1 ? setStep(step + 1) : setIntro(false))}>
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
          <MapContainer center={[37, 10]} zoom={4} scrollWheelZoom style={{ flex: '1 1 auto', minHeight: 0, width: '100%' }}>
            <TileLayer attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitBounds points={allPoints} />
            {['ben', 'miki'].map((tk) => (
              <Polyline key={tk} positions={curved(teamPaths[tk].map((p) => p.pt), tk)}
                pathOptions={{ color: TEAMS[tk].color, weight: 2.5, dashArray: '2 8', lineCap: 'round' }} />
            ))}
            <Markers markers={markers} onSelect={setOpenLeg} />
            <MapLock active={intro || openLeg != null} />
            <MapResizeSync />
          </MapContainer>
          <p className="rodeo-map-note">Tap any dot for the full story. Both teams often land in the same city, so the trails curve apart.</p>
        </div>
      )}

      {view === 'timeline' && (
        <div className="rodeo-timeline">
          <ScoreboardBreakdown data={data} />
          <div className="rodeo-spine" />
          {data.legs.map((leg, li) => {
            if (leg.scope === 'together') {
              const u = leg.updates.find((x) => x.team == null);
              return (
                <div key={li} className="rodeo-leg together">
                  <div className="rodeo-merge-card" onClick={() => setOpenLeg(li)}>
                    <span className="rodeo-leg-tag">Leg {leg.leg_no} · together</span>
                    <h3>{leg.to_place}{u?.title ? `: ${u.title}` : ''}</h3>
                    {u?.body && <div className="rodeo-body" dangerouslySetInnerHTML={html(u.body)} />}
                    {(u?.best_meal || u?.worst_meal) && (
                      <div className="rodeo-stats">
                        {u.best_meal && <span>🍽️ Best: {u.best_meal}</span>}
                        {u.worst_meal && <span>🤢 Worst: {u.worst_meal}</span>}
                      </div>
                    )}
                    <PhotoThumb photos={u?.photos} />
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
                  return (
                    <div key={tk} className={`rodeo-card side-${TEAMS[tk].side}`}
                      style={{ borderColor: TEAMS[tk].color }} onClick={() => u && setOpenLeg(li)}>
                      {!u ? <p className="rodeo-pending">{TEAMS[tk].name} has not filed yet.</p> : (
                        <>
                          <div className="rodeo-card-head">
                            <span style={{ color: TEAMS[tk].color }}>{TEAMS[tk].name}</span>
                            <span className="rodeo-leg-pts">{leg.points?.[tk] ?? 0} pts</span>
                          </div>
                          {u.title && <h3>{u.title}</h3>}
                          <div className="rodeo-stats">
                            {money(u) && <span>💸 {money(u)}</span>}
                            {legTime(u) && <span>⏱ {legTime(u)}</span>}
                            {u.countries?.length > 0 && <span>🌍 {u.countries.length}</span>}
                            {u.best_meal && <span>🍽️ Best: {u.best_meal}</span>}
                            {u.worst_meal && <span>🤢 Worst: {u.worst_meal}</span>}
                          </div>
                          {u.body && <div className="rodeo-body" dangerouslySetInnerHTML={html(u.body)} />}
                          <PhotoThumb photos={u.photos} />
                        </>
                      )}
                    </div>
                  );
                })}
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
// snapshot) so a new comment or reply shows up without waiting on the next
// "Publish Rodeo snapshot" run.
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

  useEffect(() => {
    if (!RODEO_TURNSTILE_SITE_KEY || !widgetRef.current || !window.turnstile) return;
    widgetId.current = window.turnstile.render(widgetRef.current, {
      sitekey: RODEO_TURNSTILE_SITE_KEY,
      callback: (t) => setToken(t),
    });
    return () => { if (widgetId.current != null) window.turnstile?.remove(widgetId.current); };
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
                  <h3 style={{ color: t.color }}>{t.name}</h3>
                  <div className="rodeo-stats">
                    {money(u) && <span>💸 {money(u)}</span>}
                    {legTime(u) && <span>⏱ {legTime(u)}</span>}
                    {u.countries?.length > 0 && <span>🌍 {u.countries.join(', ')}</span>}
                    {u.best_meal && <span>🍽️ Best: {u.best_meal}</span>}
                    {u.worst_meal && <span>🤢 Worst: {u.worst_meal}</span>}
                  </div>
                  {u.body && <div className="rodeo-body" dangerouslySetInnerHTML={html(u.body)} />}
                  <PhotoCarousel photos={u.photos} />
                  {u.waypoints?.length > 0 && (
                    <div className="rodeo-waypoints-stack">
                      {u.waypoints.map((w, wi) => (
                        <div key={wi} className="rodeo-waypoint-card">
                          {w.title && <h4>{w.title}</h4>}
                          {(w.place_city || w.place_country) && (
                            <p className="rodeo-waypoint-place">{[w.place_city, w.place_country].filter(Boolean).join(', ')}</p>
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
          <Comments legId={leg.id} />
        </div>
      </div>
    </div>
  );
}
