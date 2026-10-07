/**
 * The derelict Innsmouth house — a first-person walkthrough level (see
 * walkthrough.ts) built in Summer Engine (~/dev/my-summer-game) and exported
 * to /innsmouth-house.glb by `tools/export_house.sh` in that project.
 *
 * The model marks every examinable object with a node named `Examine_<id>`;
 * the viewer looks the id up here. An `Examine_*` node with no entry below is
 * still walkable, just not examinable, and an entry with no node is ignored —
 * so adding a clue is a two-step change: name the node in Summer, add it here.
 *
 * The text is deliberately physical description only. It is the GM's to
 * replace with the campaign's actual clues — and so are the `checks`: what a
 * skill roll turns up at each object, written as a first pass to try the
 * mechanic out, not as settled campaign fact.
 */

import type { Examinable, GazeHazard, Inspectable, Peeper, PhotoFrames, RadioSet, UvStain, WalkthroughLevel } from './walkthrough';

const EXAMINABLES: Record<string, Examinable> = {
  console_table: {
    title: 'Hall Table',
    text: 'A narrow console table under a skin of dust. A brass oil lamp stands on it, the reservoir dry, the wick burned down to nothing.',
    // Written by the GM in the "Skill Matrix" sheet, one tab per object — keep the two in step.
    checks: [
      {
        skill: 'Spot Hidden', action: 'Search the table',
        failure: 'Dust, a dead lamp, and nothing else.',
        success: 'There is a clean rectangle in the dust, about the size of a calling card, where something lay until a few days ago. Someone took it recently.',
        hard: 'Besides the clean patch, there is a shallow drawer hidden under the apron with its pull removed. Inside is a tide table clipped from a Newburyport paper, with every 3 a.m. low tide circled in pencil.',
        extreme: 'Besides the clean patch and the hidden tide table, the floorboards in front of the table are worn in a dull arc. Something stands here often, facing the gilt mirror across the hall.',
      },
      {
        skill: 'Architecture & Engineering', action: 'Study how the table is set against the wall',
        failure: 'An ordinary console table, cheaply joined, pushed up against the plaster. Nothing about it stands out.',
        success: 'The table is screwed to the wall, and not to hold it up. The plaster behind it is newer and whiter than the rest of the hall\'s. The table is there to hide something.',
        hard: 'The wall behind the table sounds hollow when you tap it. A doorway has been lathed and plastered over, and the table placed to hide the seam. It would have led to the space under the stairs.',
        extreme: 'The patch was done from the other side. The lath is nailed from inside the hollow, so whoever sealed this doorway was standing behind it when they finished, and never came back out this way.',
      },
      {
        skill: 'History', action: 'Date the brass lamp',
        failure: 'An old brass lamp. It could be any age.',
        success: 'Not a parlour lamp. It is a ship\'s lamp, gimballed so it stays level at sea, of the kind whalers carried in the 1840s.',
        hard: 'Under the grime on the base is a chandler\'s stamp: "MARSH & CO. · INNSMOUTH". That dates it to Obed Marsh\'s trading years, when the town\'s fortunes turned.',
        extreme: 'The burner has been altered: the wick channel is widened to take a thicker, fouler oil than whale oil. It is the same kind of fuel that burns in the parlor grate.',
      },
      {
        skill: 'Science (Forensics)', action: 'Examine the marks in the dust',
        failure: 'Smudges in the dust. They could have been left by anyone, at any time.',
        success: 'Two handprints on the front edge, palms down, as if someone leaned their full weight on the table. They are fresh: a day or two old at most.',
        hard: 'The prints are wrong. The fingers are too long, and there is no ridge detail at all; the skin that made them was smooth. They left a faint film that still has not dried.',
        extreme: 'Between the fingers, each print bridges across: webbing at the base of the digits. Whoever leaned here was not entirely human, and was here recently.',
      },
      {
        skill: 'Science (Biology)', action: 'Sample the film on the table\'s edge',
        failure: 'Grime and damp. Nothing you can identify without a laboratory.',
        success: 'The film is a mucus that crusts with salt crystals as it dries. It is marine in origin, and it is not from the lamp.',
        hard: 'Small translucent scales are caught in the film. They are not quite fish scales: each has a raised keel, more like a reptile\'s.',
        extreme: 'Several scales still have living tissue at the root. They were shed, not scraped off a dead fish. Something is moulting, and it does so here.',
      },
      {
        skill: 'Track', action: 'Read the floor around the table',
        failure: 'The hall floor is a mess of dust, plaster and debris. No trail you can follow.',
        success: 'Damp barefoot prints come up the hall to the table and stop there.',
        hard: 'The prints come from the boarded back door, under the boards rather than through them, and go back the same way. The stride is long, with the weight on the balls of the feet.',
        extreme: 'There are many sets of prints, layered over weeks, always on the same path and always ending at this table. The newest are still wet: whatever made them was here within the hour.',
      },
      {
        skill: 'Listen', action: 'Put an ear to the wall behind the table',
        failure: 'Only the house creaking as it settles.',
        success: 'A thin draught comes through a seam behind the table. It smells of low tide.',
        hard: 'Behind the wall, water drips slowly, and under the dripping something is breathing: long, wet breaths.',
        extreme: 'The breathing stops when you hold yours. Then, from the other side of the plaster, come three slow knocks at the height of your ear.',
      },
    ],
  },
  mirror: {
    title: 'Gilt Mirror',
    text: 'A tall mirror in a gilded frame, leaning against the wall. The silvering has clouded at the edges; your reflection is a shape in fog.',
    // From the "Gilt Mirror" tab of the GM's Skill Matrix sheet — keep the two in step.
    checks: [
      {
        skill: 'POW', action: 'Hold your own gaze in the glass',
        failure: 'You look away first. You are not sure your reflection did.',
        success: 'Your reflection steadies and is only you. But for a moment, behind your shoulder, the hall in the mirror was wet, with water standing on the boards.',
        hard: 'In the glass, the hall behind you is wet, and the boarded back door stands open with grey low-tide light coming through it. In the real hall behind you, the boards are still nailed fast.',
        extreme: 'You hold on long enough to see a figure in the glass standing at the hall table with its back to you, hands flat on the wood. When you turn round, the hall is empty and dry.',
      },
      {
        skill: 'Spot Hidden', action: 'Search the frame and the back of the mirror',
        failure: 'Clouded silver in a heavy gilt frame. Nothing more.',
        success: 'The mirror has not simply been leant here. It was dragged out of the parlor, leaving scrape marks on the boards, and set down to face the hall table.',
        hard: 'Tucked into the backboard is a folded page torn from a family Bible: a register of names and births. One line has been inked over so heavily that the nib tore the paper.',
        extreme: 'Behind the frame is a page torn from a family Bible, one birth inked out so hard the nib tore the paper. Held up to the light, the struck-out line reads through from the back: "Josiah Marsh, b. 1898."',
      },
      {
        skill: 'Science (Mathematics)', action: 'Measure the reflected hall against the real one',
        failure: 'A reflection is a reflection. Nothing in it adds up to anything.',
        success: 'The angles are off. The hall in the glass is a few degrees longer than the hall you are standing in.',
        hard: 'Sighted along your compass, the reflected doorways do not line up with the real ones. The glass shows an open doorway in the wall behind the hall table.',
        extreme: 'The glass shows an open doorway in the wall behind the hall table, and by the reflected distances the space beyond it does not run back into the house. It runs down, far deeper than any cellar this house could have.',
      },
      {
        skill: 'Science (Forensics)', action: 'Examine the smears on the glass',
        failure: 'Old smears under the dust. They tell you nothing.',
        success: 'There is a fresh print on the glass at face height: a forehead and a face pressed close to the mirror, no more than a day or two old.',
        hard: 'A fresh face print on the glass is flanked by two handprints, as if someone braced against the frame to lean in. The palms are smooth, with no ridge detail, and the fingers are too long.',
        extreme: 'The face print on the glass has no bridge to the nose. It is flat and wide, with the eyes set far apart and the mouth a broad, lipless line. Something pressed its face to this glass to look at itself.',
      },
      {
        skill: 'Track', action: 'Read the floor in front of the mirror',
        failure: 'Dust and debris. Nothing you can follow.',
        success: 'The boards in front of the mirror are water-stained in a rough circle, as if someone stood here dripping.',
        hard: 'The water stains in front of the mirror are layered, rings inside rings: many visits, always to the same spot, standing still for a long time.',
        extreme: 'A damp ring of water stains the boards in front of the mirror, the newest of many, and the prints leading out of it go backwards. Whatever stood here backed away from the mirror without once turning round.',
      },
    ],
  },
  grandfather_clock: {
    title: 'Grandfather Clock',
    text: 'A longcase clock at the end of the hall. The pendulum hangs still. The case door is shut.',
    // From the "Grandfather Clock" tab of the GM's Skill Matrix sheet — keep the two in step.
    checks: [
      {
        skill: 'Mechanical Repair', action: 'Open the case and look at the works',
        failure: 'The case door sticks, and the works are a mystery of brass and grime. Whatever stopped this clock, you cannot tell.',
        success: 'The movement is sound. Someone stopped the pendulum by hand and wedged it with a folded card. The hands read 3:12.',
        hard: 'Someone stopped the pendulum by hand and wedged it with a folded card; the hands read 3:12. On the card, in pencil: "Tide turns at 3. Do not let it strike."',
        extreme: 'The pendulum is wedged with a card reading "Tide turns at 3. Do not let it strike." The hands read 3:12. Behind the weights, a brass key on a loop of fishing line hangs against the back board.',
        fumble: 'Your hand knocks the pendulum free. The clock lurches into motion and strikes once — a single deep note that rolls through the empty house. Somewhere below the floor, something knocks back.',
      },
      {
        skill: 'Architecture & Engineering', action: 'Study how the clock is fixed in place',
        failure: 'A heavy longcase clock. Solid, and nothing remarkable.',
        success: 'The clock is bolted through the floor, far more firmly than any clock needs. It is holding something down.',
        hard: 'The boards under it are newer, cut in a neat square. It is a hatch, and the clock has been stood on top of it.',
        extreme: 'The clock is bolted down over a hatch framed from below with old ship\'s timbers, and cold salt air breathes up through the gaps. It is not a cellar under there but a shaft, running down towards the water table.',
      },
      {
        skill: 'Science (Mathematics)', action: 'Work out what 3:12 means',
        failure: 'A stopped clock is right twice a day. That is all the arithmetic you can bring to it.',
        success: '3:12 is not random. Low tide in Innsmouth harbour falls a few minutes after three this week.',
        hard: 'The clock was stopped on the night of a spring tide, the lowest of the month, when Devil Reef shows above the water.',
        extreme: 'Counting back through the tide cycles, the last spring low to fall at exactly 3:12 was in the autumn of 1914: the year the family portraits in the parlor stop.',
      },
      {
        skill: 'Listen', action: 'Put an ear to the case',
        failure: 'Only the creak of the house settling.',
        success: 'Under the silence there is a faint, wet rhythm, not from the clock but from behind the wall it stands against, like water lapping in a space that should be dry.',
        hard: 'Behind the wall the clock stands against, water is lapping in a space that should be dry. It rises and falls slowly, like a tide, and quickens as it rises.',
        extreme: 'Behind the wall, under the lapping of water, there are voices, many of them, chanting in a long, low drone. They fall silent the instant your ear touches the case.',
      },
      {
        skill: 'Science (Forensics)', action: 'Examine the card wedged in the works',
        failure: 'Pencil on card. It tells you nothing.',
        success: 'The writing is a child\'s, pressed hard enough to dent the card.',
        hard: 'The card wedged in the pendulum has been handled many times since a child wrote it, by wet fingers that left salt stains. Someone keeps coming back to check it is still in place.',
        extreme: 'The newest prints on the card wedged in the pendulum are smooth and webbed. Whatever visits this house keeps checking that the clock does not strike.',
      },
      {
        skill: 'Spot Hidden', action: 'Search around and on top of the clock',
        failure: 'Dust on the hood and a stopped dial.',
        success: 'The dust on top of the hood has been disturbed recently, where someone reached up.',
        hard: 'On top of the hood, out of sight from the floor, hundreds of tally marks are scratched into the wood in groups of five.',
        extreme: 'Hidden on top of the hood are hundreds of scratched tally marks, each run ending with a small anchor: the same anchor that is stitched on the boy\'s breast in the 1913 family portrait.',
      },
    ],
  },
  fireplace: {
    title: 'Parlor Fireplace',
    text: 'A brick hearth under a heavy timber mantel. There is a fire in it — burning low and steady in a house no one has lived in for years.',
    // From the "Parlor Fireplace" tab of the GM's Skill Matrix sheet — keep the two in step.
    checks: [
      {
        skill: 'Spot Hidden', action: 'Search the ashes at the edge of the grate',
        failure: 'Ash, cinders and the stink of old smoke. Nothing you can make out.',
        success: 'There is half-burned paper among the cinders: the corner of a ledger page, with columns of dates and weights in ounces.',
        hard: 'Half-burned among the cinders is the corner of a ledger page, with columns of dates and weights in ounces under the heading "Refinery, Marsh &".',
        extreme: 'A half-burned ledger page headed "Refinery, Marsh &" lies among the cinders. In its margin, in a different hand: "J.M. owes 4 oz. Collect at the reef."',
        fumble: 'You lean in too close. The fire flares green for an instant, and you feel it on your face like a breath from the sea.',
      },
      {
        skill: 'Architecture & Engineering', action: 'Study the hearth and chimney',
        failure: 'A brick hearth under a timber mantel.',
        success: 'The flue is bricked off above the damper. The smoke has nowhere to go, yet the room is not smoky.',
        hard: 'The flue is bricked off, yet the room is not smoky. A draught pulls the smoke down through gaps at the back of the hearth, into a void behind the parlor wall.',
        extreme: 'The bricked-off flue drains its smoke into a void behind the parlor wall, and that void runs towards the hollow behind the hall table and the shaft under the clock. The house has a spine of hidden passages running down to the water.',
      },
      {
        skill: 'History', action: 'Look closely at the mantel beam',
        failure: 'A plain timber mantel, blackened by smoke.',
        success: 'The mantel beam is a reused ship\'s timber, still showing the adze marks.',
        hard: 'A name is carved into the underside of the beam: "SUMATRA QUEEN", one of Obed Marsh\'s trading ships.',
        extreme: 'Under the mantel beam, beneath the carved name "SUMATRA QUEEN", is a cruder sigil like those on the South Sea trade goods Obed Marsh brought home. It could be a ward, or a welcome.',
      },
      {
        skill: 'Science (Biology)', action: 'Work out what is burning',
        failure: 'Some kind of slow-burning fuel. You cannot place it.',
        success: 'It is not wood. The fuel is a dark, waxy mass of rendered fish oil and kelp.',
        hard: 'The fuel is rendered fish oil and kelp, packed into the grate in a heap that could burn for weeks. Someone banked this fire to keep it alight.',
        extreme: 'The fuel is fish oil and kelp, and the kelp is still green at the core, cut from the reef within the last day or two. Whoever tends this fire was in the sea last night.',
      },
      {
        skill: 'Science (Forensics)', action: 'Sift the grate for anything that is not fuel',
        failure: 'Ash and cinders.',
        success: 'Small, chalky fragments of bone are mixed into the ash.',
        hard: 'Chalky bone fragments are mixed into the ash. Most are bird and fish, but one is a finger bone, and it is human.',
        extreme: 'Among the bones in the ash is a finger bone, human but wrong: too long, with a ridge where a web of tissue joined it to the next digit. It was burned recently.',
      },
      {
        skill: 'Natural World', action: 'Work out what is burning',
        failure: 'Some kind of slow-burning fuel. You cannot place it.',
        success: 'It is not wood. The fuel is a dark, waxy mass of rendered fish oil and kelp.',
        hard: 'The fuel is rendered fish oil and kelp, packed into the grate in a heap that could burn for weeks. Someone banked this fire to keep it alight.',
        extreme: 'The fuel is fish oil and kelp, and the kelp is still green at the core, cut from the reef within the last day or two. Whoever tends this fire was in the sea last night.',
      },
      {
        skill: 'Track', action: 'Read the floor in front of the hearth',
        failure: 'Ash scuffed everywhere. No trail you can follow.',
        success: 'Someone tends this fire regularly: ash is trodden into the rug in a path to the hearth.',
        hard: 'A path of ash is trodden into the rug, leading to the hearth from the hall, not from the front door.',
        extreme: 'Bare, long-toed prints in ash lead from the hall to the hearth, and the freshest lie on top of today\'s dust. The fire was fed today.',
      },
    ],
  },
  radio: {
    title: 'Tube Radio',
    text: 'A wooden cabinet radio on a side table. The dial is turned to a station near the bottom of the band.',
    // From the "Tube Radio" tab of the GM's Skill Matrix sheet — keep the two in step.
    checks: [
      {
        skill: 'Science (Mathematics)', action: 'Work out where the signal comes from',
        failure: 'A station near the bottom of the band. That is all you can tell.',
        success: 'The frequency is below any licensed broadcaster in New England.',
        hard: 'The station sits below any licensed broadcaster in New England, close to the ship-to-shore band. Whatever is transmitting, it is maritime.',
        extreme: 'Turning the set and timing the fade, you triangulate the transmitter: close, and offshore to the north-east, where Devil Reef lies.',
      },
      {
        skill: 'Electrical Repair', action: 'Look at how the set is powered',
        failure: 'The tubes glow and the set plays. How, you cannot say.',
        success: 'It is not plugged into anything; the cord has been cut. The tubes glow anyway.',
        hard: 'The power cord has been cut. Instead the chassis is rewired to a pair of copper plates in a pan of seawater under the table: a crude galvanic cell that could never run tubes this bright.',
        extreme: 'The set runs off copper plates in a pan of seawater, and the circuit only closes through the water. It glows brighter as the tide rises outside. The radio is powered by the sea.',
      },
      {
        skill: 'Spot Hidden', action: 'Search the cabinet',
        failure: 'A wooden cabinet radio, tuned near the bottom of the band.',
        success: 'The dial is glued in place. Nobody was ever meant to change the station.',
        hard: 'The dial is glued in place, and a paper strip inside the dial glass has a frequency pencilled on it with the words "Reef. 3 a.m."',
        extreme: 'Folded small behind the speaker cloth is a receipt from the Marsh Refinery: "One receiving set. Paid in kind, 2 oz."',
      },
      {
        skill: 'Listen', action: 'Listen under the music',
        failure: 'Music, faint and crackling.',
        success: 'Beneath the music there is a second signal: rhythmic clicks.',
        hard: 'Beneath the music there are clicks: Morse, repeating the same short group over and over.',
        extreme: 'Beneath the music, a Morse signal repeats the same letters over and over: Y-H-A-N-T-H-L-E-I. Y\'ha-nthlei.',
      },
      {
        skill: 'Streetwise / Underworld Networks', action: 'Place the station',
        failure: 'Just a radio playing music.',
        success: 'Rum-runners used low-band sets like this to time their landings. This was a smuggler\'s radio.',
        hard: 'The station is known on the waterfront. Nobody runs liquor through Innsmouth, and boats that try do not come back. Dockhands call it "the Marsh band".',
        extreme: 'A Boston fence once told you that Innsmouth gold comes ashore on nights the Marsh band plays. The music is the signal that the reef is ready for a collection.',
      },
    ],
  },
  dining_table: {
    title: 'Dining Table',
    text: 'A long mahogany table set for no one. One of the chairs lies on its back beside it, as if someone rose too quickly. A torn envelope lies on the boards, the letter half drawn out of it, addressed to Jamies Martnee, Water Street, Innsmouth, Mass.',
    image: '/innsmouth/letter.webp',
    lying: { src: '/innsmouth/letter.webp', crop: [215, 455, 1440, 610], width: 0.34, turnDeg: 12 },
  },
  sideboard: {
    title: 'Sideboard',
    text: 'A heavy carved sideboard. The doors are closed, the wood swollen with damp.',
    checks: [
      {
        skill: 'STR', action: 'Force the swollen doors',
        success: 'The doors give with a crack. Inside: good china, all of it, every plate turned face down. Beneath the stack is a church bulletin for the Esoteric Order of Dagon, the family name inked in a list of "the Called".',
        failure: 'The wood has swelled tight. The doors do not move.',
        fumble: 'The door tears free of its hinge and the china crashes to the boards. The noise is enormous. At the end of the hall, the boards over the back door creak as if something has pressed against them.',
      },
      {
        skill: 'Locksmith', action: 'Work the little drawer lock',
        success: 'The drawer slides out: a roll of gold coins of no mint you know, stamped with a wave-crest, and a cheap rosary with the cross snapped off.',
        failure: 'The lock is rusted solid.',
      },
    ],
  },
  writing_desk: {
    title: 'Writing Desk',
    text: 'A pedestal desk beneath the boarded window. A sheet of paper lies on the blotter, curled at the corners.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Study the blotter',
        success: 'The page is blank, but the blotter beneath holds the ghost of a letter pressed through in reverse. You make out "…cannot stay. The children hear it in their sleep now…" and a signature: "J. Martnee".',
        extreme: 'Held to the torch at an angle, the blotter gives up a full line pressed through in reverse: "…cannot stay. The children hear it in their sleep now. If the Marsh man comes again, tell him we are gone to Arkham." Signed "J. Martnee".',
        failure: 'A blank sheet, stained with damp. Nothing you can read.',
      },
      {
        skill: 'Library Use', action: 'Go through the pigeonholes',
        success: 'Bills, mostly, from Water Street merchants, all marked paid in gold. The last is a receipt from the Innsmouth town hall for "removal of name from the register".',
        failure: 'Paper, mildew and silverfish. Nothing stands out.',
      },
    ],
  },
  bookshelf: {
    title: 'Bookshelves',
    text: 'Two cases of books, several shelves half-emptied. The spines that remain are cracked and water-stained.',
    checks: [
      {
        skill: 'Library Use', action: 'Look at what was taken',
        success: 'The gaps are not random. Every book on sailing, tides and the sea has been pulled out. What remains is scripture and almanacs — and in the almanacs, every new moon has been circled.',
        failure: 'Mildewed spines and missing volumes. You cannot see any pattern.',
      },
      {
        skill: 'Occult', action: 'Check the remaining titles',
        difficulty: 'Hard',
        success: 'Shoved behind the almanacs is a pamphlet with no title, only a crest of waves. You recognise the invocation printed inside: a prayer to Father Dagon, phrased as a marriage vow.',
        failure: 'Hymnals and almanacs. Nothing here strikes you as unusual.',
      },
    ],
  },
  dresser: {
    title: 'Bedroom Dresser',
    text: 'A chest of drawers with a small lamp on top. One drawer sits slightly open.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Search the open drawer',
        success: "Children's clothes, folded. In the corner, a drawing in wax crayon: a house, four stick figures, and in the sea behind it, a fifth figure, much larger, with its arms raised.",
        failure: "Children's clothes, folded and mildewed.",
      },
    ],
  },
  wardrobe: {
    title: 'Wardrobe',
    text: 'A tall carved wardrobe with one door standing open. Something still hangs inside.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Search behind the hanging coat',
        success: "The coat is a man's oilskin, still damp. The back panel of the wardrobe has been prised loose and nailed back; through the gap you can see a cavity in the wall with a coil of rope and a lantern.",
        failure: "An old oilskin coat, damp to the touch. Nothing else.",
      },
      {
        skill: 'Psychology', action: 'Consider why the door was left open',
        success: 'Everything else in the house was closed and left. This was opened in a hurry and abandoned mid-reach — whoever packed last took something from in here and ran.',
        failure: 'People leave doors open. You can read nothing into it.',
      },
    ],
  },
  bed: {
    title: 'Bed',
    text: 'A bare bedstead and a stained mattress. The blanket has been dragged half onto the floor.',
    checks: [
      {
        skill: 'Medicine', action: 'Examine the stains',
        success: 'Not blood. A dried, faintly iridescent residue with a smell of low tide — and caught in it, a few translucent scales the size of a fingernail. Human skin does not shed like this.',
        failure: 'Old stains of some kind. You cannot tell what.',
        fumble: 'You touch the residue. It is not as dry as it looked, and for the rest of the visit your fingertips tingle and smell of the sea.',
      },
    ],
  },
  dagon_idol: {
    title: 'Fish-Headed Idol',
    text: 'A squat figure of green-black stone, no taller than a hand-span, hunched on its haunches with webbed hands on its knees. Its head is a fish\'s, wide-mouthed and crested. Half of it has sheared away; the pieces lie beside it on the table.',
    checks: [
      {
        skill: 'Occult', action: 'Identify the figure',
        success: 'A votive of Dagon, the kind the Esoteric Order handed to new families on their first Hallowmass. It was not dropped — it was split deliberately, with a chisel, along the line of the spine.',
        failure: 'Some coastal folk carving. It means nothing to you, and you would rather stop looking at it.',
        fumble: 'The longer you try to place it, the more certain you are that it is looking back. Lose your nerve: the blur closes in.',
      },
      {
        skill: 'Appraise', action: 'Judge the stone',
        success: "Not a stone you know. Too heavy for its size, cold even in the fire's warmth, with a faint greasy sheen. No quarry in New England produced this.",
        failure: 'Dark stone, poorly carved. Worthless, probably.',
      },
      {
        skill: 'Cthulhu Mythos', action: 'Remember where you have seen it',
        success: 'The crest, the haunches, the webbed hands: this is a likeness of something that is still alive, and the break across it is a ward — a family trying to divorce itself from a bargain.',
        failure: 'You have the sense you ought to know it. The thought slides away.',
      },
    ],
  },
  oil_lamp: {
    title: 'Oil Lamp',
    text: 'A brass-footed kerosene lamp on the corner of the desk, its chimney sooted up one side. The wick was trimmed not long ago. It is light enough to pick up and turn over.',
  },
  floorboards: {
    title: 'Loose Floorboards',
    text: 'A patch of parlor floor between the armchair and the hall door where the boards sit a fraction proud of their neighbours, and not quite in line. Kneel and look closer.',
  },
  bedroom_window: {
    title: 'Bedroom Window',
    text: 'A sash window behind the boards, like every window in the house. The boards are nailed fast from inside — but through the gaps the brass sash lock catches your light, and it has been thrown shut.',
  },
  // Hidden things, brought out from their containers (see INSPECTABLES).
  mirror_newspaper: {
    title: 'Newspaper Lining',
    text: 'The mirror\'s backboard comes away from the frame, and behind it the glass is packed with a folded front page, yellow and brittle. It has been there a good while, but not since the mirror was made.',
  },
  clock_weight: {
    title: 'Hollow Clock Weight',
    text: 'Of the three brass weights hanging in the case, one is lighter than the others. Its base turns on a fine thread, worn bright, and comes away in your hand. Something is rolled up inside.',
  },
  photo_corner: {
    title: 'Half-Burned Photograph',
    text: 'Raked out from under the fuel at the edge of the grate: a curled corner of stiff card, charred black along two sides. It is a studio photograph, or what is left of one.',
  },
  toy_boat: {
    title: 'Toy Boat',
    text: 'Under the loose boards is a dry hollow between the joists, and in it, wrapped in a scrap of sacking, a child\'s carved sailing boat. Its sail is torn. It was put here to be kept, not thrown away.',
  },
  blotter_sheet: {
    title: 'Curled Sheet',
    text: 'The sheet lifts off the blotter with a dry crackle. It is good writing paper, blank on both sides as far as the eye can tell.',
  },
  hymnal_shelf: {
    title: 'Half-Emptied Shelf',
    text: 'A stretch of shelf where most of the books are gone. A few volumes lean at one end, and a hymnal lies open on the bare wood, as if someone set it down mid-reading and walked away.',
  },
  oilskin_coat: {
    title: 'Oilskin Coat',
    text: 'A heavy fisherman\'s oilskin on a wooden hanger, stiff with dubbin and still faintly tacky. It smells of the harbour. Hung up, it looks almost ordinary.',
  },
  window_latch: {
    title: 'Sash Lock',
    text: 'Through the gap between two boards you can reach the meeting rails of the sash. The brass lock is thrown, the cam turned hard into its keeper, and the sill below is white with something that crunches under your glove.',
  },
  iron_safe: {
    title: 'Iron Safe',
    text: 'A squat iron safe on cast feet, wedged into the corner by the front door. The maker\'s gilt lettering has worn to a ghost, the paint is scabbed with rust, and the door is shut fast. The dust on its top is undisturbed; the floorboards in front of it are scuffed bare.',
  },
};

/**
 * The four frames above the parlor sofa hold the family's yearly studio
 * portraits (the same plates as "Family Portraits, 1911–1914" in All
 * Resources), read left to right then top to bottom: 1911 left, 1912 top,
 * 1913 bottom, 1914 right. The openings were measured off a render of the
 * frames' mesh, whose +Y faces into the parlor.
 */
const PHOTO_FRAMES: PhotoFrames = {
  node: 'Examine_family_portraits',
  axes: { right: [1, 0, 0], up: [0, 0, -1], out: [0, 1, 0] },
  photos: [
    {
      id: 'portrait_1911', title: 'Portrait, 1911', image: '/family-portraits/1911.webp',
      center: [-0.7285, 0.05, -0.102], size: [0.413, 0.578],
      text: 'A studio portrait before a painted woodland. A moustached man and his wife sit side by side; a boy in a sailor suit and a girl with a bow in her hair stand behind them. All four look straight at the lens.',
    },
    {
      id: 'portrait_1912', title: 'Portrait, 1912', image: '/family-portraits/1912.webp',
      center: [-0.0045, 0.05, -0.454], size: [0.495, 0.674],
      text: 'The same family, a year on: the father seated, his wife behind him, the children in front. Every face is turned to the camera.',
    },
    {
      id: 'portrait_1913', title: 'Portrait, 1913', image: '/family-portraits/1913.webp',
      center: [-0.0045, 0.05, 0.463], size: [0.495, 0.682],
      text: 'The father sits in profile, turned away from the lens, his face gone to shadow. The plate is clouded and blistered around him and nowhere else. His wife and children look straight out. There is a small anchor stitched on the boy\'s breast.',
    },
    {
      id: 'portrait_1914', title: 'Portrait, 1914', image: '/family-portraits/1914.webp',
      center: [0.739, 0.05, -0.2], size: [0.47, 0.592],
      text: 'The father has his back to the camera. Black blooms of decay have eaten through the emulsion over him; the rest of the plate is clean. The mother sits beside him, the children stand, and all three stare at the lens.',
    },
  ],
};

/** Staring at the idol blurs the view — see GazeHazard. */
const GAZE_HAZARDS: Record<string, GazeHazard> = {
  dagon_idol: { angleDeg: 3, range: 5, maxBlurPx: 8, onsetSec: 2.5, recoverSec: 0.8 },
};

/** The parlor radio still works — it plays the campaign's second theme. */
const RADIOS: Record<string, RadioSet> = {
  radio: { src: '/soundtrack-2.mp3', volume: 0.8, refDistance: 1.5 },
};

/**
 * What the Wood's lamp finds (see UvStain): the father's change, written in
 * brine from his bed to the back door, and the night the family fought him
 * off, in blood someone has tried to wash away. Positions are in the house's
 * metres — rooms and walls as laid out in Summer's `build_house.gd`.
 */
const UV_STAINS: UvStain[] = [
  {
    id: 'uv_brine_prints', kind: 'brine', mark: 'prints',
    // From the side of the bed, round its foot, out of the bedroom and down the hall to the back door.
    floor: [[4.95, -3.45], [4.75, -2.55], [3.3, -2.45], [2.55, -3.95], [1.5, -4.3], [0.55, -4.5], [0.1, -4.8]],
    title: 'Trail of Brine',
    text: 'Footprints in dried salt water, glowing a sickly green under the lamp. By the bed they are a man\'s bare feet. Down the hall the toes lengthen and splay; at the back door the last prints are three-toed, webbed and clawed, and the stride is far too long. None come back.',
    checks: [
      {
        skill: 'Track', action: 'Follow the trail',
        success: 'One walker, unhurried, all the way. He did not run and nothing chased him. He stopped once, at the foot of the bed, and stood a long while — the prints there are doubled and smeared.',
        hard: 'One walker, unhurried. He stood a long while at the foot of the bed before he left. At the back door the last print is half under the door itself: he went out before the boards went up, and the boards were nailed over his footprint.',
        failure: 'Salt and scuffs. The trail breaks up on the bare boards and you lose it.',
      },
      {
        skill: 'Science (Biology)', action: 'Study the change in the feet',
        success: 'This is no costume and no deformity. Over a few dozen yards the bones of a foot lengthen and the toes fuse into three. Whatever happened to him happened while he walked.',
        failure: 'Animal tracks over a man\'s — or a trick of the lamp. You cannot make it mean anything.',
      },
    ],
  },
  {
    id: 'uv_brine_glyph', kind: 'brine', mark: 'glyph',
    wall: { from: [4.0, 1.85, -4.0], toward: [0, 0, -1], size: [0.8, 0.8] },
    title: 'Sign Above the Bed',
    text: 'Above the headboard, drawn on the plaster with a wet finger and invisible by any other light: a ring, a three-tined staff with wavering tines, and a wave beneath it. Salt water has run from the strokes and dried.',
    checks: [
      {
        skill: 'Occult', action: 'Read the sign',
        success: 'A mark of the Esoteric Order of Dagon — the sign members set over a door, or a bed, to say a house is pledged. Someone in this family took the Oath.',
        failure: 'Fisherman\'s superstition, perhaps. Nothing you know.',
      },
      {
        skill: 'Cthulhu Mythos', action: 'Recall where it is from',
        success: 'Not a ward. A summons. It tells whatever comes up out of the harbour that someone in this room is ready to go down to it.',
        failure: 'The shape will not hold still in your memory.',
      },
    ],
  },
  {
    id: 'uv_brine_message', kind: 'brine', mark: 'writing',
    words: ['ABIGAIL MARSH', 'IS ALIVE'],
    // The bedroom's west wall, between the door and the dresser, facing the bed.
    wall: { from: [3.0, 1.5, -1.9], toward: [-1, 0, 0], size: [1.5, 0.65] },
    title: 'Message in Brine',
    text: 'Across the bedroom wall, in letters a hand high, drawn with a finger dipped in sea water and dried to salt: ABIGAIL MARSH IS ALIVE. By any other light the plaster is blank.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Study the lettering',
        success: 'The same finger drew the sign above the bed: the strokes are as wide, and they run the same way. The letters are careful and upright, from someone used to writing a fair hand.',
        failure: 'Salt letters on old plaster. Nothing more to see in them.',
      },
      {
        skill: 'History', action: 'Place the name',
        success: 'The Marshes were Innsmouth\'s first family: Captain Obed Marsh\'s line, owners of the refinery, who left the town years ago. No Abigail appears in any record of them you have seen. Either she was never written down, or someone saw to it that she was not.',
        failure: 'Marsh is an old Innsmouth name. You can recall nothing about an Abigail.',
      },
    ],
  },
  {
    id: 'uv_blood_spatter', kind: 'blood', mark: 'spatter',
    wall: { from: [-3.0, 1.25, -3.35], toward: [1, 0, 0], size: [1.2, 0.9] },
    title: 'Washed Spatter',
    text: 'Above the fallen chair the wall has been scrubbed, and by daylight it looks clean. Under the lamp the scrubbing shows as a dark cloud, and through it an arc of flung drops, the sort a heavy blow throws off a weapon on the backswing.',
    checks: [
      {
        skill: 'Science (Forensics)', action: 'Read the spatter',
        success: 'Two blows, from someone standing where the chair fell, swinging right to left. A tall man, or a woman standing on something. The blood flew back toward the dining table, not the door.',
        hard: 'Two blows, swung by someone at the fallen chair, right to left. The drops are thinner than they should be and have a greenish ring where they dried — whoever bled here was not entirely human by then.',
        failure: 'A mess of old stains under older paint. You cannot tell one blow from another.',
      },
    ],
  },
  {
    id: 'uv_blood_handprint', kind: 'blood', mark: 'handprint',
    wall: { from: [-1.0, 0.95, -1.0], toward: [-1, 0, 0], size: [0.34, 0.9] },
    title: 'Handprint in the Hall',
    text: 'Beside the dining-room door, a hand in blood: pressed flat at shoulder height, then dragged down the wall to the skirting. Somebody hurt came out of the dining room and needed the wall to stand.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Look closer',
        success: 'A small hand — a woman\'s, or a child\'s — with a ring on the third finger that left a clean band in the print.',
        failure: 'A smear. It could be anyone\'s.',
      },
      {
        skill: 'Medicine', action: 'Judge how badly they were hurt',
        success: 'Enough blood to soak a hand, not enough to kill. Whoever this was walked on.',
        failure: 'Too old to say.',
      },
    ],
  },
  {
    id: 'uv_blood_writing', kind: 'blood', mark: 'writing',
    words: ['HE IS NOT', 'YOUR FATHER'], scrubbed: true,
    wall: { from: [5.0, 1.55, 4.25], toward: [1, 0, 0], size: [1.1, 0.55] },
    title: 'Words on the Study Wall',
    text: 'Daubed on the wall beside the desk in big, careful capitals, then scrubbed at with a rag until no eye would see it: HE IS NOT YOUR FATHER.',
    checks: [
      {
        skill: 'Psychology', action: 'Think about who wrote it',
        success: 'Written for the children, not for him — and scrubbed off later by someone else, someone who did not want them to know.',
        failure: 'A warning, or a threat. You cannot tell which.',
      },
    ],
  },
  // The same name three times, in brine with blood flung across it, leading from the hall to the study.
  {
    id: 'uv_find_abigail', kind: 'brine', mark: 'writing', splash: 'blood',
    words: ['FIND ABIGAIL'],
    // The hall's west wall above the hall table, beside its oil lamp.
    wall: { from: [-1.0, 1.5, 0.6], toward: [-1, 0, 0], size: [1.1, 0.36] },
    title: 'Above the Hall Table',
    text: 'On the wall over the hall table, beside the lamp, letters drawn in brine that glows green under the lamp, and flung across them a spray of blood that shows black: FIND ABIGAIL. By any other light the wallpaper is only stained.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Study the letters',
        success: 'The brine went on first, with a finger. The blood came after, flung, not painted: it beads over the letters as if someone was struck down beside them while the words were still wet.',
        failure: 'Old stains under older paper. You can make nothing more of them.',
      },
    ],
  },
  {
    id: 'uv_abigail_parlor', kind: 'brine', mark: 'writing', splash: 'blood',
    words: ['ABIGAIL'],
    // The parlor's west wall past the fireplace, facing the door from the hall.
    wall: { from: [-4.0, 1.5, 4.25], toward: [-1, 0, 0], size: [1.1, 0.42] },
    title: 'A Name on the Parlor Wall',
    text: 'Facing the door from the hall, on the wall past the fireplace: one word in glowing brine, spattered over with blood. ABIGAIL.',
    checks: [
      {
        skill: 'Psychology', action: 'Think about who wrote it',
        success: 'Not a warning this time. The letters are larger and less careful than in the hall, the hand of someone calling a name rather than leaving one.',
        failure: 'A name, and nothing about who needed it written here.',
      },
    ],
  },
  {
    id: 'uv_abigail_door', kind: 'brine', mark: 'writing', splash: 'blood',
    words: ['ABIGAIL IS', 'BEHIND', 'THE DOOR'],
    // The study's west wall, beside its door from the hall.
    wall: { from: [3.5, 1.5, 4.25], toward: [-1, 0, 0], size: [1.2, 0.75] },
    title: 'Beside the Study Door',
    text: 'On the wall beside the study door, where you would only see it turning to leave: ABIGAIL IS BEHIND THE DOOR, in glowing brine, flecked all over with blood.',
    checks: [
      {
        skill: 'Spot Hidden', action: 'Look at the brine',
        success: 'The brine has run from the bottom of every letter and dried in long salt tears, the same green as the footprints that lead to the back door.',
        failure: 'Salt spray and old blood. Which door, it does not say.',
      },
    ],
  },
];

/** A Deep One at the hole in the boarded back door, at the end of the hall. */
const PEEPER: Peeper = { gapSec: [3, 7], holdSec: [1.2, 2.4], shyWithin: 0.8 };

/**
 * Things to pick up and turn over (E). The lamp is built in Godot
 * (my-summer-game tools/build_oil_lamp_cli.gd), which also places its clue
 * markers; the floorboards are a Sketchfab patch scaled and marked by
 * my-summer-game tools/build_floorboards.mjs. PLACEHOLDER clue text, for the
 * GM to replace.
 */
const INSPECTABLES: Record<string, Inspectable> = {
  oil_lamp: {
    model: '/props/oil-lamp.glb',
    on: 'writing_desk',
    offset: [0.28, -0.12],
    turnDeg: 25,
    clues: {
      stamp: {
        title: "Maker's Stamp",
        uv: true,
        text: 'Pressed into the underside of the foot: GILMAN HOUSE · INNSMOUTH, under a ringed device of a fish-tailed cross. The hotel\'s lamps were never sold; this one was carried out of it.',
        mark: { kind: 'stamp', lines: ['GILMAN HOUSE', 'INNSMOUTH'] },
        size: [0.09, 0.09],
      },
      print: {
        title: 'A Webbed Thumbprint',
        text: "Under the Wood's lamp a thumbprint glows on the side of the foot, crusted with salt. It is too broad, and the ridges run on into a smear of skin between thumb and finger. Whoever last carried this lamp had sea-wet hands.",
        uv: true,
        mark: { kind: 'print' },
        size: [0.026, 0.026],
      },
    },
  },
  // Pried up and set back: the toy boat is in the hollow beneath (toy_boat).
  floorboards: {
    model: '/props/floorboards.glb',
    at: [-3.7, 4.42],
    turnDeg: 90,
    clues: {
      pry: {
        title: 'Pry Marks',
        uv: true,
        text: 'The end of one board is bitten all along its edge where a bar was worked under it, and the splinters are still pale. These boards have been lifted and pressed back down, and not long ago. The nails were put back by hand, without a hammer.',
        mark: { kind: 'gouge' },
        size: [0.11, 0.035],
      },
      print: {
        title: 'Salt in the Grain',
        text: "Under the Wood's lamp a thumbprint glows on the next board, crusted with salt, where someone knelt and braced a hand to lever up the floor. It is too broad for a man's thumb, and the ridges smear out sideways into skin.",
        uv: true,
        mark: { kind: 'print' },
        size: [0.045, 0.045],
      },
    },
  },

  // ── Hidden inside things: never drawn in the house; a button on the
  // container's card (or viewer) brings each one out. Models are procedural,
  // from my-summer-game tools/house_props (build.mjs, textures.py).
  mirror_newspaper: {
    model: '/props/mirror-newspaper.glb',
    in: { from: 'mirror', action: 'Look behind the backing' },
    clues: {
      dateline: {
        title: 'Dated February 1928',
        uv: true,
        text: 'The lining is the front page of the Essex County Courier for Thursday, February 16, 1928: "U.S. AGENTS RAID INNSMOUTH." The morning after the raids. Whoever took the backing off this mirror did it that week, and wanted the date kept behind the glass.',
        size: [0.22, 0.02],
      },
      pencil: {
        title: 'A Wavelength in Pencil',
        uv: true,
        text: 'In the empty foot of the page, in soft pencil: "550 kc. — bottom of the dial. He speaks at three." The parlor radio is tuned to the very bottom of the band.',
        mark: { kind: 'writing', style: 'pencil', lines: ['550 kc. — bottom of the dial.', 'He speaks at three.'] },
        size: [0.15, 0.03],
      },
    },
  },
  clock_weight: {
    model: '/props/clock-weight.glb',
    in: { from: 'grandfather_clock', action: 'Open the case and lift out the weights' },
    clues: {
      hollow: {
        title: 'A Hollow Weight',
        uv: true,
        text: 'The weight is a brass shell, bored out and fitted with a screw base: made to be opened, and opened often, by the wear on the thread. Packed inside was a roll of oilskin, tied with fishing line.',
        size: [0.05, 0.05],
      },
      hour: {
        title: 'The Tide-Gate',
        uv: true,
        text: 'Unrolled, the oilskin holds a hand-corrected chart of the harbour mouth. A course is pencilled from the old tide-gate on the breakwater out to Devil Reef, and beside it in ink: "L.W. 3·12 — gate stands open. One hour, no more." The same hour the clock was stopped at.',
        mark: { kind: 'writing', style: 'ink', lines: ['L.W. 3·12 — gate stands open.', 'One hour, no more.'] },
        size: [0.12, 0.03],
      },
    },
  },
  photo_corner: {
    model: '/props/photo-corner.glb',
    in: { from: 'fireplace', action: 'Rake through the ashes' },
    clues: {
      anchor: {
        title: 'The Stitched Anchor',
        uv: true,
        text: 'It is the same sitting as the 1913 portrait above the sofa: the boy in his sailor blouse. His head is burned away, but the anchor stitched on his breast survived. Someone fed this print to the fire on purpose, and did not stay to see it finish.',
        size: [0.02, 0.02],
      },
      inscription: {
        title: 'On the Back',
        uv: true,
        text: 'On the back of the card, in a woman\'s careful hand: "Easter 1913." Whatever was written after it has burned away.',
        size: [0.05, 0.012],
      },
    },
  },
  toy_boat: {
    model: '/props/toy-boat.glb',
    in: { from: 'floorboards', action: 'Lift the loose boards', after: 'pry' },
    clues: {
      initials: {
        title: 'Initials Gouged Out',
        uv: true,
        text: 'Initials were cut into the transom with a penknife, a child\'s careful work, and later dug out again with the point of a blade. You can still make out a J, and the first stroke of an M.',
        mark: { kind: 'gouge', lines: ['J. M.'] },
        size: [0.05, 0.022],
      },
      notches: {
        title: 'Notches on the Deck',
        uv: true,
        text: 'Knifed into the deck beside the mast are four dated notches, a boy measuring himself against his boat: 1911, 1912 and 1913 close together, a year\'s growing apart. The last, 1914, is cut a hand\'s width further on. No boy grows that much in a year.',
        mark: { kind: 'writing', style: 'carved', lines: ['1911 · 1912 · 1913 · · · · 1914'] },
        size: [0.1, 0.012],
      },
    },
  },
  blotter_sheet: {
    model: '/props/blotter-sheet.glb',
    in: { from: 'writing_desk', action: 'Lift the sheet off the blotter' },
    clues: {
      indent: {
        title: 'Pressed into the Paper',
        uv: true,
        text: 'Tilted against the light, the blank sheet shows the dents of a letter written on the page above it and torn away: "Mother — I will not come down to the reef, not for him and not for you. Tell the Marsh man the boy is not his. Burn this. — J." The reply to the letter in the torn envelope, never sent.',
        raking: true,
        mark: { kind: 'writing', lines: ['Mother —', 'I will not come down to the reef,', 'not for him and not for you.', 'Tell the Marsh man the boy is not his.', 'Burn this. — J.'] },
        size: [0.18, 0.11],
      },
    },
  },
  hymnal_shelf: {
    model: '/props/hymnal-shelf.glb',
    in: { from: 'bookshelf', action: 'Look along the emptied shelves' },
    clues: {
      gaps: {
        title: 'Outlines in the Dust',
        uv: true,
        text: 'Clean shapes stand out of the dust where eleven books stood until lately: tall, thin bindings the size of charts and tide tables, not hymnals. They were taken within the last few weeks; the dust has barely begun to settle into the gaps.',
        size: [0.3, 0.2],
      },
      margin: {
        title: 'Notes in the Margin',
        uv: true,
        text: 'The hymnal lies open at "For Those at Sea." Beside the burial verse, in the same hand as the letter pressed into the blotter sheet: "not for those at sea — for those who come up out of it. — J."',
        mark: { kind: 'writing', style: 'ink', lines: ['not for those at sea —', 'for those who come up out of it.', '— J.'] },
        size: [0.1, 0.035],
      },
    },
  },
  oilskin_coat: {
    model: '/props/oilskin-coat.glb',
    in: { from: 'wardrobe', action: 'Take down the coat' },
    clues: {
      sleeves: {
        title: 'Too Long in the Arm',
        uv: true,
        text: 'The coat is cut for a narrow man, but the sleeves hang a full hand\'s length past where any hand would be, and the back seam has been let out across the shoulders. It was altered to fit a body that is the wrong shape for it.',
        size: [0.16, 0.16],
      },
      stencil: {
        title: 'Refinery Stencil',
        uv: true,
        text: 'Stencilled across the back in black: "MARSH REF. CO. — STORES · 14." Refinery issue, not a fisherman\'s own. Somewhere in the Marsh refinery there is a stores locker numbered 14.',
        mark: { kind: 'writing', style: 'stencil', lines: ['MARSH REF. CO.', 'STORES · 14'] },
        size: [0.22, 0.075],
      },
    },
  },
  window_latch: {
    model: '/props/window-latch.glb',
    in: { from: 'bedroom_window', action: 'Look closely at the latch' },
    clues: {
      scratches: {
        title: 'Worked from Outside',
        uv: true,
        text: 'On the outside face of the lower sash, under the lock, the paint is chewed in a row of small bites where a thin blade was worked up between the sashes to throw the catch. The window was latched from outside, by someone leaving.',
        mark: { kind: 'gouge' },
        size: [0.1, 0.022],
      },
      salt: {
        title: 'Salt on the Sill',
        uv: true,
        text: 'The sill is crusted white with sea-salt, thickest under the lock, as if something wet stood streaming here a long while, working at the catch. The same crust rims the boarded back door at the end of the hall.',
        size: [0.15, 0.08],
      },
    },
  },
};

export const HOUSE_LEVEL: WalkthroughLevel = {
  id: 'house',
  model: '/innsmouth-house.glb',
  godot: '/godot/walkthrough.html?level=house',
  title: 'The Derelict House · Innsmouth',
  loadingText: 'Approaching the house…',
  errorText: 'The house could not be loaded.',
  enterText: 'Click to step inside',
  leaveLabel: 'Leave the house',
  credit: '"Antique Iron Safe" by pixelgrapher — CC BY 4.0',
  examinables: EXAMINABLES,
  gazeHazards: GAZE_HAZARDS,
  radios: RADIOS,
  peeper: PEEPER,
  photoFrames: PHOTO_FRAMES,
  uvStains: UV_STAINS,
  inspectables: INSPECTABLES,
  // In the hall, in the corner between the study door and the front door, facing the stairs.
  props: { iron_safe: { model: '/props/iron-safe.glb', at: [1.56, 4.35], turnDeg: -90 } },
  // Cracked by the dial game (SafeCracker). What is inside is a placeholder for the GM.
  locks: {
    iron_safe: {
      opened: {
        title: 'Iron Safe — Open',
        text: 'The door swings out on a dry squeal. Inside, on a single shelf: a bundle of papers tied with faded ribbon, a cash box with its lid prised up and nothing in it, and a ring of keys on a tag stamped with a number. The steel walls are beaded with salt, as if the sea got in without opening the door.',
      },
    },
  },
  // The bedroom window has no furniture node of its own (the windows are part of the walls).
  spots: { bedroom_window: { min: [5.72, 0.85, -3.95], max: [5.93, 2.35, -2.85] } },
  atmosphere: {
    background: 0x020202,
    fogColor: 0x030303,
    fogDensity: 0.07,
    // Moonlight leaking through the boards — just enough to find the walls.
    sky: 0x4a5670,
    ground: 0x0c0906,
    fill: 0.35,
  },
  // The hearth is lit. Give it light of its own.
  fires: [{ examineId: 'fireplace', at: b => [b.max.x + 0.2, 0.5, (b.min.z + b.max.z) / 2] }],
};
