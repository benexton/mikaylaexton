import { useEffect, useMemo, useRef, useState } from 'react';
import { rodeo, uploadRodeoPhoto, TEAMS } from './rodeoSupabase.js';
import { nzdRate, toNzdMinor } from './currency.js';
import { geocodePlace } from './geocode.js';

const LEG_SELECT = 'id,leg_no,scope,from_place,to_place,envelope_opened_at';
// Money and timing columns aren't directly readable (so neither pair can peek
// at the other's before both finish) - they come from rodeo_figures() instead.
const UPD_SELECT =
  'id,leg_id,team,title,body,countries,place_city,place_country,lat,lng,photos,published,best_meal,worst_meal';
const WP_SELECT =
  'id,update_id,leg_id,team,title,body,place_city,place_country,lat,lng,arrived_at,photos,sort_order';
const CMT_SELECT =
  'id,leg_id,author_name,body,created_at,published,reply_body,replied_at,replied_by';

// From the briefing pack: the core route plus the detours that may count.
const COUNTRIES = [
  'Morocco', 'Spain', 'France', 'Italy', 'Austria', 'Slovenia', 'Croatia', 'Bosnia & Herzegovina',
  'Serbia', 'Hungary', 'Slovakia', 'Romania', 'Albania', 'North Macedonia', 'Greece', 'Bulgaria', 'Türkiye',
  'Gibraltar', 'Montenegro', 'Kosovo', 'Monaco', 'San Marino', 'Vatican City',
];

// ISO timestamp <-> <input type="datetime-local"> value, in the device's own
// time zone (slicing the ISO string directly would show UTC).
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
function fromLocalInput(v) { return v ? new Date(v).toISOString() : null; }

function minutesBetween(startIso, endIso) {
  if (!startIso || !endIso) return null;
  return Math.round((new Date(endIso) - new Date(startIso)) / 60000);
}
function fmtMinutes(m) {
  if (m == null) return '-';
  const h = Math.floor(m / 60), mm = m % 60;
  return h ? `${h}h ${mm}m` : `${mm}m`;
}
function fmtNzdMinor(minor) {
  return minor == null ? '-' : `NZ$${(minor / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// Caption field that grows with its content instead of clipping long text.
function AutoTextarea({ value, onChange, placeholder }) {
  function resize(el) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }
  return (
    <textarea
      rows={1}
      value={value}
      placeholder={placeholder}
      ref={resize}
      onChange={(e) => { resize(e.target); onChange(e); }}
    />
  );
}

// One row in the HQ comment-moderation list: publish toggle, delete, and a
// reply draft kept local until "Save reply" so we don't write on every keystroke.
function CommentRow({ comment, legLabel, onTogglePublished, onSaveReply, onDelete }) {
  const [reply, setReply] = useState(comment.reply_body ?? '');
  const [busy, setBusy] = useState(false);
  return (
    <li className="rodeo-comment-mod-row">
      <div className="rodeo-comment-mod-head">
        <span className="rodeo-muted">{legLabel}</span>
        <label className="rodeo-check">
          <input type="checkbox" checked={comment.published}
            onChange={(e) => onTogglePublished(comment.id, e.target.checked)} />
          Published
        </label>
        <button type="button" className="rodeo-btn ghost small rodeo-danger" onClick={() => onDelete(comment.id)}>Delete</button>
      </div>
      <p><b>{comment.author_name || 'Someone'}</b>: {comment.body}</p>
      <AutoTextarea placeholder="Write a reply..." value={reply} onChange={(e) => setReply(e.target.value)} />
      <button type="button" className="rodeo-btn ghost small" disabled={busy}
        onClick={async () => { setBusy(true); await onSaveReply(comment.id, reply); setBusy(false); }}>
        {busy ? 'Saving...' : 'Save reply'}
      </button>
    </li>
  );
}

function blankUpdate() {
  return {
    id: null, title: '', body: '', dollars: '', currency: 'USD',
    startedAt: null, arrivedAt: null, durationMinutes: null, countries: [],
    city: '', country: '', lat: '', lng: '', geoStatus: '',
    bestMeal: '', bestMealNA: false, worstMeal: '', worstMealNA: false,
    photos: [], published: false,
  };
}

export default function RodeoInput({ team, teamName, signOut }) {
  const [legs, setLegs] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [waypoints, setWaypoints] = useState([]);
  const [comments, setComments] = useState([]);
  const [legId, setLegId] = useState('');
  const [form, setForm] = useState(blankUpdate());
  const [countryDraft, setCountryDraft] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [fxPreview, setFxPreview] = useState('');
  const [wpForm, setWpForm] = useState(null); // null = waypoint editor closed
  const [wpBusy, setWpBusy] = useState(false);
  const [wpStatus, setWpStatus] = useState('');
  const [editTimes, setEditTimes] = useState(false);
  const [timeDraft, setTimeDraft] = useState({ start: '', arrive: '' });
  const [now, setNow] = useState(() => Date.now());

  // New-leg fields
  const [newLeg, setNewLeg] = useState({ from_place: '', to_place: '', scope: 'race' });

  async function loadAll() {
    const [{ data: L }, { data: U }, { data: F, error: fErr }, { data: W }, { data: C }] = await Promise.all([
      rodeo.from('rodeo_legs').select(LEG_SELECT).order('leg_no', { ascending: true }),
      rodeo.from('rodeo_updates').select(UPD_SELECT),
      rodeo.rpc('rodeo_figures'),
      rodeo.from('rodeo_waypoints').select(WP_SELECT).order('sort_order', { ascending: true }),
      rodeo.from('rodeo_comments').select(CMT_SELECT).order('created_at', { ascending: false }),
    ]);
    if (fErr) setStatus(`Could not load leg figures (${fErr.message}). Has section 12 of rodeo_schema.sql been run?`);
    const figs = new Map((F ?? []).map((f) => [f.update_id, f]));
    setLegs(L ?? []);
    setUpdates((U ?? []).map((u) => ({ ...u, ...(figs.get(u.id) ?? {}) })));
    setWaypoints(W ?? []);
    setComments(C ?? []);
  }
  useEffect(() => { loadAll(); }, []);

  const leg = useMemo(() => legs.find((l) => l.id === legId) ?? null, [legs, legId]);
  // For a race leg you write your own team's row; for a together leg, the shared row.
  const targetTeam = leg?.scope === 'together' ? null : team;

  const existing = useMemo(
    () => (leg ? updates.find((u) => u.leg_id === leg.id && (leg.scope === 'together' ? u.team == null : u.team === team)) : null),
    [leg, updates, team]
  );
  const otherTeam = team === 'ben' ? 'miki' : 'ben';
  const other = useMemo(
    () => (leg?.scope === 'race' ? updates.find((u) => u.leg_id === leg.id && u.team === otherTeam) : null),
    [leg, updates, otherTeam]
  );

  // Prefill the form from the saved row when the leg (or which row backs it)
  // changes - not on every reload, so starting/stopping the clock or saving a
  // waypoint doesn't throw away a half-written story.
  const prefilledFor = useRef('');
  useEffect(() => {
    const key = `${leg?.id ?? ''}:${existing?.id ?? ''}`;
    if (key === prefilledFor.current) return;
    prefilledFor.current = key;
    setEditTimes(false);
    if (!leg || !existing) { setForm(blankUpdate()); return; }
    setForm({
      id: existing.id,
      title: existing.title ?? '',
      body: existing.body ?? '',
      dollars: existing.money_minor != null ? (existing.money_minor / 100).toString() : '',
      currency: existing.currency ?? 'USD',
      startedAt: existing.started_at ?? null,
      arrivedAt: existing.arrived_at ?? null,
      durationMinutes: existing.duration_minutes ?? null,
      countries: existing.countries ?? [],
      city: existing.place_city ?? '', country: existing.place_country ?? '',
      lat: existing.lat ?? '', lng: existing.lng ?? '',
      geoStatus: existing.lat != null && existing.lng != null ? 'Located.' : '',
      bestMeal: existing.best_meal ?? '', bestMealNA: false,
      worstMeal: existing.worst_meal ?? '', worstMealNA: false,
      photos: existing.photos ?? [],
      published: !!existing.published,
    });
  }, [leg, existing]);

  // Tick the running clock while a pair is on the road.
  const racing = !!form.startedAt && !form.arrivedAt;
  useEffect(() => {
    if (!racing) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [racing]);

  async function startClock() {
    if (!leg) return;
    if (form.startedAt && !window.confirm('Restart the clock from now? This replaces your start time.')) return;
    setBusy(true); setStatus('');
    const startedAt = new Date().toISOString();
    let error, id = form.id;
    if (id) {
      ({ error } = await rodeo.from('rodeo_updates')
        .update({ started_at: startedAt, arrived_at: null, duration_minutes: null }).eq('id', id));
    } else {
      let data;
      ({ data, error } = await rodeo.from('rodeo_updates').insert({
        leg_id: leg.id, team: targetTeam, started_at: startedAt, submitted_by: teamName, published: false,
      }).select('id').single());
      id = data?.id;
    }
    setBusy(false);
    if (error) { setStatus(error.message); return; }
    prefilledFor.current = `${leg.id}:${id}`; // keep whatever's already typed
    setForm((f) => ({ ...f, id, startedAt, arrivedAt: null, durationMinutes: null }));
    setEditTimes(false);
    setStatus('Clock started. Go go go!');
    await loadAll();
  }

  async function arriveClock() {
    if (!form.id || !form.startedAt) return;
    setBusy(true); setStatus('');
    const arrivedAt = new Date().toISOString();
    const durationMinutes = minutesBetween(form.startedAt, arrivedAt);
    const { error } = await rodeo.from('rodeo_updates')
      .update({ arrived_at: arrivedAt, duration_minutes: durationMinutes }).eq('id', form.id);
    setBusy(false);
    if (error) { setStatus(error.message); return; }
    setForm((f) => ({ ...f, arrivedAt, durationMinutes }));
    setStatus(`Arrived in ${fmtMinutes(durationMinutes)}. Now log what you spent and the story.`);
    await loadAll();
  }

  // Manual correction for a forgotten tap or a wrong time. Only changes the
  // form - "Save/Update this leg" writes it, same as every other field.
  function openTimeEditor() {
    setTimeDraft({ start: toLocalInput(form.startedAt), arrive: toLocalInput(form.arrivedAt) });
    setEditTimes(true);
  }
  function applyTimeEdit() {
    const startedAt = fromLocalInput(timeDraft.start);
    const arrivedAt = fromLocalInput(timeDraft.arrive);
    if (arrivedAt && !startedAt) { setStatus('Set a start time too.'); return; }
    const durationMinutes = minutesBetween(startedAt, arrivedAt);
    if (durationMinutes != null && durationMinutes <= 0) { setStatus('Arrival has to be after the start.'); return; }
    setForm((f) => ({ ...f, startedAt, arrivedAt, durationMinutes }));
    setEditTimes(false);
    setStatus('Times changed. Save the leg to keep them.');
  }

  async function createLeg(e) {
    e.preventDefault();
    if (!newLeg.to_place.trim()) { setStatus('Give the leg a destination first.'); return; }
    setBusy(true); setStatus('');
    const nextNo = (legs[legs.length - 1]?.leg_no ?? 0) + 1;
    const { data, error } = await rodeo.from('rodeo_legs').insert({
      leg_no: nextNo,
      from_place: newLeg.from_place.trim() || (legs[legs.length - 1]?.to_place ?? null),
      to_place: newLeg.to_place.trim(),
      scope: newLeg.scope,
      envelope_opened_at: new Date().toISOString(),
    }).select(LEG_SELECT).single();
    setBusy(false);
    if (error) { setStatus(error.message); return; }
    setNewLeg({ from_place: '', to_place: '', scope: 'race' });
    await loadAll();
    setLegId(data.id);
    setStatus(`Leg ${data.leg_no} opened.`);
  }

  // Live "≈ NZD $X" preview as the amount/currency are typed, debounced so we
  // don't hit the FX API on every keystroke.
  useEffect(() => {
    if (form.dollars === '' || Number.isNaN(+form.dollars) || !form.currency) { setFxPreview(''); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const rate = await nzdRate(form.currency);
        if (!cancelled) {
          setFxPreview(rate === 1 ? '' : (+form.dollars * rate).toLocaleString(undefined, { maximumFractionDigits: 2 }));
        }
      } catch { if (!cancelled) setFxPreview(''); }
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [form.dollars, form.currency]);

  function addCountry() {
    const c = countryDraft.trim();
    if (!c || form.countries.includes(c)) { setCountryDraft(''); return; }
    setForm((f) => ({ ...f, countries: [...f.countries, c] }));
    setCountryDraft('');
  }

  async function onPhotos(e) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !leg) return;
    setBusy(true); setStatus('Uploading photos...');
    try {
      const prefix = `${targetTeam ?? 'together'}/${leg.leg_no}/`;
      const added = [];
      for (const f of files) added.push({ url: await uploadRodeoPhoto(f, prefix), caption: '' });
      setForm((fm) => ({ ...fm, photos: [...fm.photos, ...added] }));
      setStatus('Photos added. Remember to save.');
    } catch (err) { setStatus(err.message || 'Upload failed.'); }
    setBusy(false);
    e.target.value = '';
  }

  // Resolve the typed Town/City + Country to a pin via Nominatim. Called on
  // blur, not per-keystroke, so we don't hammer the free lookup API.
  async function locate() {
    if (!form.city.trim() && !form.country.trim()) return;
    setForm((f) => ({ ...f, geoStatus: 'Locating...' }));
    try {
      const hit = await geocodePlace(form.city, form.country);
      setForm((f) => hit
        ? { ...f, lat: hit.lat, lng: hit.lng, geoStatus: `Found: ${hit.displayName}` }
        : { ...f, lat: '', lng: '', geoStatus: "Couldn't find that place - try being more specific." });
    } catch (err) {
      setForm((f) => ({ ...f, lat: '', lng: '', geoStatus: err.message || 'Location lookup failed.' }));
    }
  }

  async function save() {
    if (!leg) return;
    setBusy(true); setStatus('Saving...');
    const currency = (form.currency || 'USD').trim().toUpperCase();

    let moneyNzdMinor = null, fxWarning = '';
    if (form.dollars !== '') {
      try { moneyNzdMinor = await toNzdMinor(form.dollars, currency); }
      catch { fxWarning = ' (could not fetch an exchange rate, so this leg has no NZD figure yet)'; }
    }

    const row = {
      leg_id: leg.id,
      team: targetTeam,
      title: form.title || null,
      body: form.body || null,
      money_minor: form.dollars === '' ? null : Math.round(parseFloat(form.dollars) * 100),
      currency,
      money_nzd_minor: moneyNzdMinor,
      started_at: form.startedAt,
      arrived_at: form.arrivedAt,
      duration_minutes: minutesBetween(form.startedAt, form.arrivedAt) ?? form.durationMinutes,
      countries: form.countries,
      place_city: form.city.trim() || null,
      place_country: form.country.trim() || null,
      lat: form.lat === '' ? null : parseFloat(form.lat),
      lng: form.lng === '' ? null : parseFloat(form.lng),
      best_meal: form.bestMealNA ? null : (form.bestMeal.trim() || null),
      worst_meal: form.worstMealNA ? null : (form.worstMeal.trim() || null),
      photos: form.photos,
      published: form.published,
      submitted_by: teamName,
    };
    let error;
    if (form.id) ({ error } = await rodeo.from('rodeo_updates').update(row).eq('id', form.id));
    else ({ error } = await rodeo.from('rodeo_updates').insert(row));
    setBusy(false);
    if (error) { setStatus(error.message); return; }
    setStatus(`Saved. It goes live on the public page within about half an hour (if ticked ready).${fxWarning}`);
    await loadAll();
  }

  async function deleteUpdate() {
    if (!form.id) return;
    if (!window.confirm('Delete this entire leg summary, including any waypoints under it? This cannot be undone.')) return;
    setBusy(true); setStatus('Deleting...');
    const { error } = await rodeo.from('rodeo_updates').delete().eq('id', form.id);
    setBusy(false);
    if (error) { setStatus(error.message); return; }
    setStatus('Deleted. The public page catches up within about half an hour.');
    await loadAll();
  }

  // ---- waypoints: any number of extra story/photo dots under one summary ----
  const legWaypoints = useMemo(
    () => (form.id ? waypoints.filter((w) => w.update_id === form.id) : []),
    [waypoints, form.id]
  );

  useEffect(() => { setWpForm(null); setWpStatus(''); }, [legId]);

  function blankWaypoint() {
    return { id: null, title: '', body: '', city: '', country: '', lat: '', lng: '', geoStatus: '', arrivedAt: '', photos: [] };
  }
  function editWaypoint(w) {
    setWpForm({
      id: w.id, title: w.title ?? '', body: w.body ?? '',
      city: w.place_city ?? '', country: w.place_country ?? '',
      lat: w.lat ?? '', lng: w.lng ?? '',
      geoStatus: w.lat != null && w.lng != null ? 'Located.' : '',
      arrivedAt: toLocalInput(w.arrived_at),
      photos: w.photos ?? [],
    });
    setWpStatus('');
  }

  async function locateWaypoint() {
    if (!wpForm.city.trim() && !wpForm.country.trim()) return;
    setWpForm((f) => ({ ...f, geoStatus: 'Locating...' }));
    try {
      const hit = await geocodePlace(wpForm.city, wpForm.country);
      setWpForm((f) => hit
        ? { ...f, lat: hit.lat, lng: hit.lng, geoStatus: `Found: ${hit.displayName}` }
        : { ...f, lat: '', lng: '', geoStatus: "Couldn't find that place - try being more specific." });
    } catch (err) {
      setWpForm((f) => ({ ...f, lat: '', lng: '', geoStatus: err.message || 'Location lookup failed.' }));
    }
  }

  async function onWaypointPhotos(e) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !leg) return;
    setWpBusy(true); setWpStatus('Uploading photos...');
    try {
      const prefix = `${targetTeam ?? 'together'}/${leg.leg_no}/`;
      const added = [];
      for (const f of files) added.push({ url: await uploadRodeoPhoto(f, prefix), caption: '' });
      setWpForm((f) => ({ ...f, photos: [...f.photos, ...added] }));
      setWpStatus('Photos added. Remember to save.');
    } catch (err) { setWpStatus(err.message || 'Upload failed.'); }
    setWpBusy(false);
    e.target.value = '';
  }

  async function saveWaypoint() {
    if (!form.id || !leg) return;
    setWpBusy(true); setWpStatus('Saving...');
    const row = {
      update_id: form.id, leg_id: leg.id, team: targetTeam,
      title: wpForm.title || null, body: wpForm.body || null,
      place_city: wpForm.city.trim() || null, place_country: wpForm.country.trim() || null,
      lat: wpForm.lat === '' ? null : parseFloat(wpForm.lat),
      lng: wpForm.lng === '' ? null : parseFloat(wpForm.lng),
      arrived_at: fromLocalInput(wpForm.arrivedAt),
      photos: wpForm.photos,
    };
    let error;
    if (wpForm.id) ({ error } = await rodeo.from('rodeo_waypoints').update(row).eq('id', wpForm.id));
    else ({ error } = await rodeo.from('rodeo_waypoints').insert(row));
    setWpBusy(false);
    if (error) { setWpStatus(error.message); return; }
    setWpStatus('Saved.');
    setWpForm(null);
    await loadAll();
  }

  async function deleteWaypoint(id) {
    if (!window.confirm('Delete this waypoint? This cannot be undone.')) return;
    setWpBusy(true);
    const { error } = await rodeo.from('rodeo_waypoints').delete().eq('id', id);
    setWpBusy(false);
    if (error) { setWpStatus(error.message); return; }
    await loadAll();
  }

  const legLabel = (l) =>
    `Leg ${l.leg_no}: ${l.from_place ? l.from_place + ' to ' : ''}${l.to_place ?? '?'}` +
    (l.scope === 'together' ? '  (together)' : '');

  // ---- comment moderation: public comments land unpublished, we approve/reply here ----
  function commentLegLabel(c) {
    const l = legs.find((x) => x.id === c.leg_id);
    return l ? legLabel(l) : 'Unknown leg';
  }
  async function toggleCommentPublished(id, published) {
    const { error } = await rodeo.from('rodeo_comments').update({ published }).eq('id', id);
    if (error) { setStatus(error.message); return; }
    await loadAll();
  }
  async function saveCommentReply(id, replyBody) {
    const text = replyBody.trim();
    const { error } = await rodeo.from('rodeo_comments').update({
      reply_body: text || null,
      replied_at: text ? new Date().toISOString() : null,
      replied_by: text ? teamName : null,
    }).eq('id', id);
    if (error) { setStatus(error.message); return; }
    await loadAll();
  }
  async function deleteComment(id) {
    if (!window.confirm('Delete this comment? This cannot be undone.')) return;
    const { error } = await rodeo.from('rodeo_comments').delete().eq('id', id);
    if (error) { setStatus(error.message); return; }
    await loadAll();
  }

  return (
    <div className="rodeo-hq">
      <header className="rodeo-hq-bar" style={{ borderColor: TEAMS[team].color }}>
        <div>
          <span className="rodeo-kicker">Rodeo HQ</span>
          <h1 style={{ color: TEAMS[team].color }}>{teamName}</h1>
        </div>
        <button className="rodeo-btn ghost" onClick={signOut}>Sign out</button>
      </header>

      <section className="rodeo-panel">
        <h2>Open a new envelope</h2>
        <form className="rodeo-newleg" onSubmit={createLeg}>
          <input placeholder="From (optional)" value={newLeg.from_place}
            onChange={(e) => setNewLeg({ ...newLeg, from_place: e.target.value })} />
          <input placeholder="Destination" value={newLeg.to_place}
            onChange={(e) => setNewLeg({ ...newLeg, to_place: e.target.value })} />
          <select value={newLeg.scope} onChange={(e) => setNewLeg({ ...newLeg, scope: e.target.value })}>
            <option value="race">Race (two teams)</option>
            <option value="together">Together (one update)</option>
          </select>
          <button className="rodeo-btn" disabled={busy}>Open leg</button>
        </form>
      </section>

      <section className="rodeo-panel">
        <h2>File an update</h2>
        <label>Which leg</label>
        <select value={legId} onChange={(e) => setLegId(e.target.value)}>
          <option value="">Pick a leg...</option>
          {legs.map((l) => <option key={l.id} value={l.id}>{legLabel(l)}</option>)}
        </select>

        {leg && (
          <>
            <p className="rodeo-writing-as">
              Writing {leg.scope === 'together'
                ? 'the shared update for this together leg'
                : <>as <b style={{ color: TEAMS[team].color }}>{teamName}</b></>}.
            </p>

            {leg.scope === 'race' && (
              <div className="rodeo-clock">
                <div className="rodeo-clock-main">
                  {!form.startedAt && (
                    <button type="button" className="rodeo-btn big" onClick={startClock} disabled={busy}>Start the clock</button>
                  )}
                  {racing && (
                    <>
                      <span className="rodeo-clock-time">⏱ {fmtMinutes(minutesBetween(form.startedAt, new Date(now).toISOString()))}</span>
                      <button type="button" className="rodeo-btn big" onClick={arriveClock} disabled={busy}>We've arrived</button>
                    </>
                  )}
                  {form.arrivedAt && (
                    <span className="rodeo-clock-time">🏁 Leg time {fmtMinutes(form.durationMinutes)}</span>
                  )}
                  {!form.startedAt && form.durationMinutes != null && (
                    <span className="rodeo-muted">Saved leg time: {fmtMinutes(form.durationMinutes)}</span>
                  )}
                </div>
                {form.startedAt && (
                  <p className="rodeo-fx-preview">
                    Started {new Date(form.startedAt).toLocaleString()}
                    {form.arrivedAt && <> · arrived {new Date(form.arrivedAt).toLocaleString()}</>}
                  </p>
                )}
                {!editTimes ? (
                  <button type="button" className="rodeo-btn ghost small" onClick={openTimeEditor}>Edit times</button>
                ) : (
                  <div className="rodeo-time-edit">
                    <div className="rodeo-grid2">
                      <div>
                        <label>Started</label>
                        <input type="datetime-local" value={timeDraft.start}
                          onChange={(e) => setTimeDraft({ ...timeDraft, start: e.target.value })} />
                      </div>
                      <div>
                        <label>Arrived</label>
                        <input type="datetime-local" value={timeDraft.arrive}
                          onChange={(e) => setTimeDraft({ ...timeDraft, arrive: e.target.value })} />
                      </div>
                    </div>
                    <p className="rodeo-fx-preview">In this phone's current time zone. Leave Arrived blank if you're still going.</p>
                    <div className="rodeo-inline">
                      <button type="button" className="rodeo-btn small" onClick={applyTimeEdit}>Use these times</button>
                      <button type="button" className="rodeo-btn ghost small" onClick={() => setEditTimes(false)}>Cancel</button>
                    </div>
                  </div>
                )}
                <p className="rodeo-other-team">
                  <b style={{ color: TEAMS[otherTeam].color }}>{TEAMS[otherTeam].name}</b>:{' '}
                  {!other?.has_started ? 'not started yet' : (other.has_arrived ? 'arrived' : 'on the road')}
                  {other?.revealed && (
                    <> · {fmtMinutes(other.duration_minutes)}, {fmtNzdMinor(other.money_nzd_minor)}
                      {' '}(you: {fmtMinutes(existing?.duration_minutes)}, {fmtNzdMinor(existing?.money_nzd_minor)})</>
                  )}
                </p>
                {!other?.revealed && (
                  <p className="rodeo-fx-preview">Their time and spend stay sealed until both pairs have arrived and logged a spend.</p>
                )}
              </div>
            )}

            <label>Headline</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. We missed the ferry" />

            <label>The story</label>
            <textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="What happened out there..." />

            <div className="rodeo-grid2">
              <div>
                <label>Money spent (whole pair)</label>
                <div className="rodeo-inline">
                  <input type="number" step="0.01" value={form.dollars}
                    onChange={(e) => setForm({ ...form, dollars: e.target.value })} placeholder="0.00" />
                  <input className="rodeo-cur" value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="USD" />
                </div>
                {fxPreview && <p className="rodeo-fx-preview">≈ NZD ${fxPreview}</p>}
                <p className="rodeo-fx-preview">Total for both of you. Never shown publicly - the site only says which pair spent more per person.</p>
              </div>
            </div>

            <label>Countries crossed this leg</label>
            <div className="rodeo-country-pick">
              {[...COUNTRIES, ...form.countries.filter((c) => !COUNTRIES.includes(c))].map((c) => {
                const on = form.countries.includes(c);
                return (
                  <button key={c} type="button" className={`rodeo-country${on ? ' on' : ''}`} aria-pressed={on}
                    onClick={() => setForm((f) => ({ ...f, countries: on ? f.countries.filter((x) => x !== c) : [...f.countries, c] }))}>
                    {on ? '✓ ' : ''}{c}
                  </button>
                );
              })}
            </div>
            <div className="rodeo-inline">
              <input value={countryDraft} onChange={(e) => setCountryDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCountry(); } }}
                placeholder="Somewhere not on the list?" />
              <button type="button" className="rodeo-btn ghost" onClick={addCountry}>Add</button>
            </div>

            <label>Where this pin drops on the map</label>
            <div className="rodeo-grid2">
              <div>
                <input placeholder="Town/city" value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value, geoStatus: '' })}
                  onBlur={locate} />
              </div>
              <div>
                <input placeholder="Country" value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value, geoStatus: '' })}
                  onBlur={locate} />
              </div>
            </div>
            {form.geoStatus && <p className="rodeo-fx-preview">{form.geoStatus}</p>}

            <div className="rodeo-grid2">
              <div>
                <label>Best meal of the leg</label>
                <div className="rodeo-inline">
                  <input value={form.bestMeal} disabled={form.bestMealNA}
                    onChange={(e) => setForm({ ...form, bestMeal: e.target.value })}
                    placeholder="e.g. Grandma's tagine in Fes" />
                  <label className="rodeo-check">
                    <input type="checkbox" checked={form.bestMealNA}
                      onChange={(e) => setForm({ ...form, bestMealNA: e.target.checked, bestMeal: e.target.checked ? '' : form.bestMeal })} />
                    N/A
                  </label>
                </div>
              </div>
              <div>
                <label>Worst meal of the leg</label>
                <div className="rodeo-inline">
                  <input value={form.worstMeal} disabled={form.worstMealNA}
                    onChange={(e) => setForm({ ...form, worstMeal: e.target.value })}
                    placeholder="e.g. The mystery kebab in Sofia" />
                  <label className="rodeo-check">
                    <input type="checkbox" checked={form.worstMealNA}
                      onChange={(e) => setForm({ ...form, worstMealNA: e.target.checked, worstMeal: e.target.checked ? '' : form.worstMeal })} />
                    N/A
                  </label>
                </div>
              </div>
            </div>

            <label>Photos</label>
            <input type="file" accept="image/*" capture="environment" multiple onChange={onPhotos} />
            <div className="rodeo-photos">
              {form.photos.map((p, i) => (
                <div key={i} className="rodeo-photo">
                  <img src={p.url} alt="" />
                  <AutoTextarea placeholder="caption" value={p.caption}
                    onChange={(e) => setForm((f) => { const ph = [...f.photos]; ph[i] = { ...ph[i], caption: e.target.value }; return { ...f, photos: ph }; })} />
                  <button type="button" onClick={() => setForm((f) => ({ ...f, photos: f.photos.filter((_, j) => j !== i) }))}>Remove</button>
                </div>
              ))}
            </div>

            <label className="rodeo-check">
              <input type="checkbox" checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })} />
              Ready for the public snapshot
            </label>

            <button className="rodeo-btn big" onClick={save} disabled={busy}>
              {busy ? 'Working...' : (form.id ? 'Update this leg' : 'Save this leg')}
            </button>
            {form.id && (
              <button type="button" className="rodeo-btn ghost small rodeo-danger" onClick={deleteUpdate} disabled={busy}>
                Delete this update
              </button>
            )}
          </>
        )}
        {status && <p className="rodeo-status">{status}</p>}
      </section>

      {leg && form.id && (
        <section className="rodeo-panel">
          <h2>Waypoints</h2>
          <p className="rodeo-muted">
            Extra dots dropped along this leg - a few photos and a line or two, no stats. Drop as many as you like.
          </p>

          {legWaypoints.length > 0 && (
            <ul className="rodeo-waypoint-list">
              {legWaypoints.map((w) => (
                <li key={w.id} className="rodeo-waypoint-row">
                  {w.photos?.[0] && <img src={w.photos[0].url} alt="" />}
                  <div className="rodeo-waypoint-row-body">
                    <b>{w.title || '(untitled waypoint)'}</b>
                    {(w.place_city || w.place_country) && (
                      <span className="rodeo-muted"> - {[w.place_city, w.place_country].filter(Boolean).join(', ')}</span>
                    )}
                  </div>
                  <button type="button" className="rodeo-btn ghost small" onClick={() => editWaypoint(w)}>Edit</button>
                  <button type="button" className="rodeo-btn ghost small rodeo-danger" onClick={() => deleteWaypoint(w.id)}>Delete</button>
                </li>
              ))}
            </ul>
          )}

          {!wpForm ? (
            <button type="button" className="rodeo-btn ghost" onClick={() => setWpForm(blankWaypoint())}>+ Add a waypoint</button>
          ) : (
            <div className="rodeo-waypoint-form">
              <label>Headline</label>
              <input value={wpForm.title} onChange={(e) => setWpForm({ ...wpForm, title: e.target.value })}
                placeholder="e.g. Roadside coffee in the Atlas" />

              <label>The story</label>
              <textarea rows={3} value={wpForm.body} onChange={(e) => setWpForm({ ...wpForm, body: e.target.value })} />

              <label>Where this pin drops on the map</label>
              <div className="rodeo-grid2">
                <input placeholder="Town/city" value={wpForm.city}
                  onChange={(e) => setWpForm({ ...wpForm, city: e.target.value, geoStatus: '' })}
                  onBlur={locateWaypoint} />
                <input placeholder="Country" value={wpForm.country}
                  onChange={(e) => setWpForm({ ...wpForm, country: e.target.value, geoStatus: '' })}
                  onBlur={locateWaypoint} />
              </div>
              {wpForm.geoStatus && <p className="rodeo-fx-preview">{wpForm.geoStatus}</p>}

              <label>Photos</label>
              <input type="file" accept="image/*" capture="environment" multiple onChange={onWaypointPhotos} />
              <div className="rodeo-photos">
                {wpForm.photos.map((p, i) => (
                  <div key={i} className="rodeo-photo">
                    <img src={p.url} alt="" />
                    <AutoTextarea placeholder="caption" value={p.caption}
                      onChange={(e) => setWpForm((f) => { const ph = [...f.photos]; ph[i] = { ...ph[i], caption: e.target.value }; return { ...f, photos: ph }; })} />
                    <button type="button" onClick={() => setWpForm((f) => ({ ...f, photos: f.photos.filter((_, j) => j !== i) }))}>Remove</button>
                  </div>
                ))}
              </div>

              <div className="rodeo-inline" style={{ marginTop: '.8em' }}>
                <button type="button" className="rodeo-btn" onClick={saveWaypoint} disabled={wpBusy}>
                  {wpBusy ? 'Working...' : (wpForm.id ? 'Update waypoint' : 'Save waypoint')}
                </button>
                <button type="button" className="rodeo-btn ghost" onClick={() => setWpForm(null)}>Cancel</button>
              </div>
            </div>
          )}
          {wpStatus && <p className="rodeo-status">{wpStatus}</p>}
        </section>
      )}

      <section className="rodeo-panel">
        <h2>Comments</h2>
        <p className="rodeo-muted">Public comments land here unpublished. Approve to make one visible, or reply first.</p>
        {comments.length === 0 ? (
          <p className="rodeo-muted">No comments yet.</p>
        ) : (
          <ul className="rodeo-comment-mod-list">
            {comments.map((c) => (
              <CommentRow key={c.id} comment={c} legLabel={commentLegLabel(c)}
                onTogglePublished={toggleCommentPublished} onSaveReply={saveCommentReply} onDelete={deleteComment} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
