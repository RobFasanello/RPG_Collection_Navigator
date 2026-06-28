import { useState, type FormEvent } from 'react';
import { tablesAPI } from '../services/api';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { X } from 'lucide-react';

interface RecordFormProps {
  tableName: string;
  schema?: any[];
  recordId: number | string | null | undefined;
  onClose?: () => void;
  onSuccess?: () => void;
}

export default function RecordForm({
  tableName,
  schema = [],
  recordId,
  onClose,
  onSuccess,
}: RecordFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (recordId) {
        await tablesAPI.updateRecord(tableName, recordId, formData);
      } else {
        await tablesAPI.createRecord(tableName, formData);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">
            {recordId ? 'Edit Record' : 'Create New Record'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {schema?.map((col: any) => {
            // Skip identity and computed columns
            if (col.IS_IDENTITY || col.IS_COMPUTED) {
              return null;
            }

            return (
              <div key={col.COLUMN_NAME}>
                <label className="block text-sm font-medium mb-1">
                  {col.COLUMN_NAME}
                </label>
                <Input
                  type={col.DATA_TYPE.includes('int') ? 'number' : 'text'}
                  placeholder={`Enter ${col.COLUMN_NAME}`}
                  value={formData[col.COLUMN_NAME] ?? ''}
                  onChange={(e) =>
                    handleChange(col.COLUMN_NAME, e.target.value)
                  }
                  required={col.IS_NULLABLE === 'NO'}
                />
              </div>
            );
          })}

          <div className="flex gap-2 justify-end mt-6">
            <Button
              type="button"
              onClick={onClose}
              className="bg-gray-200 text-gray-800 hover:bg-gray-300"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save Record'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
