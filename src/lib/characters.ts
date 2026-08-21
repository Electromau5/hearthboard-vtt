export type Vitals = {
  hp: number;
  willpower: number;
  sanity: number;
  maxSanity: number;
  bufferedSanity: number;
  bufferedSanityMax: number;
  ancestralResonance: number;
  luck: number;
};

export type Characteristics = {
  STR: number; CON: number; SIZ: number; DEX: number;
  APP: number; INT: number; POW: number; EDU: number;
};

export type Skill = { name: string; value: number; notes: string };
export type Ability = { name: string; type: "Active" | "Passive" | "Utility" | "Buffered Sanity" | "Resonance Check"; description: string };
export type Hook = { title: string; description: string };

export type Character = {
  slug: string;
  name: string;
  age: number;
  gender: string;
  pastDemons: string;
  avatar?: string;
  className: string;
  cover: string;
  formerStatus: string;
  vitals: Vitals;
  characteristics: Characteristics;
  skills: Skill[];
  abilities: Ability[];
  hooks: Hook[];
  equipment: string[];
};

export const CHARACTERS: Character[] = [
  {
    slug: "dr-alistair-finch",
    name: "Dr. Alistair Finch",
    age: 42,
    gender: "Male",
    pastDemons: "",
    className: "The Disgraced Mortician",
    cover: "City Morgue Contract Embalmer at Arkham Sanitarium",
    formerStatus: "Senior Chief of Surgery, Danvers State Hospital",
    vitals: {
      hp: 12, willpower: 15,
      sanity: 45, maxSanity: 78,
      bufferedSanity: 0, bufferedSanityMax: 12,
      ancestralResonance: 35, luck: 50,
    },
    characteristics: { STR: 50, CON: 65, SIZ: 55, DEX: 75, APP: 40, INT: 85, POW: 75, EDU: 85 },
    skills: [
      { name: "Forensics / Autopsy", value: 80, notes: "Master level identification of tissue damage, biological anomalies, toxic exposure" },
      { name: "Medicine & Surgery", value: 75, notes: "Field stabilizing, wound suture, precise anatomical dissection" },
      { name: "Biology / Abnormal Zoology", value: 70, notes: "Comparative alien anatomy, organ classification, taxonomy" },
      { name: "First Aid", value: 70, notes: "Rapid tourniquet application, hemorrhage control" },
      { name: "Spot Hidden", value: 65, notes: "Microscopic incision traces, structural fractures, concealed biological markers" },
      { name: "Stealth", value: 55, notes: "Evading municipal inspectors and federal tail teams" },
      { name: "Intimidation", value: 50, notes: "Morbid clinical detachment, unblinking mortuary demeanor" },
    ],
    abilities: [
      { name: "Macabre Anatomy", type: "Active", description: "Upon observing an entity or mutated specimen for 1 full turn, Finch can make an INT / Biology check to pinpoint anatomical vulnerabilities, granting all allies +20% to hit vital weak spots or bypass 2 points of natural armor." },
      { name: "Morgue Sanctuary", type: "Utility", description: "Unfettered access to municipal mortuary coolers, embalming chemicals, and cadaver records. Can forge autopsy certificates or conceal contraband evidence within transit caskets." },
      { name: "Buffered Dissection", type: "Buffered Sanity", description: "When dissecting cosmic entities, sanity damage is banked into the Exposed Negative pool. Full psychic recoil triggers only when the surgical session concludes and specimens are fixed." },
    ],
    hooks: [
      { title: "Watched by the State", description: "Government agents monitor his movements. Rolling a 95–00 on any clandestine check introduces a federal investigation agent or detective tail." },
      { title: "Tomb Ambition", description: "To recover an uncorrupted, mummified pre-human entity (Elder Thing / Mi-Go tissue) to validate his life's work and master non-terrestrial physiology." },
      { title: "Ancestral Secret", description: "Finch's bloodline was genetically altered by early necromantic experiments (connected to the salts of Charles Dexter Ward), explaining why preserved specimens never fully rot in his presence." },
    ],
    equipment: [
      "Master surgeon's dissection kit",
      "Heavy rubber apron",
      "3 glass jars of formaldehyde-saline concentrate",
      "Scalpel holster",
      "Mortuary bypass credentials",
    ],
  },
  {
    slug: "silas-vance",
    name: "Silas \"The Great\" Vance",
    age: 36,
    gender: "Male",
    pastDemons: "",
    className: "The Blackmailed Illusionist",
    cover: "Vaudeville Escape Artist & Illusionist",
    formerStatus: "Sergeant, Corps of Royal Engineers / Special Infiltration Scout",
    vitals: {
      hp: 11, willpower: 14,
      sanity: 55, maxSanity: 82,
      bufferedSanity: 0, bufferedSanityMax: 10,
      ancestralResonance: 40, luck: 65,
    },
    characteristics: { STR: 55, CON: 60, SIZ: 50, DEX: 85, APP: 70, INT: 75, POW: 70, EDU: 65 },
    skills: [
      { name: "Sleight of Hand", value: 85, notes: "Concealing items, pickpocketing, palming keys and lock triggers" },
      { name: "Locksmith / Mechanical Infiltration", value: 75, notes: "Bypassing mechanical tumblers, pressure pad locks, vault pins" },
      { name: "Stealth", value: 70, notes: "Silent movement, camouflage, trench creeping" },
      { name: "Fast Talk / Misdirection", value: 65, notes: "Audience manipulation, psychological redirection" },
      { name: "Hand-to-Hand Combat (Brawl/Cane)", value: 60, notes: "Close-quarters disarming, weighted cane strikes" },
      { name: "Occult Lore (Stage Counterfeiting)", value: 50, notes: "Distinguishing genuine occult symbols from parlor tricks" },
    ],
    abilities: [
      { name: "Smoke & Mirrors", type: "Active", description: "Silas can ignite a custom magnesium-phosphorus flash pellet as a reaction. All hostile entities in close range must make a CON check or be blinded for 1 round, allowing immediate disengage without penalty." },
      { name: "Trench Breacher", type: "Passive", description: "Silas gains bonus dice when picking non-electronic locks, bypassing tripwires, or disarming mechanical dungeon traps." },
      { name: "Mirrored Deflection", type: "Buffered Sanity", description: "Silas can treat impossible manifestations as elaborate optical illusions, transferring up to 10 SAN damage to his buffer." },
    ],
    hooks: [
      { title: "The Syndicate's Leash", description: "The Donato crime syndicate extorts 40% of his income and sends enforcers to track his movements. The Keeper may spawn debt-collector ambushes." },
      { title: "Tomb Ambition", description: "To discover genuine pre-human grimoires or true incantation formulas that grant undeniable occult power, allowing him to destroy his extortionists." },
      { title: "Ancestral Secret", description: "His stage patterns and hypnotic mirrors match the geometric summoning lattices of an ancient cult of Yog-Sothoth." },
    ],
    equipment: [
      "Concealed brass lockpick kit",
      "4 smoke/flash pellets",
      "Weighted defense cane (1d6 damage)",
      "Silk flash-cloth",
      "Marked syndicate debt note",
    ],
  },
  {
    slug: "julian-sterling",
    name: "Julian Sterling",
    age: 31,
    gender: "Male",
    pastDemons: "",
    className: "The Desperate Auteur",
    cover: "Freelance Newsreel Cameraman & Documentarian",
    formerStatus: "Blacklisted Indie Filmmaker",
    vitals: {
      hp: 10, willpower: 13,
      sanity: 50, maxSanity: 80,
      bufferedSanity: 0, bufferedSanityMax: 15,
      ancestralResonance: 25, luck: 55,
    },
    characteristics: { STR: 45, CON: 55, SIZ: 45, DEX: 70, APP: 65, INT: 80, POW: 65, EDU: 75 },
    skills: [
      { name: "Cinematography / Photography", value: 85, notes: "Framing, exposure calibration, chemical developing, high-speed filming" },
      { name: "Spot Hidden", value: 75, notes: "Noticing background anomalies, movement in shadows, lens aberrations" },
      { name: "Art (Directing / Storyboarding)", value: 70, notes: "Visual composition, pacing, narrative framing" },
      { name: "Mechanical Repair (Optics)", value: 65, notes: "Rebuilding camera shutters, lens grinding, fixing jammed gears" },
      { name: "Persuasion", value: 60, notes: "Coaxing reluctant witnesses to speak before the lens" },
      { name: "History (Cultural Mythos)", value: 50, notes: "Recognizing legendary motifs on physical monuments" },
    ],
    abilities: [
      { name: "The Viewfinder Shield", type: "Buffered Sanity", description: "Julian can bank up to 15 SAN loss into his Buffered Sanity pool while viewing entities through his optical viewfinder. The full psychic cost strikes when he develops the nitrate reels in the darkroom." },
      { name: "The Cutting Room Floor", type: "Active", description: "When developing film of an encounter, Julian makes an Art/Photography check to uncover hidden runes, cloaked predators, or inscriptions completely invisible to the naked human eye during combat." },
      { name: "Magnesium Flash Gun", type: "Utility", description: "Can detonate a high-potency magnesium dish, illuminating pitch-dark vaults (100-foot radius) and blinding light-sensitive subterranean horrors for 1 turn." },
    ],
    hooks: [
      { title: "\"Keep the Camera Rolling!\"", description: "Julian must pass a Willpower test to flee active danger. On failure, he remains stationary to film the catastrophe." },
      { title: "Tomb Ambition", description: "To record undisputed, high-definition 35mm footage of an active extraterrestrial biological entity or cyclopean chamber to secure an undisputed Hollywood distribution deal." },
      { title: "Ancestral Secret", description: "His rejected avant-garde scripts contain precise phonetic transcriptions of R'lyehian chants and architectural floorplans." },
    ],
    equipment: [
      "Hand-cranked 35mm Bell & Howell Eyemo camera",
      "Wooden tripod",
      "4 raw nitrate film rolls",
      "Magnesium powder dish",
      "Chemical developing kit",
    ],
  },
  {
    slug: "thomas-callahan",
    name: "Thomas \"Mack\" Callahan",
    age: 38,
    gender: "Male",
    pastDemons: "",
    className: "The Amnesiac Detective",
    cover: "Licensed Private Investigator (Boston/Arkham)",
    formerStatus: "26th Infantry Division, AEF (Service Record Redacted)",
    vitals: {
      hp: 14, willpower: 13,
      sanity: 40, maxSanity: 75,
      bufferedSanity: 0, bufferedSanityMax: 8,
      ancestralResonance: 50, luck: 45,
    },
    characteristics: { STR: 75, CON: 70, SIZ: 70, DEX: 65, APP: 45, INT: 70, POW: 65, EDU: 60 },
    skills: [
      { name: "Firearms (Handgun & Trench Gun)", value: 80, notes: "Rapid fire, defensive shooting in pitch darkness" },
      { name: "Hand-to-Hand Combat (Brawl/Trench Knife)", value: 75, notes: "Lethal martial counters, grappling" },
      { name: "Intimidation", value: 70, notes: "Interrogation, aggressive psychological dominance" },
      { name: "Spot Hidden", value: 70, notes: "Trench scouting, identifying concealed snipers or stalkers" },
      { name: "Streetwise / Underworld Networks", value: 65, notes: "Informant cultivation, locating safehouses" },
      { name: "Track / Shadowing", value: 60, notes: "Urban surveillance, tracking trail markings through rubble" },
    ],
    abilities: [
      { name: "Trench Reflexes", type: "Passive", description: "When ambushed, surprised, or attacked by cloaked entities, Mack can take 1 immediate combat or defensive action before initiative order is determined." },
      { name: "Alien Intuition (Yithian Fragment)", type: "Active", description: "Once per session, Mack can channel an involuntary combat flash, instantly mastering a non-human weapon or deciphering alien controls. Doing so permanently replaces one mundane memory on his sheet." },
      { name: "Hardened Survivor", type: "Passive", description: "Takes 1 less point of physical damage from all non-magical blunt force or ballistic attacks." },
    ],
    hooks: [
      { title: "Combat Dissociation", description: "Sudden concussive explosions or heavy subterranean tremors require an immediate Willpower test. Failure triggers a 2-round dissociative flashback (-20% to all action rolls)." },
      { title: "Tomb Ambition", description: "To recover redacted military-intelligence files or ancient archives within the vault proving his true name, identity, and the fate of his vanished platoon." },
      { title: "Ancestral Secret", description: "Mack's amnesia was caused by a Great Race of Yith mind-swap experiment conducted during the 1918 Meuse-Argonne offensive." },
    ],
    equipment: [
      "Colt M1911 .45 ACP pistol (3 spare magazines)",
      "Trench knife with brass knuckle grip",
      "PI badge",
      "Worn trench coat",
      "Scarred silver lighter with unknown initials",
    ],
  },
  {
    slug: "richard-graves",
    name: "Richard Pickman Graves",
    age: 34,
    gender: "Male",
    pastDemons: "",
    className: "The Macabre Visionary",
    cover: "Commercial Illustrator & Pulp Cover Artist",
    formerStatus: "Expelled Fine Arts Prodigy, Boston Guild",
    vitals: {
      hp: 9, willpower: 16,
      sanity: 35, maxSanity: 72,
      bufferedSanity: 0, bufferedSanityMax: 14,
      ancestralResonance: 60, luck: 50,
    },
    characteristics: { STR: 40, CON: 45, SIZ: 45, DEX: 80, APP: 50, INT: 85, POW: 80, EDU: 70 },
    skills: [
      { name: "Art (Painting & Anatomical Drawing)", value: 90, notes: "Master draftsmanship, hyper-realistic macabre rendering" },
      { name: "Spot Hidden", value: 75, notes: "Recognizing subtle environmental mutations, concealed tunnel grates" },
      { name: "Occult", value: 70, notes: "Subterranean lore, ghoul glyphs, necromantic symbology" },
      { name: "Appraise", value: 65, notes: "Dating pre-human antiquities and eldritch sculptures" },
      { name: "Disguise / Pigment Alteration", value: 60, notes: "Using stage wax and charcoal to mimic corpse paleness" },
      { name: "Stealth", value: 55, notes: "Slipping into forgotten graveyards and cellar passages" },
    ],
    abilities: [
      { name: "Prophetic Canvas", type: "Active", description: "Spending 10 minutes sketching a location or relic reveals one concealed structural secret, ancient trap mechanism, or entity weak point via subconscious ancestral vision." },
      { name: "Ghoul Sight", type: "Passive", description: "Richard can see through non-magical darkness up to 40 feet with distinct clarity, perceiving heat and organic decay signatures." },
      { name: "Clairvoyant Mapping", type: "Resonance Check", description: "When lost subterranean, can make a Resonance check to automatically map the correct route toward deep burial vaults." },
    ],
    hooks: [
      { title: "Morbid Fascination", description: "When directly encountering a grotesque monstrosity, Richard must succeed on a Willpower roll to avert his eyes or take action. Failure forces him to stand and sketch the entity, suffering full sanity loss." },
      { title: "Tomb Ambition", description: "To view living or intact deep-earth entities in their native environment, finishing a master gallery piece that will force humanity to witness the true cosmos." },
      { title: "Ancestral Secret", description: "Richard is a direct descendant of the Boston ghoul-cult bloodline (tied to Richard Upton Pickman); his digestive tract is beginning to crave decayed matter." },
    ],
    equipment: [
      "Heavy charcoal sketchbook",
      "Tin of pig-bristle brushes",
      "Oil paint tubes",
      "Palette knife",
      "Pocket sketchbook of cemetery vault cross-sections",
    ],
  },
  {
    slug: "arthur-wright",
    name: "Arthur Wright",
    age: 45,
    gender: "Male",
    pastDemons: "",
    className: "The Non-Euclidean Architect",
    cover: "Independent Civil Surveyor & Demolition Consultant",
    formerStatus: "Chief Urban Draftsman, Boston Metropolitan Commission",
    vitals: {
      hp: 12, willpower: 14,
      sanity: 48, maxSanity: 80,
      bufferedSanity: 0, bufferedSanityMax: 10,
      ancestralResonance: 45, luck: 50,
    },
    characteristics: { STR: 55, CON: 65, SIZ: 60, DEX: 60, APP: 50, INT: 90, POW: 70, EDU: 85 },
    skills: [
      { name: "Architecture & Engineering", value: 85, notes: "Structural integrity, vault stress calculations, ancient masonry analysis" },
      { name: "Science (Mathematics & Physics)", value: 80, notes: "Non-Euclidean vectors, gravitational stress models, spatial anomalies" },
      { name: "Demolitions & Mining Operations", value: 70, notes: "Placing dynamite charges, controlled collapses, bedrock breaching" },
      { name: "Navigate (Subterranean)", value: 65, notes: "Sub-surface orientation without compass or sunlight" },
      { name: "Spot Hidden", value: 65, notes: "Identifying micro-fractures in stone, hidden counterweights, keystone traps" },
      { name: "History (Pre-Human Monuments)", value: 60, notes: "Identifying architectural epochs of Elder Things and pre-cataclysmic civs" },
    ],
    abilities: [
      { name: "Structural Resonance", type: "Active", description: "Arthur can analyze cyclopean stone masonry for 1 round to detect load-bearing keystones, hidden counterweight doors, or imminent ceiling collapses, granting +30% to party survival actions." },
      { name: "Controlled Breacher", type: "Utility", description: "When using dynamite or heavy drills to open sealed vaults, reduces required explosive amounts by 50% and generates 0 excess Exposure Pool tokens." },
      { name: "Spatial Orientation", type: "Passive", description: "Immune to disorientation and vertigo caused by non-Euclidean angles or shifting gravity wells." },
    ],
    hooks: [
      { title: "Euclidean Sickness", description: "Arthur suffers intense claustrophobia and psychological agitation in ordinary, symmetrical right-angled modern buildings (-10% to all mental checks unless working on cyclopean plans)." },
      { title: "Tomb Ambition", description: "To be the first modern engineer to enter an intact pre-human megalithic vault, confirm non-Euclidean structural mechanics, and publish the definitive mathematical treatise." },
      { title: "Ancestral Secret", description: "His lineage traces back to Sarnath and the builders of the sunken basalt spires of R'lyeh; he dreams in five-dimensional geometry." },
    ],
    equipment: [
      "Solid brass drafting compass",
      "Surveyor's theodolite",
      "2 sticks of industrial mining dynamite",
      "Blasting caps with crimpers",
      "Roll of reinforced blueprint parchment",
    ],
  },
  {
    slug: "percival-winthrop",
    name: "Percival Montgomery Winthrop",
    age: 48,
    gender: "Male",
    pastDemons: "",
    className: "The Ruined Tycoon",
    cover: "Disgraced High-Society Speculator & Antiquities Broker",
    formerStatus: "Majority Shareholder, Winthrop Maritime Shipping Empire",
    vitals: {
      hp: 11, willpower: 15,
      sanity: 52, maxSanity: 85,
      bufferedSanity: 0, bufferedSanityMax: 8,
      ancestralResonance: 30, luck: 70,
    },
    characteristics: { STR: 50, CON: 55, SIZ: 60, DEX: 55, APP: 75, INT: 80, POW: 75, EDU: 85 },
    skills: [
      { name: "Persuasion & High-Stakes Negotiation", value: 85, notes: "Securing contracts, settling disputes, closing backroom deals" },
      { name: "Appraise (Antiquities & Precious Metals)", value: 80, notes: "Instant valuation of gold alloys, pre-Columbian and occult relics" },
      { name: "Credit Rating / High Bureaucracy", value: 75, notes: "Navigating municipal registries, calling in elite Bostonian favors" },
      { name: "Psychology", value: 70, notes: "Reading motives, sensing desperation or deceit in officials and cultists" },
      { name: "Law (Maritime & Property)", value: 65, notes: "Bypassing export restrictions, establishing illegal salvage rights" },
      { name: "Fast Talk", value: 60, notes: "Smooth-talking guards, bluffing municipal inspectors" },
    ],
    abilities: [
      { name: "Silver Tongue", type: "Active", description: "Percival can reroll any failed social check (Persuasion, Fast Talk, Bureaucracy) when interacting with bankers, municipal authorities, or black-market antiquities fences." },
      { name: "Underworld Liquidation", type: "Utility", description: "Can convert recovered occult relics, pre-human jewelry, or tomb gold into cold hard cash or Black Line supplies in 24 hours without alerting federal authorities." },
      { name: "Elite Clearance", type: "Passive", description: "Grants access to private university boardrooms, members-only historical societies, and restricted government manifests." },
    ],
    hooks: [
      { title: "Miser's Desperation", description: "Percival must pass a Willpower test when presented with the opportunity to abandon valuable gold/relics during a crisis. Failure forces him to secure the treasure at great physical risk." },
      { title: "Tomb Ambition", description: "To claim vast quantities of pre-human gold bullion, esoteric metal alloys, or mineral deeds to re-establish his multi-million-dollar New England financial dynasty." },
      { title: "Ancestral Secret", description: "The original Winthrop shipping fortune was seeded by trade agreements with Innsmouth hybrids and gold smelted by the Esoteric Order of Dagon." },
    ],
    equipment: [
      "Frayed Savile Row tailored suit",
      "Gold pocket watch with broken hands",
      "Leather ledger of bankrupt assets",
      "Pearl-handled .32 ACP pocket revolver",
      "Personal signet ring",
    ],
  },
];

export function getCharacter(slug: string): Character | undefined {
  return CHARACTERS.find((c) => c.slug === slug);
}
