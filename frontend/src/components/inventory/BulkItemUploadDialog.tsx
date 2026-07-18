import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import readXlsxFile from 'read-excel-file/browser';
import { Trash2 } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/Table';
import { tablesAPI } from '../../services/api';

type BulkField =
  | 'Publisher'
  | 'Collection'
  | 'ItemName'
  | 'ItemVersion'
  | 'Category'
  | 'SubCategory'
  | 'ProductID'
  | 'ReleaseDate'
  | 'IsPhysical'
  | 'IsDigital';

interface UploadRow {
  id: number;
  rowNumber: number;
  values: Record<BulkField, string>;
  errors: string[];
  warnings: string[];
  success: boolean;
  isManual: boolean;
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
  publisherCollectionLinks: Array<{ PublisherID: number; CollectionID: number }>;
  categorySubTypeLinks: Array<{ CategoryID: number; SubTypeID: number }>;
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

const REQUIRED_ROW_FIELDS: BulkField[] = ['Publisher', 'Collection', 'ItemName', 'ItemVersion', 'Category', 'SubCategory', 'ProductID'];
const ALL_FIELDS: BulkField[] = [
  'Publisher',
  'Collection',
  'ItemName',
  'ItemVersion',
  'Category',
  'SubCategory',
  'ProductID',
  'ReleaseDate',
  'IsPhysical',
  'IsDigital',
];

const HEADER_ALIASES: Record<string, BulkField> = {
  publisher: 'Publisher',
  publishers: 'Publisher',
  collection: 'Collection',
  collections: 'Collection',
  itemname: 'ItemName',
  item: 'ItemName',
  'item name': 'ItemName',
  itemnames: 'ItemName',
  itemversion: 'ItemVersion',
  version: 'ItemVersion',
  'item version': 'ItemVersion',
  category: 'Category',
  categories: 'Category',
  subcategory: 'SubCategory',
  subtype: 'SubCategory',
  subcat: 'SubCategory',
  'sub type': 'SubCategory',
  productid: 'ProductID',
  'product id': 'ProductID',
  product: 'ProductID',
  sku: 'ProductID',
  releasedate: 'ReleaseDate',
  release: 'ReleaseDate',
  'release date': 'ReleaseDate',
  isphysical: 'IsPhysical',
  'is physical': 'IsPhysical',
  physical: 'IsPhysical',
  isdigital: 'IsDigital',
  'is digital': 'IsDigital',
  digital: 'IsDigital',
};

const BULK_UPLOAD_TEMPLATE_URL = '/templates/Bulk%20Upload%20Template.xlsx';
const ITEM_VERSION_MAX_LENGTH = 15;
const POSITIVE_FLAG_VALUES = new Set(['y', 'yes', 't', 'true', 'x', '1']);
const NEGATIVE_FLAG_VALUES = new Set(['n', 'no', 'f', 'false', '0']);
const BASE_SELECT_CLASS_NAME = 'mt-1 block w-full border rounded-md p-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const ERROR_FIELD_CLASS_NAME = 'border-red-500 bg-red-50 focus:ring-red-500';
const WARNING_FIELD_CLASS_NAME = 'border-amber-400 bg-amber-50 focus:ring-amber-500';

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

function stripCollectionTypeSuffix(value: string): string {
  return value.replace(/\s+\([^)]+\)\s*$/, '').trim();
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

function parseBooleanFlagForUpload(
  value: string,
  label: string
): { normalized: string; booleanValue: boolean | null; error?: string } {
  const raw = value.trim();
  if (!raw) {
    return { normalized: '', booleanValue: null };
  }

  const normalized = raw.toLowerCase();
  if (POSITIVE_FLAG_VALUES.has(normalized)) {
    return { normalized: 'true', booleanValue: true };
  }

  if (NEGATIVE_FLAG_VALUES.has(normalized)) {
    return { normalized: 'false', booleanValue: false };
  }

  return {
    normalized: raw,
    booleanValue: null,
    error: `${label} must be one of Y, Yes, T, True, X, 1, N, No, F, False, or 0.`,
  };
}

function buildRowValidation(
  rows: UploadRow[],
  publisherOptions: OptionItem[],
  collectionOptions: OptionItem[],
  categoryOptions: OptionItem[],
  subTypeOptions: OptionItem[],
  publisherCollectionLinks: Array<{ PublisherID: number; CollectionID: number }>,
  categorySubTypeLinks: Array<{ CategoryID: number; SubTypeID: number }>
): UploadRow[] {
  const publisherByName = new Map<string, number>();
  publisherOptions.forEach((option) => {
    const publisherId = Number(option.value);
    if (Number.isFinite(publisherId)) {
      publisherByName.set(normalizeKey(option.label), publisherId);
    }
  });

  const collectionLookup = new Map<string, number[]>();
  const addCollectionLookup = (key: string, value: number) => {
    if (!key) {
      return;
    }
    const existing = collectionLookup.get(key);
    if (!existing) {
      collectionLookup.set(key, [value]);
      return;
    }
    if (!existing.includes(value)) {
      existing.push(value);
    }
  };
  collectionOptions.forEach((option) => {
    const optionValue = Number(option.value ?? option.label);
    const optionLabel = String(option.label ?? option.value);
    if (!Number.isFinite(optionValue)) {
      return;
    }
    addCollectionLookup(normalizeKey(String(optionValue)), optionValue);
    addCollectionLookup(normalizeKey(optionLabel), optionValue);
    addCollectionLookup(normalizeKey(stripCollectionTypeSuffix(optionLabel)), optionValue);
  });
  const categoryByName = new Map<string, number>();
  categoryOptions.forEach((option) => {
    const categoryId = Number(option.value);
    if (Number.isFinite(categoryId)) {
      categoryByName.set(normalizeKey(option.label), categoryId);
    }
  });
  const subTypeByName = new Map<string, number>();
  subTypeOptions.forEach((option) => {
    const subTypeId = Number(option.value);
    if (Number.isFinite(subTypeId)) {
      subTypeByName.set(normalizeKey(option.label), subTypeId);
    }
  });
  const publisherCollectionSet = new Set(
    publisherCollectionLinks.map((link) => `${Number(link.PublisherID)}:${Number(link.CollectionID)}`)
  );
  const categorySubTypeSet = new Set(
    categorySubTypeLinks.map((link) => `${Number(link.CategoryID)}:${Number(link.SubTypeID)}`)
  );
  const duplicateItemProductMap = new Map<string, number>();
  const duplicateItemNameMap = new Map<string, number>();

  rows.forEach((row) => {
    if (row.success) {
      return;
    }
    const itemNameKey = normalizeKey(row.values.ItemName);
    if (itemNameKey) {
      duplicateItemNameMap.set(itemNameKey, (duplicateItemNameMap.get(itemNameKey) || 0) + 1);
    }

    const itemProductKey = `${itemNameKey}::${normalizeKey(row.values.ProductID)}`;
    if (itemProductKey && itemProductKey !== '::') {
      duplicateItemProductMap.set(itemProductKey, (duplicateItemProductMap.get(itemProductKey) || 0) + 1);
    }
  });

  return rows.map((row) => {
    if (row.success) {
      return { ...row, errors: [], warnings: [] };
    }

    const nextErrors: string[] = [];
    const nextWarnings: string[] = [];

    REQUIRED_ROW_FIELDS.forEach((field) => {
      if (!row.values[field].trim()) {
        nextErrors.push(`${field} is required.`);
      }
    });

    const publisherId = publisherByName.get(normalizeKey(row.values.Publisher));
    if (row.values.Publisher.trim() && !publisherId) {
      nextErrors.push(`Publisher "${row.values.Publisher}" was not found.`);
    }

    const rawCollection = row.values.Collection.trim();
    let normalizedCollection = rawCollection;
    let collectionId: number | undefined;
    if (rawCollection) {
      const matches = collectionLookup.get(normalizeKey(rawCollection)) || [];
      if (matches.length === 1) {
        collectionId = matches[0];
        normalizedCollection = String(matches[0]);
      } else if (matches.length === 0) {
        nextErrors.push(`Collection "${row.values.Collection}" was not found.`);
      } else {
        nextErrors.push(`Collection "${row.values.Collection}" matches multiple collections. Please select the specific collection.`);
      }
    }

    const categoryId = categoryByName.get(normalizeKey(row.values.Category));
    if (row.values.Category.trim() && !categoryId) {
      nextErrors.push(`Category "${row.values.Category}" was not found.`);
    }

    const subTypeId = subTypeByName.get(normalizeKey(row.values.SubCategory));
    if (row.values.SubCategory.trim() && !subTypeId) {
      nextErrors.push(`SubCategory "${row.values.SubCategory}" was not found.`);
    }

    if (publisherId && collectionId && !publisherCollectionSet.has(`${publisherId}:${collectionId}`)) {
      nextErrors.push('Publisher and Collection are not a valid combination.');
    }

    if (categoryId && subTypeId && !categorySubTypeSet.has(`${categoryId}:${subTypeId}`)) {
      nextErrors.push('Category and SubCategory are not a valid combination.');
    }

    const dateParse = parseDateForUpload(row.values.ReleaseDate);
    if (dateParse.error) {
      nextErrors.push(dateParse.error);
    }

    const physicalParse = parseBooleanFlagForUpload(row.values.IsPhysical, 'Is Physical');
    if (physicalParse.error) {
      nextErrors.push(physicalParse.error);
    }

    const digitalParse = parseBooleanFlagForUpload(row.values.IsDigital, 'Is Digital');
    if (digitalParse.error) {
      nextErrors.push(digitalParse.error);
    }

    if (physicalParse.booleanValue !== true && digitalParse.booleanValue !== true) {
      nextErrors.push('At least one of Is Physical or Is Digital must be positive.');
    }

    if (row.values.ItemVersion.trim().length > ITEM_VERSION_MAX_LENGTH) {
      nextErrors.push(`ItemVersion must be ${ITEM_VERSION_MAX_LENGTH} characters or fewer.`);
    }

    const duplicateKey = `${normalizeKey(row.values.ItemName)}::${normalizeKey(row.values.ProductID)}`;
    if (duplicateKey !== '::' && (duplicateItemProductMap.get(duplicateKey) || 0) > 1) {
      nextErrors.push('Duplicate ItemName and ProductID exists in this upload file.');
    }

    const duplicateItemNameKey = normalizeKey(row.values.ItemName);
    if (duplicateItemNameKey && (duplicateItemNameMap.get(duplicateItemNameKey) || 0) > 1) {
      nextWarnings.push('Duplicate Item Name exists in this upload file.');
    }

    return {
      ...row,
      values: {
        ...row.values,
        Collection: normalizedCollection,
        ReleaseDate: dateParse.normalized,
        IsPhysical: physicalParse.normalized,
        IsDigital: digitalParse.normalized,
      },
      errors: nextErrors,
      warnings: nextWarnings,
    };
  });
}

function emptyRowValues(): Record<BulkField, string> {
  return {
    Publisher: '',
    Collection: '',
    ItemName: '',
    ItemVersion: '',
    Category: '',
    SubCategory: '',
    ProductID: '',
    ReleaseDate: '',
    IsPhysical: '',
    IsDigital: '',
  };
}

function getErrorFields(row: UploadRow): Set<BulkField> {
  const fields = new Set<BulkField>();

  row.errors.forEach((error) => {
    if (error.startsWith('Publisher ')) fields.add('Publisher');
    if (error.startsWith('Collection ')) fields.add('Collection');
    if (error.startsWith('ItemName ') || error.startsWith('An item with') || error.startsWith('Duplicate ItemName')) fields.add('ItemName');
    if (error.startsWith('ItemVersion ')) fields.add('ItemVersion');
    if (error.startsWith('Category ')) fields.add('Category');
    if (error.startsWith('SubCategory ')) fields.add('SubCategory');
    if (error.startsWith('ProductID ') || error.startsWith('An item with') || error.startsWith('Duplicate ItemName')) fields.add('ProductID');
    if (error.startsWith('Release Date') || error.startsWith('ReleaseDate')) fields.add('ReleaseDate');
    if (error.startsWith('Is Physical') || error.startsWith('At least one of')) fields.add('IsPhysical');
    if (error.startsWith('Is Digital') || error.startsWith('At least one of')) fields.add('IsDigital');
    if (error.startsWith('Publisher and Collection')) {
      fields.add('Publisher');
      fields.add('Collection');
    }
    if (error.startsWith('Category and SubCategory')) {
      fields.add('Category');
      fields.add('SubCategory');
    }
  });

  return fields;
}

function getWarningFields(row: UploadRow): Set<BulkField> {
  const fields = new Set<BulkField>();

  row.warnings.forEach((warning) => {
    if (warning.startsWith('Duplicate Item Name')) fields.add('ItemName');
  });

  return fields;
}

export default function BulkItemUploadDialog({
  open,
  onOpenChange,
  publisherOptions,
  collectionOptions,
  categoryOptions,
  subTypeOptions,
  publisherCollectionLinks,
  categorySubTypeLinks,
  onItemsAdded,
}: BulkItemUploadDialogProps) {
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [parseError, setParseError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [removedCount, setRemovedCount] = useState(0);
  const [addedCount, setAddedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const publisherSelectOptions = useMemo<SelectOption[]>(
    () => publisherOptions.map((option) => ({ value: String(option.label), label: String(option.label) })),
    [publisherOptions]
  );

  const collectionSelectOptions = useMemo<SelectOption[]>(
    () =>
      collectionOptions.map((option) => ({
        value: String(option.value ?? option.label),
        label: String(option.label),
      })),
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

  const publisherIdByName = useMemo(() => {
    const map = new Map<string, number>();
    publisherOptions.forEach((option) => {
      const publisherId = Number(option.value);
      if (Number.isFinite(publisherId)) {
        map.set(normalizeKey(option.label), publisherId);
      }
    });
    return map;
  }, [publisherOptions]);

  const categoryIdByName = useMemo(() => {
    const map = new Map<string, number>();
    categoryOptions.forEach((option) => {
      const categoryId = Number(option.value);
      if (Number.isFinite(categoryId)) {
        map.set(normalizeKey(option.label), categoryId);
      }
    });
    return map;
  }, [categoryOptions]);

  const subTypeIdByName = useMemo(() => {
    const map = new Map<string, number>();
    subTypeOptions.forEach((option) => {
      const subTypeId = Number(option.value);
      if (Number.isFinite(subTypeId)) {
        map.set(normalizeKey(option.label), subTypeId);
      }
    });
    return map;
  }, [subTypeOptions]);

  const collectionIdsByPublisherId = useMemo(() => {
    const map = new Map<number, Set<number>>();
    publisherCollectionLinks.forEach((link) => {
      const publisherId = Number(link.PublisherID);
      const collectionId = Number(link.CollectionID);
      if (!Number.isFinite(publisherId) || !Number.isFinite(collectionId)) {
        return;
      }
      const existing = map.get(publisherId) || new Set<number>();
      existing.add(collectionId);
      map.set(publisherId, existing);
    });
    return map;
  }, [publisherCollectionLinks]);

  const subTypeIdsByCategoryId = useMemo(() => {
    const map = new Map<number, Set<number>>();
    categorySubTypeLinks.forEach((link) => {
      const categoryId = Number(link.CategoryID);
      const subTypeId = Number(link.SubTypeID);
      if (!Number.isFinite(categoryId) || !Number.isFinite(subTypeId)) {
        return;
      }
      const existing = map.get(categoryId) || new Set<number>();
      existing.add(subTypeId);
      map.set(categoryId, existing);
    });
    return map;
  }, [categorySubTypeLinks]);

  const getFieldClassName = (errorFields: Set<BulkField>, warningFields: Set<BulkField>, field: BulkField) => {
    if (errorFields.has(field)) {
      return ERROR_FIELD_CLASS_NAME;
    }

    return warningFields.has(field) ? WARNING_FIELD_CLASS_NAME : '';
  };

  const getSelectClassName = (errorFields: Set<BulkField>, warningFields: Set<BulkField>, field: BulkField) =>
    `${BASE_SELECT_CLASS_NAME} ${getFieldClassName(errorFields, warningFields, field)}`;

  const getCollectionOptionsForRow = (row: UploadRow) => {
    const publisherId = publisherIdByName.get(normalizeKey(row.values.Publisher));
    if (!publisherId) {
      return collectionSelectOptions;
    }

    const allowedCollectionIds = collectionIdsByPublisherId.get(publisherId);
    if (!allowedCollectionIds) {
      return [];
    }

    return collectionSelectOptions.filter((option) => allowedCollectionIds.has(Number(option.value)));
  };

  const getSubTypeOptionsForRow = (row: UploadRow) => {
    const categoryId = categoryIdByName.get(normalizeKey(row.values.Category));
    if (!categoryId) {
      return subTypeSelectOptions;
    }

    const allowedSubTypeIds = subTypeIdsByCategoryId.get(categoryId);
    if (!allowedSubTypeIds) {
      return [];
    }

    return subTypeSelectOptions.filter((option) => {
      const subTypeId = subTypeIdByName.get(normalizeKey(option.label));
      return subTypeId !== undefined && allowedSubTypeIds.has(subTypeId);
    });
  };

  const recalculateRows = (nextRows: UploadRow[]) => {
    setRows(
      buildRowValidation(
        nextRows,
        publisherOptions,
        collectionOptions,
        categoryOptions,
        subTypeOptions,
        publisherCollectionLinks,
        categorySubTypeLinks
      )
    );
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

  const readyRows = useMemo(() => {
    return rows.filter((row) => !row.success && row.errors.length === 0);
  }, [rows]);

  const invalidRows = useMemo(() => rows.filter((row) => !row.success && row.errors.length > 0), [rows]);

  const bulkAddMutation = useMutation({
    mutationFn: async (payloadRows: UploadRow[]) => {
      const payload = payloadRows.map((row) => ({
        RowNumber: row.rowNumber,
        Publisher: row.values.Publisher.trim(),
        Collection: row.values.Collection.trim(),
        ItemName: row.values.ItemName.trim(),
        ItemVersion: row.values.ItemVersion.trim(),
        Category: row.values.Category.trim(),
        SubCategory: row.values.SubCategory.trim(),
        ProductID: row.values.ProductID.trim(),
        ReleaseDate: row.values.ReleaseDate.trim() || null,
        IsPhysical: row.values.IsPhysical === 'true',
        IsDigital: row.values.IsDigital === 'true',
      }));

      const response = await tablesAPI.bulkCreateItems({ rows: payload });
      return response.data as BulkCreateResult;
    },
    onSuccess: (result, payloadRows) => {
      const byRowNumber = new Map<number, { success: boolean; errors: string[] }>();
      result.rowResults.forEach((entry) => {
        byRowNumber.set(entry.rowNumber, { success: entry.success, errors: entry.errors || [] });
      });

      const manualInsertedCount = payloadRows.filter((row) => {
        const serverResult = byRowNumber.get(row.rowNumber);
        return row.isManual && serverResult?.success;
      }).length;

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
            warnings: serverResult.success ? [] : row.warnings,
          };
        })
      );

      if (result.insertedCount > 0) {
        if (manualInsertedCount > 0) {
          setAddedCount((current) => current + manualInsertedCount);
        }
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
    setAddedCount(0);

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

      const missingRequired = ALL_FIELDS.filter((field) => !columnIndexByField.has(field));
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
          warnings: [],
          success: false,
          isManual: false,
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
    const removedRow = rows.find((row) => row.id === rowId);
    if (removedRow?.isManual && removedRow.success) {
      setAddedCount((current) => Math.max(0, current - 1));
    }
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
        warnings: [],
        success: false,
        isManual: true,
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
      showCloseButton={false}
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
          Required columns: Publisher, Collection, Item Name, Version, Category,
          Sub Category, Product ID, Is Physical, and Is Digital.
          Release Date is not required.  Data validation will be performed on all rows, and any errors or warnings will be displayed in the table below.
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
          <span>Added: {addedCount}</span>
          <span>Removed: {removedCount}</span>
        </div>

        <div className="max-h-[50vh] overflow-auto rounded-lg border border-gray-200">
          <Table className="min-w-[1450px]">
            <TableHeader>
              <TableRow>
                <TableHead>Row</TableHead>
                <TableHead>Publisher</TableHead>
                <TableHead>Collection</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Sub Category</TableHead>
                <TableHead>Product ID</TableHead>
                <TableHead>Release Date</TableHead>
                <TableHead>Is Physical</TableHead>
                <TableHead>Is Digital</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} className="py-10 text-center text-gray-500">
                    Upload a file to preview and validate rows.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const errorFields = getErrorFields(row);
                  const warningFields = getWarningFields(row);
                  const rowCollectionOptions = getCollectionOptionsForRow(row);
                  const rowSubTypeOptions = getSubTypeOptionsForRow(row);

                  return (
                  <TableRow key={row.id} className={row.success ? 'bg-green-50' : ''}>
                    <TableCell className="whitespace-nowrap align-top">{row.rowNumber}</TableCell>
                    <TableCell className="align-top">
                      <select
                        value={row.values.Publisher}
                        onChange={(event) => handleCellChange(row.id, 'Publisher', event.target.value)}
                        disabled={row.success}
                        className={getSelectClassName(errorFields, warningFields, 'Publisher')}
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
                        className={getSelectClassName(errorFields, warningFields, 'Collection')}
                      >
                        <option value="">Select collection</option>
                        {rowCollectionOptions.map((option) => (
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
                        className={getFieldClassName(errorFields, warningFields, 'ItemName')}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        value={row.values.ItemVersion}
                        onChange={(event) => handleCellChange(row.id, 'ItemVersion', event.target.value)}
                        disabled={row.success}
                        placeholder="Version"
                        maxLength={ITEM_VERSION_MAX_LENGTH}
                        className={getFieldClassName(errorFields, warningFields, 'ItemVersion')}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <select
                        value={row.values.Category}
                        onChange={(event) => handleCellChange(row.id, 'Category', event.target.value)}
                        disabled={row.success}
                        className={getSelectClassName(errorFields, warningFields, 'Category')}
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
                        className={getSelectClassName(errorFields, warningFields, 'SubCategory')}
                      >
                        <option value="">Select sub category</option>
                        {rowSubTypeOptions.map((option) => (
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
                        className={getFieldClassName(errorFields, warningFields, 'ProductID')}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <Input
                        type="date"
                        value={row.values.ReleaseDate}
                        onChange={(event) => handleCellChange(row.id, 'ReleaseDate', event.target.value)}
                        disabled={row.success}
                        className={getFieldClassName(errorFields, warningFields, 'ReleaseDate')}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <select
                        value={row.values.IsPhysical}
                        onChange={(event) => handleCellChange(row.id, 'IsPhysical', event.target.value)}
                        disabled={row.success}
                        className={getSelectClassName(errorFields, warningFields, 'IsPhysical')}
                      >
                        <option value="">Blank</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </TableCell>
                    <TableCell className="align-top">
                      <select
                        value={row.values.IsDigital}
                        onChange={(event) => handleCellChange(row.id, 'IsDigital', event.target.value)}
                        disabled={row.success}
                        className={getSelectClassName(errorFields, warningFields, 'IsDigital')}
                      >
                        <option value="">Blank</option>
                        <option value="true">Yes</option>
                        <option value="false">No</option>
                      </select>
                    </TableCell>
                    <TableCell className="align-top">
                      {row.success ? (
                        <span className="text-green-700">Added</span>
                      ) : row.errors.length > 0 ? (
                        <div className="space-y-1 text-xs">
                          {row.errors.map((errorMessage) => (
                            <div key={`${row.id}-${errorMessage}`} className="text-red-700">{errorMessage}</div>
                          ))}
                          {row.warnings.map((warningMessage) => (
                            <div key={`${row.id}-${warningMessage}`} className="text-amber-700">{warningMessage}</div>
                          ))}
                        </div>
                      ) : (
                        <div className="space-y-1 text-xs">
                          <div className="font-medium text-green-700">Ready</div>
                          {row.warnings.map((warningMessage) => (
                            <div key={`${row.id}-${warningMessage}`} className="text-amber-700">{warningMessage}</div>
                          ))}
                        </div>
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
            className="bg-gray-600 hover:bg-gray-700"
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
