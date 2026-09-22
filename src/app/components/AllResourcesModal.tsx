'use client';

import { useEffect, useMemo, useState } from 'react';
import { RESOURCE_SECTIONS, type Resource, type ResourceSection, type ResourceStatus } from '@/lib/resources';

interface Props {
  resources: Resource[];
  /** Open an image in the lightbox. */
  onOpenImage: (src: string) => void;
  /** Open a video in the player modal. */
  onOpenVideo: (src: string) => void;
  /** Open the 3D artifact viewer. */
  onOpenModel: () => void;
  onClose: () => void;
}

const KIND_LABEL: Record<Resource['kind'], string> = {
  image: 'Document',
  video: 'Footage',
  model: '3D',
  item: 'Carried',
};

/**
 * The party's full resource index. Media rows open their viewer; carried
 * equipment is a read-only record of who has what, so the GM can answer
 * "does anyone have a crowbar" without opening seven sheets.
 */
export function AllResourcesModal({
  resources, onOpenImage, onOpenVideo, onOpenModel, onClose,
}: Props) {
  const [query, setQuery] = useState('');
  // Field kit first: what the party is actually carrying is the common case.
  const [view, setView] = useState<ResourceStatus>('active');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const counts = useMemo(() => ({
    active: resources.filter(r => r.status === 'active').length,
    archived: resources.filter(r => r.status === 'archived').length,
  }), [resources]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = resources.filter(r => {
      if (r.status !== view) return false;
      return q === '' ||
        r.name.toLowerCase().includes(q) ||
        (r.carriedBy ?? '').toLowerCase().includes(q) ||
        (r.detail ?? '').toLowerCase().includes(q) ||
        (r.note ?? '').toLowerCase().includes(q);
    });
    return RESOURCE_SECTIONS
      .map((section: ResourceSection) => ({ section, items: matches.filter(r => r.section === section) }))
      .filter(g => g.items.length > 0);
  }, [resources, query, view]);

  const open = (r: Resource) => {
    if (r.kind === 'image' && r.src) onOpenImage(r.src);
    else if (r.kind === 'video' && r.src) onOpenVideo(r.src);
    else if (r.kind === 'model') onOpenModel();
  };

  return (
    <div className="skills-veil" onClick={onClose} role="presentation">
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
              {view === 'active'
                ? `${counts.active} carried in the field`
                : `${counts.archived} held at base — retrievable at any time`}
            </p>
          </div>
          <button type="button" className="sm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="skills-tools">
          <input
            type="text"
            className="sm-search"
            placeholder="Search resources, or an investigator's name…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          <div className="res-views">
            <button
              type="button"
              className={`sm-filter${view === 'active' ? ' active' : ''}`}
              onClick={() => setView('active')}
            >
              Field kit · {counts.active}
            </button>
            <button
              type="button"
              className={`sm-filter${view === 'archived' ? ' active' : ''}`}
              onClick={() => setView('archived')}
            >
              Archive · {counts.archived}
            </button>
          </div>
        </div>

        <div className="skills-body">
          {groups.length === 0 && (
            <p className="sm-empty">
              {query
                ? `No ${view === 'active' ? 'field kit' : 'archived'} resource matches “${query}”.`
                : 'Nothing here.'}
            </p>
          )}
          {groups.map(({ section, items }) => (
            <section key={section} className="sm-group">
              <h3 className="sm-group-title">{section}</h3>
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
                      <span className={`res-kind k-${r.kind}`}>{KIND_LABEL[r.kind]}</span>
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
