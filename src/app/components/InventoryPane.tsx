'use client';

import { getItemIcon } from '@/lib/item-icons';

interface Props {
  /** Whose pockets these are; absent when the account has no investigator. */
  owner?: string;
  /** The investigator's sheet equipment, in sheet order. */
  items: string[];
  /** The item in hand, if any. */
  held: string | null;
  /** Takes an item in hand, or puts it away when it is already held. */
  onHold: (item: string) => void;
  onClose: () => void;
}

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', letterSpacing: '1px', textTransform: 'uppercase' };

/**
 * What the investigator carries, from their character sheet, laid over the
 * right of the walkthrough. One item can be in hand; with it held, U (or the
 * reading card) uses it on whatever is being looked at. I or Esc closes the
 * pane, and 1–9 take an item in hand (both handled by the modal).
 */
export function InventoryPane({ owner, items, held, onHold, onClose }: Props) {
  return (
    <div style={{
      position: 'absolute', top: 12, right: 12, bottom: 12, width: 'min(320px, 44%)',
      display: 'flex', flexDirection: 'column',
      background: 'rgba(14,11,8,0.96)', border: '1px solid var(--brass-dim)',
      borderRadius: 'var(--r-md)', boxShadow: '0 12px 40px rgba(0,0,0,0.8)', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, padding: '10px 14px', borderBottom: '1px solid rgba(201,148,79,0.18)' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--parchment)' }}>Inventory</span>
        {owner && <span style={{ ...mono, fontSize: 9, color: 'var(--ink-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{owner}</span>}
        <span style={{ flex: 1 }} />
        <button
          onClick={onClose}
          style={{
            ...mono, fontSize: 9, padding: '5px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
            background: 'transparent', border: '1px solid var(--line)', color: 'var(--ink-text-2)',
          }}
        >
          Close [I]
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 8 }}>
        {!owner ? (
          <p style={{ fontSize: 12, color: 'var(--ink-text-2)', margin: 8, lineHeight: 1.6 }}>
            No investigator is assigned to this account, so there is nothing to carry.
          </p>
        ) : items.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--ink-text-2)', margin: 8, lineHeight: 1.6 }}>
            Carrying nothing. Equipment added on the character sheet shows up here.
          </p>
        ) : items.map((item, i) => {
          const inHand = item === held;
          return (
            <button
              key={`${i}-${item}`}
              onClick={() => onHold(item)}
              aria-pressed={inHand}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                padding: '8px 10px', marginBottom: 4, borderRadius: 'var(--r-sm)', cursor: 'pointer',
                background: inHand ? 'rgba(201,148,79,0.16)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${inHand ? 'var(--brass)' : 'rgba(201,148,79,0.14)'}`,
                color: 'var(--parchment)',
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1, width: 24, textAlign: 'center' }}>{getItemIcon(item)}</span>
              <span style={{ flex: 1, fontSize: 12, lineHeight: 1.4 }}>{item}</span>
              <span style={{ ...mono, fontSize: 9, color: inHand ? 'var(--brass)' : 'var(--ink-text-2)', whiteSpace: 'nowrap' }}>
                {inHand ? 'In hand' : i < 9 ? `[${i + 1}]` : ''}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ padding: '8px 14px', borderTop: '1px solid rgba(201,148,79,0.12)', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--ink-text-2)', letterSpacing: '0.4px', lineHeight: 1.6 }}>
        {held
          ? <>Holding <span style={{ color: 'var(--brass)' }}>{held}</span>. Look at something and press U to use it. Click it again to put it away.</>
          : 'Click an item, or press its number, to take it in hand.'}
      </div>
    </div>
  );
}
