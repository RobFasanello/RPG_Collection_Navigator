import { useQuery } from '@tanstack/react-query';
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
  const [publishersResp, collectionsResp, itemsResp, allPublishersRows] = await Promise.all([
    tablesAPI.getTableData('Publisher', 1, 1),
    tablesAPI.getTableData('Collection', 1, 1),
    tablesAPI.getInventoryItems({ page: 1, pageSize: 1 }),
    getAllTableRows('Publisher'),
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

function TopListCard({ title, loading, children }: { title: string; loading: boolean; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
      {loading ? <p className="mt-3 text-sm text-gray-500">Loading...</p> : <div className="mt-3">{children}</div>}
    </div>
  );
}

export default function HomePage() {
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

  return (
    <AdminLayout title="Home">
      <div className="max-w-6xl mx-auto space-y-6">
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
          <h3 className="text-xl font-semibold text-gray-900 mb-4">Publisher Dashboard</h3>
          {dashboardLoading && !publisherDashboard.length ? (
            <p className="text-sm text-gray-500">Loading publisher coverage...</p>
          ) : publisherDashboard.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {publisherDashboard.map((publisher) => {
                const coverageBand = getCoverageBandClasses(publisher.CoveragePercent);

                return (
                  <Link
                    key={publisher.PublisherID || publisher.PublisherName}
                    to={`/admin/inventory?publisher=${encodeURIComponent(publisher.PublisherName)}`}
                    className={`block rounded-xl border p-5 transition focus:outline-none focus:ring-2 focus:ring-blue-500 ${coverageBand.card}`}
                  >
                    <p className={`text-sm font-medium truncate ${coverageBand.title}`} title={publisher.PublisherName}>
                      {publisher.PublisherName}
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
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
