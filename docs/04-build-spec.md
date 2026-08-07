# The Big Chill: build spec (Claude Code instructions)

Instructions for building the app. Read 01-overview.md, 02-mystery-bible.md, and 03-character-scripts.md first. This document is the technical plan. Where it leaves a choice open, make a sensible call and note it.

## Goals in one line

A content driven, installable web app played on one shared iPad, that runs a walking mystery around Hanmer Springs in a relaxed story mode for one group, and a timed race mode for up to three groups, with video characters, a real street map, and a fair deduction finale.

## Stack

- **React with Vite and TypeScript.**
- **Tailwind CSS** for styling.
- **Installable progressive web app** (vite-plugin-pwa), add to home screen on iPad, service worker for media caching.
- **MapLibre GL JS** for the real street map (no access token needed). Leaflet with OpenStreetMap tiles is an acceptable fallback if simpler.
- **Supabase** for the back end (Postgres, Auth, Storage, Edge Functions, Realtime).
- No heavy state library needed. React state plus a small store (Zustand or context) is fine.

## Project identity and hosting

- Build it as a **self contained app** with its **own Supabase project**. It does not share code or data with any other project on the site.
- **Host it on the mikaylaexton domain as a hidden, non indexable subdomain**, in the same manner the rodeo is deployed. For example `thebigchill.mikaylaexton.nz`. Match whatever deploy pattern the existing site uses.
- **Not indexable and not linked** from the main site navigation. Add `robots.txt` with `Disallow: /`, a `<meta name="robots" content="noindex, nofollow">` tag, and no sitemap entry.
- Optional light gate: a simple passphrase on entry, so a casual visitor who guesses the subdomain cannot wander in. Keep it trivial, this is not real security.

## Repo structure (suggested)

```
src/
  app/                 routing and top level shell
  content/
    game.config.ts     the non secret game content (see schema below)
    assets/            video and audio clips, images (or serve from Supabase Storage)
  components/          shared UI (VideoCharacter, CaseBoard, StopScreen, MapView, etc.)
  screens/             Briefing, Stop, Interrogation, CaseFile, Accusation, Finale, Certificate
  game/                engine: progress, routing, geofence, scoring, modes
  lib/                 supabase client, api wrappers, hooks
  pwa/                 service worker, media preloader
supabase/
  migrations/          schema
  functions/           edge functions (answer and accusation validation)
```

## Content config schema

The whole game is data. Keep the **non secret** content in `game.config.ts` so it is easy to edit and to swap for another group. Keep the **secret** answers (puzzle solutions and the culprit) out of the client, in Supabase (see back end). Suggested shape, refine as needed:

```ts
type Tell = { id: string; label: string };   // e.g. { id: "stripes", label: "Red and white stripes" }

type Suspect = {
  id: string;
  name: string;
  role: string;
  introClip: string;                 // filename, e.g. "barty_intro.mp4"
  questions: {
    id: string;
    prompt: string;                  // the button text, e.g. "Where were you when it happened?"
    answerClip: string;              // filename
  }[];
  traits: Record<string, boolean | string>; // for the case board, e.g. { stripes: true, smell: "eucalyptus", caps: true }
  clearedBy?: string;                // human readable note for the case file
};

type Puzzle = {
  id: string;
  type: "lookAtWorld" | "count" | "cipher" | "match";
  prompt: string;
  hints: string[];
  // the correct answer is NOT here. It lives server side.
};

type JuniorTask = {
  prompt: string;                    // spoken and shown, e.g. "Can you find someone wearing a hat?"
  clip?: string;                     // optional character voice clip
  type: "spot" | "count";
  skippable: boolean;                // always allow skip
};

type Stop = {
  id: string;
  order: number;                     // story mode order
  fixedStart?: boolean;              // stop 1 is the fixed start
  title: string;
  locationLabel: string;
  coords: { lat: number; lng: number };
  geofenceRadiusM: number;           // e.g. 30, tune on site
  suspectId?: string;                // the suspect interviewed here (stop 1 has none)
  puzzle: Puzzle;
  juniorTask: JuniorTask;
  evidenceLabel: string;             // what the case file records after this stop
};

type GameConfig = {
  id: string;
  title: string;
  tells: Tell[];
  suspects: Suspect[];
  stops: Stop[];
  narratorClips: {
    chiefIntro: string;
    chiefMidway?: string;
    chiefFinale: string;
    thiefTaunt: string;
    bartyCaught?: string;
    fairyHello?: string;
  };
};
```

Populate this from 02-mystery-bible.md and 03-character-scripts.md. The clip filenames must match the scripts doc exactly.

## Screens and flow

1. **Start gate.** A "tap to begin" screen. This satisfies the iOS gesture requirement for audio and video, and kicks off media pre download.
2. **Briefing.** Plays `chiefIntro`, swears in the Junior Detective (ask for the child's name here, used later on the certificate), then plays `thiefTaunt`. Explains the goal.
3. **Map and stop list.** The real street map with the live location dot, the next stop pin, and the case file always reachable. In story mode the app points to the next stop in order. In race mode it points to the next stop in the team's randomised route.
4. **Stop screen.** On reaching a stop (geofence or manual "I'm here"), show the suspect video, the interrogation questions, the group puzzle, and the Junior Detective task. Layout follows the wireframe in the scoping document: progress meter themed as heat, the character video, the question buttons, a clearly separate Junior Detective strip, and a bottom nav (case file, suspects, map, hint).
5. **Interrogation.** Tapping a question plays the matching answer clip. All questions are viewable, only one answer usually carries key evidence.
6. **Case file and suspects.** A running list of evidence and the five suspects, with the traits revealed so far. This is where the deduction builds.
7. **Accusation.** Unlocked once all five suspects are interviewed. Shows the case board (suspects across, tells down). The group picks the culprit. Validated server side.
8. **Finale.** On a correct accusation, guide the group through the restore gesture (press and hold the valve, then blow the steam back), play `chiefFinale` (and `bartyCaught` if used), then the certificate.
9. **Certificate.** A printable victory certificate with the Junior Detective's name and "Case Closed". Support browser print and, if easy, a downloadable image or PDF. The family prints it themselves.

## Game logic

### Modes
- **Story mode.** One group. Stops in fixed `order`. Junior tasks on. No timer pressure. The accusation is made only at the end, so a wrong guess is handled gently ("look again") rather than penalised.
- **Race mode.** Up to three groups. Each joins a session with a code. Each team gets a **randomised order of stops 2 to 6** (stop 1 stays the fixed start). Junior tasks off. A timer runs. A wrong accusation adds a time penalty. **No live leaderboard**, just a results screen at the end.

### Routing and randomisation
- Compute the team route as `[stop1, ...shuffle(stops 2..6)]`.
- The map always points to the next unsolved stop in the route. The group may still physically walk in any order, but the app guides them along their route so groups spread out.

### Staggered starts (race)
- Do not start all teams at once. The host starts each team a short interval apart, or each team taps start when ready. Record each team's `started_at` at its actual start.

### Geofencing
- Use `navigator.geolocation.watchPosition`. Compute haversine distance to the target stop. Unlock the stop when within `geofenceRadiusM` (start around 30 metres, tune on site).
- Always provide a manual **"I am here"** override, because GPS in the valley can drift, and a stuck geofence would ruin the game.

### Scoring (race)
- Elapsed time = `finished_at - started_at`, computed **server side** so it is authoritative.
- Add a penalty per wrong accusation, for example plus five minutes. Optionally add a small penalty per hint used.
- The results screen ranks teams by total adjusted time.

## Supabase back end

### Auth
- Anonymous sign in (`supabase.auth.signInAnonymously()`). No account required to play.
- A team joins a session by code. Store the team against the anon user or the device.

### Tables (suggested)
- `sessions` ( id, code, mode, created_at )
- `teams` ( id, session_id, name, route jsonb, started_at, finished_at, penalty_seconds, junior_name )
- `progress` ( id, team_id, stop_id, solved_at )
- `accusations` ( id, team_id, suspect_id, correct, created_at )
- `secrets` ( key, value ) protected. Holds puzzle answers keyed by stop or puzzle id, and the culprit id. **Row level security denies select to clients.** Only the validation functions read it.

### Row level security
- Teams and progress: readable within their session (so a host can show results), writable only for the owning team.
- `secrets`: no client read at all.

### Validation (Edge Functions or Postgres RPC)
Answers must never be shipped in the client bundle. Two server side entry points:
- `check_answer(stop_id, submitted)` returns correct or not, and on success records progress and returns the next content pointer.
- `make_accusation(team_id, suspect_id)` compares against the culprit in `secrets`, records the accusation, applies a penalty on a wrong guess (race mode), and on a correct guess records `finished_at` and unlocks the finale.

This keeps the solution off the device and makes the race timing authoritative.

### Realtime
- Optional. For race mode, a host results view can subscribe to `teams` to see finishes come in. No live leaderboard is required, so this is a convenience, not a core need.

### Storage
- Put the video and audio clips in a Supabase Storage bucket (or serve from the app assets). Storage lets you **update clips between sessions without redeploying**, which matches the plan to keep iterating. Public read or signed URLs, either is fine for a hidden game.

## Media and offline

- On the start gate, **pre download all clips** for the game into the Cache Storage via the service worker, showing a prep progress bar. After that, playback is instant and a hotspot blip does not interrupt a video.
- The model is hotspot plus pre downloaded media. A full offline fallback is not required, but caching the app shell and media means brief signal drops are invisible.

## iPad and iOS specifics

- **Add to home screen.** Provide a web manifest, `apple-touch-icon`, and `display: standalone`. Handle safe area insets with `env(safe-area-inset-*)`.
- **Audio and video autoplay** need a user gesture on iOS. The start gate handles the first one. Play each clip in response to a tap.
- **Blow into the mic.** Use `getUserMedia` and a Web Audio analyser to detect a volume spike. Requires HTTPS and a permission prompt. If denied or unsupported, fall back to a tap or press and hold.
- **Shake the iPad.** Use `DeviceMotionEvent`. On iOS this needs `DeviceMotionEvent.requestPermission()` triggered by a user gesture. Provide a tap fallback.
- **Keep the screen awake** during play with the Wake Lock API where supported.
- Test on an actual iPad in Safari, since these permissions behave differently from desktop.

## Reuse with another group

- To run the same story again, nothing changes.
- To vary it, edit `game.config.ts` (names, clips, junior tasks, stops) and update the `secrets` rows (puzzle answers and culprit). Keep the rule from the mystery bible: the tells must point to exactly one suspect, and every other suspect must be cleared.
- Keep assets in a per game folder or Storage path so two games can coexist.

## Security note

Do not put puzzle answers or the culprit id anywhere in the client bundle or the client content config. They live in the protected `secrets` table and are only ever checked by the validation functions. Everything else (names, prompts, clip filenames, coordinates, junior tasks) is safe to keep in the client config.

## Milestone build order

1. **Skeleton.** Scaffold Vite, React, TypeScript, Tailwind. Add `game.config.ts` with the real content. Build the start gate, briefing, and one stop end to end with placeholder clips, in story mode, all state local.
2. **Full story mode.** All six stops, the branching video player, the case file and suspects view, the deduction board and accusation, the restore gesture, and the finale and certificate. Still single group, still local or lightly persisted state.
3. **Map and location.** MapLibre street map, the live location dot, the next stop pin, geofenced unlocks, and the manual "I am here" fallback.
4. **PWA and media.** Installability, add to home screen, service worker, and media pre download with a prep screen. Test add to home screen on an iPad.
5. **Back end and race mode.** Supabase project, anonymous auth, the tables and row level security, the validation functions, and race mode: sessions and codes, randomised routes, staggered starts, server side timing, wrong accusation penalty, and the results screen.
6. **Polish.** The cartoon theme and transitions, the blow and shake sensor moments with fallbacks, the heat themed progress meter, sound and the theme jingle, and the printable certificate. Then a full walk through on site to tune geofence radii and pins.

## Open items to confirm during the build

- Exact coordinates and geofence radius for each stop, captured on the map or on site.
- Final list of which real, public spots host stops 2 to 6, from the candidates in the mystery bible.
- Whether to include the optional clips (chief midway, fairy hello, barty caught) or fold them in.
