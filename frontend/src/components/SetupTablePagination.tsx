import { Button } from './ui/Button';

export const SETUP_TABLE_PAGE_SIZE = 50;

type SetupTablePaginationProps = {
  currentCount: number;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export default function SetupTablePagination({
  currentCount,
  total,
  page,
  totalPages,
  onPageChange,
}: SetupTablePaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);
  const hasManyPages = safeTotalPages > 3;

  return (
    <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <p className="text-sm text-gray-600">
        Showing {currentCount} of {total} results — Page {safePage} of {safeTotalPages}
      </p>
      <div className="flex gap-2">
        <Button onClick={() => onPageChange(1)} disabled={!hasManyPages || safePage === 1}>
          First
        </Button>
        <Button onClick={() => onPageChange(Math.max(1, safePage - 1))} disabled={safePage === 1}>
          Previous
        </Button>
        <Button onClick={() => onPageChange(Math.min(safeTotalPages, safePage + 1))} disabled={safePage >= safeTotalPages}>
          Next
        </Button>
        <Button onClick={() => onPageChange(safeTotalPages)} disabled={!hasManyPages || safePage >= safeTotalPages}>
          Last
        </Button>
      </div>
    </div>
  );
}
