/**
 * Cliff notes of the sessions played so far, as the investigators know them.
 * Condensed from the GM's Drive docs (EOD › Session Recaps: "Comprehensive
 * Campaign Recap: Act I" and "Session Logs (Continued)"). They are pinned as
 * typed index cards on the Black Archive's case board, beside the party's own
 * notes, and listed first when the board is opened.
 *
 * Player knowledge only — nothing here comes from the GM's secrets. Add a
 * session's cards to the end; `links` draws red string between cards.
 */

export type RecapCard = {
  id: string;
  session: number;
  title: string;
  text: string;
  /** Paper colour; plain index-card stock if unset. */
  color?: string;
  /** Other cards this one is strung to. */
  links?: string[];
};

export const RECAP_ACT = 'Act I';

export const SESSION_RECAPS: RecapCard[] = [
  // ── Session 1 — The Briefing & Bellevue ─────────────────────────────
  {
    id: 'recap-retainer', session: 1, title: 'The Retainer',
    text: 'Arthur Butler retained Callahan, Wright and Finch here at the Black Archive: find the sealed chamber within one year. No bail. Severance the moment the law takes notice. The relics are ours; the chamber’s prize belongs to the patron.',
  },
  {
    id: 'recap-day1', session: 1, title: 'Day One Leads',
    text: 'The 17-Year Expedition Dossier. A bat-winged Chaugnar Faugn idol. Orderly Robbie’s "Day 66" journal: screams of Dagon, Deep Ones and Innsmouth from the cell next door at Bellevue.',
    links: ['recap-cell66', 'recap-zadok'],
  },
  {
    id: 'recap-cell66', session: 1, title: 'Bellevue — Cell 66',
    text: 'Callahan leaned on the chief attendant and got us into the lower block alone. The deformed inmate was gone, taken in an unauthorized night extraction. Behind a loose flagstone: a parchment charting moon phases.',
  },
  {
    id: 'recap-zadok', session: 1, title: 'Zadok Allen',
    text: 'At the word "Innsmouth" he panicked. The thing in Cell 66 was pulled from an Innsmouth cellar. Robbie learned aquatic hymns through the wall and stole an iron lockbox. "Obed Marsh’s bloodline holds the key to the deep bedrock."',
    links: ['recap-banks'],
  },
  {
    id: 'recap-receipt', session: 1, title: 'Freight Receipt',
    text: 'Torn rail freight receipt, squeezed out of the laundry orderly: shipped from Manhattan to the Boston Federal Quarantine Docks.',
    links: ['recap-cell66'],
  },
  // ── Session 2 — The Speakeasy & the Sealed Envelope ─────────────────
  {
    id: 'recap-banks', session: 2, title: 'Tyler Banks',
    text: 'Fixer at the Abattoir & Speakeasy; had a cut with the last team. Goes pale at "Dagon". Obed Marsh founded the Esoteric Order of Dagon and ran Innsmouth into the ground. Says a Marsh descendant is living hidden in the city.',
  },
  {
    id: 'recap-price', session: 2, title: 'Banks’s Price',
    text: 'He will find the Marsh descendant — in exchange for access to our military hardware.',
    links: ['recap-banks', 'recap-miles'],
  },
  {
    id: 'recap-miles', session: 2, title: 'Sgt. Miles',
    text: 'Logistics officer at the Archive. No weapons for Banks yet: she will meet him in two weeks to set terms. Every crate here is government property — nothing leaves without her approval.',
  },
  {
    id: 'recap-envelope', session: 2, title: 'The Sealed Envelope',
    text: 'Miles: give it to Banks, do not open it. Finch lifted the wax seal clean. The page was blank until heated over a lighter: "The next meeting for the Esoteric Order of Dagon will occur in 2 weeks." Resealed without a trace.',
    color: '#f3e3c0',
    links: ['recap-miles', 'recap-banks'],
  },
  {
    id: 'recap-delivered', session: 2, title: 'Delivered',
    text: 'Banks slit the seal, read the sheet under his desk lamp and pocketed it. Promised intel on the Marsh family the next day. We slept at the Archive.',
    links: ['recap-envelope'],
  },
  {
    id: 'recap-threads', session: 2, title: 'Loose Threads',
    text: 'Where are Robbie and the iron lockbox? What went to the Quarantine Docks? Where does the Order meet — and why is Miles passing its date to Banks? Who is the Marsh descendant?',
    color: '#fce7e7',
  },
  {
    id: 'recap-cliffhanger', session: 2, title: 'Where We Left Off',
    text: 'The next night, Banks sits down at our table, leans in: "I want to tell you this just once. So pay attention."',
    color: '#fef3c7',
    links: ['recap-delivered'],
  },
];
