import type { ReactNode } from 'react';
import { useId, useRef } from 'react';
import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Building2, Layers, MapPin, Package, ShoppingCart, Store, X } from 'lucide-react';
import { tablesAPI } from '../services/api';
import useModalFocusTrap from '../hooks/useModalFocusTrap';

type SearchResults = {
  items: Array<{ ItemID: number; ItemName: string; ItemVersion?: string; PublisherName: string; CollectionName: string; CategoryName: string; SubTypeName: string }>;
  miniatures: Array<{ MiniatureID: number; MiniatureName: string; MiniatureQuantity: number }>;
  orders: Array<{ PurchaseOrderID: number; InvoiceNumber: string; PurchasedDate: string; StoreName: string; StatusName?: string }>;
  publishers: Array<{ PublisherID: number; PublisherName: string }>;
  collections: Array<{ CollectionID: number; CollectionName: string; CollectionTypeName?: string }>;
  stores: Array<{ StoreID: number; StoreName: string }>;
  locations: Array<{ LocationID: number; LocationName: string; LocationTypeName?: string }>;
};

type Props = {
  open: boolean;
  query: string;
  onClose: () => void;
};

export default function GlobalSearchModal({ open, query, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useModalFocusTrap<HTMLDivElement>(open, onClose);

  const { data, isLoading, isError } = useQuery<SearchResults>({
    queryKey: ['global-search', query],
    queryFn: async () => {
      const response = await tablesAPI.globalSearch(query);
      return response.data;
    },
    enabled: open && query.trim().length >= 2,
    staleTime: 30_000,
    retry: false,
  });

  if (!open) return null;

  const totalCount = data
    ? data.items.length + data.miniatures.length + data.orders.length +
      data.publishers.length + data.collections.length + data.stores.length + data.locations.length
    : 0;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-20"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div className="w-full max-w-2xl max-h-[75vh] overflow-y-auto rounded-xl bg-[var(--arcane-paper-raised)] shadow-2xl">
        <h2 id={titleId} className="sr-only">Global Search</h2>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] px-4 py-3">
          <p className="text-sm font-medium text-[var(--arcane-ink-900)]">
            {isLoading
              ? 'Searching…'
              : data
              ? `${totalCount} result${totalCount === 1 ? '' : 's'} for "${query}"`
              : `Results for "${query}"`}
          </p>
          <button type="button" onClick={onClose} aria-label="Close search" className="rounded-md p-1 text-[var(--arcane-ink-soft)] hover:bg-[#e2d5bd99] hover:text-[var(--arcane-ink-900)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading && (
          <div className="px-4 py-10 text-center text-sm text-[var(--arcane-ink-soft)]">Searching…</div>
        )}

        {!isLoading && isError && (
          <div className="px-4 py-4 text-sm text-red-600">Search failed. Please try again.</div>
        )}

        {!isLoading && !isError && data && totalCount === 0 && (
          <div className="px-4 py-10 text-center text-sm text-[var(--arcane-ink-soft)]">No results found for "{query}".</div>
        )}

        {!isLoading && !isError && data && totalCount > 0 && (
          <div className="divide-y divide-[var(--arcane-border-light)]">
            {data.items.length > 0 && (
              <Section title="Inventory Items" icon={<Package className="h-4 w-4" />}>
                {data.items.map((item) => (
                  <ResultLink
                    key={item.ItemID}
                    to={`/home/inventory?item=${encodeURIComponent(item.ItemName)}`}
                    onClose={onClose}
                  >
                    <span className="font-medium text-[var(--arcane-ink-900)]">
                      {item.ItemName}
                      {item.ItemVersion ? <span className="ml-1 text-[var(--arcane-ink-soft)]">({item.ItemVersion})</span> : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--arcane-ink-soft)]">
                      {item.PublisherName} · {item.CollectionName} · {item.CategoryName} / {item.SubTypeName}
                    </span>
                  </ResultLink>
                ))}
              </Section>
            )}

            {data.miniatures.length > 0 && (
              <Section title="Miniatures" icon={<Layers className="h-4 w-4" />}>
                {data.miniatures.map((m) => (
                  <ResultLink
                    key={m.MiniatureID}
                    to={`/home/miniatures?miniatureName=${encodeURIComponent(m.MiniatureName)}`}
                    onClose={onClose}
                  >
                    <span className="font-medium text-[var(--arcane-ink-900)]">{m.MiniatureName}</span>
                    <span className="mt-0.5 block text-xs text-[var(--arcane-ink-soft)]">Qty: {m.MiniatureQuantity}</span>
                  </ResultLink>
                ))}
              </Section>
            )}

            {data.orders.length > 0 && (
              <Section title="Purchase Orders" icon={<ShoppingCart className="h-4 w-4" />}>
                {data.orders.map((order) => (
                  <ResultLink
                    key={order.PurchaseOrderID}
                    to={`/home/orders?purchaseOrderId=${order.PurchaseOrderID}`}
                    onClose={onClose}
                  >
                    <span className="font-medium text-[var(--arcane-ink-900)]">{order.InvoiceNumber}</span>
                    <span className="mt-0.5 block text-xs text-[var(--arcane-ink-soft)]">
                      {order.StoreName}
                      {order.PurchasedDate ? ` · ${String(order.PurchasedDate).slice(0, 10)}` : ''}
                      {order.StatusName ? ` · ${order.StatusName}` : ''}
                    </span>
                  </ResultLink>
                ))}
              </Section>
            )}

            {data.publishers.length > 0 && (
              <Section title="Publishers" icon={<Building2 className="h-4 w-4" />}>
                {data.publishers.map((p) => (
                  <ResultLink
                    key={p.PublisherID}
                    to={`/home/inventory?publisher=${encodeURIComponent(p.PublisherName)}`}
                    onClose={onClose}
                  >
                    <span className="font-medium text-[var(--arcane-ink-900)]">{p.PublisherName}</span>
                  </ResultLink>
                ))}
              </Section>
            )}

            {data.collections.length > 0 && (
              <Section title="Collections" icon={<BookOpen className="h-4 w-4" />}>
                {data.collections.map((c) => (
                  <ResultLink
                    key={c.CollectionID}
                    to={`/home/inventory?collection=${encodeURIComponent(c.CollectionName)}`}
                    onClose={onClose}
                  >
                    <span className="font-medium text-[var(--arcane-ink-900)]">{c.CollectionName}</span>
                    {c.CollectionTypeName && (
                      <span className="mt-0.5 block text-xs text-[var(--arcane-ink-soft)]">{c.CollectionTypeName}</span>
                    )}
                  </ResultLink>
                ))}
              </Section>
            )}

            {data.stores.length > 0 && (
              <Section title="Stores" icon={<Store className="h-4 w-4" />}>
                {data.stores.map((s) => (
                  <ResultLink
                    key={s.StoreID}
                    to={`/home/orders?store=${encodeURIComponent(s.StoreName)}`}
                    onClose={onClose}
                  >
                    <span className="font-medium text-[var(--arcane-ink-900)]">{s.StoreName}</span>
                  </ResultLink>
                ))}
              </Section>
            )}

            {data.locations.length > 0 && (
              <Section title="Locations" icon={<MapPin className="h-4 w-4" />}>
                {data.locations.map((l) => (
                  <ResultLink
                    key={l.LocationID}
                    to="/home/setup/locations"
                    onClose={onClose}
                  >
                    <span className="font-medium text-[var(--arcane-ink-900)]">{l.LocationName}</span>
                    {l.LocationTypeName && (
                      <span className="mt-0.5 block text-xs text-[var(--arcane-ink-soft)]">{l.LocationTypeName}</span>
                    )}
                  </ResultLink>
                ))}
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 bg-[var(--arcane-paper)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--arcane-ink-soft)]">
        {icon}
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ResultLink({ to, onClose, children }: { to: string; onClose: () => void; children: ReactNode }) {
  return (
    <Link
      to={to}
      onClick={onClose}
      className="block px-4 py-2.5 text-sm transition hover:bg-[#b886481a]"
    >
      {children}
    </Link>
  );
}
