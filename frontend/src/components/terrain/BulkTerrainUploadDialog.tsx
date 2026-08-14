import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import readXlsxFile from 'read-excel-file/browser';
import { Trash2 } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import ComboSelect from '../ui/ComboSelect';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { tablesAPI } from '../../services/api';

type BulkField = 'Item' | 'TerrainName' | 'TerrainCode' | 'TerrainQuantity' | 'Location';

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

type TerrainRecord = {
  TerrainID: number;
  ItemID?: number;
  TerrainName?: string;
};

type UploadRow = {
  id: number;
  rowNumber: number;
  values: Record<BulkField, string>;
  errors: string[];
  success: boolean;
  isManual: boolean;
  resolvedItemId?: number;
  resolvedLocationId?: number;
};

type BulkTerrainUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationOptions: OptionItem[];
  itemRecords: ItemRecord[];
  terrainRecords: TerrainRecord[];
  onTerrainsAdded?: () => void;
};

const REQUIRED_ROW_FIELDS: BulkField[] = ['Item', 'TerrainName', 'TerrainQuantity'];
const ALL_FIELDS: BulkField[] = ['Item', 'TerrainName', 'TerrainCode', 'TerrainQuantity', 'Location'];
const BULK_UPLOAD_TERRAIN_TEMPLATE_URL = '/templates/Bulk%20Upload%20Terrain%20Template.xlsx';
const BASE_SELECT_CLASS_NAME =
  'text-sm';
const ERROR_FIELD_CLASS_NAME = 'border-red-500 bg-red-50 focus:ring-red-500';

const HEADER_ALIASES: Record<string, BulkField> = {
  item: 'Item',
  itemname: 'Item',
  terrainname: 'TerrainName',
  terrain: 'TerrainName',
  name: 'TerrainName',
  terraincode: 'TerrainCode',
  code: 'TerrainCode',
  terrainquantity: 'TerrainQuantity',
  quantity: 'TerrainQuantity',
  location: 'Location',
  locationname: 'Location',
};

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function emptyRowValues(): Record<BulkField, string> {
  return {
    Item: '',
    TerrainName: '',
    TerrainCode: '',
    TerrainQuantity: '',
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
    if (
      error.startsWith('Item') ||
      error.startsWith('No matching item') ||
      error.startsWith('Multiple matching items') ||
      error.startsWith('A terrain record already exists')
    ) {
      fields.add('Item');
    }
    if (error.startsWith('Terrain Name')) fields.add('TerrainName');
    if (error.startsWith('Terrain Code')) fields.add('TerrainCode');
    if (error.startsWith('Terrain Quantity')) fields.add('TerrainQuantity');
    if (error.startsWith('Location')) fields.add('Location');
  });

  return fields;
}

export default function BulkTerrainUploadDialog({
  open,
  onOpenChange,
  locationOptions,
  itemRecords,
  terrainRecords,
  onTerrainsAdded,
}: BulkTerrainUploadDialogProps) {
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [removedCount, setRemovedCount] = useState(0);
  const [addedCount, setAddedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const locationSelectOptions = useMemo(
    () => locationOptions.map((option) => ({ value: String(option.label), label: String(option.label) })),
    [locationOptions]
  );

  const locationLookup = useMemo(() => buildLookup(locationOptions), [locationOptions]);

  const terrainNameByItemId = useMemo(() => {
    const lookup: Record<number, Set<string>> = {};
    terrainRecords.forEach((terrain) => {
      const itemId = Number(terrain.ItemID);
      const terrainName = normalizeKey(String(terrain.TerrainName ?? ''));
      if (!Number.isInteger(itemId) || itemId <= 0 || !terrainName) {
        return;
      }

      if (!lookup[itemId]) {
        lookup[itemId] = new Set<string>();
      }
      lookup[itemId].add(terrainName);
    });

    return lookup;
  }, [terrainRecords]);

  const getItemSelectOptions = () => {
    return itemRecords
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
          const label =
            field === 'TerrainName'
              ? 'Terrain Name'
              : field === 'TerrainQuantity'
                ? 'Terrain Quantity'
                : field;
          errors.push(`${label} is required.`);
        }
      });

      let resolvedItemId: number | undefined;
      let resolvedLocationId: number | undefined;
      const quantity = parseInt(row.values.TerrainQuantity, 10);

      if (!Number.isInteger(quantity) || quantity < 0) {
        errors.push('Terrain Quantity must be zero or greater.');
      }

      if (row.values.Item.trim()) {
        const itemMatches = itemRecords.filter(
          (item) => normalizeKey(String(item.ItemName || '')) === normalizeKey(row.values.Item)
        );

        if (itemMatches.length === 0) {
          errors.push('No matching item exists for this Item.');
        } else if (itemMatches.length > 1) {
          errors.push('Multiple matching items exist for this Item.');
        } else {
          resolvedItemId = Number(itemMatches[0].ItemID);
        }
      }

      if (row.values.Location.trim()) {
        const locationMatches = locationLookup.get(normalizeKey(row.values.Location)) || [];
        if (locationMatches.length === 0) {
          errors.push(`Location "${row.values.Location}" was not found.`);
        } else if (locationMatches.length > 1) {
          errors.push(`Location "${row.values.Location}" matches multiple locations.`);
        } else {
          resolvedLocationId = Number(locationMatches[0].value);
        }
      }

      const terrainName = normalizeKey(row.values.TerrainName);
      if (resolvedItemId && terrainNameByItemId[resolvedItemId]?.has(terrainName)) {
        errors.push('A terrain record already exists for this item and terrain name.');
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
          const terrainCode = row.values.TerrainCode.trim();
          const payload: Record<string, any> = {
            ItemID: row.resolvedItemId,
            TerrainName: row.values.TerrainName.trim(),
            TerrainQuantity: parseInt(row.values.TerrainQuantity, 10),
          };

          if (terrainCode) {
            payload.TerrainCode = terrainCode;
          }

          if (Number.isInteger(row.resolvedLocationId) && Number(row.resolvedLocationId) > 0) {
            payload.LocationID = row.resolvedLocationId;
          }

          return tablesAPI.createRecord('Terrain', payload);
        })
      );
    },
    onSuccess: (_, payloadRows) => {
      const successfulIds = new Set(payloadRows.map((row) => row.id));

      setRows((current) =>
        current.map((row) => (successfulIds.has(row.id) ? { ...row, success: true, errors: [] } : row))
      );

      setAddedCount((current) => current + payloadRows.length);
      onTerrainsAdded?.();
    },
    onError: (error: any) => {
      setParseError(error.response?.data?.error || error.message || 'Failed to add terrain records.');
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
        const labels = missingRequired.map((field) => (field === 'TerrainName' ? 'Terrain Name' : field));
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
    recalculateRows(
      rows.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        return {
          ...row,
          success: false,
          values: {
            ...row.values,
            [field]: value,
          },
        };
      })
    );
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

  const handleAddTerrains = () => {
    setParseError('');
    if (readyRows.length === 0) {
      setParseError('No valid rows are ready to add.');
      return;
    }
    bulkAddMutation.mutate(readyRows);
  };

  const getFieldClassName = (errorFields: Set<BulkField>, field: BulkField) =>
    errorFields.has(field) ? ERROR_FIELD_CLASS_NAME : '';
  const getSelectClassName = (errorFields: Set<BulkField>, field: BulkField) =>
    `${BASE_SELECT_CLASS_NAME} ${getFieldClassName(errorFields, field)}`;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Bulk Upload Terrain Master"
      contentClassName="max-w-[95vw]"
      showCloseButton={false}
    >
      <div className="space-y-5">
        <div
          className={`rounded-lg border-2 border-dashed p-6 text-center transition ${
            isDragging ? 'border-[var(--arcane-gold-500)] bg-[#b886481a]' : 'border-[var(--arcane-border-light)] bg-[var(--arcane-paper)]'
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
          <p className="text-sm text-[var(--arcane-ink-900)]">Drag and drop an Excel file here</p>
          <p className="text-xs text-[var(--arcane-ink-soft)] mt-1">Accepted format: .xlsx</p>
          <div className="mt-3">
            <Button type="button" className="bg-[var(--arcane-gold-500)] hover:bg-[var(--arcane-gold-300)]" onClick={handleSelectFile}>
              Select File
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={handleFileInputChange}
            />
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Required columns: Item, Terrain Name, and Terrain Quantity. Item and Location must match existing values when provided. Terrain Code and Location are optional.
          <div className="mt-2">
            <a
              href={BULK_UPLOAD_TERRAIN_TEMPLATE_URL}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[var(--arcane-gold-700)] underline hover:text-[var(--arcane-gold-600)]"
            >
              Download Bulk Upload Template
            </a>
          </div>
        </div>

        {parseError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{parseError}</div>
        ) : null}

        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] p-3 text-sm text-[var(--arcane-ink-900)]">
          <span>Total rows: {rows.length}</span>
          <span>Ready: {readyRows.length}</span>
          <span>Invalid: {invalidRows.length}</span>
          <span>Added: {addedCount}</span>
          <span>Removed: {removedCount}</span>
        </div>

        <div className="max-h-[50vh] overflow-auto rounded-lg border border-[var(--arcane-border-light)]">
          <Table className="min-w-[1000px]">
            <TableHeader>
              <TableRow>
                <TableHead>Row</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Terrain Name</TableHead>
                <TableHead>Terrain Code</TableHead>
                <TableHead>Terrain Quantity</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-[var(--arcane-ink-soft)]">
                    Upload a file to preview and validate rows.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const errorFields = getErrorFields(row);
                  const itemSelectOptions = getItemSelectOptions();
                  return (
                    <TableRow key={row.id} className={row.success ? 'bg-green-50' : ''}>
                      <TableCell className="whitespace-nowrap align-top">{row.rowNumber}</TableCell>
                      <TableCell className="align-top">
                        <ComboSelect
                          options={itemSelectOptions.map((option) => ({ value: option.value, label: option.label }))}
                          value={row.values.Item}
                          onChange={(value) => handleCellChange(row.id, 'Item', value)}
                          disabled={row.success}
                          placeholder="Select item"
                          className="w-full"
                          triggerClassName={getSelectClassName(errorFields, 'Item')}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          value={row.values.TerrainName}
                          onChange={(event) => handleCellChange(row.id, 'TerrainName', event.target.value)}
                          disabled={row.success}
                          placeholder="Terrain name"
                          className={getFieldClassName(errorFields, 'TerrainName')}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          value={row.values.TerrainCode}
                          onChange={(event) => handleCellChange(row.id, 'TerrainCode', event.target.value)}
                          disabled={row.success}
                          placeholder="Optional code"
                          className={getFieldClassName(errorFields, 'TerrainCode')}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <Input
                          type="number"
                          min="0"
                          value={row.values.TerrainQuantity}
                          onChange={(event) => handleCellChange(row.id, 'TerrainQuantity', event.target.value)}
                          disabled={row.success}
                          placeholder="Quantity"
                          className={getFieldClassName(errorFields, 'TerrainQuantity')}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        <ComboSelect
                          options={locationSelectOptions}
                          value={row.values.Location}
                          onChange={(value) => handleCellChange(row.id, 'Location', value)}
                          disabled={row.success}
                          placeholder="Select location"
                          className="w-full"
                          triggerClassName={getSelectClassName(errorFields, 'Location')}
                        />
                      </TableCell>
                      <TableCell className="align-top">
                        {row.success ? (
                          <span className="text-green-700">Added</span>
                        ) : row.errors.length > 0 ? (
                          <div className="space-y-1 text-xs">
                            {row.errors.map((errorMessage) => (
                              <div key={`${row.id}-${errorMessage}`} className="text-red-700">
                                {errorMessage}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="font-medium text-green-700 text-xs">Ready</div>
                        )}
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.id)}
                          className="inline-flex items-center text-red-600 hover:text-red-700"
                          aria-label={`Remove row ${row.rowNumber}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              className="bg-[var(--arcane-gold-500)] hover:bg-[var(--arcane-gold-300)]"
              onClick={handleAddBlankRow}
              disabled={bulkAddMutation.isLoading}
            >
              Add New Row
            </Button>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              className="!bg-[var(--arcane-ink-700)] hover:!bg-[var(--arcane-ink-800)] !text-white"
              onClick={() => onOpenChange(false)}
              disabled={bulkAddMutation.isLoading}
            >
              Close
            </Button>
            <Button
              type="button"
              className="bg-green-600 hover:bg-green-700"
              onClick={handleAddTerrains}
              disabled={bulkAddMutation.isLoading || readyRows.length === 0}
            >
              {bulkAddMutation.isLoading ? 'Uploading Terrain...' : `Upload Terrain (${readyRows.length})`}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
