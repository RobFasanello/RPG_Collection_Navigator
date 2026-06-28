import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tablesAPI } from '../services/api';
import TableManager from './TableManager';
import { Database } from 'lucide-react';

export default function TableBrowser() {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  
  const { data: tables, isLoading, error } = useQuery<any, Error>({
    queryKey: ['tables'],
    queryFn: async () => {
      const response = await tablesAPI.getTables();
      return response.data;
    },
  });

  if (selectedTable) {
    return (
      <TableManager
        tableName={selectedTable}
        onBack={() => setSelectedTable(null)}
      />
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Database className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold">RPG Collection Manager</h1>
        </div>
        <p className="text-gray-600">Select a table to manage your data</p>
      </div>

      {isLoading && <p className="text-gray-500">Loading tables...</p>}
      {error && <p className="text-red-600">Error loading tables</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables?.map((table: any) => (
          <button
            key={table.TABLE_NAME}
            onClick={() => setSelectedTable(table.TABLE_NAME)}
            className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-left"
          >
            <h3 className="font-semibold text-lg">{table.TABLE_NAME}</h3>
            <p className="text-sm text-gray-500">Click to manage records</p>
          </button>
        ))}
      </div>
    </div>
  );
}
