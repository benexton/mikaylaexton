# The Big Chill: character scripts

Every line for the video clips, ready to drop into ElevenLabs. Each clip has a filename, a voice note, performance direction in brackets, and the line itself. The app plays these by filename, so keep the names exactly as written.

## Recommended workflow

You are generating voices in ElevenLabs and video in a separate tool. A pipeline that keeps the characters consistent and the cartoon look intact:

1. **Design each character as a still image first.** Use an image tool (Midjourney, Ideogram, or similar) with a consistent flat cartoon style in the spirit of Carmen Sandiego: bold shapes, limited palette, light noir, friendly not scary. Generate a clean portrait for each character and keep that reference image so every clip of that character stays on model. Portrait framing, since the iPad is held upright.
2. **Generate the voice in ElevenLabs.** Assign one distinct voice per character and reuse the same voice for all of that character's lines. Keep lines short, which you already have here. Export MP3.
3. **Animate the still to the audio.** Use a talking character or lip sync tool (for example Hedra, HeyGen, or Runway) to drive the portrait from the ElevenLabs audio. These tools change quickly, so check current options, but any image plus audio lip sync tool that handles a stylised face will work.
4. **Light finish.** Add a simple background or a subtle motion loop if the tool does not, keep it to fifteen to thirty seconds, export as MP4 in portrait (roughly 9 by 16).
5. **Name the file** exactly as listed below and hand it to the build. The content config references these names.

**Voice tip:** in ElevenLabs, lean on the style and stability settings to exaggerate each character a little. Barty faster and slicker, the Baroness slow and grand, Keith slow and gravelly, the Professor quick and scattered. Short performance notes are in each clip.

## Character voices at a glance

- **Chief Wembley:** warm, well meaning, slightly bumbling. An older, friendly voice.
- **The mystery thief:** disguised and echoey. Use a different, distorted voice so it does not reveal Barty. Do not let it sound like Barty.
- **Sandra Steamwell:** frazzled but kind, the pools manager. Mid range, sincere.
- **Barty Bottler:** slick, fast talking salesman. Charming, a touch oily.
- **Baroness von Frost:** haughty, dramatic, icy grandeur.
- **Keith Kettle:** grumpy old hermit. Gravelly and slow.
- **Professor Watt:** quirky, enthusiastic inventor. Quick and a little scattered.
- **The fairy (optional):** tiny, sweet, sing song. For the youngest player.

## Clip inventory

Core clips (the game needs these): 22.
Optional extras (nice to have): chief_midway, fairy_hello, barty_caught if you would rather fold the capture into chief_finale.

To reduce the load, you can drop each suspect from three questions to two. The build supports two or three answers per suspect.

---

## Chief Wembley

**chief_intro** [warm, a bit flustered, building to proud]
"Detectives, thank goodness you are here. I am Chief Wembley, and we have a disaster. Overnight, somebody stole the heat from our famous hot pools. Stone cold, the lot of it. I have five suspects and not a single clue what to do next. That is where you come in. And this young detective here... [warmer] by the power vested in me, I hereby swear you in as our Junior Detective. Your first job is the most important of all. Now, off to the pools, and watch for anything the thief left behind."

**chief_midway** (optional) [encouraging]
"Good work out there, team. The town is counting on you. Keep talking to those suspects, keep an eye on the evidence, and do not let anyone charming talk you out of it."

**chief_finale** [triumphant, then chuckling]
"You did it. You cracked the case. We caught him red handed at the tanker, still filling his silly little bottles. The heat is coming back to the pools as we speak, and the whole town says thank you. And a very special thank you to our Junior Detective. Outstanding work. Case closed."

---

## The mystery thief

**thief_taunt** [disguised, echoey, playful menace, do not sound like Barty]
"Well, well. If it is not the great detectives. Too late. The heat is mine now, every last drop of it, and you will never work out where it went. Enjoy the cold. You will not catch me. Ha."

---

## Sandra Steamwell  (stop 2, cleared)

**sandra_intro** [frazzled, relieved to see help]
"Oh, you are the detectives. Thank goodness. I opened up this morning and the whole place was freezing. I have run these pools for years and I have never seen anything like it. Please, ask me anything, I just want this sorted."

**sandra_q1** for "Where were you when it happened?" [earnest]
"I was right here at the front desk the whole time, checking people in. It is all on the camera above the till, you can see me. The moment the water went cold, I raised the alarm and called the chief myself."

**sandra_q2** for "Did you notice anything strange?" [thoughtful]
"Now that you mention it, the water level dropped. A lot. It was not just cold, there was less of it. Almost like someone was, I do not know, pumping it out somewhere."

**sandra_q3** for "Do you have keys to everything?" [a little defensive, then open]
"I do, and they never leave my belt, see. I know that makes me look suspicious, but I promise you, I am the one who wants this solved most of all. These pools are my life."

---

## Barty Bottler  (stop 3, the culprit)

**barty_intro** [slick, charming, chewing a lozenge, deflecting]
"Detectives. Charmed, truly charmed. Barty Bottler, entrepreneur, visionary, man of the people. Terrible business about the pools. Just terrible. Lozenge? No? Suit yourself. Now, I am a very busy man, but for you, I have got all the time in the world. Ask away."

**barty_q1** for "Where were you when it happened?" [smooth, evasive]
"Me? I was, ah, meeting investors. Very important people. Very hush hush. Can I prove it? Well, a gentleman of my standing does not need to prove anything. You will simply have to take my word for it."

**barty_q2** for "What is in the briefcase?" [proud, oversharing]
"Ah, now you are asking the right questions. Samples. My finest product. Premium bottled water, straight from a very special source. Costs a fortune, worth every cent. One day this town will be famous for it. Trust me."

**barty_q3** for "Nice bow tie. Is that your style?" [flattered, a slip]
"You noticed. Red and white stripes, my signature. I am never without it. Matches the hatband, you see. A man has got to have a look. Now, was there anything else, or shall I get back to my terribly important meetings?"

**barty_caught** (optional, or fold into chief_finale) [whining, caught]
"No, no, this is a misunderstanding. Do you have any idea how much that water was worth? Millions. Millions. I was going to be rich. It is not fair. I nearly got away with it too."

---

## Baroness von Frost  (stop 4, cleared)

**baroness_intro** [haughty, grand, dripping with disdain]
"You wish to speak with me? How quaint. Baroness Cornelia von Frost, of Frosthaven Spa, the superior spa, obviously. I am only visiting your soggy little town to see what all the fuss was about. And now the pools are cold. What a shame. What a terrible, terrible shame."

**baroness_q1** for "Where were you when it happened?" [smug]
"Darling, I was on live television, promoting my own magnificent spa. Cameras, lights, an adoring audience. You may check the broadcast. I could not possibly have been skulking about your grubby pools. I have people for that. Well, I would, if I did that sort of thing, which I do not."

**baroness_q2** for "Did you see anything?" [dismissive, then a clue]
"See anything? I saw this town at its worst, that is what I saw. Although... yes, there was a filthy tanker truck sneaking up one of your back roads. Dreadful thing. Ruined my photograph."

**baroness_q3** for "Would you benefit from the pools closing?" [affronted]
"Are you accusing me? How dare you. Naturally more tourists would come to Frosthaven. Naturally I would be delighted. But I did not do it, and you cannot prove a thing, because there is nothing to prove. Good day."

---

## Keith Kettle  (stop 5, cleared)

**keith_intro** [grumpy, gravelly, slow, put upon]
"What do you want. Oh, detectives, is it. Keith Kettle. I live up the hill, away from all the noise and the crowds and the splashing. Best place in town. And no, before you ask, I did not touch your precious pools. Though I will not pretend I am sad to see them quiet."

**keith_q1** for "Where were you this morning?" [flat, certain]
"Up the hill, chopping firewood, same as every morning. My neighbour waved at me over the fence, ask her. I was nowhere near the water, and my boots have never been so much as damp. Muddy, aye. Damp, no."

**keith_q2** for "Did you hear anything unusual?" [grumbling, a clue]
"Heard a truck. Big one. Rumbling up the back road all morning, there and back, there and back. Woke me twice. If you want your culprit, you go and find that truck."

**keith_q3** for "You do not like the crowds, do you?" [honest, gruff]
"No, I do not. Too many people, too much racket. But wanting a bit of peace and quiet is not a crime, is it. I would never wreck the place. I just want to be left alone. Now shoo."

---

## Professor Iona Watt  (stop 6, cleared, points to Barty)

**watt_intro** [quick, cheerful, scattered, delighted by visitors]
"Visitors. Marvellous. Do come in, mind the toaster, it butters its own toast now, quite pleased with that one. Professor Iona Watt, inventor, tinkerer, occasional small explosion. You are the detectives. Splendid. How can I help. Do not touch the red lever."

**watt_q1** for "Where were you when it happened?" [breezy]
"Oh, at the science fair, showing off the self buttering toaster. Won a ribbon. There are photographs, I am the one covered in butter. So it was certainly not me freezing your pools, I was far too busy buttering."

**watt_q2** for "Have you sold any machines lately?" [the key clue, brightening]
"Machines, machines... oh. Oh yes. Last week. A lovely powerful pump, very high pressure. Sold it to a charming gentleman. Red and white striped bow tie, terribly smart. Kept offering me eucalyptus lozenges. Minty fellow. Did I do something wrong?"

**watt_q3** for "What could someone do with that pump?" [thinking aloud]
"With a pump that size. Move an enormous amount of liquid, very quickly. Water, for instance. You could drain a whole pool with that and pipe it straight into, say, a tanker truck. Goodness. That is rather what happened, is it not."

---

## The fairy (optional, stop 6)

**fairy_hello** [tiny, sweet, sing song, for the youngest player]
"Hello little detective. I live behind the tiny door. I saw the thief go by. He had a stripy bow tie and he smelled all minty, and he dropped a shiny bottle top right here. You are doing such a good job. Keep going."

---

## Notes on order and use

- The chief_intro plays at stop 1 after the group opens the game. The thief_taunt follows, at the crime scene.
- Each suspect_intro plays on arrival at their stop. The three question clips play when the group taps one of the offered questions. Only one answer per suspect carries the important content, but all three add character.
- The key evidence answers are: sandra_q1 and sandra_q2, baroness_q1 and baroness_q2, keith_q1 and keith_q2, watt_q2 and watt_q3, and barty_q1 and barty_q3.
- chief_finale (and optionally barty_caught) plays after a correct accusation.
