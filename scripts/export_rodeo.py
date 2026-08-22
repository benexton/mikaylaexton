#!/usr/bin/env python3
"""
Publish the public snapshot for The Rodeo (Casablanca to Constantinople).

Reads PUBLISHED updates + legs with the service role, computes the scoreboard,
and writes a single JSON file to the public Storage bucket. The public viewer
(/the-rodeo) fetches that file directly - no rebuild required to refresh data,
exactly like VERT's export_public.py.

Scoring (race legs only; 'together' legs score nothing):
  * cheapest pair that leg           -> +1
  * fastest pair that leg            -> +1
  * every country a pair crossed     -> +1 each (per team, own route)
Money/time points are only awarded when BOTH teams have a published update for
that leg (you can't win a race the other pair hasn't reported yet). Money is
compared using money_nzd_minor (spend converted to NZD at filing time), never
the raw money_minor, since the two teams routinely file in different
currencies and comparing those directly would be meaningless.

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


def money_nzd(u):
    return u.get("money_nzd_minor")


def minutes(u):
    return u.get("duration_minutes")


def score(legs, updates_by_leg):
    """Return (per_leg_points, totals, breakdown, spend_nzd, shared_spend_nzd).

    breakdown[team] = {"money": n, "time": n, "countries": n} point counts by
    category. spend_nzd[team] is that team's own race-leg spend, in NZD cents;
    shared_spend_nzd is spend on 'together' legs, which isn't attributable to
    either team.
    """
    per_leg, totals = {}, {t: 0 for t in TEAMS}
    breakdown = {t: {"money": 0, "time": 0, "countries": 0} for t in TEAMS}
    spend_nzd = {t: 0 for t in TEAMS}
    shared_spend_nzd = 0

    for leg in legs:
        lid = leg["id"]
        pts = {t: 0 for t in TEAMS}
        ups = {u["team"]: u for u in updates_by_leg.get(lid, []) if u.get("team")}

        for t, u in ups.items():
            spend_nzd[t] += u.get("money_nzd_minor") or 0

        if leg.get("scope") != "race":
            for u in updates_by_leg.get(lid, []):
                if not u.get("team"):
                    shared_spend_nzd += u.get("money_nzd_minor") or 0
            per_leg[lid] = pts            # together legs: everyone stays on 0
            continue

        # country points: per team, always counted from their own route
        for t, u in ups.items():
            c = len(u.get("countries") or [])
            pts[t] += c
            breakdown[t]["countries"] += c

        # money + time points need both teams reporting
        if "ben" in ups and "miki" in ups:
            mb, mm = money_nzd(ups["ben"]), money_nzd(ups["miki"])
            if mb is not None and mm is not None and mb != mm:
                winner = "ben" if mb < mm else "miki"
                pts[winner] += 1
                breakdown[winner]["money"] += 1
            tb, tm = minutes(ups["ben"]), minutes(ups["miki"])
            if tb is not None and tm is not None and tb != tm:
                winner = "ben" if tb < tm else "miki"
                pts[winner] += 1
                breakdown[winner]["time"] += 1

        per_leg[lid] = pts
        for t in TEAMS:
            totals[t] += pts[t]

    return per_leg, totals, breakdown, spend_nzd, shared_spend_nzd


def main():
    for k, v in {"SUPABASE_URL": SUPABASE_URL, "SUPABASE_SERVICE_ROLE_KEY": SUPABASE_KEY}.items():
        if not v:
            print(f"Missing env: {k}", file=sys.stderr); return 1

    legs = get("rodeo_legs", {"select": "id,leg_no,scope,from_place,to_place,envelope_opened_at",
                              "order": "leg_no.asc"})
    updates = get("rodeo_updates", {
        "select": "id,leg_id,team,title,body,money_minor,currency,money_nzd_minor,duration_minutes,"
                  "countries,place_city,place_country,lat,lng,arrived_at,photos,submitted_by,"
                  "best_meal,worst_meal",
        "published": "eq.true",
    })
    # Waypoints have no published flag of their own - visibility inherits from
    # their parent update, so only keep waypoints whose update made the cut above.
    published_update_ids = {u["id"] for u in updates}
    waypoints = get("rodeo_waypoints", {
        "select": "update_id,title,body,place_city,place_country,lat,lng,arrived_at,photos",
        "order": "sort_order.asc",
    })
    waypoints_by_update = {}
    for w in waypoints:
        if w["update_id"] not in published_update_ids:
            continue
        waypoints_by_update.setdefault(w["update_id"], []).append(w)

    updates_by_leg = {}
    for u in updates:
        updates_by_leg.setdefault(u["leg_id"], []).append(u)

    per_leg, totals, breakdown, spend_nzd, shared_spend_nzd = score(legs, updates_by_leg)

    out_legs = []
    for leg in legs:
        lid = leg["id"]
        out_legs.append({
            "id": lid,  # needed publicly so the comment form knows which leg to attach to
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
                    "money_nzd_minor": u.get("money_nzd_minor"),
                    "duration_minutes": u.get("duration_minutes"),
                    "countries": u.get("countries") or [],
                    "place_city": u.get("place_city"), "place_country": u.get("place_country"),
                    "lat": u.get("lat"), "lng": u.get("lng"),
                    "arrived_at": u.get("arrived_at"),
                    "photos": u.get("photos") or [],
                    "submitted_by": u.get("submitted_by"),
                    "best_meal": u.get("best_meal"),
                    "worst_meal": u.get("worst_meal"),
                    "waypoints": [
                        {
                            "title": w.get("title"),
                            "body": w.get("body"),
                            "place_city": w.get("place_city"), "place_country": w.get("place_country"),
                            "lat": w.get("lat"), "lng": w.get("lng"),
                            "arrived_at": w.get("arrived_at"),
                            "photos": w.get("photos") or [],
                        }
                        for w in waypoints_by_update.get(u["id"], [])
                    ],
                }
                for u in sorted(updates_by_leg.get(lid, []), key=lambda x: (x.get("team") or ""))
            ],
        })

    payload = json.dumps({
        "generatedAt": datetime.datetime.utcnow().isoformat() + "Z",
        "title": "The Rodeo: Casablanca to Constantinople",
        "teams": TEAMS,
        "scoreboard": totals,
        "scoreboard_breakdown": breakdown,
        "spend_nzd_minor": spend_nzd,
        "shared_spend_nzd_minor": shared_spend_nzd,
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
