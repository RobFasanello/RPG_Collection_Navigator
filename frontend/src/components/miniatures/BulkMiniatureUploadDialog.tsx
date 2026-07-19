import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import readXlsxFile from 'read-excel-file/browser';
import { Trash2 } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { tablesAPI } from '../../services/api';

type BulkField = 'CollectionName' | 'SubCategory' | 'Item' | 'MiniatureName' | 'Quantity' | 'Location';

type OptionItem = {
  value: string | number;
  label: string;
};

type ItemRecord = {
  ItemID: number;
  ItemName: string;
  CollectionID: number;
  SubTypeID: number;
};

type MiniatureRecord = {
  MiniatureID: number;
  ItemID?: number;
};

type UploadRow = {
  id: number;
  rowNumber: number;
  values: Record<BulkField, string>;
  errors: string[];
  success: boolean;
  isManual: boolean;
  resolvedItemId?: number;
  resolvedLocationId?: number | null;
};

type BulkMiniatureUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionOptions: OptionItem[];
  subTypeOptions: OptionItem[];
  locationOptions: OptionItem[];
  itemRecords: ItemRecord[];
  miniatureRecords: MiniatureRecord[];
  onMiniaturesAdded?: () => void;
};

const REQUIRED_ROW_FIELDS: BulkField[] = ['CollectionName', 'SubCategory', 'Item', 'MiniatureName', 'Quantity'];
const ALL_FIELDS: BulkField[] = ['CollectionName', 'SubCategory', 'Item', 'MiniatureName', 'Quantity', 'Location'];
const BULK_UPLOAD_MINIATURE_TEMPLATE_URL = '/templates/Bulk%20Upload%20Miniature%20Template.xlsx';
const BASE_SELECT_CLASS_NAME = 'mt-1 block w-full border rounded-md p-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const ERROR_FIELD_CLASS_NAME = 'border-red-500 bg-red-50 focus:ring-red-500';

const HEADER_ALIASES: Record<string, BulkField> = {
  collectionname: 'CollectionName',
  collection: 'CollectionName',
  subcategory: 'SubCategory',
  subtype: 'SubCategory',
  subcat: 'SubCategory',
  item: 'Item',
  itemname: 'Item',
  miniaturename: 'MiniatureName',
  miniature: 'MiniatureName',
  name: 'MiniatureName',
  quantity: 'Quantity',
  miniaturequantity: 'Quantity',
  location: 'Location',
  locationname: 'Location',
};

function normalizeHeader(value: unknown): string {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function emptyRowValues(): Record<BulkField, string> {
  return {
    CollectionName: '',
    SubCategory: '',
    Item: '',
    MiniatureName: '',
    Quantity: '',
    Location: '',
  };
}

function buildLookup(options: OptionItem[]) {
  const lookup = new Map<string, OptionItem[]>();
  options.forEach((option) => {
    const key = normalizeKey(String(option.label));
    if (!key) return;
    lookup.set(key, [...(lookup.get(key) || []), option]);
  });
  return lookup;
}

function getErrorFields(row: UploadRow): Set<BulkField> {
  const fields = new Set<BulkField>();

  row.errors.forEach((error) => {
    if (error.startsWith('Collection Name')) fields.add('CollectionName');
    if (error.startsWith('Sub Category')) fields.add('SubCategory');
    if (error.startsWith('Item') || error.startsWith('No matching item') || error.startsWith('Multiple matching items') || error.startsWith('A miniature record already exists')) fields.add('Item');
    if (error.startsWith('Miniature Name')) fields.add('MiniatureName');
    if (error.startsWith('Quantity')) fields.add('Quantity');
    if (error.startsWith('Location')) fields.add('Location');
  });

  return fields;
}

export default function BulkMiniatureUploadDialog({
  open,
  onOpenChange,
  collectionOptions,
  subTypeOptions,
  locationOptions,
  itemRecords,
  onMiniaturesAdded,
}: BulkMiniatureUploadDialogProps) {
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [removedCount, setRemovedCount] = useState(0);
  const [addedCount, setAddedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const collectionSelectOptions = useMemo(
    () => collectionOptions.map((option) => ({ value: String(option.label), label: String(option.label) })),
    [collectionOptions]
  );

  const subTypeSelectOptions = useMemo(
    () => subTypeOptions.map((option) => ({ value: String(option.label), label: String(option.label) })),
    [subTypeOptions]
  );

  const locationSelectOptions = useMemo(
    () => locationOptions.map((option) => ({ value: String(option.label), label: String(option.label) })),
    [locationOptions]
  );

  const collectionLookup = useMemo(() => buildLookup(collectionOptions), [collectionOptions]);
  const subTypeLookup = useMemo(() => buildLookup(subTypeOptions), [subTypeOptions]);
  const locationLookup = useMemo(() => buildLookup(locationOptions), [locationOptions]);

  const getItemSelectOptions = (row: UploadRow) => {
    const collectionMatches = collectionLookup.get(normalizeKey(row.values.CollectionName)) || [];
    const subTypeMatches = subTypeLookup.get(normalizeKey(row.values.SubCategory)) || [];
    const collectionId = collectionMatches.length === 1 ? Number(collectionMatches[0].value) : null;
    const subTypeId = subTypeMatches.length === 1 ? Number(subTypeMatches[0].value) : null;

    return itemRecords
      .filter((item) => collectionId === null || Number(item.CollectionID) === collectionId)
      .filter((item) => subTypeId !== null && Number(item.SubTypeID) === subTypeId)
      .map((item) => ({
        value: String(item.ItemName ?? '').trim(),
        label: String(item.ItemName ?? '').trim(),
        itemId: Number(item.ItemID),
      }))
      .filter((option) => option.value)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }) || a.itemId - b.itemId);
  };

  const recalculateRows = (nextRows: UploadRow[]) => {
    setRows(validateRows(nextRows));
  };

  const validateRows = (sourceRows: UploadRow[]) => {
    return sourceRows.map((row) => {
      if (row.success) {
        return { ...row, errors: [] };
      }

      const errors: string[] = [];
      REQUIRED_ROW_FIELDS.forEach((field) => {
        if (!row.values[field].trim()) {
          const label = field === 'CollectionName' ? 'Collection Name' : field === 'SubCategory' ? 'Sub Category' : field === 'MiniatureName' ? 'Miniature Name' : field;
          errors.push(`${label} is required.`);
        }
      });

      const collectionMatches = collectionLookup.get(normalizeKey(row.values.CollectionName)) || [];
      const subTypeMatches = subTypeLookup.get(normalizeKey(row.values.SubCategory)) || [];
      const locationMatches = row.values.Location.trim() ? locationLookup.get(normalizeKey(row.values.Location)) || [] : [];
      const quantity = parseInt(row.values.Quantity, 10);
      let resolvedItemId: number | undefined;
      let resolvedLocationId: number | null | undefined = null;

      if (row.values.CollectionName.trim() && collectionMatches.length === 0) {
        errors.push(`Collection Name "${row.values.CollectionName}" was not found.`);
      } else if (collectionMatches.length > 1) {
        errors.push(`Collection Name "${row.values.CollectionName}" matches multiple collections.`);
      }

      if (row.values.SubCategory.trim() && subTypeMatches.length === 0) {
        errors.push(`Sub Category "${row.values.SubCategory}" was not found.`);
      } else if (subTypeMatches.length > 1) {
        errors.push(`Sub Category "${row.values.SubCategory}" matches multiple sub categories.`);
      }

      if (!Number.isInteger(quantity) || quantity < 0) {
        errors.push('Quantity must be zero or greater.');
      }

      if (row.values.Location.trim()) {
        if (locationMatches.length === 0) {
          errors.push(`Location "${row.values.Location}" was not found.`);
        } else if (locationMatches.length > 1) {
          errors.push(`Location "${row.values.Location}" matches multiple locations.`);
        } else {
          resolvedLocationId = Number(locationMatches[0].value);
        }
      }

      if (collectionMatches.length === 1 && subTypeMatches.length === 1 && row.values.Item.trim()) {
        const collectionId = Number(collectionMatches[0].value);
        const subTypeId = Number(subTypeMatches[0].value);
        const itemMatches = itemRecords.filter(
          (item) =>
            Number(item.CollectionID) === collectionId &&
            Number(item.SubTypeID) === subTypeId &&
            normalizeKey(String(item.ItemName || '')) === normalizeKey(row.values.Item)
        );

        if (itemMatches.length === 0) {
          errors.push('No matching item exists for this Collection Name, Sub Category, and Item.');
        } else if (itemMatches.length > 1) {
          errors.push('Multiple matching items exist for this Collection Name, Sub Category, and Item.');
        } else {
          resolvedItemId = Number(itemMatches[0].ItemID);
        }
      }

      return {
        ...row,
        errors,
        resolvedItemId,
        resolvedLocationId,
      };
    });
  };

  useEffect(() => {
    if (!open) {
      setRows([]);
      setParseError('');
      setIsDragging(false);
      setRemovedCount(0);
      setAddedCount(0);
    }
  }, [open]);

  const readyRows = useMemo(() => rows.filter((row) => !row.success && row.errors.length === 0), [rows]);
  const invalidRows = useMemo(() => rows.filter((row) => !row.success && row.errors.length > 0), [rows]);

  const bulkAddMutation = useMutation({
    mutationFn: async (payloadRows: UploadRow[]) => {
      await Promise.all(
        payloadRows.map((row) => {
          const payload: Record<string, any> = {
            ItemID: row.resolvedItemId,
            MiniatureName: row.values.MiniatureName.trim(),
            MiniatureQuantity: parseInt(row.values.Quantity, 10),
          };

          if (row.resolvedLocationId !== null && row.resolvedLocationId !== undefined) {
            payload.LocationID = row.resolvedLocationId;
          }

          return tablesAPI.createRecord('Miniature', payload);
        })
      );
    },
    onSuccess: (_, payloadRows) => {
      const successfulIds = new Set(payloadRows.map((row) => row.id));

      setRows((current) =>
        current.map((row) =>
          successfulIds.has(row.id)
            ? { ...row, success: true, errors: [] }
            : row
        )
      );

      setAddedCount((current) => current + payloadRows.length);
      onMiniaturesAdded?.();
    },
    onError: (error: any) => {
      setParseError(error.response?.data?.error || error.message || 'Failed to add miniatures.');
    },
  });

  const parseFile = async (file: File) => {
    setParseError('');

    if (!/\.xlsx$/i.test(file.name)) {
      setParseError('Please select an Excel file (.xlsx).');
      return;
    }

    try {
      const sheets = await readXlsxFile(file);
      const sourceRows = sheets[0]?.data;
      if (!sourceRows) {
        setParseError('The selected file does not contain any worksheet.');
        return;
      }

      setRemovedCount(0);
      setAddedCount(0);

      const rawRows = sourceRows.map((row: unknown[]) => row.map((value: unknown) => normalizeText(value)));
      if (rawRows.length < 2) {
        setParseError('The file must include a header row and at least one data row.');
        return;
      }

      const columnIndexByField = new Map<BulkField, number>();
      rawRows[0].forEach((headerCell: string, index: number) => {
        const mappedField = HEADER_ALIASES[normalizeHeader(headerCell)];
        if (mappedField && !columnIndexByField.has(mappedField)) {
          columnIndexByField.set(mappedField, index);
        }
      });

      const missingRequired = REQUIRED_ROW_FIELDS.filter((field) => !columnIndexByField.has(field));
      if (missingRequired.length > 0) {
        const labels = missingRequired.map((field) => field === 'CollectionName' ? 'Collection Name' : field === 'SubCategory' ? 'Sub Category' : field === 'MiniatureName' ? 'Miniature Name' : field);
        setParseError(`Missing required column${labels.length === 1 ? '' : 's'}: ${labels.join(', ')}.`);
        return;
      }

      const parsedRows: UploadRow[] = [];
      for (let index = 1; index < rawRows.length; index += 1) {
        const sourceRow = rawRows[index] || [];
        const values = emptyRowValues();

        ALL_FIELDS.forEach((field) => {
          const columnIndex = columnIndexByField.get(field);
          values[field] = columnIndex === undefined ? '' : normalizeText(sourceRow[columnIndex]);
        });

        if (ALL_FIELDS.every((field) => !values[field])) {
          continue;
        }

        parsedRows.push({
          id: index,
          rowNumber: index,
          values,
          errors: [],
          success: false,
          isManual: false,
        });
      }

      if (parsedRows.length === 0) {
        setParseError('No data rows were found after the header row.');
        return;
      }

      recalculateRows(parsedRows);
    } catch (error: any) {
      setParseError(error.message || 'Failed to read the selected file.');
    }
  };

  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    parseFile(file);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  const handleCellChange = (rowId: number, field: BulkField, value: string) => {
    setParseError('');
    recalculateRows(rows.map((row) => {
      if (row.id !== rowId) {
        return row;
      }

      return {
        ...row,
        success: false,
        values: {
          ...row.values,
          [field]: value,
          ...(field === 'CollectionName' || field === 'SubCategory' ? { Item: '' } : {}),
        },
      };
    }));
  };

  const handleRemoveRow = (rowId: number) => {
    setParseError('');
    setRemovedCount((current) => current + 1);
    recalculateRows(rows.filter((row) => row.id !== rowId));
  };

  const handleAddBlankRow = () => {
    setParseError('');
    const nextId = rows.length ? Math.max(...rows.map((row) => row.id)) + 1 : 1;
    const nextRowNumber = rows.length ? Math.max(...rows.map((row) => row.rowNumber)) + 1 : 1;
    recalculateRows([
      ...rows,
      {
        id: nextId,
        rowNumber: nextRowNumber,
        values: emptyRowValues(),
        errors: [],
        success: false,
        isManual: true,
      },
    ]);
  };

  const handleAddMiniatures = () => {
    setParseError('');
    if (readyRows.length === 0) {
      setParseError('No valid rows are ready to add.');
      return;
    }
    bulkAddMutation.mutate(readyRows);
  };

  const getFieldClassName = (errorFields: Set<BulkField>, field: BulkField) => errorFields.has(field) ? ERROR_FIELD_CLASS_NAME : '';
  const getSelectClassName = (errorFields: Set<BulkField>, field: BulkField) => `${BASE_SELECT_CLASS_NAME} ${getFieldClassName(errorFields, field)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Bulk Upload Miniature Master" contentClassName="max-w-[95vw]" showCloseButton={false}>
      <div className="space-y-5">
        <div
          className={`rounded-lg border-2 border-dashed p-6 text-center transition ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
          }`}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragging(false);
          }}
          onDrop={handleDrop}
        >
          <p className="text-sm text-gray-700">Drag and drop an Excel file here</p>
          <p className="text-xs text-gray-500 mt-1">Accepted format: .xlsx</p>
          <div className="mt-3">
            <Button type="button" className="bg-blue-600 hover:bg-blue-700" onClick={handleSelectFile}>
              Select File
            </Button>
            <input ref={fileInputRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileInputChange} />
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Required columns: Collection Name, Sub Category, Item, Miniature Name, and Quantity. Item must match an existing Item for the selected Collection Name and Sub Category. Location is optional, but when provided it must match an existing Location.
          <div className="mt-2">
            <a href={BULK_UPLOAD_MINIATURE_TEMPLATE_URL} download target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 underline hover:text-blue-800">
              Download Bulk Upload Miniatures Template
            </a>
          </div>
        </div>

        {parseError ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{parseError}</div> : null}

        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700">
          <span>Total rows: {rows.length}</span>
          <span>Ready: {readyRows.length}</span>
          <span>Invalid: {invalidRows.length}</span>
          <span>Added: {addedCount}</span>
          <span>Removed: {removedCount}</span>
        </div>

        <div className="max-h-[50vh] overflow-auto rounded-lg border border-gray-200">
          <Table className="min-w-[1300px]">
            <TableHeader>
              <TableRow>
                <TableHead>Row</TableHead>
                <TableHead>Collection Name</TableHead>
                <TableHead>Sub Category</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Miniature Name</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-gray-500">
                    Upload a file to preview and validate rows.
                  </TableCell>
                </TableRow>
              ) : rows.map((row) => {
                const errorFields = getErrorFields(row);
                const itemSelectOptions = getItemSelectOptions(row);
                return (
                  <TableRow key={row.id} className={row.success ? 'bg-green-50' : ''}>
                    <TableCell className="whitespace-nowrap align-top">{row.rowNumber}</TableCell>
                    <TableCell className="align-top">
                      <select value={row.values.CollectionName} onChange={(event) => handleCellChange(row.id, 'CollectionName', event.target.value)} disabled={row.success} className={getSelectClassName(errorFields, 'CollectionName')}>
                        <option value="">Select collection</option>
                        {collectionSelectOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </TableCell>
                    <TableCell className="align-top">
                      <select value={row.values.SubCategory} onChange={(event) => handleCellChange(row.id, 'SubCategory', event.target.value)} disabled={row.success} className={getSelectClassName(errorFields, 'SubCategory')}>
                        <option value="">Select sub category</option>
                        {subTypeSelectOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </TableCell>
                    <TableCell className="align-top">
                      <select value={row.values.Item} onChange={(event) => handleCellChange(row.id, 'Item', event.target.value)} disabled={row.success} className={getSelectClassName(errorFields, 'Item')}>
                        <option value="">Select item</option>
                        {itemSelectOptions.map((option) => <option key={`${option.itemId}-${option.value}`} value={option.value}>{option.label}</option>)}
                      </select>
                    </TableCell>
                    <TableCell className="align-top">
                      <Input value={row.values.MiniatureName} onChange={(event) => handleCellChange(row.id, 'MiniatureName', event.target.value)} disabled={row.success} placeholder="Miniature name" className={getFieldClassName(errorFields, 'MiniatureName')} />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input type="number" min="0" value={row.values.Quantity} onChange={(event) => handleCellChange(row.id, 'Quantity', event.target.value)} disabled={row.success} className={getFieldClassName(errorFields, 'Quantity')} />
                    </TableCell>
                    <TableCell className="align-top">
                      <select value={row.values.Location} onChange={(event) => handleCellChange(row.id, 'Location', event.target.value)} disabled={row.success} className={getSelectClassName(errorFields, 'Location')}>
                        <option value="">Blank</option>
                        {locationSelectOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </TableCell>
                    <TableCell className="align-top">
                      {row.success ? (
                        <span className="text-green-700">Added</span>
                      ) : row.errors.length > 0 ? (
                        <div className="space-y-1 text-xs">
                          {row.errors.map((errorMessage) => <div key={`${row.id}-${errorMessage}`} className="text-red-700">{errorMessage}</div>)}
                        </div>
                      ) : <div className="font-medium text-green-700 text-xs">Ready</div>}
                    </TableCell>
                    <TableCell className="align-top text-right">
                      <button type="button" onClick={() => handleRemoveRow(row.id)} className="inline-flex items-center text-red-600 hover:text-red-700" aria-label={`Remove row ${row.rowNumber}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button type="button" className="bg-blue-600 hover:bg-blue-700" onClick={handleAddBlankRow} disabled={bulkAddMutation.isLoading}>
              Add New Row
            </Button>
            <Button type="button" className="bg-green-600 hover:bg-green-700" onClick={handleAddMiniatures} disabled={bulkAddMutation.isLoading || readyRows.length === 0}>
              {bulkAddMutation.isLoading ? 'Uploading Miniatures...' : `Upload Miniatures (${readyRows.length})`}
            </Button>
          </div>

          <Button type="button" className="bg-gray-600 hover:bg-gray-700" onClick={() => onOpenChange(false)} disabled={bulkAddMutation.isLoading}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
