import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { tablesAPI } from '../services/api';

type DashboardData = {
  totals: {
    publishers: number;
    collections: number;
    items: number;
    orders: number;
  };
  publisherDashboard: Array<{
    PublisherID: number;
    PublisherName: string;
    TotalItems: number;
    ItemsInPurchaseOrder: number;
    CoveragePercent: number;
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
  topItemsByPrice: Array<{ ItemID: number; ItemName: string; ProductID?: string; MaxPrice: number }>;
  topOrdersByAmount: Array<{
    PurchaseOrderID: number;
    InvoiceNumber: string;
    StoreName: string;
    PurchaseDate: string;
    TotalAmount: number;
  }>;
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
  const [publishersResp, collectionsResp, itemsResp, allPublishersRows, allCollectionsRows] = await Promise.all([
    tablesAPI.getTableData('Publisher', 1, 1),
    tablesAPI.getTableData('Collection', 1, 1),
    tablesAPI.getInventoryItems({ page: 1, pageSize: 1 }),
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

  const [purchaseOrderDetailsRows, itemLookupResp] = await Promise.all([
    getAllTableRows('PurchaseOrderDetail'),
    tablesAPI.getItemsForLookup(),
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
      items: Number(itemsResp.data?.total || 0),
      orders: ordersTotal,
    },
    topPublishers,
    topCollections,
    topItemsByPrice,
    topOrdersByAmount,
    publisherDashboard,
    collectionDashboard,
  };
}

function MetricCard({ label, value, loading, to }: { label: string; value: number; loading: boolean; to: string }) {
  return (
    <Link
      to={to}
      className="block rounded-xl border border-gray-200 bg-gray-50 p-5 text-center transition hover:bg-gray-100 hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{loading ? '...' : value.toLocaleString()}</p>
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
      card: 'border-red-200 bg-red-50 hover:bg-red-100 hover:border-red-300',
      title: 'text-red-800',
      value: 'text-red-900',
      detail: 'text-red-700',
    };
  }

  if (coveragePercent < 80) {
    return {
      card: 'border-amber-200 bg-amber-50 hover:bg-amber-100 hover:border-amber-300',
      title: 'text-amber-800',
      value: 'text-amber-900',
      detail: 'text-amber-700',
    };
  }

  return {
    card: 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 hover:border-emerald-300',
    title: 'text-emerald-800',
    value: 'text-emerald-900',
    detail: 'text-emerald-700',
  };
}

type CoverageBox = {
  EntityID: number;
  EntityName: string;
  TotalItems: number;
  ItemsInPurchaseOrder: number;
  CoveragePercent: number;
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
    };
  });
}

function TopListCard({ title, loading, children }: { title: string; loading: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
      {loading ? <p className="mt-3 text-sm text-gray-500">Loading...</p> : <div className="mt-3">{children}</div>}
    </div>
  );
}

export default function HomePage() {
  const [coverageView, setCoverageView] = useState<'publisher' | 'collection' | 'collectionDetail'>('publisher');

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
            b.itemCount - a.itemCount ||
            a.categoryName.localeCompare(b.categoryName) ||
            a.subTypeName.localeCompare(b.subTypeName)
        );

      return { matrixRows };
    },
  });

  const totals = dashboardData?.totals || {
    publishers: 0,
    collections: 0,
    items: 0,
    orders: 0,
  };

  const topPublishers = dashboardData?.topPublishers || [];
  const topCollections = dashboardData?.topCollections || [];
  const topItemsByPrice = dashboardData?.topItemsByPrice || [];
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
  });

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

  const collectionBoxes: CoverageBox[] = (allCollectionsRows || []).map((row: any) => {
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
    };
  });

  return (
    <AdminLayout title="Home">
      <div className="max-w-[1800px] mx-auto space-y-6">
        <section className="bg-white rounded-lg shadow p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Welcome to Arcane Repository</h2>
          <p className="text-gray-700 mb-4">
            Use the Setup and Inventory tabs in the left menu to navigate the application.
          </p>
          <p className="text-gray-600">
            Setup contains reference data pages. Inventory contains Item Master, Order Entry,
            and Stores.
          </p>
        </section>

        <section className="bg-white rounded-lg shadow p-8">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Repository Dashboard</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="space-y-3">
              <MetricCard label="Publishers" value={totals.publishers} loading={dashboardLoading} to="/admin/publishers" />
              <TopListCard title="Top 10 Publishers by Item Count" loading={dashboardLoading}>
                {topPublishers.length ? (
                  <ul className="space-y-1 text-sm">
                    {topPublishers.map((row) => (
                      <li key={row.PublisherName} className="flex items-center justify-between gap-2">
                        <Link
                          to={`/admin/inventory?publisher=${encodeURIComponent(row.PublisherName)}`}
                          className="truncate text-blue-600 hover:text-blue-700 hover:underline"
                          title={`View items for ${row.PublisherName}`}
                        >
                          {row.PublisherName}
                        </Link>
                        <span className="font-semibold text-gray-900">{row.ItemCount}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No data.</p>
                )}
              </TopListCard>
            </div>

            <div className="space-y-3">
              <MetricCard label="Collections" value={totals.collections} loading={dashboardLoading} to="/admin/collections" />
              <TopListCard title="Top 10 Collections by Item Count" loading={dashboardLoading}>
                {topCollections.length ? (
                  <ul className="space-y-1 text-sm">
                    {topCollections.map((row) => (
                      <li key={row.CollectionName} className="flex items-center justify-between gap-2">
                        <Link
                          to={`/admin/inventory?collection=${encodeURIComponent(row.CollectionName)}`}
                          className="truncate text-blue-600 hover:text-blue-700 hover:underline"
                          title={`View items for ${row.CollectionName}`}
                        >
                          {row.CollectionName}
                        </Link>
                        <span className="font-semibold text-gray-900">{row.ItemCount}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No data.</p>
                )}
              </TopListCard>
            </div>

            <div className="space-y-3">
              <MetricCard label="Items" value={totals.items} loading={dashboardLoading} to="/admin/inventory" />
              <TopListCard title="Top 10 Most Expensive Items" loading={dashboardLoading}>
                {topItemsByPrice.length ? (
                  <ul className="space-y-1 text-sm">
                    {topItemsByPrice.map((row) => (
                      <li key={row.ItemID} className="flex items-center justify-between gap-2">
                        <Link
                          to={`/admin/inventory?item=${encodeURIComponent(row.ItemName)}`}
                          className="truncate text-blue-600 hover:text-blue-700 hover:underline"
                          title={`View item ${row.ItemName}`}
                        >
                          {row.ItemName}{row.ProductID ? ` (${row.ProductID})` : ''}
                        </Link>
                        <span className="font-semibold text-gray-900">{formatCurrency(Number(row.MaxPrice || 0))}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No pricing data.</p>
                )}
              </TopListCard>
            </div>

            <div className="space-y-3">
              <MetricCard label="Orders" value={totals.orders} loading={dashboardLoading} to="/admin/order-master" />
              <TopListCard title="Top 10 Most Expensive Orders" loading={dashboardLoading}>
                {topOrdersByAmount.length ? (
                  <ul className="space-y-1 text-sm">
                    {topOrdersByAmount.map((row) => (
                      <li key={row.PurchaseOrderID} className="flex items-center justify-between gap-2">
                        <Link
                          to={`/admin/order-master?invoice=${encodeURIComponent(row.InvoiceNumber)}&store=${encodeURIComponent(row.StoreName)}`}
                          className="truncate text-blue-600 hover:text-blue-700 hover:underline"
                          title={`View order ${row.InvoiceNumber}`}
                        >
                          #{row.InvoiceNumber} - {row.StoreName}
                        </Link>
                        <span className="font-semibold text-gray-900">{formatCurrency(Number(row.TotalAmount || 0))}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No order data.</p>
                )}
              </TopListCard>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow p-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <h3 className="text-xl font-semibold text-gray-900">Coverage Dashboard</h3>
            <div className="grid grid-cols-3 gap-2 bg-gray-100 rounded-lg p-1 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setCoverageView('publisher')}
                className={`px-3 py-2 text-sm rounded-md transition ${
                  coverageView === 'publisher'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Publisher View
              </button>
              <button
                type="button"
                onClick={() => setCoverageView('collection')}
                className={`px-3 py-2 text-sm rounded-md transition ${
                  coverageView === 'collection'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Collection View
              </button>
              <button
                type="button"
                onClick={() => setCoverageView('collectionDetail')}
                className={`px-3 py-2 text-sm rounded-md transition ${
                  coverageView === 'collectionDetail'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Collection Detail
              </button>
            </div>
          </div>

          {coverageView === 'publisher' ? (
            dashboardLoading && !publisherBoxes.length ? (
              <p className="text-sm text-gray-500">Loading publisher coverage...</p>
            ) : publishersLoading && !publisherBoxes.length ? (
              <p className="text-sm text-gray-500">Loading publishers...</p>
            ) : publisherBoxes.length ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {publisherBoxes.map((publisher) => {
                  const coverageBand = getCoverageBandClasses(publisher.CoveragePercent);

                  return (
                    <Link
                      key={publisher.EntityID || publisher.EntityName}
                      to={`/admin/inventory?publisher=${encodeURIComponent(publisher.EntityName)}`}
                      className={`block rounded-xl border p-5 transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${coverageBand.card}`}
                    >
                      <p className={`text-sm font-medium truncate ${coverageBand.title}`} title={publisher.EntityName}>
                        {publisher.EntityName}
                      </p>
                      <p className={`mt-2 text-3xl font-bold ${coverageBand.value}`}>{formatPercent(publisher.CoveragePercent)}</p>
                      <p className={`mt-2 text-sm ${coverageBand.detail}`}>
                        {publisher.ItemsInPurchaseOrder.toLocaleString()} / {publisher.TotalItems.toLocaleString()} items in orders
                      </p>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No publishers found.</p>
              )
            ) : coverageView === 'collection' ? (
              dashboardLoading && !collectionBoxes.length ? (
            <p className="text-sm text-gray-500">Loading collection coverage...</p>
          ) : collectionsLoading && !collectionBoxes.length ? (
            <p className="text-sm text-gray-500">Loading collections...</p>
          ) : collectionBoxes.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {collectionBoxes.map((collection) => {
                const coverageBand = getCoverageBandClasses(collection.CoveragePercent);

                return (
                  <Link
                    key={collection.EntityID || collection.EntityName}
                    to={`/admin/inventory?collection=${encodeURIComponent(String(collection.EntityID || collection.EntityName))}`}
                    className={`block rounded-xl border p-5 transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${coverageBand.card}`}
                  >
                    <p className={`text-sm font-medium truncate ${coverageBand.title}`} title={collection.EntityName}>
                      {collection.EntityName}
                    </p>
                    <p className={`mt-2 text-3xl font-bold ${coverageBand.value}`}>{formatPercent(collection.CoveragePercent)}</p>
                    <p className={`mt-2 text-sm ${coverageBand.detail}`}>
                      {collection.ItemsInPurchaseOrder.toLocaleString()} / {collection.TotalItems.toLocaleString()} items in orders
                    </p>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No collections found.</p>
          )
          ) : collectionDetailLoading && !collectionDetailCounts ? (
            <p className="text-sm text-gray-500">Loading collection detail counts...</p>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h4 className="text-sm font-semibold text-gray-800">Category + Sub Category Detail</h4>
              {collectionDetailCounts?.matrixRows?.length ? (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
                  {collectionDetailCounts.matrixRows.map((row) => {
                    const inventoryBaseLink =
                      `/admin/inventory?category=${encodeURIComponent(row.categoryName)}` +
                      `&subType=${encodeURIComponent(row.subTypeName)}`;

                    return (
                      <div
                        key={`${row.categoryName}:${row.subTypeName}`}
                        className="rounded-xl border border-emerald-200 bg-emerald-50 p-5"
                      >
                        <Link
                          to={inventoryBaseLink}
                          className="block rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          title={`Open Item Master for ${row.categoryName} (${row.subTypeName})`}
                        >
                          <p
                            className="text-sm font-medium truncate text-emerald-800"
                            title={`${row.categoryName} (${row.subTypeName})`}
                          >
                            {row.categoryName} ({row.subTypeName})
                          </p>
                          <p className="mt-2 text-3xl font-bold text-emerald-900">
                            {row.itemCount.toLocaleString()}
                          </p>
                          <p className="mt-2 text-sm text-emerald-700">
                            Publisher Count: {row.publishers.length.toLocaleString()}
                          </p>
                          <p className="text-sm text-emerald-700">
                            Collection Count: {row.collections.length.toLocaleString()}
                          </p>
                        </Link>

                        <div className="mt-3 border-t border-green-200/70 pt-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-green-900/90 mb-2">Collections</p>
                          {row.collections.length ? (
                            <div className="flex flex-wrap gap-1.5">
                              {row.collections.map((collectionName: string) => (
                                <Link
                                  key={collectionName}
                                  to={`${inventoryBaseLink}&collection=${encodeURIComponent(collectionName)}`}
                                  className="inline-flex items-center rounded-md bg-green-800 text-green-50 px-2 py-1 text-xs"
                                  title={`Add collection filter: ${collectionName}`}
                                >
                                  {collectionName}
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-green-900/80">No collections</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500">No matrix rows available.</p>
              )}
              </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
