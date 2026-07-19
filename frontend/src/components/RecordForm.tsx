import { useState, useEffect, type FormEvent } from 'react';
import { tablesAPI } from '../services/api';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import useModalFocusTrap from '../hooks/useModalFocusTrap';

interface RecordFormProps {
  tableName: string;
  schema?: any[];
  recordId: number | string | null | undefined;
  onClose?: () => void;
  onSuccess?: () => void;
  title?: string;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  deleteLabel?: string;
}

const isTruthyFlag = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes';
  }
  return false;
};

export default function RecordForm({
  tableName,
  schema,
  recordId,
  onClose,
  onSuccess,
  title,
  onDelete,
  deleteDisabled = false,
  deleteLabel = 'Delete',
}: RecordFormProps) {
  const [schemaState, setSchemaState] = useState<any[]>(schema ?? []);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState('');
  const modalRef = useModalFocusTrap<HTMLDivElement>();

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    if (schema !== undefined) {
      setSchemaState(schema);
    }
  }, [schema]);

  useEffect(() => {
    if (schemaState.length > 0) {
      return;
    }

    let cancelled = false;
    const loadSchema = async () => {
      setFetching(true);
      try {
        const response = await tablesAPI.getTableSchema(tableName);
        if (!cancelled) {
          setSchemaState(response.data);
        }
      } catch (err) {
        console.error('Error loading schema for record form:', err);
      } finally {
        if (!cancelled) {
          setFetching(false);
        }
      }
    };

    loadSchema();
    return () => {
      cancelled = true;
    };
  }, [schemaState.length, tableName]);

  useEffect(() => {
    if (recordId === null || recordId === undefined) {
      setFormData({});
      return;
    }

    let cancelled = false;
    const loadRecord = async () => {
      setFetching(true);
      try {
        const response = await tablesAPI.getRecord(tableName, recordId);
        if (!cancelled) {
          const record = response.data ?? {};
          const filteredRecord = Object.entries(record).reduce(
            (acc, [key, value]) => {
              const column = schemaState.find((col) => col.COLUMN_NAME === key);
              if (isTruthyFlag(column?.IS_IDENTITY) || isTruthyFlag(column?.IS_COMPUTED)) {
                return acc;
              }
              acc[key] = value;
              return acc;
            },
            {} as Record<string, any>
          );
          setFormData(filteredRecord);
        }
      } catch (err) {
        console.error('Error loading record for edit:', err);
      } finally {
        if (!cancelled) {
          setFetching(false);
        }
      }
    };

    loadRecord();
    return () => {
      cancelled = true;
    };
  }, [tableName, recordId, schemaState]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = Object.entries(formData).reduce((acc, [key, value]) => {
        const column = schemaState.find((col) => col.COLUMN_NAME === key);
        if (isTruthyFlag(column?.IS_IDENTITY) || isTruthyFlag(column?.IS_COMPUTED)) {
          return acc;
        }
        acc[key] = value;
        return acc;
      }, {} as Record<string, any>);

      if (recordId !== null && recordId !== undefined) {
        await tablesAPI.updateRecord(tableName, recordId, payload);
      } else {
        await tablesAPI.createRecord(tableName, payload);
      }
      if (onSuccess) {
        onSuccess();
      } else {
        onClose?.();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Error saving record');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div ref={modalRef} tabIndex={-1} className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">
            {title ?? (recordId !== null && recordId !== undefined ? 'Edit Record' : 'Create New Record')}
          </h3>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}

        {fetching && <p className="text-gray-500">Loading record...</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {schemaState?.map((col: any) => {
            // Skip identity and computed columns
            if (isTruthyFlag(col.IS_IDENTITY) || isTruthyFlag(col.IS_COMPUTED)) {
              return null;
            }

            const isSubTypeNameField = tableName === 'SubType' && col.COLUMN_NAME === 'SubTypeName';
            const fieldLabel = isSubTypeNameField ? 'New Sub Category' : col.COLUMN_NAME;
            const fieldPlaceholder = isSubTypeNameField ? 'Enter New Sub Category' : `Enter ${col.COLUMN_NAME}`;

            return (
              <div key={col.COLUMN_NAME}>
                <label className="block text-sm font-medium mb-1">
                  {fieldLabel}
                </label>
                <Input
                  type={col.DATA_TYPE.includes('int') ? 'number' : 'text'}
                  placeholder={fieldPlaceholder}
                  value={formData[col.COLUMN_NAME] ?? ''}
                  onChange={(e) =>
                    handleChange(col.COLUMN_NAME, e.target.value)
                  }
                  required={col.IS_NULLABLE === 'NO'}
                  autoFocus={schemaState.filter((candidate: any) => !isTruthyFlag(candidate.IS_IDENTITY) && !isTruthyFlag(candidate.IS_COMPUTED))[0]?.COLUMN_NAME === col.COLUMN_NAME}
                />
              </div>
            );
          })}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-6">
            <div>
              {recordId !== null && recordId !== undefined && onDelete ? (
                <Button
                  type="button"
                  onClick={onDelete}
                  disabled={deleteDisabled || loading || fetching}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deleteLabel}
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                onClick={onClose}
                className="bg-gray-200 text-gray-800 hover:bg-gray-300"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading || fetching}>
                {loading ? 'Saving...' : 'Save Record'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
