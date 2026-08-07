# The Big Chill

**An interactive walking mystery game for Hanmer Springs.**
Working title. Version 1.0 of the build brief.

## What this is

A mystery game played on one shared iPad as a group walks a loop around the Hanmer Springs village. The famous hot pools have run stone cold overnight, and someone has stolen the heat. The group is recruited as detectives to interview five suspects, gather evidence, and name the culprit before the town freezes over. Video characters carry the story, the group solves puzzles anchored to real spots around town, and the youngest player has a real job at every stop.

It is built first for a family holiday, with a four year old in the group, and is designed to be reused with other groups later, including a competitive mode where up to three groups race the loop for the fastest solve.

## How the docs fit together

1. **01-overview.md** (this file). The vision, the locked decisions, and the build plan.
2. **02-mystery-bible.md**. The full mystery: the culprit and why, the five suspects, the deduction logic, and a stop by stop walkthrough of the loop. This is the source of truth for the story.
3. **03-character-scripts.md**. Every line of dialogue for the video clips, formatted for ElevenLabs, plus a recommended voice and video workflow and the asset naming convention.
4. **04-build-spec.md**. The technical instructions for Claude Code: stack, repo shape, the content config schema, screens, game logic, Supabase back end, offline and media handling, map, iPad notes, hosting, and a milestone order.

## Locked decisions

**Audience and modes**
- Primary: one family group including a four year old, playing at a relaxed pace (story mode).
- Secondary: reuse with other groups, and a race mode for up to three groups (race mode).

**Play**
- One shared iPad, gathered round like a board game. No multi device play for a single group.
- Connected to a phone hotspot for data. Coverage in the village is good.
- Media is pre downloaded when the game starts, so a signal blip never interrupts a video.
- Content can be updated between sessions without rebuilding the app.

**The mystery**
- Five suspects. The full cast, culprit, and logic are defined in 02-mystery-bible.md.
- Six stops on a walkable loop in the area around the hot pools. The group does not go inside the pools. The pools frontage, viewed from the street, is the crime scene.
- Whole game runs about 60 to 90 minutes.
- No Māori stories or cultural content of any kind. The mystery is entirely invented and light.

**The youngest player**
- A spoken task at every stop (no reading required), leaning on things reliably present in the town.
- A signature role for the whole game: the Steam Button Presser, whose press unlocks moving on.
- A printable certificate at the finish, presented to the child when the culprit is caught. The family prints it themselves.

**Look and feel**
- Cartoon style, in the spirit of Carmen Sandiego: flat, characterful, slightly noir but never scary.
- A blend that suits both the child and the adults.
- Portrait video to suit a held iPad.

**Map**
- A real street map with a live dot the group follows around the loop. Not a hand drawn map.

**Race mode**
- Up to three groups, each joining a session with a code.
- Randomised stop order per group, with staggered start times.
- A wrong accusation adds a time penalty. Scoring is by total time to a correct solve.
- No live leaderboard. A results screen at the end is enough.

**Tech and hosting**
- Target device: iOS iPads.
- Lives on the mikaylaexton domain as its own hidden, non indexable subdomain, in the same manner the rodeo is hosted. Not linked from the main site navigation, and set to noindex.
- Hotspot with pre downloaded media is the model. A full offline fallback is not required.

**Video production**
- The family generates the clips. Voices via ElevenLabs, video via a separate tool.
- Scripts are written for them (see 03-character-scripts.md), along with a suggested workflow.

## Timeline

The trip is roughly two months out. There is time to build and to generate the video clips in parallel. The scripts and the build can proceed at the same time, since the app reads clips by filename from a content config and does not need the finished videos to be developed against.

## The reward

Bragging rights, plus a printable certificate for the child. No physical prizes hidden in the world, since anything left out could be removed during the day.

## Build plan (summary)

The full detail is in 04-build-spec.md. In short:

1. Scaffold the app, the content config, and one stop end to end.
2. All six stops, the branching video player, the case file, the deduction board, and the finale (story mode, single group).
3. Real street map with the live location dot and geofenced stop unlocks, with a manual fallback.
4. Progressive web app packaging, add to home screen, and media pre download.
5. Supabase back end, anonymous sign in, and race mode (sessions, randomised routes, staggered starts, timing, penalties, results screen).
6. Polish: theme, transitions, sensor moments (blow and shake), and the printable certificate screen.
