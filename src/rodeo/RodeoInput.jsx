import { useEffect, useMemo, useState } from 'react';
import { rodeo, uploadRodeoPhoto, TEAMS } from './rodeoSupabase.js';
import { nzdRate, toNzdMinor } from './currency.js';

const LEG_SELECT = 'id,leg_no,scope,from_place,to_place,envelope_opened_at';
const UPD_SELECT =
  'id,leg_id,team,title,body,money_minor,currency,money_nzd_minor,duration_minutes,countries,lat,lng,arrived_at,photos,published';

function blankUpdate() {
  return {
    id: null, title: '', body: '', dollars: '', currency: 'USD',
    hours: '', minutes: '', countries: [], lat: '', lng: '', photos: [], published: false,
  };
}

export default function RodeoInput({ team, teamName, signOut }) {
  const [legs, setLegs] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [legId, setLegId] = useState('');
  const [form, setForm] = useState(blankUpdate());
  const [countryDraft, setCountryDraft] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [fxPreview, setFxPreview] = useState('');

  // New-leg fields
  const [newLeg, setNewLeg] = useState({ from_place: '', to_place: '', scope: 'race' });

  async function loadAll() {
    const [{ data: L }, { data: U }] = await Promise.all([
      rodeo.from('rodeo_legs').select(LEG_SELECT).order('leg_no', { ascending: true }),
      rodeo.from('rodeo_updates').select(UPD_SELECT),
    ]);
    setLegs(L ?? []);
    setUpdates(U ?? []);
  }
  useEffect(() => { loadAll(); }, []);

  const leg = useMemo(() => legs.find((l) => l.id === legId) ?? null, [legs, legId]);
  // For a race leg you write your own team's row; for a together leg, the shared row.
  const targetTeam = leg?.scope === 'together' ? null : team;

  // When leg changes, prefill the form from any existing matching update.
  useEffect(() => {
    if (!leg) { setForm(blankUpdate()); return; }
    const existing = updates.find(
      (u) => u.leg_id === leg.id && (leg.scope === 'together' ? u.team == null : u.team === team)
    );
    if (!existing) { setForm(blankUpdate()); return; }
    const mins = existing.duration_minutes ?? 0;
    setForm({
      id: existing.id,
      title: existing.title ?? '',
      body: existing.body ?? '',
      dollars: existing.money_minor != null ? (existing.money_minor / 100).toString() : '',
      currency: existing.currency ?? 'USD',
      hours: mins ? Math.floor(mins / 60).toString() : '',
      minutes: mins ? (mins % 60).toString() : '',
      countries: existing.countries ?? [],
      lat: existing.lat ?? '', lng: existing.lng ?? '',
      photos: existing.photos ?? [],
      published: !!existing.published,
    });
  }, [leg, updates, team]);

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

  function useMyLocation() {
    if (!navigator.geolocation) { setStatus('No geolocation on this device.'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setForm((f) => ({ ...f, lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) })),
      () => setStatus('Could not read location.')
    );
  }

  async function save() {
    if (!leg) return;
    setBusy(true); setStatus('Saving...');
    const mins = (parseInt(form.hours || '0', 10) * 60) + parseInt(form.minutes || '0', 10);
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
      duration_minutes: mins || null,
      countries: form.countries,
      lat: form.lat === '' ? null : parseFloat(form.lat),
      lng: form.lng === '' ? null : parseFloat(form.lng),
      photos: form.photos,
      published: form.published,
      submitted_by: teamName,
    };
    let error;
    if (form.id) ({ error } = await rodeo.from('rodeo_updates').update(row).eq('id', form.id));
    else ({ error } = await rodeo.from('rodeo_updates').insert(row));
    setBusy(false);
    if (error) { setStatus(error.message); return; }
    setStatus(`Saved. Run the "Publish Rodeo snapshot" Action to push it live.${fxWarning}`);
    await loadAll();
  }

  const legLabel = (l) =>
    `Leg ${l.leg_no}: ${l.from_place ? l.from_place + ' to ' : ''}${l.to_place ?? '?'}` +
    (l.scope === 'together' ? '  (together)' : '');

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

            <label>Headline</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. We missed the ferry" />

            <label>The story (markdown ok)</label>
            <textarea rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="What happened out there..." />

            <div className="rodeo-grid2">
              <div>
                <label>Money spent</label>
                <div className="rodeo-inline">
                  <input type="number" step="0.01" value={form.dollars}
                    onChange={(e) => setForm({ ...form, dollars: e.target.value })} placeholder="0.00" />
                  <input className="rodeo-cur" value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="USD" />
                </div>
                {fxPreview && <p className="rodeo-fx-preview">≈ NZD ${fxPreview}</p>}
              </div>
              <div>
                <label>Leg time</label>
                <div className="rodeo-inline">
                  <input type="number" value={form.hours}
                    onChange={(e) => setForm({ ...form, hours: e.target.value })} placeholder="hrs" />
                  <input type="number" value={form.minutes}
                    onChange={(e) => setForm({ ...form, minutes: e.target.value })} placeholder="min" />
                </div>
              </div>
            </div>

            <label>Countries crossed this leg</label>
            <div className="rodeo-chips">
              {form.countries.map((c) => (
                <span key={c} className="rodeo-chip">
                  {c}<button type="button" onClick={() => setForm({ ...form, countries: form.countries.filter((x) => x !== c) })}>×</button>
                </span>
              ))}
            </div>
            <div className="rodeo-inline">
              <input value={countryDraft} onChange={(e) => setCountryDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addCountry(); } }}
                placeholder="Add a country, Enter to confirm" />
              <button type="button" className="rodeo-btn ghost" onClick={addCountry}>Add</button>
            </div>

            <div className="rodeo-grid2">
              <div>
                <label>Latitude</label>
                <input type="number" step="0.00001" value={form.lat}
                  onChange={(e) => setForm({ ...form, lat: e.target.value })} />
              </div>
              <div>
                <label>Longitude</label>
                <input type="number" step="0.00001" value={form.lng}
                  onChange={(e) => setForm({ ...form, lng: e.target.value })} />
              </div>
            </div>
            <button type="button" className="rodeo-btn ghost small" onClick={useMyLocation}>Use my current location</button>

            <label>Photos</label>
            <input type="file" accept="image/*" capture="environment" multiple onChange={onPhotos} />
            <div className="rodeo-photos">
              {form.photos.map((p, i) => (
                <div key={i} className="rodeo-photo">
                  <img src={p.url} alt="" />
                  <input placeholder="caption" value={p.caption}
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
          </>
        )}
        {status && <p className="rodeo-status">{status}</p>}
      </section>
    </div>
  );
}
