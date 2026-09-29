'use client';

import { useEffect, useMemo, useState } from 'react';
import { RESOURCE_GROUPS, RESOURCE_SECTIONS, type Resource, type ResourceSection } from '@/lib/resources';

interface Props {
  resources: Resource[];
  /** A viewer opened from this index is showing; stay mounted but out of sight. */
  hidden?: boolean;
  /**
   * Open an image in the lightbox. `gallery` is every image on the current
   * page, in display order, so the lightbox can step through them.
   */
  onOpenImage: (src: string, gallery: string[]) => void;
  /** Open a video in the player modal. */
  onOpenVideo: (src: string) => void;
  /** Play a recording alongside its transcript. */
  onOpenAudio: (src: string) => void;
  /** Open the 3D artifact viewer. */
  onOpenModel: () => void;
  onClose: () => void;
}

const ARCHIVE = 'Archive';
type View = ResourceSection | typeof ARCHIVE;

const KIND_LABEL: Record<Resource['kind'], string> = {
  image: 'Document',
  video: 'Footage',
  audio: 'Recording',
  model: '3D',
  item: 'Carried',
};

/**
 * The party's full resource index. Media rows open their viewer; carried
 * equipment is a read-only record of who has what, so the GM can answer
 * "does anyone have a crowbar" without opening seven sheets.
 */
export function AllResourcesModal({
  resources, hidden = false, onOpenImage, onOpenVideo, onOpenAudio, onOpenModel, onClose,
}: Props) {
  const [query, setQuery] = useState('');
  // One page per category for what the party carries, plus the Archive —
  // everything held at base, still grouped by category.
  const [view, setView] = useState<View>('Documents');

  useEffect(() => {
    // While hidden, Escape belongs to the viewer on top — closing that must
    // bring this index back, not dismiss it too.
    if (hidden) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, hidden]);

  // Search runs across every page, so the tab counts show where the hits are.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return resources;
    return resources.filter(r =>
      r.name.toLowerCase().includes(q) ||
      (r.carriedBy ?? '').toLowerCase().includes(q) ||
      (r.detail ?? '').toLowerCase().includes(q) ||
      (r.note ?? '').toLowerCase().includes(q));
  }, [resources, query]);

  const counts = useMemo(() => {
    const c = { [ARCHIVE]: 0 } as Record<View, number>;
    for (const s of RESOURCE_SECTIONS) c[s] = 0;
    for (const r of matches) {
      if (r.status === 'archived') c[ARCHIVE]++;
      else c[r.section]++;
    }
    return c;
  }, [matches]);

  // A category page is split into its sub-sections (titled only when the tab
  // has any); the Archive keeps its by-category grouping.
  const groups = useMemo((): { key: string; title?: string; items: Resource[] }[] => {
    if (view !== ARCHIVE) {
      const items = matches.filter(r => r.status === 'active' && r.section === view);
      const order = RESOURCE_GROUPS[view];
      if (order.length === 0) return items.length > 0 ? [{ key: view, items }] : [];
      const known = new Set(order);
      return [
        ...order.map(g => ({ key: g, title: g, items: items.filter(r => r.group === g) })),
        { key: 'other', title: 'Other', items: items.filter(r => !r.group || !known.has(r.group)) },
      ].filter(g => g.items.length > 0);
    }
    const archived = matches.filter(r => r.status === 'archived');
    return RESOURCE_SECTIONS
      .map((section: ResourceSection) => ({ key: section, title: section, items: archived.filter(r => r.section === section) }))
      .filter(g => g.items.length > 0);
  }, [matches, view]);

  // Every image on the current page in display order, with paged entries
  // expanded, so ←/→ reads straight through a report and on to the next item.
  const gallery = useMemo(
    () => groups.flatMap(g => g.items)
      .filter(r => r.kind === 'image' && r.src)
      .flatMap(r => r.pages ?? [r.src!]),
    [groups],
  );

  const open = (r: Resource) => {
    if (r.kind === 'image' && r.src) onOpenImage(r.pages?.[0] ?? r.src, gallery);
    else if (r.kind === 'video' && r.src) onOpenVideo(r.src);
    else if (r.kind === 'audio' && r.src) onOpenAudio(r.src);
    else if (r.kind === 'model') onOpenModel();
  };

  return (
    <div
      className="skills-veil"
      // .skills-veil sets display, which would override the `hidden` attribute.
      style={hidden ? { display: 'none' } : undefined}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="skills-modal res-modal"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="All resources"
      >
        <div className="skills-head">
          <div className="sm-titles">
            <h2>All Resources</h2>
            <p>
              {view === ARCHIVE
                ? `${counts[ARCHIVE]} held at base — retrievable at any time`
                : `${counts[view]} carried in the field`}
            </p>
          </div>
          <button type="button" className="sm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <nav className="res-nav" aria-label="Resource categories">
          {RESOURCE_SECTIONS.map(section => (
            <button
              key={section}
              type="button"
              className={`res-tab${view === section ? ' active' : ''}`}
              aria-current={view === section ? 'page' : undefined}
              onClick={() => setView(section)}
            >
              {section} <span className="res-tab-count">{counts[section]}</span>
            </button>
          ))}
          <button
            type="button"
            className={`res-tab res-tab-archive${view === ARCHIVE ? ' active' : ''}`}
            aria-current={view === ARCHIVE ? 'page' : undefined}
            onClick={() => setView(ARCHIVE)}
          >
            Archive <span className="res-tab-count">{counts[ARCHIVE]}</span>
          </button>
        </nav>

        <div className="skills-tools">
          <input
            type="text"
            className="sm-search"
            placeholder="Search resources, or an investigator's name…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        <div className="skills-body">
          {groups.length === 0 && (
            <p className="sm-empty">
              {query
                ? `No ${view === ARCHIVE ? 'archived' : view.toLowerCase()} resource matches “${query}”.`
                : 'Nothing here.'}
            </p>
          )}
          {groups.map(({ key, title, items }) => (
            <section key={key} className="sm-group">
              {title && <h3 className="sm-group-title">{title}</h3>}
              <div className="sm-grid res-grid">
                {items.map(r => {
                  const viewable = r.kind !== 'item';
                  const Row = viewable ? 'button' : 'div';
                  return (
                    <Row
                      key={r.id}
                      {...(viewable
                        ? { type: 'button' as const, onClick: () => open(r) }
                        : {})}
                      // Long names ellipsis in a narrow column, so the full
                      // text stays reachable on hover.
                      title={[viewable ? `Open ${r.name}` : r.name, r.carriedBy, r.detail, r.note]
                        .filter(Boolean)
                        .join(' · ')}
                      className={`res-row${viewable ? ' viewable' : ''}${r.status === 'archived' ? ' archived' : ''}`}
                    >
                      <span className="res-main">
                        <span className="res-name">{r.name}</span>
                        {(r.carriedBy || r.detail) && (
                          <span className="res-sub">{r.carriedBy ?? r.detail}</span>
                        )}
                        {r.note && <span className="res-note">{r.note}</span>}
                      </span>
                      <span className={`res-kind k-${r.kind}`}>
                        {KIND_LABEL[r.kind]}{r.pages && ` · ${r.pages.length}`}
                      </span>
                    </Row>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
