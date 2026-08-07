// The Big Chill: game content config.
//
// Everything here is NON-SECRET: names, prompts, clip filenames/captions,
// coordinates, junior tasks. Puzzle answers and the culprit id must never
// live here - they land in Supabase `secrets` once the back end exists
// (see docs/04-build-spec.md). Clip filenames match docs/03-character-scripts.md
// exactly; `caption` is a build-time addition (not in the spec's type) used
// both as an accessibility caption and as the placeholder text shown before
// real video clips exist.
//
// Coordinates below are approximate Hanmer Springs landmarks and are marked
// TBD - the build spec calls out exact pins/geofence radii as an open item
// to confirm on site.

export const TELLS = [
  { id: 'stripes', label: 'Red and white stripes' },
  { id: 'eucalyptus', label: 'Smell of eucalyptus' },
  { id: 'bottlecaps', label: 'Drops shiny bottle caps' },
];

export const NARRATOR_CLIPS = {
  chiefIntro: {
    file: 'chief_intro.mp4',
    character: 'Chief Wembley',
    caption:
      "Detectives, thank goodness you are here. I am Chief Wembley, and we have a disaster. Overnight, somebody stole the heat from our famous hot pools. Stone cold, the lot of it. I have five suspects and not a single clue what to do next. That is where you come in. And this young detective here... by the power vested in me, I hereby swear you in as our Junior Detective. Your first job is the most important of all. Now, off to the pools, and watch for anything the thief left behind.",
  },
  chiefMidway: {
    file: 'chief_midway.mp4',
    character: 'Chief Wembley',
    caption:
      'Good work out there, team. The town is counting on you. Keep talking to those suspects, keep an eye on the evidence, and do not let anyone charming talk you out of it.',
    optional: true,
  },
  chiefFinale: {
    file: 'chief_finale.mp4',
    character: 'Chief Wembley',
    caption:
      'You did it. You cracked the case. We caught him red handed at the tanker, still filling his silly little bottles. The heat is coming back to the pools as we speak, and the whole town says thank you. And a very special thank you to our Junior Detective. Outstanding work. Case closed.',
  },
  thiefTaunt: {
    file: 'thief_taunt.mp4',
    character: 'The mystery thief',
    caption:
      'Well, well. If it is not the great detectives. Too late. The heat is mine now, every last drop of it, and you will never work out where it went. Enjoy the cold. You will not catch me. Ha.',
  },
  bartyCaught: {
    file: 'barty_caught.mp4',
    character: 'Barty Bottler',
    caption:
      'No, no, this is a misunderstanding. Do you have any idea how much that water was worth? Millions. Millions. I was going to be rich. It is not fair. I nearly got away with it too.',
    optional: true,
  },
  fairyHello: {
    file: 'fairy_hello.mp4',
    character: 'The fairy',
    caption:
      'Hello little detective. I live behind the tiny door. I saw the thief go by. He had a stripy bow tie and he smelled all minty, and he dropped a shiny bottle top right here. You are doing such a good job. Keep going.',
    optional: true,
  },
};

export const SUSPECTS = [
  {
    id: 'vonfrost',
    name: 'Baroness Cornelia von Frost',
    role: 'Owner of Frosthaven, a rival alpine spa',
    stopId: 'visitor_centre',
    introClip: {
      file: 'baroness_intro.mp4',
      caption:
        'You wish to speak with me? How quaint. Baroness Cornelia von Frost, of Frosthaven Spa, the superior spa, obviously. I am only visiting your soggy little town to see what all the fuss was about. And now the pools are cold. What a shame. What a terrible, terrible shame.',
    },
    questions: [
      {
        id: 'q1',
        prompt: 'Where were you when it happened?',
        answerClip: {
          file: 'baroness_q1.mp4',
          caption:
            'Darling, I was on live television, promoting my own magnificent spa. Cameras, lights, an adoring audience. You may check the broadcast. I could not possibly have been skulking about your grubby pools. I have people for that. Well, I would, if I did that sort of thing, which I do not.',
        },
        keyEvidence: true,
      },
      {
        id: 'q2',
        prompt: 'Did you see anything?',
        answerClip: {
          file: 'baroness_q2.mp4',
          caption:
            'See anything? I saw this town at its worst, that is what I saw. Although... yes, there was a filthy tanker truck sneaking up one of your back roads. Dreadful thing. Ruined my photograph.',
        },
        keyEvidence: true,
      },
      {
        id: 'q3',
        prompt: 'Would you benefit from the pools closing?',
        answerClip: {
          file: 'baroness_q3.mp4',
          caption:
            'Are you accusing me? How dare you. Naturally more tourists would come to Frosthaven. Naturally I would be delighted. But I did not do it, and you cannot prove a thing, because there is nothing to prove. Good day.',
        },
      },
    ],
    traits: { stripes: false, eucalyptus: false, bottlecaps: false },
    clearedBy: 'A timestamped live TV alibi. No stripes, wrong scent.',
  },
  {
    id: 'kettle',
    name: 'Keith Kettle',
    role: 'Grumpy hermit who lives up the hill',
    stopId: 'forest_walk',
    introClip: {
      file: 'keith_intro.mp4',
      caption:
        'What do you want. Oh, detectives, is it. Keith Kettle. I live up the hill, away from all the noise and the crowds and the splashing. Best place in town. And no, before you ask, I did not touch your precious pools. Though I will not pretend I am sad to see them quiet.',
    },
    questions: [
      {
        id: 'q1',
        prompt: 'Where were you this morning?',
        answerClip: {
          file: 'keith_q1.mp4',
          caption:
            'Up the hill, chopping firewood, same as every morning. My neighbour waved at me over the fence, ask her. I was nowhere near the water, and my boots have never been so much as damp. Muddy, aye. Damp, no.',
        },
        keyEvidence: true,
      },
      {
        id: 'q2',
        prompt: 'Did you hear anything unusual?',
        answerClip: {
          file: 'keith_q2.mp4',
          caption:
            'Heard a truck. Big one. Rumbling up the back road all morning, there and back, there and back. Woke me twice. If you want your culprit, you go and find that truck.',
        },
        keyEvidence: true,
      },
      {
        id: 'q3',
        prompt: 'You do not like the crowds, do you?',
        answerClip: {
          file: 'keith_q3.mp4',
          caption:
            'No, I do not. Too many people, too much racket. But wanting a bit of peace and quiet is not a crime, is it. I would never wreck the place. I just want to be left alone. Now shoo.',
        },
      },
    ],
    traits: { stripes: false, eucalyptus: false, bottlecaps: false },
    clearedBy: 'A neighbour saw him. No stripes, wrong scent.',
  },
  {
    id: 'steamwell',
    name: 'Sandra Steamwell',
    role: 'Pools manager who raised the alarm',
    stopId: 'village_green',
    introClip: {
      file: 'sandra_intro.mp4',
      caption:
        'Oh, you are the detectives. Thank goodness. I opened up this morning and the whole place was freezing. I have run these pools for years and I have never seen anything like it. Please, ask me anything, I just want this sorted.',
    },
    questions: [
      {
        id: 'q1',
        prompt: 'Where were you when it happened?',
        answerClip: {
          file: 'sandra_q1.mp4',
          caption:
            'I was right here at the front desk the whole time, checking people in. It is all on the camera above the till, you can see me. The moment the water went cold, I raised the alarm and called the chief myself.',
        },
        keyEvidence: true,
      },
      {
        id: 'q2',
        prompt: 'Did you notice anything strange?',
        answerClip: {
          file: 'sandra_q2.mp4',
          caption:
            'Now that you mention it, the water level dropped. A lot. It was not just cold, there was less of it. Almost like someone was, I do not know, pumping it out somewhere.',
        },
        keyEvidence: true,
      },
      {
        id: 'q3',
        prompt: 'Do you have keys to everything?',
        answerClip: {
          file: 'sandra_q3.mp4',
          caption:
            'I do, and they never leave my belt, see. I know that makes me look suspicious, but I promise you, I am the one who wants this solved most of all. These pools are my life.',
        },
      },
    ],
    traits: { stripes: false, eucalyptus: false, bottlecaps: false },
    clearedBy: 'Front desk camera footage, and she is the one who raised the alarm.',
  },
  {
    id: 'watt',
    name: 'Professor Iona Watt',
    role: 'Inventor who tinkers in a garden workshop',
    stopId: 'fairy_door_walk',
    introClip: {
      file: 'watt_intro.mp4',
      caption:
        'Visitors. Marvellous. Do come in, mind the toaster, it butters its own toast now, quite pleased with that one. Professor Iona Watt, inventor, tinkerer, occasional small explosion. You are the detectives. Splendid. How can I help. Do not touch the red lever.',
    },
    questions: [
      {
        id: 'q1',
        prompt: 'Where were you when it happened?',
        answerClip: {
          file: 'watt_q1.mp4',
          caption:
            'Oh, at the science fair, showing off the self buttering toaster. Won a ribbon. There are photographs, I am the one covered in butter. So it was certainly not me freezing your pools, I was far too busy buttering.',
        },
      },
      {
        id: 'q2',
        prompt: 'Have you sold any machines lately?',
        answerClip: {
          file: 'watt_q2.mp4',
          caption:
            'Machines, machines... oh. Oh yes. Last week. A lovely powerful pump, very high pressure. Sold it to a charming gentleman. Red and white striped bow tie, terribly smart. Kept offering me eucalyptus lozenges. Minty fellow. Did I do something wrong?',
        },
        keyEvidence: true,
      },
      {
        id: 'q3',
        prompt: 'What could someone do with that pump?',
        answerClip: {
          file: 'watt_q3.mp4',
          caption:
            'With a pump that size. Move an enormous amount of liquid, very quickly. Water, for instance. You could drain a whole pool with that and pipe it straight into, say, a tanker truck. Goodness. That is rather what happened, is it not.',
        },
        keyEvidence: true,
      },
    ],
    traits: { stripes: false, eucalyptus: false, bottlecaps: false },
    clearedBy: 'A timestamped science fair alibi. She is the witness who names the buyer.',
  },
  {
    id: 'bottler',
    name: 'Bartholomew "Barty" Bottler',
    role: 'Fast-talking entrepreneur',
    stopId: 'main_avenue',
    introClip: {
      file: 'barty_intro.mp4',
      caption:
        'Detectives. Charmed, truly charmed. Barty Bottler, entrepreneur, visionary, man of the people. Terrible business about the pools. Just terrible. Lozenge? No? Suit yourself. Now, I am a very busy man, but for you, I have got all the time in the world. Ask away.',
    },
    questions: [
      {
        id: 'q1',
        prompt: 'Where were you when it happened?',
        answerClip: {
          file: 'barty_q1.mp4',
          caption:
            'Me? I was, ah, meeting investors. Very important people. Very hush hush. Can I prove it? Well, a gentleman of my standing does not need to prove anything. You will simply have to take my word for it.',
        },
        keyEvidence: true,
      },
      {
        id: 'q2',
        prompt: 'What is in the briefcase?',
        answerClip: {
          file: 'barty_q2.mp4',
          caption:
            'Ah, now you are asking the right questions. Samples. My finest product. Premium bottled water, straight from a very special source. Costs a fortune, worth every cent. One day this town will be famous for it. Trust me.',
        },
      },
      {
        id: 'q3',
        prompt: 'Nice bow tie. Is that your style?',
        answerClip: {
          file: 'barty_q3.mp4',
          caption:
            'You noticed. Red and white stripes, my signature. I am never without it. Matches the hatband, you see. A man has got to have a look. Now, was there anything else, or shall I get back to my terribly important meetings?',
        },
        keyEvidence: true,
      },
    ],
    traits: { stripes: true, eucalyptus: true, bottlecaps: true },
    clearedBy: null,
  },
];

export const STOPS = [
  {
    id: 'pools_frontage',
    order: 1,
    fixedStart: true,
    title: 'The pools frontage',
    locationLabel: 'Outside the thermal pools entrance, viewed from the footpath',
    coords: { lat: -42.5228, lng: 172.8286 }, // TBD: confirm on site
    geofenceRadiusM: 30,
    suspectId: null,
    puzzle: {
      id: 'crime_scene',
      type: 'lookAtWorld',
      prompt:
        'Look closely at the scene by the pump. Tap on anything the thief might have left behind.',
      hints: [
        'Check the grate for a snagged thread.',
        'Take a sniff near the machine.',
        'Look for anything small and shiny scattered on the ground.',
      ],
    },
    juniorTask: {
      prompt: 'Can you count the flags at the pools entrance?',
      type: 'count',
      skippable: true,
    },
    evidenceLabel: 'Three tells found at the scene, and the water was pumped out, not just cooled.',
  },
  {
    id: 'village_green',
    order: 2,
    title: 'The village green and playground',
    locationLabel: 'The village green, near the playground',
    coords: { lat: -42.5237, lng: 172.8264 }, // TBD: confirm on site
    geofenceRadiusM: 30,
    suspectId: 'steamwell',
    puzzle: {
      id: 'village_green_count',
      type: 'count',
      prompt: 'Count the benches around the green to unlock the front desk camera timestamp.',
      hints: ['Walk the edge of the green and count as you go.'],
    },
    juniorTask: {
      prompt: 'Can you find the swings? Or spot a dog?',
      type: 'spot',
      skippable: true,
    },
    evidenceLabel: 'Sandra is cleared, and hints the water was going somewhere, not just cooling.',
  },
  {
    id: 'main_avenue',
    order: 3,
    title: 'The shops on the main avenue',
    locationLabel: 'The main shopping avenue',
    coords: { lat: -42.5238, lng: 172.8281 }, // TBD: confirm on site
    geofenceRadiusM: 30,
    suspectId: 'bottler',
    puzzle: {
      id: 'barty_card_cipher',
      type: 'cipher',
      prompt: 'A simple cipher on Barty’s flashy business card.',
      hints: ['Try reading just the capital letters.'],
    },
    juniorTask: {
      prompt: 'Can you spot someone eating an ice cream, or find a striped awning?',
      type: 'spot',
      skippable: true,
    },
    evidenceLabel: 'A dropped bottle cap stamped with a "B", and Barty has no real alibi.',
  },
  {
    id: 'visitor_centre',
    order: 4,
    title: 'The visitor centre',
    locationLabel: 'The i-SITE visitor centre',
    coords: { lat: -42.5232, lng: 172.8290 }, // TBD: confirm on site
    geofenceRadiusM: 30,
    suspectId: 'vonfrost',
    puzzle: {
      id: 'visitor_centre_count',
      type: 'count',
      prompt: 'Count the flags outside, or read the opening hours sign, to reveal her TV alibi.',
      hints: ['The flags are near the entrance.'],
    },
    juniorTask: {
      prompt: 'Can you count the flags, or find a red car?',
      type: 'count',
      skippable: true,
    },
    evidenceLabel: 'The Baroness is cleared, plus her sighting of a tanker up the back road.',
  },
  {
    id: 'forest_walk',
    order: 5,
    title: 'The forest walk edge',
    locationLabel: 'The edge of the forest walk track',
    coords: { lat: -42.5261, lng: 172.8320 }, // TBD: confirm on site
    geofenceRadiusM: 30,
    suspectId: 'kettle',
    puzzle: {
      id: 'forest_walk_count',
      type: 'count',
      prompt: 'Count the big redwoods, or the steps at the track start, to reveal his alibi.',
      hints: ['Look up - the tallest trees are the redwoods.'],
    },
    juniorTask: {
      prompt: 'Can you find the biggest tree, or spot a bird?',
      type: 'spot',
      skippable: true,
    },
    evidenceLabel: 'Keith is cleared, plus his account of a truck up the back road all morning.',
  },
  {
    id: 'fairy_door_walk',
    order: 6,
    title: 'The fairy door walk',
    locationLabel: 'The fairy door walk',
    coords: { lat: -42.5254, lng: 172.8300 }, // TBD: confirm on site
    geofenceRadiusM: 30,
    suspectId: 'watt',
    puzzle: {
      id: 'watt_pump_receipt',
      type: 'match',
      prompt: 'A matching task using the pump receipt Professor Watt shows you.',
      hints: ['Match the description on the receipt to what you have already found.'],
    },
    juniorTask: {
      prompt: 'Can you find and count the fairy doors?',
      type: 'count',
      skippable: true,
    },
    evidenceLabel:
      'Watt is cleared, and the pump was sold to a man in a red and white striped bow tie who smelled of eucalyptus.',
  },
];

export const GAME_CONFIG = {
  id: 'the-big-chill',
  title: 'The Big Chill',
  tells: TELLS,
  suspects: SUSPECTS,
  stops: STOPS,
  narratorClips: NARRATOR_CLIPS,
};
