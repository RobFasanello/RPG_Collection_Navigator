import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, X, ChevronUp, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import AdminLayout from '../components/AdminLayout';
import { Button } from '../components/ui/Button';
import { Dialog } from '../components/ui/Dialog';
import RecordForm from '../components/RecordForm';
import { tableAPI } from '../services/api';

interface Publisher {
  [key: string]: any;
  PublisherID?: number;
  PublisherName?: string;
  PublisherURL?: string | null;
}

type SortDirection = 'asc' | 'desc' | null;
type SortColumn = 'name' | 'url' | 'itemCount' | 'orderCount' | null;

async function getAllTableRows(tableName: string): Promise<any[]> {
  const pageSize = 500;
  const firstResponse = await tableAPI.getTableData(tableName, 1, pageSize);
  const firstData = firstResponse.data;
  const rows = [...(firstData?.data || [])];
  const totalPages = Number(firstData?.totalPages || 1);

  for (let page = 2; page <= totalPages; page++) {
    const response = await tableAPI.getTableData(tableName, page, pageSize);
    rows.push(...(response.data?.data || []));
  }

  return rows;
}

function buildPublisherInventoryLink(publisherName: string, ownedOnly: boolean) {
  const params = new URLSearchParams();
  params.set('publisher', publisherName);
  if (ownedOnly) {
    params.set('hasPurchaseOrder', 'true');
  }

  return `/admin/inventory?${params.toString()}`;
}

export default function PublishersPage() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const queryClient = useQueryClient();
  const tableName = 'Publisher';

  const { data: records = [], isLoading, error } = useQuery<any, Error>({
    queryKey: ['table', tableName],
    queryFn: async () => {
      const response = await tableAPI.getRecords(tableName);
      return response.data.data;
    },
  });

  const { data: allItems = [] } = useQuery<any, Error>({
    queryKey: ['table', 'Item', 'all-for-publisher-counts'],
    queryFn: async () => getAllTableRows('Item'),
  });

  const { data: allPurchaseOrderDetails = [] } = useQuery<any, Error>({
    queryKey: ['table', 'PurchaseOrderDetail', 'all-for-publisher-counts'],
    queryFn: async () => getAllTableRows('PurchaseOrderDetail'),
  });

  const itemCountByPublisher = (allItems || []).reduce((map: Record<number, number>, item: any) => {
    const publisherId = Number(item?.PublisherID);
    if (!Number.isFinite(publisherId)) {
      return map;
    }

    map[publisherId] = (map[publisherId] || 0) + 1;
    return map;
  }, {});

  const publisherIdByItemId = (allItems || []).reduce((map: Record<number, number>, item: any) => {
    const itemId = Number(item?.ItemID);
    const publisherId = Number(item?.PublisherID);
    if (!Number.isFinite(itemId) || !Number.isFinite(publisherId)) {
      return map;
    }

    map[itemId] = publisherId;
    return map;
  }, {});

  const orderIdsByPublisher: Record<number, Set<number>> = {};
  (allPurchaseOrderDetails || []).forEach((detail: any) => {
    const itemId = Number(detail?.ItemID);
    const purchaseOrderId = Number(detail?.PurchaseOrderID);
    const publisherId = publisherIdByItemId[itemId];

    if (!Number.isFinite(itemId) || !Number.isFinite(purchaseOrderId) || !Number.isFinite(publisherId)) {
      return;
    }

    if (!orderIdsByPublisher[publisherId]) {
      orderIdsByPublisher[publisherId] = new Set<number>();
    }

    orderIdsByPublisher[publisherId].add(purchaseOrderId);
  });

  const orderCountByPublisher = Object.entries(orderIdsByPublisher).reduce((map: Record<number, number>, [publisherId, orderIds]) => {
    map[Number(publisherId)] = orderIds.size;
    return map;
  }, {});

  const deleteMutation = useMutation({
    mutationFn: async (recordId: number | string) => {
      return await tableAPI.deleteRecord(tableName, recordId);
    },
    onSuccess: () => {
      setDeleteError('');
      queryClient.invalidateQueries({ queryKey: ['table', tableName] });
    },
    onError: (error: any) => {
      const backendError = String(error?.response?.data?.error || error?.message || '').trim();
      const backendMessage = backendError.toLowerCase();
      const referentialIntegrityConflict =
        backendMessage.includes('reference constraint') ||
        backendMessage.includes('foreign key') ||
        backendMessage.includes('conflicted with the reference');

      if (referentialIntegrityConflict) {
        setDeleteError(
          'Delete failed. This publisher is still referenced by one or more publisher/collection links and linked items. Reassign or remove the linked items first, then try again.'
        );
        return;
      }

      setDeleteError(backendError || 'Delete failed. Please try again.');
    },
  });

  const handleDelete = (recordId: string) => {
    if (confirm('Are you sure you want to delete this record?')) {
      setDeleteError('');
      deleteMutation.mutate(recordId);
    }
  };

  const handleSort = (column: Exclude<SortColumn, null>) => {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection('asc');
      return;
    }

    if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else if (sortDirection === 'desc') {
      setSortDirection(null);
      setSortColumn(null);
    } else {
      setSortDirection('asc');
    }
  };

  const getSortedRecords = () => {
    if (!Array.isArray(records) || !sortDirection || !sortColumn) {
      return records;
    }

    const sorted = [...records].sort((a, b) => {
      if (sortColumn === 'itemCount' || sortColumn === 'orderCount') {
        const countA =
          sortColumn === 'itemCount'
            ? itemCountByPublisher[Number(a.PublisherID)] || 0
            : orderCountByPublisher[Number(a.PublisherID)] || 0;
        const countB =
          sortColumn === 'itemCount'
            ? itemCountByPublisher[Number(b.PublisherID)] || 0
            : orderCountByPublisher[Number(b.PublisherID)] || 0;

        if (countA < countB) return sortDirection === 'asc' ? -1 : 1;
        if (countA > countB) return sortDirection === 'asc' ? 1 : -1;
      } else {
        const valueA = sortColumn === 'name' ? String(a.PublisherName || '') : String(a.PublisherURL || '');
        const valueB = sortColumn === 'name' ? String(b.PublisherName || '') : String(b.PublisherURL || '');
        const normalizedA = valueA.toLowerCase();
        const normalizedB = valueB.toLowerCase();

        if (normalizedA < normalizedB) return sortDirection === 'asc' ? -1 : 1;
        if (normalizedA > normalizedB) return sortDirection === 'asc' ? 1 : -1;
      }

      const fallbackA = String(a.PublisherName || '').toLowerCase();
      const fallbackB = String(b.PublisherName || '').toLowerCase();
      return fallbackA.localeCompare(fallbackB);
    });

    return sorted;
  };

  const getSortIcon = (column: Exclude<SortColumn, null>) => {
    if (sortColumn !== column) return null;
    if (sortDirection === 'asc') return <ChevronUp className="w-4 h-4" />;
    if (sortDirection === 'desc') return <ChevronDown className="w-4 h-4" />;
    return null;
  };

  const sortedRecordValues = getSortedRecords();
  const sortedRecords = Array.isArray(sortedRecordValues) ? sortedRecordValues : [];

  return (
    <AdminLayout title="Publishers" subtitle="Use this screen to view, add, remove and modify the publishers in your collection.">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Button
            onClick={() => {
              setIsAdding(true);
              setEditingId(null);
            }}
            className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="w-4 h-4" />
            New Publisher
          </Button>
        </div>

        {isAdding || editingId !== null ? (
          <div className="mb-8 bg-white p-6 rounded-lg shadow">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                {editingId !== null ? 'Edit Publisher' : 'New Publisher'}
              </h2>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <RecordForm
              tableName={tableName}
              recordId={editingId ?? undefined}
              onClose={() => {
                setIsAdding(false);
                setEditingId(null);
              }}
              onSuccess={() => {
                setIsAdding(false);
                setEditingId(null);
                queryClient.invalidateQueries({ queryKey: ['table', tableName] });
              }}
            />
          </div>
        ) : null}

        {isLoading && <p className="text-gray-500">Loading...</p>}
        {error && <p className="text-red-600">Error loading records</p>}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-200 transition"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-2">
                    Name
                    {getSortIcon('name')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-200 transition"
                  onClick={() => handleSort('url')}
                >
                  <div className="flex items-center gap-2">
                    Publisher URL
                    {getSortIcon('url')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-right text-sm font-semibold cursor-pointer hover:bg-gray-200 transition"
                  onClick={() => handleSort('itemCount')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Item Count
                    {getSortIcon('itemCount')}
                  </div>
                </th>
                <th
                  className="px-6 py-3 text-right text-sm font-semibold cursor-pointer hover:bg-gray-200 transition"
                  onClick={() => handleSort('orderCount')}
                >
                  <div className="flex items-center justify-end gap-2">
                    Order Count
                    {getSortIcon('orderCount')}
                  </div>
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedRecords.map((record: Publisher) => (
                <tr key={record.PublisherID} className="hover:bg-gray-50">
                  <td className="px-6 py-4">{record.PublisherName}</td>
                  <td className="px-6 py-4">
                    {record.PublisherURL ? (
                      <a
                        href={record.PublisherURL}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:text-blue-700 underline break-all"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {record.PublisherURL}
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={buildPublisherInventoryLink(String(record.PublisherName || ''), false)}
                      className="text-blue-600 hover:text-blue-700 underline"
                      title={`View items for ${record.PublisherName || ''}`}
                    >
                      {(itemCountByPublisher[Number(record.PublisherID)] || 0).toLocaleString()}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={buildPublisherInventoryLink(String(record.PublisherName || ''), true)}
                      className="text-blue-600 hover:text-blue-700 underline"
                      title={`View owned items for ${record.PublisherName || ''}`}
                    >
                      {(orderCountByPublisher[Number(record.PublisherID)] || 0).toLocaleString()}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button
                      onClick={() => setEditingId(String(record.PublisherID))}
                      className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(String(record.PublisherID))}
                      className="inline-flex items-center gap-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Dialog
          open={!!deleteError}
          onOpenChange={(open) => {
            if (!open) {
              setDeleteError('');
            }
          }}
          title="Delete Failed"
          onClose={() => setDeleteError('')}
          contentClassName="max-w-lg"
        >
          <div className="space-y-4">
            <p className="text-sm text-red-700">{deleteError}</p>
            <div className="flex justify-end">
              <Button onClick={() => setDeleteError('')} className="bg-red-600 hover:bg-red-700">
                OK
              </Button>
            </div>
          </div>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
