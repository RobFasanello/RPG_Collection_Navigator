import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import readXlsxFile from 'read-excel-file/browser';
import { Trash2 } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { tablesAPI } from '../../services/api';

type BulkField = 'Publisher' | 'Collection' | 'ItemName' | 'Category' | 'SubCategory' | 'ProductID' | 'ReleaseDate';

interface UploadRow {
  id: number;
  rowNumber: number;
  values: Record<BulkField, string>;
  errors: string[];
  success: boolean;
  duplicateCheckRequested: boolean;
}

interface OptionItem {
  value: string | number;
  label: string;
}

interface SelectOption {
  value: string;
  label: string;
}

interface BulkItemUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  publisherOptions: OptionItem[];
  collectionOptions: OptionItem[];
  categoryOptions: OptionItem[];
  subTypeOptions: OptionItem[];
  onItemsAdded?: () => void;
}

interface BulkCreateResult {
  insertedCount: number;
  totalRows: number;
  rowResults: Array<{
    rowNumber: number;
    success: boolean;
    errors: string[];
  }>;
}

const REQUIRED_FIELDS: BulkField[] = ['Publisher', 'Collection', 'ItemName', 'Category', 'SubCategory', 'ProductID'];
const ALL_FIELDS: BulkField[] = [
  'Publisher',
  'Collection',
  'ItemName',
  'Category',
  'SubCategory',
  'ProductID',
  'ReleaseDate',
];

const HEADER_ALIASES: Record<string, BulkField> = {
  publisher: 'Publisher',
  publishers: 'Publisher',
  collection: 'Collection',
  collections: 'Collection',
  itemname: 'ItemName',
  item: 'ItemName',
  itemnames: 'ItemName',
  category: 'Category',
  categories: 'Category',
  subcategory: 'SubCategory',
  subtype: 'SubCategory',
  subcat: 'SubCategory',
  'sub type': 'SubCategory',
  productid: 'ProductID',
  product: 'ProductID',
  sku: 'ProductID',
  releasedate: 'ReleaseDate',
  release: 'ReleaseDate',
  'release date': 'ReleaseDate',
};

const BULK_UPLOAD_TEMPLATE_URL = '/templates/Bulk%20Upload%20Template.xlsx';

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function parseDateForUpload(value: string): { normalized: string; error?: string } {
  const raw = value.trim();
  if (!raw) {
    return { normalized: '' };
  }

  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    const candidate = new Date(year, month - 1, day);
    if (
      candidate.getFullYear() === year &&
      candidate.getMonth() === month - 1 &&
      candidate.getDate() === day
    ) {
      return { normalized: raw };
    }
    return { normalized: raw, error: 'Release Date is invalid.' };
  }

  const mdy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const month = Number(mdy[1]);
    const day = Number(mdy[2]);
    const year = Number(mdy[3]);
    const candidate = new Date(year, month - 1, day);
    if (
      candidate.getFullYear() === year &&
      candidate.getMonth() === month - 1 &&
      candidate.getDate() === day
    ) {
      const normalized = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      return { normalized };
    }
    return { normalized: raw, error: 'Release Date is invalid.' };
  }

  return { normalized: raw, error: 'Release Date must be YYYY-MM-DD or MM/DD/YYYY.' };
}

function buildRowValidation(
  rows: UploadRow[],
  publisherOptions: OptionItem[],
  collectionOptions: OptionItem[],
  categoryOptions: OptionItem[],
  subTypeOptions: OptionItem[]
): UploadRow[] {
  const publisherNames = new Set(publisherOptions.map((option) => normalizeKey(option.label)));
  const collectionNames = new Set(collectionOptions.map((option) => normalizeKey(option.label)));
  const categoryNames = new Set(categoryOptions.map((option) => normalizeKey(option.label)));
  const subTypeNames = new Set(subTypeOptions.map((option) => normalizeKey(option.label)));
  const duplicateMap = new Map<string, number>();

  rows.forEach((row) => {
    if (row.success) {
      return;
    }
    const itemKey = `${normalizeKey(row.values.ItemName)}::${normalizeKey(row.values.ProductID)}`;
    if (!itemKey || itemKey === '::') {
      return;
    }
    duplicateMap.set(itemKey, (duplicateMap.get(itemKey) || 0) + 1);
  });

  return rows.map((row) => {
    if (row.success) {
      return { ...row, errors: [] };
    }

    const nextErrors: string[] = [];

    REQUIRED_FIELDS.forEach((field) => {
      if (!row.values[field].trim()) {
        nextErrors.push(`${field} is required.`);
      }
    });

    if (row.values.Publisher.trim() && !publisherNames.has(normalizeKey(row.values.Publisher))) {
      nextErrors.push(`Publisher "${row.values.Publisher}" was not found.`);
    }

    if (row.values.Collection.trim() && !collectionNames.has(normalizeKey(row.values.Collection))) {
      nextErrors.push(`Collection "${row.values.Collection}" was not found.`);
    }

    if (row.values.Category.trim() && !categoryNames.has(normalizeKey(row.values.Category))) {
      nextErrors.push(`Category "${row.values.Category}" was not found.`);
    }

    if (row.values.SubCategory.trim() && !subTypeNames.has(normalizeKey(row.values.SubCategory))) {
      nextErrors.push(`SubCategory "${row.values.SubCategory}" was not found.`);
    }

    const dateParse = parseDateForUpload(row.values.ReleaseDate);
    if (dateParse.error) {
      nextErrors.push(dateParse.error);
    }

    const duplicateKey = `${normalizeKey(row.values.ItemName)}::${normalizeKey(row.values.ProductID)}`;
    if (duplicateKey !== '::' && (duplicateMap.get(duplicateKey) || 0) > 1) {
      nextErrors.push('Duplicate ItemName and ProductID exists in this upload file.');
    }

    return {
      ...row,
      values: {
        ...row.values,
        ReleaseDate: dateParse.normalized,
      },
      errors: nextErrors,
    };
  });
}

function emptyRowValues(): Record<BulkField, string> {
  return {
    Publisher: '',
    Collection: '',
    ItemName: '',
    Category: '',
    SubCategory: '',
    ProductID: '',
    ReleaseDate: '',
  };
}

export default function BulkItemUploadDialog({
  open,
  onOpenChange,
  publisherOptions,
  collectionOptions,
  categoryOptions,
  subTypeOptions,
  onItemsAdded,
}: BulkItemUploadDialogProps) {
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [removedCount, setRemovedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const publisherSelectOptions = useMemo<SelectOption[]>(
    () => publisherOptions.map((option) => ({ value: String(option.label), label: String(option.label) })),
    [publisherOptions]
  );

  const collectionSelectOptions = useMemo<SelectOption[]>(
    () => collectionOptions.map((option) => ({ value: String(option.label), label: String(option.label) })),
    [collectionOptions]
  );

  const categorySelectOptions = useMemo<SelectOption[]>(
    () => categoryOptions.map((option) => ({ value: String(option.label), label: String(option.label) })),
    [categoryOptions]
  );

  const subTypeSelectOptions = useMemo<SelectOption[]>(
    () => subTypeOptions.map((option) => ({ value: String(option.label), label: String(option.label) })),
    [subTypeOptions]
  );

  const recalculateRows = (nextRows: UploadRow[]) => {
    setRows(buildRowValidation(nextRows, publisherOptions, collectionOptions, categoryOptions, subTypeOptions));
  };

  useEffect(() => {
    if (!open) {
      setRows([]);
      setParseError('');
      setIsDragging(false);
      setRemovedCount(0);
    }
  }, [open]);

  const readyRows = useMemo(() => {
    return rows.filter((row) => !row.success && row.errors.length === 0);
  }, [rows]);

  const invalidRows = useMemo(() => rows.filter((row) => !row.success && row.errors.length > 0), [rows]);
  const successRows = useMemo(() => rows.filter((row) => row.success), [rows]);

  const bulkAddMutation = useMutation({
    mutationFn: async (payloadRows: UploadRow[]) => {
      const payload = payloadRows.map((row) => ({
        RowNumber: row.rowNumber,
        Publisher: row.values.Publisher.trim(),
        Collection: row.values.Collection.trim(),
        ItemName: row.values.ItemName.trim(),
        Category: row.values.Category.trim(),
        SubCategory: row.values.SubCategory.trim(),
        ProductID: row.values.ProductID.trim(),
        ReleaseDate: row.values.ReleaseDate.trim() || null,
      }));

      const response = await tablesAPI.bulkCreateItems({ rows: payload });
      return response.data as BulkCreateResult;
    },
    onSuccess: (result) => {
      const byRowNumber = new Map<number, { success: boolean; errors: string[] }>();
      result.rowResults.forEach((entry) => {
        byRowNumber.set(entry.rowNumber, { success: entry.success, errors: entry.errors || [] });
      });

      setRows((current) =>
        current.map((row) => {
          if (row.success) {
            return row;
          }

          const serverResult = byRowNumber.get(row.rowNumber);
          if (!serverResult) {
            return row;
          }

          return {
            ...row,
            success: serverResult.success,
            errors: serverResult.success ? [] : [...new Set([...row.errors, ...serverResult.errors])],
          };
        })
      );

      if (result.insertedCount > 0) {
        onItemsAdded?.();
      }
    },
    onError: (error: any) => {
      setParseError(error.response?.data?.error || error.message || 'Failed to add items.');
    },
  });

  const parseFile = async (file: File) => {
    setParseError('');

    const isExcel = /\.(xlsx)$/i.test(file.name);
    if (!isExcel) {
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

      const rawRows: string[][] = sourceRows.map((row: unknown[]) =>
        row.map((value: unknown) => normalizeText(value))
      );

      if (rawRows.length < 2) {
        setParseError('The file must include a header row and at least one data row.');
        return;
      }

      const headerRow = rawRows[0] || [];
      const columnIndexByField = new Map<BulkField, number>();
      headerRow.forEach((headerCell: string, index: number) => {
        const normalized = normalizeHeader(headerCell);
        const mappedField = HEADER_ALIASES[normalized.replace(/\s+/g, ' ')] || HEADER_ALIASES[normalized.replace(/\s+/g, '')];
        if (mappedField && !columnIndexByField.has(mappedField)) {
          columnIndexByField.set(mappedField, index);
        }
      });

      const missingRequired = REQUIRED_FIELDS.filter((field) => !columnIndexByField.has(field));
      if (missingRequired.length > 0) {
        setParseError(`Missing required column${missingRequired.length === 1 ? '' : 's'}: ${missingRequired.join(', ')}.`);
        return;
      }

      const parsedRows: UploadRow[] = [];
      for (let i = 1; i < rawRows.length; i += 1) {
        const sourceRow = rawRows[i] || [];
        const values = emptyRowValues();

        ALL_FIELDS.forEach((field) => {
          const columnIndex = columnIndexByField.get(field);
          if (columnIndex === undefined) {
            values[field] = '';
            return;
          }
          values[field] = normalizeText(sourceRow[columnIndex]);
        });

        const isBlank = ALL_FIELDS.every((field) => !values[field]);
        if (isBlank) {
          continue;
        }

        parsedRows.push({
          id: i,
          rowNumber: i,
          values,
          errors: [],
          success: false,
          duplicateCheckRequested: false,
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
    if (!file) {
      return;
    }

    parseFile(file);

    // Let users pick the same file again if needed.
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    parseFile(file);
  };

  const handleCellChange = (rowId: number, field: BulkField, value: string) => {
    setParseError('');
    const nextRows = rows.map((row) => {
      if (row.id !== rowId) {
        return row;
      }

      return {
        ...row,
        success: false,
        duplicateCheckRequested:
          field === 'ItemName' || field === 'ProductID' ? false : row.duplicateCheckRequested,
        values: { ...row.values, [field]: value },
      };
    });

    recalculateRows(nextRows);
  };

  const handleDuplicateFieldBlur = (rowId: number) => {
    const nextRows = rows.map((row) =>
      row.id === rowId ? { ...row, duplicateCheckRequested: true } : row
    );

    recalculateRows(nextRows);
  };

  const handleRemoveRow = (rowId: number) => {
    setParseError('');
    const nextRows = rows.filter((row) => row.id !== rowId);
    setRemovedCount((current) => current + 1);
    recalculateRows(nextRows);
  };

  const handleAddBlankRow = () => {
    setParseError('');
    const nextId = rows.length ? Math.max(...rows.map((row) => row.id)) + 1 : 1;
    const nextRowNumber = rows.length ? Math.max(...rows.map((row) => row.rowNumber)) + 1 : 1;

    const nextRows = [
      ...rows,
      {
        id: nextId,
        rowNumber: nextRowNumber,
        values: emptyRowValues(),
        errors: [],
        success: false,
        duplicateCheckRequested: false,
      },
    ];

    recalculateRows(nextRows);
  };

  const handleAddItems = () => {
    setParseError('');
    if (readyRows.length === 0) {
      setParseError('No valid rows are ready to add.');
      return;
    }

    bulkAddMutation.mutate(readyRows);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Bulk Upload Item Master"
      contentClassName="max-w-[95vw]"
    >
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
          Required columns: Publisher, Collection, ItemName, Category, SubCategory, ProductID. Optional: ReleaseDate.
          Aliases supported: Item, Item Name, Sub Type, Sub Category, Release Date.
          <div className="mt-2">
            <a
              href={BULK_UPLOAD_TEMPLATE_URL}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-700 underline hover:text-blue-800"
            >
              Download Bulk Upload Template
            </a>
          </div>
        </div>

        {parseError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{parseError}</div>
        ) : null}

        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700">
          <span>Total rows: {rows.length}</span>
          <span>Ready: {readyRows.length}</span>
          <span>Invalid: {invalidRows.length}</span>
          <span>Added: {successRows.length}</span>
          <span>Removed: {removedCount}</span>
        </div>

        <div className="max-h-[50vh] overflow-auto rounded-lg border border-gray-200">
          <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow>
                <TableHead>Row</TableHead>
                <TableHead>Publisher</TableHead>
                <TableHead>Collection</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Sub Category</TableHead>
                <TableHead>Product ID</TableHead>
                <TableHead>Release Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-10 text-center text-gray-500">
                    Upload a file to preview and validate rows.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} className={row.success ? 'bg-green-50' : ''}>
                    <TableCell className="whitespace-nowrap align-top">{row.rowNumber}</TableCell>
                    <TableCell className="align-top">
                      <select
                        value={row.values.Publisher}
                        onChange={(event) => handleCellChange(row.id, 'Publisher', event.target.value)}
                        disabled={row.success}
                        className="mt-1 block w-full border rounded-md p-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select publisher</option>
                        {publisherSelectOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell className="align-top">
                      <select
                        value={row.values.Collection}
                        onChange={(event) => handleCellChange(row.id, 'Collection', event.target.value)}
                        disabled={row.success}
                        className="mt-1 block w-full border rounded-md p-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select collection</option>
                        {collectionSelectOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        value={row.values.ItemName}
                        onChange={(event) => handleCellChange(row.id, 'ItemName', event.target.value)}
                        onBlur={() => handleDuplicateFieldBlur(row.id)}
                        disabled={row.success}
                        placeholder="Item name"
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <select
                        value={row.values.Category}
                        onChange={(event) => handleCellChange(row.id, 'Category', event.target.value)}
                        disabled={row.success}
                        className="mt-1 block w-full border rounded-md p-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select category</option>
                        {categorySelectOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell className="align-top">
                      <select
                        value={row.values.SubCategory}
                        onChange={(event) => handleCellChange(row.id, 'SubCategory', event.target.value)}
                        disabled={row.success}
                        className="mt-1 block w-full border rounded-md p-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select sub category</option>
                        {subTypeSelectOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        value={row.values.ProductID}
                        onChange={(event) => handleCellChange(row.id, 'ProductID', event.target.value)}
                        onBlur={() => handleDuplicateFieldBlur(row.id)}
                        disabled={row.success}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        type="date"
                        value={row.values.ReleaseDate}
                        onChange={(event) => handleCellChange(row.id, 'ReleaseDate', event.target.value)}
                        disabled={row.success}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      {row.success ? (
                        <span className="text-green-700">Added</span>
                      ) : row.errors.length > 0 ? (
                        <div className="space-y-1 text-xs text-red-700">
                          {row.errors.map((errorMessage) => (
                            <div key={`${row.id}-${errorMessage}`}>{errorMessage}</div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-amber-700">Ready</span>
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
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleAddBlankRow}
              disabled={bulkAddMutation.isLoading}
            >
              Add New Item
            </Button>
            <Button
              type="button"
              className="bg-green-600 hover:bg-green-700"
              onClick={handleAddItems}
              disabled={bulkAddMutation.isLoading || readyRows.length === 0}
            >
              {bulkAddMutation.isLoading ? 'Uploading Items...' : `Upload Items (${readyRows.length})`}
            </Button>
          </div>

          <Button
            type="button"
            className="bg-gray-200 text-gray-800 hover:bg-gray-300"
            onClick={() => onOpenChange(false)}
            disabled={bulkAddMutation.isLoading}
          >
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
