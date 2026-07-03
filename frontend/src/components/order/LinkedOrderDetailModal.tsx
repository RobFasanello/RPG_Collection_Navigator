import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2 } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { tablesAPI } from '../../services/api';

export interface LinkedPurchaseOrder {
  PurchaseOrderID: number;
  StoreName: string;
  InvoiceNumber: string;
  PurchaseDate: string;
  StatusID?: number | null;
  StatusName?: string | null;
  ItemCount: number;
  TotalAmount: number;
  PurchaseOrderDetailID?: number;
}

interface PurchaseOrderDetail {
  PurchaseOrderDetailID: number;
  ItemID: number;
  ItemName: string;
  ProductID: string;
  Quantity: number;
  Price: number;
  LineTotal: number;
}

interface DetailEditValues {
  Quantity: string;
  Price: string;
}

interface LinkedOrderDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: LinkedPurchaseOrder | null;
  targetItemId?: number | null;
  onClose?: () => void;
}

export default function LinkedOrderDetailModal({
  open,
  onOpenChange,
  order,
  targetItemId,
  onClose,
}: LinkedOrderDetailModalProps) {
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailEdits, setDetailEdits] = useState<Record<number, DetailEditValues>>({});
  const [editingDetailRows, setEditingDetailRows] = useState<Record<number, boolean>>({});
  const [autofocusKey, setAutofocusKey] = useState<string>('');
  const queryClient = useQueryClient();

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setDetailError(null);
      setDetailEdits({});
      setEditingDetailRows({});
      setAutofocusKey('');
      if (onClose) {
        onClose();
      }
    }
  };

  const parseDateParts = (value?: string | Date | null) => {
    if (!value) {
      return null;
    }

    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        return null;
      }
      return {
        year: value.getUTCFullYear(),
        month: value.getUTCMonth() + 1,
        day: value.getUTCDate(),
      };
    }

    const raw = String(value).trim();
    if (!raw) {
      return null;
    }

    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) {
      return {
        year: Number(iso[1]),
        month: Number(iso[2]),
        day: Number(iso[3]),
      };
    }

    const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdy) {
      return {
        year: Number(mdy[3]),
        month: Number(mdy[1]),
        day: Number(mdy[2]),
      };
    }

    return null;
  };

  const formatPurchaseDate = (date?: string) => {
    const parts = parseDateParts(date);
    if (!parts) {
      return date || '-';
    }

    return `${String(parts.month).padStart(2, '0')}/${String(parts.day).padStart(2, '0')}/${parts.year}`;
  };

  const formatCurrency = (amount?: number) => {
    if (amount === null || amount === undefined) {
      return '-';
    }
    return `$${amount.toFixed(2)}`;
  };

  const { data: purchaseOrderDetailsData, isLoading: purchaseOrderDetailsLoading } = useQuery<
    { data: PurchaseOrderDetail[]; total: number },
    Error
  >({
    queryKey: ['purchaseOrderDetailsByPurchaseOrder', order?.PurchaseOrderID],
    queryFn: async () => {
      if (!order) {
        return { data: [], total: 0 };
      }
      const response = await tablesAPI.getPurchaseOrderDetailsByPurchaseOrder(order.PurchaseOrderID);
      return response.data;
    },
    enabled: open && !!order,
  });

  const updateDetailMutation = useMutation({
    mutationFn: async (payload: { detailId: number; Quantity: number; Price: number }) => {
      return tablesAPI.updateRecord('PurchaseOrderDetail', payload.detailId, {
        Quantity: payload.Quantity,
        Price: payload.Price,
      });
    },
    onSuccess: () => {
      if (order?.PurchaseOrderID) {
        queryClient.invalidateQueries({ queryKey: ['purchaseOrderDetailsByPurchaseOrder', order.PurchaseOrderID] });
      }
      queryClient.invalidateQueries({ queryKey: ['purchaseOrdersByItem', targetItemId] });
      queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] });
      setDetailError(null);
    },
    onError: (error: any) => {
      setDetailError(error.response?.data?.error || error.message || 'Failed to update purchase order detail');
    },
  });

  const purchaseOrderDetails = useMemo(() => purchaseOrderDetailsData?.data || [], [purchaseOrderDetailsData]);

  useEffect(() => {
    if (!open || !order || !purchaseOrderDetails.length) {
      return;
    }

    const nextAutofocusKey = `${order.PurchaseOrderID}:${targetItemId || ''}:${order.PurchaseOrderDetailID || ''}`;
    if (autofocusKey === nextAutofocusKey) {
      return;
    }

    let targetDetail = purchaseOrderDetails.find(
      (detail) => order.PurchaseOrderDetailID && detail.PurchaseOrderDetailID === order.PurchaseOrderDetailID
    );

    if (!targetDetail && targetItemId) {
      targetDetail = purchaseOrderDetails.find((detail) => detail.ItemID === targetItemId);
    }

    if (!targetDetail) {
      return;
    }

    setAutofocusKey(nextAutofocusKey);
    setEditingDetailRows((current) => ({
      ...current,
      [targetDetail!.PurchaseOrderDetailID]: true,
    }));
    setDetailEdits((current) => ({
      ...current,
      [targetDetail!.PurchaseOrderDetailID]: {
        Quantity: String(targetDetail!.Quantity),
        Price: String(targetDetail!.Price),
      },
    }));
  }, [open, order, purchaseOrderDetails, targetItemId, autofocusKey]);

  const handleDetailFieldChange = (detailId: number, field: keyof DetailEditValues, value: string) => {
    setDetailEdits((current) => ({
      ...current,
      [detailId]: {
        ...(current[detailId] || { Quantity: '1', Price: '' }),
        [field]: value,
      },
    }));
  };

  const handleStartDetailEdit = (detail: PurchaseOrderDetail) => {
    setEditingDetailRows((current) => ({
      ...current,
      [detail.PurchaseOrderDetailID]: true,
    }));
    setDetailEdits((current) => ({
      ...current,
      [detail.PurchaseOrderDetailID]: {
        Quantity: String(detail.Quantity),
        Price: String(detail.Price),
      },
    }));
  };

  const handleCancelDetailEdit = (detail: PurchaseOrderDetail) => {
    setEditingDetailRows((current) => ({
      ...current,
      [detail.PurchaseOrderDetailID]: false,
    }));
    setDetailEdits((current) => ({
      ...current,
      [detail.PurchaseOrderDetailID]: {
        Quantity: String(detail.Quantity),
        Price: String(detail.Price),
      },
    }));
  };

  const handleSaveDetail = (detailId: number) => {
    const edit = detailEdits[detailId];
    if (!edit) {
      return;
    }

    const quantity = Number(edit.Quantity);
    const price = Number(edit.Price);

    if (quantity <= 0 || price < 0 || Number.isNaN(quantity) || Number.isNaN(price)) {
      setDetailError('Please provide valid Quantity and Price values.');
      return;
    }

    updateDetailMutation.mutate(
      {
        detailId,
        Quantity: quantity,
        Price: price,
      },
      {
        onSuccess: () => {
          setEditingDetailRows((current) => ({
            ...current,
            [detailId]: false,
          }));
        },
      }
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      contentClassName="max-w-6xl"
      title={order ? `Order #${order.InvoiceNumber} - ${order.StoreName}` : 'Order Details'}
    >
      {order ? (
        <div className="space-y-6">
          {detailError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800">{detailError}</p>
            </div>
          )}

          <div className="grid gap-4 pb-4 border-b grid-cols-2 md:grid-cols-5">
            <div>
              <p className="text-sm text-gray-600">Invoice Number</p>
              <p className="font-semibold">{order.InvoiceNumber}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Store</p>
              <p className="font-semibold">{order.StoreName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Purchase Date</p>
              <p className="font-semibold">{formatPurchaseDate(order.PurchaseDate)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="font-semibold">{order.StatusName || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="font-semibold text-blue-600">{formatCurrency(order.TotalAmount)}</p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Purchase Order Details</h3>
            {purchaseOrderDetailsLoading ? (
              <p className="text-gray-500">Loading purchase order details...</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Product ID</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right w-28">Price</TableHead>
                      <TableHead className="text-right">Line Total</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseOrderDetails.length ? (
                      <>
                        {purchaseOrderDetails.map((detail) => {
                          const editValues = detailEdits[detail.PurchaseOrderDetailID];
                          const isEditing = !!editingDetailRows[detail.PurchaseOrderDetailID];
                          const quantity = Number(editValues?.Quantity ?? detail.Quantity) || 0;
                          const price = Number(editValues?.Price ?? detail.Price) || 0;

                          return (
                            <TableRow key={detail.PurchaseOrderDetailID}>
                              <TableCell>{detail.ItemName || `Item #${detail.ItemID}`}</TableCell>
                              <TableCell>{detail.ProductID || '-'}</TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={2}
                                  pattern="[0-9]{0,2}"
                                  value={editValues?.Quantity ?? String(detail.Quantity)}
                                  onChange={(e) => {
                                    const next = e.target.value.replace(/\D/g, '').slice(0, 2);
                                    handleDetailFieldChange(detail.PurchaseOrderDetailID, 'Quantity', next);
                                  }}
                                  disabled={!isEditing}
                                  className="w-16 ml-auto text-right"
                                />
                              </TableCell>
                              <TableCell className="text-right w-28">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={editValues?.Price ?? String(detail.Price)}
                                  onChange={(e) => handleDetailFieldChange(detail.PurchaseOrderDetailID, 'Price', e.target.value)}
                                  disabled={!isEditing}
                                  className="w-24 ml-auto text-right"
                                />
                              </TableCell>
                              <TableCell className="text-right font-semibold">{formatCurrency(quantity * price)}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  {isEditing ? (
                                    <>
                                      <Button
                                        className="bg-blue-600 hover:bg-blue-700"
                                        onClick={() => handleSaveDetail(detail.PurchaseOrderDetailID)}
                                        disabled={updateDetailMutation.isPending}
                                      >
                                        {updateDetailMutation.isPending ? 'Saving...' : 'Save'}
                                      </Button>
                                      <Button
                                        className="bg-gray-600 hover:bg-gray-700"
                                        onClick={() => handleCancelDetailEdit(detail)}
                                        disabled={updateDetailMutation.isPending}
                                      >
                                        Cancel
                                      </Button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => handleStartDetailEdit(detail)}
                                      className="inline-flex items-center justify-center text-blue-600 hover:text-blue-700"
                                      title="Edit purchase order detail"
                                      type="button"
                                    >
                                      <Edit2 className="w-5 h-5" />
                                    </button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="bg-gray-50 font-semibold">
                          <TableCell colSpan={4} className="text-right">Total:</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(
                              purchaseOrderDetails.reduce((sum, detail) => {
                                const editValues = detailEdits[detail.PurchaseOrderDetailID];
                                const quantity = Number(editValues?.Quantity ?? detail.Quantity) || 0;
                                const price = Number(editValues?.Price ?? detail.Price) || 0;
                                return sum + quantity * price;
                              }, 0)
                            )}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </>
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                          No purchase order details found for this order.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
