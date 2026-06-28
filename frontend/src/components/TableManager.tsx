import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tablesAPI } from '../services/api';
import { Button } from './ui/Button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table';
import RecordForm from './RecordForm';
import { ChevronLeft, Trash2, Edit2, Plus } from 'lucide-react';

interface TableManagerProps {
  tableName: string;
  onBack: () => void;
}

export default function TableManager({ tableName, onBack }: TableManagerProps) {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const pageSize_val = pageSize;

  const { data: schema } = useQuery<any, Error>({
    queryKey: [tableName, 'schema'],
    queryFn: async () => {
      const response = await tablesAPI.getTableSchema(tableName);
      return response.data;
    },
  });

  const { data: tableData, isLoading: dataLoading, refetch } = useQuery<any, Error>({
    queryKey: [tableName, 'data', page],
    queryFn: async () => {
      const response = await tablesAPI.getTableData(tableName, page, pageSize_val);
      return response.data;
    },
  });

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this record?')) {
      await tablesAPI.deleteRecord(tableName, id);
      refetch();
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingId(null);
    refetch();
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
        >
          <ChevronLeft className="w-5 h-5" />
          Back to Tables
        </button>
        <h2 className="text-2xl font-bold">{tableName}</h2>
        <Button
          onClick={() => {
            setEditingId(null);
            setShowForm(true);
          }}
          className="ml-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Record
        </Button>
      </div>

      {showForm && (
        <RecordForm
          tableName={tableName}
          schema={schema || []}
          recordId={editingId}
          onClose={handleFormClose}
        />
      )}

      {dataLoading && <p className="text-gray-500">Loading data...</p>}

      {tableData && (
        <>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  {schema?.map((col: any) => (
                    <TableHead key={col.COLUMN_NAME}>
                      {col.COLUMN_NAME}
                    </TableHead>
                  ))}
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableData.data?.map((row: any) => (
                  <TableRow key={row.id}>
                    {schema?.map((col: any) => (
                      <TableCell key={col.COLUMN_NAME} className="truncate max-w-xs">
                        {String(row[col.COLUMN_NAME] ?? '-')}
                      </TableCell>
                    ))}
                    <TableCell className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingId(row.id);
                          setShowForm(true);
                        }}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(row.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {tableData.data?.length || 0} of {tableData.total} records
              (Page {tableData.page} of {tableData.totalPages})
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
              >
                Previous
              </Button>
              <Button
                onClick={() => setPage(page + 1)}
                disabled={page >= tableData.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
