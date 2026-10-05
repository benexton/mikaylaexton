#!/usr/bin/env python3
"""
Publish the public snapshot for The Rodeo (Casablanca to Constantinople).

Reads PUBLISHED updates + legs with the service role, computes the scoreboard,
and writes a single JSON file to the public Storage bucket. The public viewer
(/the-rodeo) fetches that file directly - no rebuild required to refresh data,
exactly like VERT's export_public.py.

Scoring (race legs only; 'together' legs score nothing):
  * fastest pair that leg            -> +2
  * cheapest pair that leg           -> +1
  * every NEW country a pair crossed -> +1 each (per team, own route). A
    country scores only the first time that pair crosses it, on the earliest
    race leg; crossing it again on a later leg earns nothing.
Money/time points are only awarded when BOTH teams have a published update for
that leg (you can't win a race the other pair hasn't reported yet). Money is
compared using money_nzd_minor (spend converted to NZD at filing time), never
the raw money_minor, since the two teams routinely file in different
currencies and comparing those directly would be meaningless.

Spend is private: no raw amounts (per update, per team, or shared) ever reach
the public JSON. Each race leg instead carries a spend_summary saying which
pair spent more and by how much per person, in NZD.

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
PEOPLE_PER_TEAM = 2   # money is filed per pair; the public summary is per person
TIME_POINTS = 2
MONEY_POINTS = 1


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


def spend_summary(ups):
    """Who spent more on a race leg, per person, in NZD cents - or None until
    both pairs have filed a converted amount. The only spend info made public."""
    if "ben" not in ups or "miki" not in ups:
        return None
    mb, mm = money_nzd(ups["ben"]), money_nzd(ups["miki"])
    if mb is None or mm is None:
        return None
    diff_pp = round(abs(mb - mm) / PEOPLE_PER_TEAM)
    return {"more": None if mb == mm else ("ben" if mb > mm else "miki"),
            "per_person_nzd_minor": diff_pp}


def score(legs, updates_by_leg):
    """Return (per_leg_points, totals, breakdown, per_leg_spend, per_leg_winners).

    breakdown[team] = {"money": n, "time": n, "countries": n} POINTS by
    category (so they sum to the team's total). per_leg_spend[leg_id] is the
    spend_summary for race legs. per_leg_winners[leg_id] = {"time": team|None,
    "money": team|None} so the viewer can badge who took each award.

    Also sets u["new_countries"] on each race-leg update: the subset of its
    countries that scored (first crossing for that team). Legs must arrive in
    leg_no order for "first" to mean first.
    """
    per_leg, totals = {}, {t: 0 for t in TEAMS}
    breakdown = {t: {"money": 0, "time": 0, "countries": 0} for t in TEAMS}
    per_leg_spend = {}
    per_leg_winners = {}
    seen = {t: set() for t in TEAMS}   # countries each team has already scored

    for leg in legs:
        lid = leg["id"]
        pts = {t: 0 for t in TEAMS}
        ups = {u["team"]: u for u in updates_by_leg.get(lid, []) if u.get("team")}

        if leg.get("scope") != "race":
            per_leg[lid] = pts            # together legs: everyone stays on 0
            continue

        per_leg_spend[lid] = spend_summary(ups)
        won = per_leg_winners[lid] = {"time": None, "money": None}

        # country points: per team, own route, first crossing only
        for t, u in ups.items():
            new = []
            for c in u.get("countries") or []:
                key = c.strip().casefold()
                if key and key not in seen[t]:
                    seen[t].add(key)
                    new.append(c)
            u["new_countries"] = new
            pts[t] += len(new)
            breakdown[t]["countries"] += len(new)

        # money + time points need both teams reporting
        if "ben" in ups and "miki" in ups:
            mb, mm = money_nzd(ups["ben"]), money_nzd(ups["miki"])
            if mb is not None and mm is not None and mb != mm:
                winner = "ben" if mb < mm else "miki"
                won["money"] = winner
                pts[winner] += MONEY_POINTS
                breakdown[winner]["money"] += MONEY_POINTS
            tb, tm = minutes(ups["ben"]), minutes(ups["miki"])
            if tb is not None and tm is not None and tb != tm:
                winner = "ben" if tb < tm else "miki"
                won["time"] = winner
                pts[winner] += TIME_POINTS
                breakdown[winner]["time"] += TIME_POINTS

        per_leg[lid] = pts
        for t in TEAMS:
            totals[t] += pts[t]

    return per_leg, totals, breakdown, per_leg_spend, per_leg_winners


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

    per_leg, totals, breakdown, per_leg_spend, per_leg_winners = score(legs, updates_by_leg)

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
            "spend_summary": per_leg_spend.get(lid),
            "winners": per_leg_winners.get(lid),
            "updates": [
                {
                    "team": u.get("team"),               # null = collective
                    "title": u.get("title"),
                    "body": u.get("body"),
                    "duration_minutes": u.get("duration_minutes"),
                    "countries": u.get("countries") or [],
                    "new_countries": u.get("new_countries"),  # the ones that scored; null on together legs
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
