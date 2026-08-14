import { useQuery } from '@tanstack/react-query';
import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import AdminLayout from '../components/AdminLayout';
import { Skeleton } from '../components/ui/Skeleton';
import { tablesAPI } from '../services/api';

type DashboardData = {
  totals: {
    publishers: number;
    collections: number;
    categories: number;
    stores: number;
    items: number;
    miniatures: number;
    terrain: number;
    orders: number;
  };
  publisherDashboard: Array<{
    PublisherID: number;
    PublisherName: string;
    TotalItems: number;
    ItemsInPurchaseOrder: number;
    CoveragePercent: number;
    ImageFileName?: string;
  }>;
  collectionDashboard: Array<{
    CollectionID: number;
    CollectionName: string;
    TotalItems: number;
    ItemsInPurchaseOrder: number;
    CoveragePercent: number;
  }>;
  topPublishers: Array<{ PublisherName: string; ItemCount: number }>;
  topCollections: Array<{ CollectionName: string; ItemCount: number }>;
  topCategories: Array<{ CategoryName: string; ItemCount: number }>;
  topItemsByPrice: Array<{ ItemID: number; ItemName: string; ProductID?: string; MaxPrice: number }>;
  topMiniatureItemsByQuantity: Array<{ ItemID: number; ItemName: string; ProductID?: string; TotalQuantity: number }>;
  topTerrainItemsByQuantity: Array<{ ItemID: number; ItemName: string; ProductID?: string; TotalQuantity: number }>;
  topStoresByOrderCount: Array<{ StoreName: string; OrderCount: number }>;
  topOrdersByAmount: Array<{
    PurchaseOrderID: number;
    InvoiceNumber: string;
    StoreName: string;
    PurchaseDate: string;
    TotalAmount: number;
  }>;
};

type CategoryTerrainMetrics = {
  categoriesTotal: number;
  terrainTotal: number;
  storesTotal: number;
  topCategories: Array<{ CategoryName: string; ItemCount: number }>;
  topTerrainItemsByQuantity: Array<{ ItemID: number; ItemName: string; ProductID?: string; TotalQuantity: number }>;
  topStoresByOrderCount: Array<{ StoreName: string; OrderCount: number }>;
};

async function getAllInventoryRows(): Promise<any[]> {
  const pageSize = 100;
  const firstResponse = await tablesAPI.getInventoryItems({ page: 1, pageSize });
  const firstData = firstResponse.data;
  const rows = [...(firstData?.data || [])];
  const totalPages = Number(firstData?.totalPages || 1);

  for (let page = 2; page <= totalPages; page++) {
    const response = await tablesAPI.getInventoryItems({ page, pageSize });
    rows.push(...(response.data?.data || []));
  }

  return rows;
}

async function getAllTableRows(tableName: string): Promise<any[]> {
  const pageSize = 100;
  const firstResponse = await tablesAPI.getTableData(tableName, 1, pageSize);
  const firstData = firstResponse.data;
  const rows = [...(firstData?.data || [])];
  const totalPages = Number(firstData?.totalPages || 1);

  for (let page = 2; page <= totalPages; page++) {
    const response = await tablesAPI.getTableData(tableName, page, pageSize);
    rows.push(...(response.data?.data || []));
  }

  return rows;
}

async function getDashboardFallback(): Promise<DashboardData> {
  const [publishersResp, collectionsResp, categoriesResp, storesResp, itemsResp, miniatureRows, terrainRows, allPublishersRows, allCollectionsRows] = await Promise.all([
    tablesAPI.getTableData('Publisher', 1, 1),
    tablesAPI.getTableData('Collection', 1, 1),
    tablesAPI.getTableData('Category', 1, 1),
    tablesAPI.getTableData('Store', 1, 1),
    tablesAPI.getInventoryItems({ page: 1, pageSize: 1 }),
    getAllTableRows('Miniature'),
    getAllTableRows('Terrain'),
    getAllTableRows('Publisher'),
    getAllTableRows('Collection'),
  ]);

  let ordersTotal = 0;
  try {
    const ordersResp = await tablesAPI.getPurchaseOrders({ page: 1, pageSize: 1 });
    ordersTotal = Number(ordersResp.data?.total || 0);
  } catch {
    const ordersResp = await tablesAPI.getTableData('PurchaseOrder', 1, 1);
    ordersTotal = Number(ordersResp.data?.total || 0);
  }

  const inventoryRows = await getAllInventoryRows();

  const publisherCounts = new Map<string, number>();
  const collectionCounts = new Map<string, number>();

  inventoryRows.forEach((row) => {
    const publisherName = String(row.PublisherName || '').trim();
    const collectionName = String(row.CollectionName || '').trim();

    if (publisherName) {
      publisherCounts.set(publisherName, (publisherCounts.get(publisherName) || 0) + 1);
    }
    if (collectionName) {
      collectionCounts.set(collectionName, (collectionCounts.get(collectionName) || 0) + 1);
    }
  });

  const topPublishers = Array.from(publisherCounts.entries())
    .map(([PublisherName, ItemCount]) => ({ PublisherName, ItemCount }))
    .sort((a, b) => b.ItemCount - a.ItemCount || a.PublisherName.localeCompare(b.PublisherName))
    .slice(0, 10);

  const topCollections = Array.from(collectionCounts.entries())
    .map(([CollectionName, ItemCount]) => ({ CollectionName, ItemCount }))
    .sort((a, b) => b.ItemCount - a.ItemCount || a.CollectionName.localeCompare(b.CollectionName))
    .slice(0, 10);

  const categoryCounts = new Map<string, number>();
  inventoryRows.forEach((row) => {
    const categoryName = String(row.CategoryName || '').trim();
    if (categoryName) {
      categoryCounts.set(categoryName, (categoryCounts.get(categoryName) || 0) + 1);
    }
  });

  const topCategories = Array.from(categoryCounts.entries())
    .map(([CategoryName, ItemCount]) => ({ CategoryName, ItemCount }))
    .sort((a, b) => b.ItemCount - a.ItemCount || a.CategoryName.localeCompare(b.CategoryName))
    .slice(0, 10);

  const publisherCoverageMap = new Map<string, { itemIds: Set<number>; coveredItemIds: Set<number> }>();
  const collectionCoverageMap = new Map<string, { itemIds: Set<number>; coveredItemIds: Set<number> }>();

  inventoryRows.forEach((row) => {
    const publisherName = String(row.PublisherName || '').trim();
    const itemId = Number(row.ItemID);
    const hasPurchaseOrder = row.HasPurchaseOrder === true || row.HasPurchaseOrder === 1;

    if (!publisherName || !Number.isFinite(itemId)) {
      return;
    }

    const current = publisherCoverageMap.get(publisherName) || {
      itemIds: new Set<number>(),
      coveredItemIds: new Set<number>(),
    };

    current.itemIds.add(itemId);
    if (hasPurchaseOrder) {
      current.coveredItemIds.add(itemId);
    }

    publisherCoverageMap.set(publisherName, current);

    const collectionName = String(row.CollectionName || '').trim();
    if (collectionName) {
      const collectionCurrent = collectionCoverageMap.get(collectionName) || {
        itemIds: new Set<number>(),
        coveredItemIds: new Set<number>(),
      };

      collectionCurrent.itemIds.add(itemId);
      if (hasPurchaseOrder) {
        collectionCurrent.coveredItemIds.add(itemId);
      }

      collectionCoverageMap.set(collectionName, collectionCurrent);
    }
  });

  const publisherDashboard = allPublishersRows
    .map((publisherRow) => {
      const publisherName = String(publisherRow.PublisherName || '').trim();
      const coverage = publisherCoverageMap.get(publisherName);
      const totalItems = coverage?.itemIds.size || 0;
      const itemsInPurchaseOrder = coverage?.coveredItemIds.size || 0;
      const coveragePercent = totalItems === 0 ? 0 : (itemsInPurchaseOrder / totalItems) * 100;

      return {
        PublisherID: Number(publisherRow.PublisherID || 0),
        PublisherName: publisherName,
        TotalItems: totalItems,
        ItemsInPurchaseOrder: itemsInPurchaseOrder,
        CoveragePercent: Number(coveragePercent.toFixed(2)),
        ImageFileName: String(publisherRow.ImageFileName || '').trim() || undefined,
      };
    })
    .sort((a, b) => a.PublisherName.localeCompare(b.PublisherName));

  const collectionDashboard = allCollectionsRows
    .map((collectionRow) => {
      const collectionName = String(collectionRow.CollectionName || '').trim();
      const coverage = collectionCoverageMap.get(collectionName);
      const totalItems = coverage?.itemIds.size || 0;
      const itemsInPurchaseOrder = coverage?.coveredItemIds.size || 0;
      const coveragePercent = totalItems === 0 ? 0 : (itemsInPurchaseOrder / totalItems) * 100;

      return {
        CollectionID: Number(collectionRow.CollectionID || 0),
        CollectionName: collectionName,
        TotalItems: totalItems,
        ItemsInPurchaseOrder: itemsInPurchaseOrder,
        CoveragePercent: Number(coveragePercent.toFixed(2)),
      };
    })
    .sort((a, b) => a.CollectionName.localeCompare(b.CollectionName));

  const [purchaseOrderDetailsRows, itemLookupResp, allPurchaseOrders, allStores] = await Promise.all([
    getAllTableRows('PurchaseOrderDetail'),
    tablesAPI.getItemsForLookup(),
    getAllTableRows('PurchaseOrder'),
    getAllTableRows('Store'),
  ]);

  const itemLookupMap = new Map<number, { ItemName: string; ProductID?: string }>();
  (itemLookupResp.data?.data || []).forEach((item: any) => {
    itemLookupMap.set(Number(item.ItemID), {
      ItemName: item.ItemName,
      ProductID: item.ProductID,
    });
  });

  const itemMaxPrice = new Map<number, number>();
  purchaseOrderDetailsRows.forEach((row) => {
    const itemId = Number(row.ItemID);
    const price = Number(row.Price);
    if (!Number.isFinite(itemId) || !Number.isFinite(price)) {
      return;
    }

    const current = itemMaxPrice.get(itemId);
    if (current === undefined || price > current) {
      itemMaxPrice.set(itemId, price);
    }
  });

  const topItemsByPrice = Array.from(itemMaxPrice.entries())
    .map(([ItemID, MaxPrice]) => {
      const item = itemLookupMap.get(ItemID);
      return {
        ItemID,
        ItemName: item?.ItemName || `Item #${ItemID}`,
        ProductID: item?.ProductID,
        MaxPrice,
      };
    })
    .sort((a, b) => b.MaxPrice - a.MaxPrice || a.ItemName.localeCompare(b.ItemName))
    .slice(0, 10);

  const miniatureQuantityByItemId = new Map<number, number>();
  let miniaturesTotal = 0;

  miniatureRows.forEach((row) => {
    const itemId = Number(row.ItemID ?? row.MiniatureID);
    const quantity = Number(row.MiniatureQuantity || 0);
    if (!Number.isFinite(quantity)) {
      return;
    }

    miniaturesTotal += quantity;

    if (!Number.isFinite(itemId) || itemId <= 0) {
      return;
    }

    miniatureQuantityByItemId.set(itemId, (miniatureQuantityByItemId.get(itemId) || 0) + quantity);
  });

  const topMiniatureItemsByQuantity = Array.from(miniatureQuantityByItemId.entries())
    .map(([ItemID, TotalQuantity]) => {
      const item = itemLookupMap.get(ItemID);
      return {
        ItemID,
        ItemName: item?.ItemName || `Item #${ItemID}`,
        ProductID: item?.ProductID,
        TotalQuantity,
      };
    })
    .sort((a, b) => b.TotalQuantity - a.TotalQuantity || a.ItemName.localeCompare(b.ItemName))
    .slice(0, 10);

  const terrainQuantityByItemId = new Map<number, number>();
  let terrainTotal = 0;

  terrainRows.forEach((row) => {
    const itemId = Number(row.ItemID ?? row.TerrainID);
    const quantity = Number(row.TerrainQuantity || 0);
    if (!Number.isFinite(quantity)) {
      return;
    }

    terrainTotal += quantity;

    if (!Number.isFinite(itemId) || itemId <= 0) {
      return;
    }

    terrainQuantityByItemId.set(itemId, (terrainQuantityByItemId.get(itemId) || 0) + quantity);
  });

  const topTerrainItemsByQuantity = Array.from(terrainQuantityByItemId.entries())
    .map(([ItemID, TotalQuantity]) => {
      const item = itemLookupMap.get(ItemID);
      return {
        ItemID,
        ItemName: item?.ItemName || `Item #${ItemID}`,
        ProductID: item?.ProductID,
        TotalQuantity,
      };
    })
    .sort((a, b) => b.TotalQuantity - a.TotalQuantity || a.ItemName.localeCompare(b.ItemName))
    .slice(0, 10);

  const storeNameById = new Map<number, string>();
  allStores.forEach((store: any) => {
    const storeId = Number(store.StoreID);
    const storeName = String(store.StoreName || '').trim();
    if (Number.isFinite(storeId) && storeId > 0 && storeName) {
      storeNameById.set(storeId, storeName);
    }
  });

  const storeOrderCounts = new Map<string, number>();
  allPurchaseOrders.forEach((order: any) => {
    const storeId = Number(order.StoreID);
    const resolvedStoreName = String(order.StoreName || storeNameById.get(storeId) || '').trim();
    if (!resolvedStoreName) {
      return;
    }

    storeOrderCounts.set(resolvedStoreName, (storeOrderCounts.get(resolvedStoreName) || 0) + 1);
  });

  const topStoresByOrderCount = Array.from(storeOrderCounts.entries())
    .map(([StoreName, OrderCount]) => ({ StoreName, OrderCount }))
    .sort((a, b) => b.OrderCount - a.OrderCount || a.StoreName.localeCompare(b.StoreName))
    .slice(0, 10);

  let topOrdersByAmount: DashboardData['topOrdersByAmount'] = [];
  try {
    const ordersResp = await tablesAPI.getPurchaseOrders({
      page: 1,
      pageSize: 10,
      sortBy: 'TotalAmount',
      sortOrder: 'DESC',
    });

    topOrdersByAmount = (ordersResp.data?.data || []).map((order: any) => ({
      PurchaseOrderID: Number(order.PurchaseOrderID),
      InvoiceNumber: String(order.InvoiceNumber || ''),
      StoreName: String(order.StoreName || ''),
      PurchaseDate: String(order.PurchaseDate || ''),
      TotalAmount: Number(order.TotalAmount || 0),
    }));
  } catch {
    topOrdersByAmount = [];
  }

  return {
    totals: {
      publishers: Number(publishersResp.data?.total || 0),
      collections: Number(collectionsResp.data?.total || 0),
      categories: Number(categoriesResp.data?.total || 0),
      stores: Number(storesResp.data?.total || 0),
      items: Number(itemsResp.data?.total || 0),
      miniatures: miniaturesTotal,
      terrain: terrainTotal,
      orders: ordersTotal,
    },
    topPublishers,
    topCollections,
    topCategories,
    topItemsByPrice,
    topMiniatureItemsByQuantity,
    topTerrainItemsByQuantity,
    topStoresByOrderCount,
    topOrdersByAmount,
    publisherDashboard,
    collectionDashboard,
  };
}

function MetricCard({ label, value, loading, to }: { label: string; value: number; loading: boolean; to: string }) {
  return (
    <Link
      to={to}
      className="flex h-[108px] flex-col items-center justify-center rounded-xl border border-[var(--arcane-border-light)] bg-[var(--arcane-paper)] p-3 text-center transition hover:border-[var(--arcane-border-light)] hover:bg-[var(--arcane-gold-soft-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--arcane-gold-600)]"
    >
      <p className="text-sm font-medium text-[var(--arcane-ink-soft)]">{label}</p>
      {loading ? (
        <Skeleton className="mx-auto mt-2 h-7 w-20" />
      ) : (
        <p className="mt-2 text-2xl font-bold leading-none text-[var(--arcane-ink-900)]">{value.toLocaleString()}</p>
      )}
    </Link>
  );
}

function formatCurrency(amount: number) {
  return `$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercent(value: number) {
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`;
}

function getCoverageBandClasses(coveragePercent: number) {
  if (coveragePercent < 40) {
    return {
      card: 'border-[var(--arcane-danger-border)] bg-[var(--arcane-danger-soft)] hover:bg-[var(--arcane-danger-soft)] hover:border-[var(--arcane-danger)]',
      title: 'text-[var(--arcane-danger-text)]',
      value: 'text-[var(--arcane-danger-text)]',
      detail: 'text-[var(--arcane-danger)]',
    };
  }

  if (coveragePercent < 80) {
    return {
      card: 'border-[var(--arcane-warning-border)] bg-[var(--arcane-warning-soft)] hover:bg-[var(--arcane-warning-soft)] hover:border-[var(--arcane-warning-text)]',
      title: 'text-[var(--arcane-warning-text)]',
      value: 'text-[var(--arcane-warning-text)]',
      detail: 'text-[var(--arcane-warning-text)]',
    };
  }

  return {
    card: 'border-[var(--arcane-success-border)] bg-[var(--arcane-success-soft)] hover:bg-[var(--arcane-success-soft)] hover:border-[var(--arcane-success-text)]',
    title: 'text-[var(--arcane-success-text)]',
    value: 'text-[var(--arcane-success-text)]',
    detail: 'text-[var(--arcane-success-text)]',
  };
}

type CoverageBox = {
  EntityID: number;
  EntityName: string;
  TotalItems: number;
  ItemsInPurchaseOrder: number;
  CoveragePercent: number;
  ImageFileName?: string;
};

function buildCoverageBoxes({
  catalogRows,
  dashboardRows,
  catalogIdKey,
  catalogNameKey,
  dashboardIdKey,
  dashboardNameKey,
}: {
  catalogRows: any[];
  dashboardRows: any[];
  catalogIdKey: string;
  catalogNameKey: string;
  dashboardIdKey: string;
  dashboardNameKey: string;
}): CoverageBox[] {
  const coverageById = new Map<number, { totalItems: number; itemsInPurchaseOrder: number; coveragePercent: number }>();
  const coverageByName = new Map<string, { totalItems: number; itemsInPurchaseOrder: number; coveragePercent: number }>();

  dashboardRows.forEach((row) => {
    const entityId = Number(row[dashboardIdKey] || 0);
    const normalizedName = String(row[dashboardNameKey] || '').trim().toLowerCase();
    const coverageValue = {
      totalItems: Number(row.TotalItems || 0),
      itemsInPurchaseOrder: Number(row.ItemsInPurchaseOrder || 0),
      coveragePercent: Number(row.CoveragePercent || 0),
    };

    if (Number.isFinite(entityId) && entityId > 0) {
      coverageById.set(entityId, coverageValue);
    }

    if (normalizedName) {
      coverageByName.set(normalizedName, coverageValue);
    }
  });

  return catalogRows.map((catalogRow) => {
    const entityId = Number(catalogRow[catalogIdKey] || 0);
    const entityName = String(catalogRow[catalogNameKey] || '').trim();
    const coverage =
      coverageById.get(entityId) ||
      coverageByName.get(entityName.toLowerCase()) || {
        totalItems: 0,
        itemsInPurchaseOrder: 0,
        coveragePercent: 0,
      };

    return {
      EntityID: entityId,
      EntityName: entityName,
      TotalItems: coverage.totalItems,
      ItemsInPurchaseOrder: coverage.itemsInPurchaseOrder,
      CoveragePercent: coverage.coveragePercent,
      ImageFileName: String(catalogRow.ImageFileName || '').trim() || undefined,
    };
  });
}

function buildInventoryLink(params: Record<string, string | number | boolean | undefined>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `/admin/inventory?${query}` : '/admin/inventory';
}

function getCollectionImageUrl(fileName?: string) {
  const normalizedFileName = String(fileName || '').trim();
  if (!normalizedFileName) {
    return '';
  }

  if (/^(https?:)?\/\//i.test(normalizedFileName) || normalizedFileName.startsWith('/')) {
    return normalizedFileName;
  }

  return `/api/uploads/collections/${encodeURIComponent(normalizedFileName)}`;
}

function getPublisherImageUrl(fileName?: string) {
  const normalizedFileName = String(fileName || '').trim();
  if (!normalizedFileName) {
    return '';
  }

  if (/^(https?:)?\/\//i.test(normalizedFileName) || normalizedFileName.startsWith('/')) {
    return normalizedFileName;
  }

  return `/api/uploads/publishers/${encodeURIComponent(normalizedFileName)}`;
}

function CollectionStatusLinks({ uncollectedTo, collectedTo }: { uncollectedTo: string; collectedTo: string }) {
  return (
    <div className="absolute bottom-3 right-3 flex flex-col gap-2 sm:flex-row">
      <Link
        to={collectedTo}
        className="rounded-md border border-[var(--arcane-success-border)] bg-[var(--arcane-paper-raised)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--arcane-success-text)] shadow-sm transition hover:bg-[var(--arcane-success-soft)] hover:text-[var(--arcane-success-text)] focus:outline-none focus:ring-2 focus:ring-[var(--arcane-gold-600)]"
        title="View collected items"
        aria-label="View collected items"
      >
        Collected
      </Link>
      <Link
        to={uncollectedTo}
        className="rounded-md border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--arcane-ink-900)] shadow-sm transition hover:bg-[var(--arcane-paper)] hover:text-[var(--arcane-ink-900)] focus:outline-none focus:ring-2 focus:ring-[var(--arcane-gold-600)]"
        title="View items without a purchase order"
        aria-label="View items without a purchase order"
      >
        Uncollected
      </Link>
    </div>
  );
}

function TopListCard({ title, loading, children }: { title: string; loading: boolean; children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-[228px] flex-col rounded-xl border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] p-3">
      <h4 className="text-sm font-semibold text-[var(--arcane-ink-900)]">{title}</h4>
      {loading ? (
        <div className="mt-2 flex-1 space-y-2" aria-label="Loading list">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      ) : (
        <div className="mt-2 flex-1">{children}</div>
      )}
    </div>
  );
}

function RepositoryMetricColumn({ metric, detail }: { metric: React.ReactNode; detail: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-[360px] flex-col gap-3">
      <div className="flex-shrink-0">{metric}</div>
      <div className="flex-1">{detail}</div>
    </div>
  );
}

function CollectionCoverageCarousel({ collectionBoxes }: { collectionBoxes: CoverageBox[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', loop: false, slidesToScroll: 1 });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const pages = useMemo(() => {
    const cardsPerPage = 12;
    const groups: CoverageBox[][] = [];

    for (let index = 0; index < collectionBoxes.length; index += cardsPerPage) {
      groups.push(collectionBoxes.slice(index, index + cardsPerPage));
    }

    return groups;
  }, [collectionBoxes]);

  const onSelect = useCallback(() => {
    setSelectedIndex(emblaApi?.selectedScrollSnap() ?? 0);
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) {
      return;
    }

    emblaApi.on('select', onSelect);
    onSelect();

    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => emblaApi?.scrollPrev()}
          disabled={!emblaApi?.canScrollPrev()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] text-[var(--arcane-ink-900)] transition hover:bg-[var(--arcane-gold-soft)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Previous collection group"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => emblaApi?.scrollNext()}
          disabled={!emblaApi?.canScrollNext()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] text-[var(--arcane-ink-900)] transition hover:bg-[var(--arcane-gold-soft)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Next collection group"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-hidden rounded-xl" ref={emblaRef}>
        <div className="flex">
          {pages.map((page, pageIndex) => (
            <div key={`collection-page-${pageIndex}`} className="min-w-full flex-[0_0_100%]">
              <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {page.map((collection) => {
                  const coverageBand = getCoverageBandClasses(collection.CoveragePercent);
                  const collectionImageUrl = getCollectionImageUrl(collection.ImageFileName);
                  const hasCollectionImage = Boolean(collectionImageUrl);
                  const titleClass = hasCollectionImage ? 'text-white drop-shadow' : coverageBand.title;
                  const valueClass = hasCollectionImage ? 'text-white drop-shadow' : coverageBand.value;
                  const detailClass = hasCollectionImage ? 'text-gray-100 drop-shadow' : coverageBand.detail;
                  const baseInventoryLink = buildInventoryLink({ collection: String(collection.EntityID || collection.EntityName) });
                  const uncollectedInventoryLink = buildInventoryLink({
                    collection: String(collection.EntityID || collection.EntityName),
                    hasPurchaseOrder: false,
                  });

                  return (
                    <div
                      key={collection.EntityID || collection.EntityName}
                      className={`relative flex h-full min-h-[240px] flex-col overflow-hidden rounded-xl border p-5 transition ${
                        hasCollectionImage
                          ? 'border-[var(--arcane-border-light)] bg-[var(--arcane-ink-900)] bg-cover bg-center hover:border-[var(--arcane-gold-500)]'
                          : coverageBand.card
                      }`}
                      style={hasCollectionImage ? { backgroundImage: `url("${collectionImageUrl}")` } : undefined}
                    >
                      {hasCollectionImage ? <div className="absolute inset-0 bg-black/55" /> : null}
                      <Link
                        to={baseInventoryLink}
                        className="relative z-10 block h-full pr-36 pb-16 focus:outline-none focus:ring-2 focus:ring-[var(--arcane-gold-600)] rounded-md"
                        title={`Open Item Master for ${collection.EntityName}`}
                      >
                        <p className={`text-3xl font-bold leading-tight ${titleClass}`} title={collection.EntityName}>
                          {collection.EntityName}
                        </p>
                        <p className={`mt-2 text-sm ${detailClass}`}>
                          {collection.ItemsInPurchaseOrder.toLocaleString()} / {collection.TotalItems.toLocaleString()} items in orders
                        </p>
                      </Link>
                      <p className={`absolute bottom-3 left-3 z-10 text-3xl font-bold ${valueClass}`}>
                        {formatPercent(collection.CoveragePercent)}
                      </p>
                      <CollectionStatusLinks
                        collectedTo={buildInventoryLink({ collection: String(collection.EntityID || collection.EntityName), hasPurchaseOrder: true })}
                        uncollectedTo={uncollectedInventoryLink}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {pages.length > 1 ? (
        <div className="flex items-center justify-center gap-2">
          {pages.map((_, pageIndex) => (
            <button
              key={`collection-dot-${pageIndex}`}
              type="button"
              aria-label={`Go to collection page ${pageIndex + 1}`}
              onClick={() => emblaApi?.scrollTo(pageIndex)}
              className={`h-2.5 w-2.5 rounded-full transition ${selectedIndex === pageIndex ? 'bg-[var(--arcane-gold-500)]' : 'bg-[var(--arcane-border-light)]'}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DetailCoverageCarousel({ detailRows }: { detailRows: Array<{ categoryName: string; subTypeName: string; itemCount: number; itemsInPurchaseOrder: number; coveragePercent: number; publishers: string[]; collections: string[] }> }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', loop: false, slidesToScroll: 1 });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const pages = useMemo(() => {
    const cardsPerPage = 8;
    const groups: typeof detailRows[] = [];

    for (let index = 0; index < detailRows.length; index += cardsPerPage) {
      groups.push(detailRows.slice(index, index + cardsPerPage));
    }

    return groups;
  }, [detailRows]);

  const onSelect = useCallback(() => {
    setSelectedIndex(emblaApi?.selectedScrollSnap() ?? 0);
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) {
      return;
    }

    emblaApi.on('select', onSelect);
    onSelect();

    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => emblaApi?.scrollPrev()}
          disabled={!emblaApi?.canScrollPrev()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] text-[var(--arcane-ink-900)] transition hover:bg-[var(--arcane-gold-soft)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Previous detail group"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => emblaApi?.scrollNext()}
          disabled={!emblaApi?.canScrollNext()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] text-[var(--arcane-ink-900)] transition hover:bg-[var(--arcane-gold-soft)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Next detail group"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-hidden rounded-xl" ref={emblaRef}>
        <div className="flex">
          {pages.map((page, pageIndex) => (
            <div key={`detail-page-${pageIndex}`} className="min-w-full flex-[0_0_100%]">
              <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {page.map((row) => {
                  const inventoryBaseLink =
                    `/admin/inventory?category=${encodeURIComponent(row.categoryName)}` +
                    `&subType=${encodeURIComponent(row.subTypeName)}`;
                  const uncollectedInventoryLink = `${inventoryBaseLink}&hasPurchaseOrder=false`;

                  return (
                    <div
                      key={`${row.categoryName}:${row.subTypeName}`}
                      className="relative flex h-full min-h-[220px] flex-col overflow-hidden rounded-xl border border-[var(--arcane-border-light)] bg-[var(--arcane-paper)] p-5 shadow-sm"
                    >
                      <Link
                        to={inventoryBaseLink}
                        className="block pr-28 focus:outline-none focus:ring-2 focus:ring-[var(--arcane-gold-600)] rounded-md"
                        title={`Open Item Master for ${row.categoryName} (${row.subTypeName})`}
                      >
                        <p className="text-sm font-medium whitespace-normal break-words leading-snug text-[var(--arcane-ink-900)]" title={`${row.categoryName} (${row.subTypeName})`}>
                          {row.categoryName} ({row.subTypeName})
                        </p>
                        <p className="mt-2 text-3xl font-bold text-[var(--arcane-ink-950)]">{row.itemCount.toLocaleString()}</p>
                        <p className="mt-2 text-sm text-[var(--arcane-gold-700)]">Publisher Count: {row.publishers.length.toLocaleString()}</p>
                        <p className="text-sm text-[var(--arcane-gold-700)]">Collection Count: {row.collections.length.toLocaleString()}</p>
                      </Link>

                      <div className="mt-3 border-t border-[var(--arcane-border-light)] pt-3 pb-14">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--arcane-ink-900)]">Collections</p>
                        {row.collections.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {row.collections.map((collectionName: string) => (
                              <Link
                                key={collectionName}
                                to={`${inventoryBaseLink}&collection=${encodeURIComponent(collectionName)}`}
                                className="inline-flex items-center rounded-md bg-[var(--arcane-gold-500)] px-2 py-1 text-xs font-medium text-[var(--arcane-ink-950)]"
                                title={`Add collection filter: ${collectionName}`}
                              >
                                {collectionName}
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-[var(--arcane-ink-soft)]">No collections</p>
                        )}
                      </div>

                      <CollectionStatusLinks
                        collectedTo={`${inventoryBaseLink}&hasPurchaseOrder=true`}
                        uncollectedTo={uncollectedInventoryLink}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {pages.length > 1 ? (
        <div className="flex items-center justify-center gap-2">
          {pages.map((_, pageIndex) => (
            <button
              key={`detail-dot-${pageIndex}`}
              type="button"
              aria-label={`Go to detail page ${pageIndex + 1}`}
              onClick={() => emblaApi?.scrollTo(pageIndex)}
              className={`h-2.5 w-2.5 rounded-full transition ${selectedIndex === pageIndex ? 'bg-[var(--arcane-gold-500)]' : 'bg-[var(--arcane-border-light)]'}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PublisherCoverageCarousel({ publisherBoxes }: { publisherBoxes: CoverageBox[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: 'start', loop: false, slidesToScroll: 1 });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const pages = useMemo(() => {
    const cardsPerPage = 12;
    const groups: CoverageBox[][] = [];

    for (let index = 0; index < publisherBoxes.length; index += cardsPerPage) {
      groups.push(publisherBoxes.slice(index, index + cardsPerPage));
    }

    return groups;
  }, [publisherBoxes]);

  const onSelect = useCallback(() => {
    setSelectedIndex(emblaApi?.selectedScrollSnap() ?? 0);
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) {
      return;
    }

    emblaApi.on('select', onSelect);
    onSelect();

    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => emblaApi?.scrollPrev()}
          disabled={!emblaApi?.canScrollPrev()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] text-[var(--arcane-ink-900)] transition hover:bg-[var(--arcane-gold-soft)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Previous publisher group"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => emblaApi?.scrollNext()}
          disabled={!emblaApi?.canScrollNext()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] text-[var(--arcane-ink-900)] transition hover:bg-[var(--arcane-gold-soft)] disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Next publisher group"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="overflow-hidden rounded-xl" ref={emblaRef}>
        <div className="flex">
          {pages.map((page, pageIndex) => (
            <div key={`publisher-page-${pageIndex}`} className="min-w-full flex-[0_0_100%]">
              <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {page.map((publisher) => {
                  const coverageBand = getCoverageBandClasses(publisher.CoveragePercent);
                  const publisherImageUrl = getPublisherImageUrl(publisher.ImageFileName);
                  const hasPublisherImage = Boolean(publisherImageUrl);
                  const titleClass = hasPublisherImage ? 'text-white drop-shadow' : coverageBand.title;
                  const valueClass = hasPublisherImage ? 'text-white drop-shadow' : coverageBand.value;
                  const detailClass = hasPublisherImage ? 'text-gray-100 drop-shadow' : coverageBand.detail;
                  const baseInventoryLink = buildInventoryLink({ publisher: publisher.EntityName });
                  const uncollectedInventoryLink = buildInventoryLink({ publisher: publisher.EntityName, hasPurchaseOrder: false });

                  return (
                    <div
                      key={publisher.EntityID || publisher.EntityName}
                      className={`relative flex h-full min-h-[240px] flex-col overflow-hidden rounded-xl border p-5 transition ${
                        hasPublisherImage
                          ? 'border-[var(--arcane-border-light)] bg-[var(--arcane-ink-900)] bg-cover bg-center hover:border-[var(--arcane-gold-500)]'
                          : coverageBand.card
                      }`}
                      style={hasPublisherImage ? { backgroundImage: `url("${publisherImageUrl}")` } : undefined}
                    >
                      {hasPublisherImage ? <div className="absolute inset-0 bg-black/55" /> : null}
                      <Link
                        to={baseInventoryLink}
                        className="relative z-10 block h-full pr-36 pb-16 focus:outline-none focus:ring-2 focus:ring-[var(--arcane-gold-600)] rounded-md"
                        title={`Open Item Master for ${publisher.EntityName}`}
                      >
                        <p className={`text-3xl font-bold leading-tight truncate ${titleClass}`} title={publisher.EntityName}>
                          {publisher.EntityName}
                        </p>
                        <p className={`mt-2 text-sm ${detailClass}`}>
                          {publisher.ItemsInPurchaseOrder.toLocaleString()} / {publisher.TotalItems.toLocaleString()} items in orders
                        </p>
                      </Link>
                      <p className={`absolute bottom-3 left-3 z-10 text-3xl font-bold ${valueClass}`}>
                        {formatPercent(publisher.CoveragePercent)}
                      </p>
                      <CollectionStatusLinks
                        collectedTo={buildInventoryLink({ publisher: publisher.EntityName, hasPurchaseOrder: true })}
                        uncollectedTo={uncollectedInventoryLink}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {pages.length > 1 ? (
        <div className="flex items-center justify-center gap-2">
          {pages.map((_, pageIndex) => (
            <button
              key={`publisher-dot-${pageIndex}`}
              type="button"
              aria-label={`Go to publisher page ${pageIndex + 1}`}
              onClick={() => emblaApi?.scrollTo(pageIndex)}
              className={`h-2.5 w-2.5 rounded-full transition ${selectedIndex === pageIndex ? 'bg-[var(--arcane-gold-500)]' : 'bg-[var(--arcane-border-light)]'}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function getStoredCoverageView(): 'repository' | 'publisher' | 'collection' | 'collectionDetail' {
  return 'repository';
}

export default function HomePage() {
  const [coverageView, setCoverageView] = useState<'repository' | 'publisher' | 'collection' | 'collectionDetail'>(getStoredCoverageView);

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['homeMetrics', 'dashboardOverview'],
    queryFn: async () => {
      try {
        const response = await tablesAPI.getDashboardOverview(10);
        return response.data as DashboardData;
      } catch {
        return getDashboardFallback();
      }
    },
  });

  const { data: categoryTerrainMetrics, isLoading: categoryTerrainLoading } = useQuery({
    queryKey: ['homeMetrics', 'categoryTerrain'],
    queryFn: async (): Promise<CategoryTerrainMetrics> => {
      const [categoriesResp, terrainRows, inventoryRows, itemLookupResp] = await Promise.all([
        tablesAPI.getTableData('Category', 1, 1),
        getAllTableRows('Terrain'),
        getAllInventoryRows(),
        tablesAPI.getItemsForLookup(),
      ]);

      const [storesResp, allPurchaseOrders, allStores] = await Promise.all([
        tablesAPI.getTableData('Store', 1, 1),
        getAllTableRows('PurchaseOrder'),
        getAllTableRows('Store'),
      ]);

      const categoryCounts = new Map<string, number>();
      inventoryRows.forEach((row) => {
        const categoryName = String(row.CategoryName || '').trim();
        if (categoryName) {
          categoryCounts.set(categoryName, (categoryCounts.get(categoryName) || 0) + 1);
        }
      });

      const topCategories = Array.from(categoryCounts.entries())
        .map(([CategoryName, ItemCount]) => ({ CategoryName, ItemCount }))
        .sort((a, b) => b.ItemCount - a.ItemCount || a.CategoryName.localeCompare(b.CategoryName))
        .slice(0, 10);

      const itemLookupMap = new Map<number, { ItemName: string; ProductID?: string }>();
      (itemLookupResp.data?.data || []).forEach((item: any) => {
        itemLookupMap.set(Number(item.ItemID), {
          ItemName: item.ItemName,
          ProductID: item.ProductID,
        });
      });

      const terrainQuantityByItemId = new Map<number, number>();
      let terrainTotal = 0;

      terrainRows.forEach((row) => {
        const itemId = Number(row.ItemID ?? row.TerrainID);
        const quantity = Number(row.TerrainQuantity || 0);
        if (!Number.isFinite(quantity)) {
          return;
        }

        terrainTotal += quantity;

        if (!Number.isFinite(itemId) || itemId <= 0) {
          return;
        }

        terrainQuantityByItemId.set(itemId, (terrainQuantityByItemId.get(itemId) || 0) + quantity);
      });

      const topTerrainItemsByQuantity = Array.from(terrainQuantityByItemId.entries())
        .map(([ItemID, TotalQuantity]) => {
          const item = itemLookupMap.get(ItemID);
          return {
            ItemID,
            ItemName: item?.ItemName || `Item #${ItemID}`,
            ProductID: item?.ProductID,
            TotalQuantity,
          };
        })
        .sort((a, b) => b.TotalQuantity - a.TotalQuantity || a.ItemName.localeCompare(b.ItemName))
        .slice(0, 10);

      const storeNameById = new Map<number, string>();
      allStores.forEach((store: any) => {
        const storeId = Number(store.StoreID);
        const storeName = String(store.StoreName || '').trim();
        if (Number.isFinite(storeId) && storeId > 0 && storeName) {
          storeNameById.set(storeId, storeName);
        }
      });

      const storeOrderCounts = new Map<string, number>();
      allPurchaseOrders.forEach((order: any) => {
        const storeId = Number(order.StoreID);
        const resolvedStoreName = String(order.StoreName || storeNameById.get(storeId) || '').trim();
        if (!resolvedStoreName) {
          return;
        }

        storeOrderCounts.set(resolvedStoreName, (storeOrderCounts.get(resolvedStoreName) || 0) + 1);
      });

      const topStoresByOrderCount = Array.from(storeOrderCounts.entries())
        .map(([StoreName, OrderCount]) => ({ StoreName, OrderCount }))
        .sort((a, b) => b.OrderCount - a.OrderCount || a.StoreName.localeCompare(b.StoreName))
        .slice(0, 10);

      return {
        categoriesTotal: Number(categoriesResp.data?.total || 0),
        terrainTotal,
        storesTotal: Number(storesResp.data?.total || 0),
        topCategories,
        topTerrainItemsByQuantity,
        topStoresByOrderCount,
      };
    },
  });

  const { data: allPublishersRows, isLoading: publishersLoading } = useQuery({
    queryKey: ['coveragePublishersCatalog'],
    queryFn: async () => getAllTableRows('Publisher'),
  });

  const { data: allCollectionsRows, isLoading: collectionsLoading } = useQuery({
    queryKey: ['coverageCollectionsCatalog'],
    queryFn: async () => getAllTableRows('Collection'),
  });

  const { data: allCollectionTypeRows } = useQuery({
    queryKey: ['coverageCollectionTypesCatalog'],
    queryFn: async () => getAllTableRows('CollectionType'),
  });

  const { data: collectionDetailCounts, isLoading: collectionDetailLoading } = useQuery({
    queryKey: ['coverageCollectionDetailCounts'],
    queryFn: async () => {
      const inventoryRows = await getAllInventoryRows();

      const matrixMap = new Map<
        string,
        {
          categoryName: string;
          subTypeName: string;
          itemCount: number;
          itemsInPurchaseOrder: number;
          publishers: Set<string>;
          collections: Set<string>;
        }
      >();

      inventoryRows.forEach((row) => {
        const categoryName = String(row.CategoryName || '').trim() || 'Unspecified Category';
        const subTypeName = String(row.SubTypeName || '').trim() || 'Unspecified Sub Category';
        const publisherName = String(row.PublisherName || '').trim();
        const collectionName = String(row.CollectionName || '').trim();
        const hasPurchaseOrder = row.HasPurchaseOrder === true || row.HasPurchaseOrder === 1;

        const key = `${categoryName}::${subTypeName}`;
        const current =
          matrixMap.get(key) ||
          {
            categoryName,
            subTypeName,
            itemCount: 0,
            itemsInPurchaseOrder: 0,
            publishers: new Set<string>(),
            collections: new Set<string>(),
          };

        current.itemCount += 1;
        if (hasPurchaseOrder) {
          current.itemsInPurchaseOrder += 1;
        }
        if (publisherName) {
          current.publishers.add(publisherName);
        }
        if (collectionName) {
          current.collections.add(collectionName);
        }

        matrixMap.set(key, current);
      });

      const matrixRows = Array.from(matrixMap.values())
        .map((row) => ({
          categoryName: row.categoryName,
          subTypeName: row.subTypeName,
          itemCount: row.itemCount,
          itemsInPurchaseOrder: row.itemsInPurchaseOrder,
          coveragePercent: row.itemCount === 0 ? 0 : Number(((row.itemsInPurchaseOrder / row.itemCount) * 100).toFixed(2)),
          publishers: Array.from(row.publishers).sort((a, b) => a.localeCompare(b)),
          collections: Array.from(row.collections).sort((a, b) => a.localeCompare(b)),
        }))
        .sort(
          (a, b) =>
            a.categoryName.localeCompare(b.categoryName) ||
            a.subTypeName.localeCompare(b.subTypeName) ||
            b.itemCount - a.itemCount
        );

      return { matrixRows };
    },
  });

  const dashboardViewModel = useMemo<{
    totals: DashboardData['totals'];
    topPublishers: DashboardData['topPublishers'];
    topCollections: DashboardData['topCollections'];
    topCategories: DashboardData['topCategories'] | CategoryTerrainMetrics['topCategories'];
    topItemsByPrice: DashboardData['topItemsByPrice'];
    topMiniatureItemsByQuantity: DashboardData['topMiniatureItemsByQuantity'];
    topTerrainItemsByQuantity: DashboardData['topTerrainItemsByQuantity'] | CategoryTerrainMetrics['topTerrainItemsByQuantity'];
    topStoresByOrderCount: DashboardData['topStoresByOrderCount'] | CategoryTerrainMetrics['topStoresByOrderCount'];
    topOrdersByAmount: DashboardData['topOrdersByAmount'];
    publisherBoxes: CoverageBox[];
    collectionBoxes: CoverageBox[];
  }>(() => {
    const totals = {
      publishers: Number(dashboardData?.totals?.publishers || 0),
      collections: Number(dashboardData?.totals?.collections || 0),
      categories: Number(categoryTerrainMetrics?.categoriesTotal ?? dashboardData?.totals?.categories ?? 0),
      stores: Number(categoryTerrainMetrics?.storesTotal ?? dashboardData?.totals?.stores ?? 0),
      items: Number(dashboardData?.totals?.items || 0),
      miniatures: Number(dashboardData?.totals?.miniatures || 0),
      terrain: Number(categoryTerrainMetrics?.terrainTotal ?? dashboardData?.totals?.terrain ?? 0),
      orders: Number(dashboardData?.totals?.orders || 0),
    };

    const topPublishers = dashboardData?.topPublishers || [];
    const topCollections = dashboardData?.topCollections || [];
    const topCategories = dashboardData?.topCategories?.length
      ? dashboardData.topCategories
      : (categoryTerrainMetrics?.topCategories || []);
    const topItemsByPrice = dashboardData?.topItemsByPrice || [];
    const topMiniatureItemsByQuantity = dashboardData?.topMiniatureItemsByQuantity || [];
    const topTerrainItemsByQuantity = dashboardData?.topTerrainItemsByQuantity?.length
      ? dashboardData.topTerrainItemsByQuantity
      : (categoryTerrainMetrics?.topTerrainItemsByQuantity || []);
    const topStoresByOrderCount = dashboardData?.topStoresByOrderCount?.length
      ? dashboardData.topStoresByOrderCount
      : (categoryTerrainMetrics?.topStoresByOrderCount || []);
    const topOrdersByAmount = dashboardData?.topOrdersByAmount || [];
    const publisherDashboard = dashboardData?.publisherDashboard || [];
    const collectionDashboard = dashboardData?.collectionDashboard || [];

    const publisherBoxes = buildCoverageBoxes({
      catalogRows: allPublishersRows || [],
      dashboardRows: publisherDashboard,
      catalogIdKey: 'PublisherID',
      catalogNameKey: 'PublisherName',
      dashboardIdKey: 'PublisherID',
      dashboardNameKey: 'PublisherName',
    }).sort((a, b) => a.EntityName.localeCompare(b.EntityName) || a.EntityID - b.EntityID);

    const collectionTypeNameById = new Map<number, string>();
    (allCollectionTypeRows || []).forEach((row: any) => {
      const collectionTypeId = Number(row.CollectionTypeID);
      const collectionTypeName = String(row.CollectionTypeName || '').trim();
      if (Number.isFinite(collectionTypeId) && collectionTypeName) {
        collectionTypeNameById.set(collectionTypeId, collectionTypeName);
      }
    });

    const collectionCoverageById = new Map<number, { totalItems: number; itemsInPurchaseOrder: number; coveragePercent: number }>();
    const collectionCoverageByName = new Map<string, { totalItems: number; itemsInPurchaseOrder: number; coveragePercent: number }>();
    (collectionDashboard || []).forEach((row: any) => {
      const collectionId = Number(row.CollectionID || 0);
      const normalizedName = String(row.CollectionName || '').trim().toLowerCase();
      const coverageValue = {
        totalItems: Number(row.TotalItems || 0),
        itemsInPurchaseOrder: Number(row.ItemsInPurchaseOrder || 0),
        coveragePercent: Number(row.CoveragePercent || 0),
      };

      if (Number.isFinite(collectionId) && collectionId > 0) {
        collectionCoverageById.set(collectionId, coverageValue);
      }

      if (normalizedName) {
        collectionCoverageByName.set(normalizedName, coverageValue);
      }
    });

    const collectionBoxes: CoverageBox[] = (allCollectionsRows || [])
      .map((row: any) => {
        const collectionId = Number(row.CollectionID || 0);
        const collectionName = String(row.CollectionName || '').trim();
        const collectionTypeName = collectionTypeNameById.get(Number(row.CollectionTypeID)) || '';
        const entityName = collectionTypeName ? `${collectionName} (${collectionTypeName})` : collectionName;
        const coverage =
          collectionCoverageById.get(collectionId) ||
          collectionCoverageByName.get(collectionName.toLowerCase()) || {
            totalItems: 0,
            itemsInPurchaseOrder: 0,
            coveragePercent: 0,
          };

        return {
          EntityID: collectionId,
          EntityName: entityName,
          TotalItems: coverage.totalItems,
          ItemsInPurchaseOrder: coverage.itemsInPurchaseOrder,
          CoveragePercent: coverage.coveragePercent,
          ImageFileName: String(row.ImageFileName || '').trim() || undefined,
        };
      })
      .sort((a, b) => a.EntityName.localeCompare(b.EntityName) || a.EntityID - b.EntityID);

    return {
      totals,
      topPublishers,
      topCollections,
      topCategories,
      topItemsByPrice,
      topMiniatureItemsByQuantity,
      topTerrainItemsByQuantity,
      topStoresByOrderCount,
      topOrdersByAmount,
      publisherBoxes,
      collectionBoxes,
    };
  }, [
    allCollectionTypeRows,
    allCollectionsRows,
    allPublishersRows,
    categoryTerrainMetrics,
    dashboardData,
  ]);

  const {
    totals,
    topPublishers,
    topCollections,
    topCategories,
    topItemsByPrice,
    topMiniatureItemsByQuantity,
    topTerrainItemsByQuantity,
    topStoresByOrderCount,
    topOrdersByAmount,
    publisherBoxes,
    collectionBoxes,
  } = dashboardViewModel;

  const coverageTabs = [
    { value: 'repository', label: 'Repository Metrics' },
    { value: 'publisher', label: 'Publisher View' },
    { value: 'collection', label: 'Collection View' },
    { value: 'collectionDetail', label: 'Collection Detail' },
  ] as const;

  return (
    <AdminLayout>
      <div className="max-w-[1920px] mx-auto space-y-6 px-0 2xl:px-2">
        <section className="bg-[var(--arcane-paper-raised)] rounded-lg shadow p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h3 className="text-xl font-semibold text-[var(--arcane-ink-900)]">Coverage Metrics</h3>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-[var(--arcane-border-light)] bg-[var(--arcane-paper)] p-1 shadow-sm sm:grid-cols-4 w-full sm:w-auto">
              {coverageTabs.map((tab) => {
                const active = coverageView === tab.value;

                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setCoverageView(tab.value)}
                    aria-pressed={active}
                    className={`px-3 py-2 text-sm rounded-md transition duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-[var(--arcane-gold-600)] focus:ring-offset-1 ${
                      active
                        ? 'bg-[var(--arcane-gold-500)] text-[var(--arcane-ink-950)] shadow-md shadow-[var(--arcane-gold-500-border)] -translate-y-0.5'
                        : 'text-[var(--arcane-ink-900)] hover:bg-[var(--arcane-border-light)] hover:-translate-y-0.5'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div key={coverageView} className="animate-coverage-swap">
          {coverageView === 'repository' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <RepositoryMetricColumn
                metric={<MetricCard label="Categories" value={totals.categories} loading={dashboardLoading || categoryTerrainLoading} to="/admin/categories" />}
                detail={
                  <TopListCard title="Top 10 Category Counts" loading={dashboardLoading || categoryTerrainLoading}>
                    {topCategories.length ? (
                      <ul className="space-y-1 text-sm">
                        {topCategories.map((row) => (
                          <li key={row.CategoryName} className="flex items-center justify-between gap-2">
                            <Link
                              to={`/admin/inventory?category=${encodeURIComponent(row.CategoryName)}`}
                              className="truncate text-[var(--arcane-gold-700)] hover:text-[var(--arcane-gold-600)] hover:underline"
                              title={`View items for ${row.CategoryName}`}
                            >
                              {row.CategoryName}
                            </Link>
                            <span className="font-semibold text-[var(--arcane-ink-900)]">{row.ItemCount}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-[var(--arcane-ink-soft)]">No data.</p>
                    )}
                  </TopListCard>
                }
              />

              <RepositoryMetricColumn
                metric={<MetricCard label="Collections" value={totals.collections} loading={dashboardLoading} to="/admin/collections" />}
                detail={
                  <TopListCard title="Top 10 Collections by Item Count" loading={dashboardLoading}>
                    {topCollections.length ? (
                      <ul className="space-y-1 text-sm">
                        {topCollections.map((row) => (
                          <li key={row.CollectionName} className="flex items-center justify-between gap-2">
                            <Link
                              to={`/admin/inventory?collection=${encodeURIComponent(row.CollectionName)}`}
                              className="truncate text-[var(--arcane-gold-700)] hover:text-[var(--arcane-gold-600)] hover:underline"
                              title={`View items for ${row.CollectionName}`}
                            >
                              {row.CollectionName}
                            </Link>
                            <span className="font-semibold text-[var(--arcane-ink-900)]">{row.ItemCount}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-[var(--arcane-ink-soft)]">No data.</p>
                    )}
                  </TopListCard>
                }
              />

              <RepositoryMetricColumn
                metric={<MetricCard label="Items" value={totals.items} loading={dashboardLoading} to="/admin/inventory" />}
                detail={
                  <TopListCard title="Top 10 Most Expensive Items" loading={dashboardLoading}>
                    {topItemsByPrice.length ? (
                      <ul className="space-y-1 text-sm">
                        {topItemsByPrice.map((row) => (
                          <li key={row.ItemID} className="flex items-center justify-between gap-2">
                            <Link
                              to={`/admin/inventory?item=${encodeURIComponent(row.ItemName)}`}
                              className="truncate text-[var(--arcane-gold-700)] hover:text-[var(--arcane-gold-600)] hover:underline"
                              title={`View item ${row.ItemName}`}
                            >
                              {row.ItemName}{row.ProductID ? ` (${row.ProductID})` : ''}
                            </Link>
                            <span className="font-semibold text-[var(--arcane-ink-900)]">{formatCurrency(Number(row.MaxPrice || 0))}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-[var(--arcane-ink-soft)]">No pricing data.</p>
                    )}
                  </TopListCard>
                }
              />

              <RepositoryMetricColumn
                metric={<MetricCard label="Miniatures" value={totals.miniatures} loading={dashboardLoading} to="/admin/miniatures" />}
                detail={
                  <TopListCard title="Top 10 Miniature Items by Quantity" loading={dashboardLoading}>
                    {topMiniatureItemsByQuantity.length ? (
                      <ul className="space-y-1 text-sm">
                        {topMiniatureItemsByQuantity.map((row) => (
                          <li key={row.ItemID} className="flex items-center justify-between gap-2">
                            <Link
                              to={`/admin/miniatures?itemId=${encodeURIComponent(String(row.ItemID))}`}
                              className="truncate text-[var(--arcane-gold-700)] hover:text-[var(--arcane-gold-600)] hover:underline"
                              title={`View miniatures for ${row.ItemName}`}
                            >
                              {row.ItemName}{row.ProductID ? ` (${row.ProductID})` : ''}
                            </Link>
                            <span className="font-semibold text-[var(--arcane-ink-900)]">{Number(row.TotalQuantity || 0).toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-[var(--arcane-ink-soft)]">No miniature data.</p>
                    )}
                  </TopListCard>
                }
              />

              <RepositoryMetricColumn
                metric={<MetricCard label="Orders" value={totals.orders} loading={dashboardLoading} to="/admin/order-master" />}
                detail={
                  <TopListCard title="Top 10 Most Expensive Orders" loading={dashboardLoading}>
                    {topOrdersByAmount.length ? (
                      <ul className="space-y-1 text-sm">
                        {topOrdersByAmount.map((row) => (
                          <li key={row.PurchaseOrderID} className="flex items-center justify-between gap-2">
                            <Link
                              to={`/admin/order-master?invoice=${encodeURIComponent(row.InvoiceNumber)}&store=${encodeURIComponent(row.StoreName)}`}
                              className="truncate text-[var(--arcane-gold-700)] hover:text-[var(--arcane-gold-600)] hover:underline"
                              title={`View order ${row.InvoiceNumber}`}
                            >
                              #{row.InvoiceNumber} - {row.StoreName}
                            </Link>
                            <span className="font-semibold text-[var(--arcane-ink-900)]">{formatCurrency(Number(row.TotalAmount || 0))}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-[var(--arcane-ink-soft)]">No order data.</p>
                    )}
                  </TopListCard>
                }
              />

              <RepositoryMetricColumn
                metric={<MetricCard label="Publishers" value={totals.publishers} loading={dashboardLoading} to="/admin/publishers" />}
                detail={
                  <TopListCard title="Top 10 Publishers by Item Count" loading={dashboardLoading}>
                    {topPublishers.length ? (
                      <ul className="space-y-1 text-sm">
                        {topPublishers.map((row) => (
                          <li key={row.PublisherName} className="flex items-center justify-between gap-2">
                            <Link
                              to={`/admin/inventory?publisher=${encodeURIComponent(row.PublisherName)}`}
                              className="truncate text-[var(--arcane-gold-700)] hover:text-[var(--arcane-gold-600)] hover:underline"
                              title={`View items for ${row.PublisherName}`}
                            >
                              {row.PublisherName}
                            </Link>
                            <span className="font-semibold text-[var(--arcane-ink-900)]">{row.ItemCount}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-[var(--arcane-ink-soft)]">No data.</p>
                    )}
                  </TopListCard>
                }
              />

              <RepositoryMetricColumn
                metric={<MetricCard label="Stores" value={totals.stores} loading={dashboardLoading || categoryTerrainLoading} to="/admin/stores" />}
                detail={
                  <TopListCard title="Top 10 Stores by Order Count" loading={dashboardLoading || categoryTerrainLoading}>
                    {topStoresByOrderCount.length ? (
                      <ul className="space-y-1 text-sm">
                        {topStoresByOrderCount.map((row) => (
                          <li key={row.StoreName} className="flex items-center justify-between gap-2">
                            <Link
                              to={`/admin/order-master?store=${encodeURIComponent(row.StoreName)}`}
                              className="truncate text-[var(--arcane-gold-700)] hover:text-[var(--arcane-gold-600)] hover:underline"
                              title={`View orders for ${row.StoreName}`}
                            >
                              {row.StoreName}
                            </Link>
                            <span className="font-semibold text-[var(--arcane-ink-900)]">{row.OrderCount.toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-[var(--arcane-ink-soft)]">No store order data.</p>
                    )}
                  </TopListCard>
                }
              />

              <RepositoryMetricColumn
                metric={<MetricCard label="Terrain" value={totals.terrain} loading={dashboardLoading || categoryTerrainLoading} to="/admin/terrain" />}
                detail={
                  <TopListCard title="Top 10 Terrain Items by Quantity" loading={dashboardLoading || categoryTerrainLoading}>
                    {topTerrainItemsByQuantity.length ? (
                      <ul className="space-y-1 text-sm">
                        {topTerrainItemsByQuantity.map((row) => (
                          <li key={row.ItemID} className="flex items-center justify-between gap-2">
                            <Link
                              to={`/admin/terrain?itemId=${encodeURIComponent(String(row.ItemID))}`}
                              className="truncate text-[var(--arcane-gold-700)] hover:text-[var(--arcane-gold-600)] hover:underline"
                              title={`View terrain for ${row.ItemName}`}
                            >
                              {row.ItemName}{row.ProductID ? ` (${row.ProductID})` : ''}
                            </Link>
                            <span className="font-semibold text-[var(--arcane-ink-900)]">{Number(row.TotalQuantity || 0).toLocaleString()}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-[var(--arcane-ink-soft)]">No terrain data.</p>
                    )}
                  </TopListCard>
                }
              />
            </div>
          ) : coverageView === 'publisher' ? (
            dashboardLoading && !publisherBoxes.length ? (
              <p className="text-sm text-[var(--arcane-ink-soft)]">Loading publisher coverage...</p>
            ) : publishersLoading && !publisherBoxes.length ? (
              <p className="text-sm text-[var(--arcane-ink-soft)]">Loading publishers...</p>
            ) : publisherBoxes.length ? (
              <PublisherCoverageCarousel publisherBoxes={publisherBoxes} />
            ) : (
              <p className="text-sm text-[var(--arcane-ink-soft)]">No publishers found.</p>
            )
            ) : coverageView === 'collection' ? (
              dashboardLoading && !collectionBoxes.length ? (
            <p className="text-sm text-[var(--arcane-ink-soft)]">Loading collection coverage...</p>
          ) : collectionsLoading && !collectionBoxes.length ? (
            <p className="text-sm text-[var(--arcane-ink-soft)]">Loading collections...</p>
          ) : collectionBoxes.length ? (
            <CollectionCoverageCarousel collectionBoxes={collectionBoxes} />
          ) : (
            <p className="text-sm text-[var(--arcane-ink-soft)]">No collections found.</p>
          )
          ) : collectionDetailLoading && !collectionDetailCounts ? (
            <p className="text-sm text-[var(--arcane-ink-soft)]">Loading collection detail counts...</p>
          ) : collectionDetailCounts?.matrixRows?.length ? (
            <div className="rounded-xl border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] p-4">
              <h4 className="text-sm font-semibold text-[var(--arcane-ink-900)]">Category + Sub Category Detail</h4>
              <div className="mt-3">
                <DetailCoverageCarousel detailRows={collectionDetailCounts.matrixRows} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--arcane-ink-soft)]">No matrix rows available.</p>
          )}
            </div>
        </section>
      </div>
    </AdminLayout>
  );
}
