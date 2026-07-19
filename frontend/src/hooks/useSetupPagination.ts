import { useEffect, useState } from 'react';
import { SETUP_TABLE_PAGE_SIZE } from '../components/SetupTablePagination';

export default function useSetupPagination<T>(rows: T[], resetKeys: unknown[] = []) {
  const [page, setPage] = useState(1);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / SETUP_TABLE_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * SETUP_TABLE_PAGE_SIZE;
  const paginatedRows = rows.slice(startIndex, startIndex + SETUP_TABLE_PAGE_SIZE);

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
    pageSize: SETUP_TABLE_PAGE_SIZE,
    paginatedRows,
    total,
    totalPages,
    setPage,
  };
}
