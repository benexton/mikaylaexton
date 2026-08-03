import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { marked } from 'marked';
import { RODEO_SNAPSHOT_URL, TEAMS, COLLECTIVE_COLOR } from './rodeoSupabase.js';

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
    button: 'Tell me how to read this',
  },
  {
    title: 'How to watch the carnage',
    body: (
      <>
        <p>Dots on the map are us: two dotted trails, one per team, curving apart so you can tell us apart even when we end up in the same spot.</p>
        <p>The timeline runs down the middle, Ben &amp; John on the left, Miki &amp; Bruce on the right, and every so often the lanes merge into one card: that is a leg we travelled together, no points at stake, just snacks.</p>
        <p>Hover a dot for the gist, tap it for the full story. The scoreboard keeps the peace.</p>
      </>
    ),
    button: 'Watch the Rodeo',
  },
];

function money(u) {
  if (u?.money_minor == null) return null;
  return `${(u.money_minor / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })} ${u.currency || ''}`.trim();
}
function legTime(u) {
  if (u?.duration_minutes == null) return null;
  const h = Math.floor(u.duration_minutes / 60), m = u.duration_minutes % 60;
  return `${h ? h + 'h' : ''}${m ? ' ' + m + 'm' : (h ? '' : '0m')}`.trim();
}
function html(md) { return { __html: marked.parse(md || '') }; }

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
      { padding: [40, 40] });
  }, [points, map]);
  return null;
}

export default function RodeoPublic() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [step, setStep] = useState(0);
  const [intro, setIntro] = useState(true);
  const [view, setView] = useState('timeline');
  const [openLeg, setOpenLeg] = useState(null);

  useEffect(() => {
    fetch(RODEO_SNAPSHOT_URL)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(setData)
      .catch(() => setErr('The snapshot has not been published yet. Run the "Publish Rodeo snapshot" Action.'));
  }, []);

  // point per team per leg (collective legs contribute a shared point to both)
  const teamPaths = useMemo(() => {
    const paths = { ben: [], miki: [] };
    if (!data) return paths;
    data.legs.forEach((leg, li) => {
      const collective = leg.updates.find((u) => u.team == null);
      ['ben', 'miki'].forEach((tk) => {
        const u = leg.scope === 'together' ? collective : leg.updates.find((x) => x.team === tk);
        if (u && u.lat != null && u.lng != null) paths[tk].push({ pt: offsetPoint(u.lat, u.lng, tk), legIndex: li, team: tk, u });
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
      if (u && u.lat != null && u.lng != null) out.push({ pt: [u.lat, u.lng], legIndex: li, u });
    });
    return out;
  }, [data]);

  const allPoints = useMemo(
    () => [...teamPaths.ben.map((p) => p.pt), ...teamPaths.miki.map((p) => p.pt), ...collectivePoints.map((p) => p.pt)],
    [teamPaths, collectivePoints]
  );

  if (err) return <div className="rodeo-empty"><p>{err}</p></div>;
  if (!data) return <div className="rodeo-loading">Loading the Rodeo...</div>;

  const leader = data.scoreboard.ben === data.scoreboard.miki ? null
    : (data.scoreboard.ben > data.scoreboard.miki ? 'ben' : 'miki');

  return (
    <div className="rodeo-public">
      {intro && (
        <div className="rodeo-modal-backdrop">
          <div className={`rodeo-modal ${INTRO[step].hero ? 'hero' : ''}`}>
            {INTRO[step].hero && <div className="rodeo-modal-hero" style={{ backgroundImage: 'url(/rodeo-hero.png)' }} />}
            <div className="rodeo-modal-body">
              <span className="rodeo-kicker">The Rodeo: Bosphorus or Bust</span>
              <h2>{INTRO[step].title}</h2>
              {INTRO[step].body}
              <button className="rodeo-btn big" onClick={() => (step < INTRO.length - 1 ? setStep(step + 1) : setIntro(false))}>
                {INTRO[step].button}
              </button>
              <div className="rodeo-dots">{INTRO.map((_, i) => <span key={i} className={i === step ? 'on' : ''} />)}</div>
            </div>
          </div>
        </div>
      )}

      <header className="rodeo-header">
        <div className="rodeo-masthead">
          <span className="rodeo-kicker">The Rodeo</span>
          <h1>Bosphorus or Bust</h1>
        </div>
        <figure className="rodeo-hero-frame">
          <img src="/rodeo-hero.png"
            alt="Ben, Miki, John and Bruce in front of a mash-up of Istanbul and European landmarks" />
        </figure>
        <div className="rodeo-scoreboard">
          {['ben', 'miki'].map((tk) => (
            <div key={tk} className="rodeo-score" style={{ borderBottomColor: TEAMS[tk].color }}>
              <span className="rodeo-score-name" style={{ color: TEAMS[tk].color }}>
                {leader === tk ? '👑 ' : ''}{TEAMS[tk].name}
              </span>
              <span className="rodeo-score-num">{data.scoreboard[tk]}</span>
            </div>
          ))}
        </div>
      </header>

      <div className="rodeo-toggle">
        <button className={view === 'timeline' ? 'on' : ''} onClick={() => setView('timeline')}>Timeline</button>
        <button className={view === 'map' ? 'on' : ''} onClick={() => setView('map')}>Map</button>
      </div>

      {view === 'map' && (
        <div className="rodeo-map">
          <MapContainer center={[37, 10]} zoom={4} scrollWheelZoom style={{ height: '70vh', width: '100%' }}>
            <TileLayer attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitBounds points={allPoints} />
            {['ben', 'miki'].map((tk) => (
              <Polyline key={tk} positions={curved(teamPaths[tk].map((p) => p.pt), tk)}
                pathOptions={{ color: TEAMS[tk].color, weight: 2.5, dashArray: '2 8', lineCap: 'round' }} />
            ))}
            {['ben', 'miki'].flatMap((tk) => teamPaths[tk].map((p, i) => (
              <CircleMarker key={`${tk}-${i}`} center={p.pt} radius={7}
                pathOptions={{ color: '#fff', weight: 2, fillColor: TEAMS[tk].color, fillOpacity: 1 }}
                eventHandlers={{ click: () => setOpenLeg(p.legIndex) }}>
                <Tooltip>
                  <b style={{ color: TEAMS[tk].color }}>{TEAMS[tk].name}</b><br />
                  {data.legs[p.legIndex].to_place}{p.u.title ? ` — ${p.u.title}` : ''}
                </Tooltip>
              </CircleMarker>
            )))}
            {collectivePoints.map((p, i) => (
              <CircleMarker key={`c-${i}`} center={p.pt} radius={8}
                pathOptions={{ color: '#fff', weight: 2, fillColor: COLLECTIVE_COLOR, fillOpacity: 1 }}
                eventHandlers={{ click: () => setOpenLeg(p.legIndex) }}>
                <Tooltip><b>Together</b><br />{data.legs[p.legIndex].to_place}</Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
          <p className="rodeo-map-note">Tap any dot for the full story. Both teams often land in the same city, so the trails curve apart.</p>
        </div>
      )}

      {view === 'timeline' && (
        <div className="rodeo-timeline">
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
                    <PhotoStrip photos={u?.photos} />
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
                          </div>
                          {u.body && <div className="rodeo-body" dangerouslySetInnerHTML={html(u.body)} />}
                          <PhotoStrip photos={u.photos} />
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
        <LegDetail leg={data.legs[openLeg]} onClose={() => setOpenLeg(null)} />
      )}
    </div>
  );
}

function PhotoStrip({ photos }) {
  if (!photos?.length) return null;
  return (
    <div className="rodeo-photostrip">
      {photos.map((p, i) => (
        <figure key={i}><img src={p.url} alt={p.caption || ''} loading="lazy" />{p.caption && <figcaption>{p.caption}</figcaption>}</figure>
      ))}
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
                  </div>
                  {u.body && <div className="rodeo-body" dangerouslySetInnerHTML={html(u.body)} />}
                  <PhotoStrip photos={u.photos} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
