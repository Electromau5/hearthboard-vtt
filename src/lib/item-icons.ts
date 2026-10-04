/** An emoji for a carried item, guessed from its name — the sheet's inventory grid and the walkthrough's inventory. */
export function getItemIcon(item: string): string {
  const l = item.toLowerCase();
  if (l.includes('kit') || l.includes('dissect') || l.includes('tool')) return '🧰';
  if (l.includes('apron') || l.includes('coat') || l.includes('cloth') || l.includes('silk')) return '🥼';
  if (l.includes('jar') || l.includes('chemical') || l.includes('formald') || l.includes('vial')) return '⚗️';
  if (l.includes('scalpel') || l.includes('blade') || l.includes('knife')) return '🔪';
  if (l.includes('cane') || l.includes('staff')) return '🪄';
  if (l.includes('gun') || l.includes('revolver') || l.includes('pistol') || l.includes('firearm') || l.includes('trench gun')) return '🔫';
  if (l.includes('smoke') || l.includes('pellet') || l.includes('flash') || l.includes('magnesium')) return '💨';
  if (l.includes('lock') || l.includes('pick') || l.includes('key')) return '🗝️';
  if (l.includes('credential') || l.includes('pass') || l.includes('badge') || l.includes('certif')) return '🪪';
  if (l.includes('note') || l.includes('debt') || l.includes('letter') || l.includes('document')) return '📜';
  if (l.includes('camera') || l.includes('film') || l.includes('eyemo') || l.includes('nitrate')) return '🎞️';
  if (l.includes('tripod')) return '📷';
  if (l.includes('powder') || l.includes('dish')) return '💡';
  if (l.includes('develop')) return '🧪';
  if (l.includes('rope') || l.includes('silk')) return '🪢';
  if (l.includes('bottle') || l.includes('flask')) return '🍶';
  if (l.includes('torch') || l.includes('lantern') || l.includes('light')) return '🕯️';
  if (l.includes('book') || l.includes('journal') || l.includes('diary') || l.includes('grimoire')) return '📔';
  if (l.includes('money') || l.includes('cash') || l.includes('coin')) return '💰';
  if (l.includes('holster') || l.includes('pouch')) return '👝';
  return '📦';
}
