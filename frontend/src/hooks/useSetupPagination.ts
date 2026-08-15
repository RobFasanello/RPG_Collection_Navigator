import { useEffect, useState } from 'react';
import { SETUP_TABLE_PAGE_SIZE } from '../components/SetupTablePagination';

export default function useSetupPagination<T>(rows: T[], resetKeys: unknown[] = [], pageSize = SETUP_TABLE_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedRows = rows.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setPage(1);
  }, resetKeys);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  return {
    page: safePage,
    pageSize,
    paginatedRows,
    total,
    totalPages,
    setPage,
  };
}
