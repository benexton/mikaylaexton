#!/usr/bin/env python3
"""
Publish the public snapshot for The Rodeo (Casablanca to Constantinople).

Reads PUBLISHED updates + legs with the service role, computes the scoreboard,
and writes a single JSON file to the public Storage bucket. The public viewer
(/the-rodeo) fetches that file directly — no rebuild required to refresh data,
exactly like VERT's export_public.py.

Scoring (race legs only; 'together' legs score nothing):
  * cheapest pair that leg           -> +1
  * fastest pair that leg            -> +1
  * every country a pair crossed     -> +1 each (per team, own route)
Money/time points are only awarded when BOTH teams have a published update for
that leg (you can't win a race the other pair hasn't reported yet).

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
"""

from __future__ import annotations
import os, sys, json, datetime
import requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
BUCKET = "rodeo-media"
OBJECT_PATH = "public/the-rodeo-public.json"

TEAMS = {
    "ben":  {"name": "Ben & John",   "color": "#2f5fa0"},
    "miki": {"name": "Miki & Bruce", "color": "#cf6a34"},
}


def get(path, params):
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/{path}",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}"},
        params=params, timeout=60,
    )
    if not r.ok:
        raise SystemExit(f"Read {path} failed [{r.status_code}]: {r.text[:300]}")
    return r.json()


def money(u):
    return u.get("money_minor")


def minutes(u):
    return u.get("duration_minutes")


def score(legs, updates_by_leg):
    """Return (per_leg_points, totals) where per_leg_points[leg_id][team] = int."""
    per_leg, totals = {}, {t: 0 for t in TEAMS}

    for leg in legs:
        lid = leg["id"]
        pts = {t: 0 for t in TEAMS}
        if leg.get("scope") != "race":
            per_leg[lid] = pts            # together legs: everyone stays on 0
            continue

        ups = {u["team"]: u for u in updates_by_leg.get(lid, []) if u.get("team")}

        # country points: per team, always counted from their own route
        for t, u in ups.items():
            pts[t] += len(u.get("countries") or [])

        # money + time points need both teams reporting
        if "ben" in ups and "miki" in ups:
            mb, mm = money(ups["ben"]), money(ups["miki"])
            if mb is not None and mm is not None and mb != mm:
                pts["ben" if mb < mm else "miki"] += 1
            tb, tm = minutes(ups["ben"]), minutes(ups["miki"])
            if tb is not None and tm is not None and tb != tm:
                pts["ben" if tb < tm else "miki"] += 1

        per_leg[lid] = pts
        for t in TEAMS:
            totals[t] += pts[t]

    return per_leg, totals


def main():
    for k, v in {"SUPABASE_URL": SUPABASE_URL, "SUPABASE_SERVICE_ROLE_KEY": SUPABASE_KEY}.items():
        if not v:
            print(f"Missing env: {k}", file=sys.stderr); return 1

    legs = get("rodeo_legs", {"select": "id,leg_no,scope,from_place,to_place,envelope_opened_at",
                              "order": "leg_no.asc"})
    updates = get("rodeo_updates", {
        "select": "id,leg_id,team,title,body,money_minor,currency,duration_minutes,"
                  "countries,lat,lng,arrived_at,photos,submitted_by",
        "published": "eq.true",
    })

    updates_by_leg = {}
    for u in updates:
        updates_by_leg.setdefault(u["leg_id"], []).append(u)

    per_leg, totals = score(legs, updates_by_leg)

    out_legs = []
    for leg in legs:
        lid = leg["id"]
        out_legs.append({
            "leg_no": leg.get("leg_no"),
            "scope": leg.get("scope"),
            "from_place": leg.get("from_place"),
            "to_place": leg.get("to_place"),
            "envelope_opened_at": leg.get("envelope_opened_at"),
            "points": per_leg.get(lid, {}),
            "updates": [
                {
                    "team": u.get("team"),               # null = collective
                    "title": u.get("title"),
                    "body": u.get("body"),
                    "money_minor": u.get("money_minor"),
                    "currency": u.get("currency"),
                    "duration_minutes": u.get("duration_minutes"),
                    "countries": u.get("countries") or [],
                    "lat": u.get("lat"), "lng": u.get("lng"),
                    "arrived_at": u.get("arrived_at"),
                    "photos": u.get("photos") or [],
                    "submitted_by": u.get("submitted_by"),
                }
                for u in sorted(updates_by_leg.get(lid, []), key=lambda x: (x.get("team") or ""))
            ],
        })

    payload = json.dumps({
        "generatedAt": datetime.datetime.utcnow().isoformat() + "Z",
        "title": "The Rodeo: Casablanca to Constantinople",
        "teams": TEAMS,
        "scoreboard": totals,
        "legs": out_legs,
    }).encode("utf-8")

    print(f"Uploading {len(out_legs)} leg(s) to {BUCKET}/{OBJECT_PATH} ...")
    up = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{OBJECT_PATH}",
        headers={"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}",
                 "Content-Type": "application/json", "x-upsert": "true"},
        data=payload, timeout=120,
    )
    if not up.ok:
        raise SystemExit(f"Upload failed [{up.status_code}]: {up.text[:300]}")
    print("Public snapshot published:",
          f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{OBJECT_PATH}")
    print("Scoreboard:", totals)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
