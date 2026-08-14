import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tablesAPI } from '../services/api';
import TableManager from './TableManager';
import { Database } from 'lucide-react';
import { Skeleton } from './ui/Skeleton';

function TableBrowserSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-label="Loading tables">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-lg border border-[var(--arcane-border-light)] p-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 h-4 w-32" />
        </div>
      ))}
    </div>
  );
}

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
          <Database className="w-8 h-8 text-[var(--arcane-gold-700)]" />
          <h1 className="text-3xl font-bold">RPG Collection Manager</h1>
        </div>
        <p className="text-[var(--arcane-ink-soft)]">Select a table to manage your data</p>
      </div>

      {isLoading && <TableBrowserSkeleton />}
      {error && <p className="text-red-600">Error loading tables</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables?.map((table: any) => (
          <button
            key={table.TABLE_NAME}
            onClick={() => setSelectedTable(table.TABLE_NAME)}
            className="p-4 border border-[var(--arcane-border-light)] rounded-lg hover:border-[var(--arcane-gold-500)] hover:bg-[var(--arcane-gold-soft)] transition text-left"
          >
            <h3 className="font-semibold text-lg">{table.TABLE_NAME}</h3>
            <p className="text-sm text-[var(--arcane-ink-soft)]">Click to manage records</p>
          </button>
        ))}
      </div>
    </div>
  );
}
