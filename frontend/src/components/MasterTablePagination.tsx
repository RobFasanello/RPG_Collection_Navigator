import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from './ui/Pagination';

type MasterTablePaginationProps = {
  currentCount: number;
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  tabIndexStart?: number;
};

type PageToken = number | 'ellipsis-start' | 'ellipsis-end';

function getPageTokens(page: number, totalPages: number): PageToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (page <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis-end', totalPages];
  }

  if (page >= totalPages - 3) {
    return [1, 'ellipsis-start', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, 'ellipsis-start', page - 1, page, page + 1, 'ellipsis-end', totalPages];
}

export default function MasterTablePagination({
  currentCount,
  total,
  page,
  totalPages,
  onPageChange,
  tabIndexStart,
}: MasterTablePaginationProps) {
  const safeTotalPages = Math.max(1, totalPages);
  const safePage = Math.min(Math.max(1, page), safeTotalPages);
  const pageTokens = getPageTokens(safePage, safeTotalPages);
  let tabOffset = 1;

  return (
    <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <p className="whitespace-nowrap text-sm text-[var(--arcane-ink-soft)]">
        Showing {currentCount} of {total} results — Page {safePage} of {safeTotalPages}
      </p>
      <Pagination className="w-auto md:justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => onPageChange(safePage - 1)}
              disabled={safePage === 1}
              tabIndex={tabIndexStart}
            />
          </PaginationItem>
          {pageTokens.map((token) => {
            if (typeof token !== 'number') {
              return (
                <PaginationItem key={token}>
                  <PaginationEllipsis />
                </PaginationItem>
              );
            }

            const tabIndex = tabIndexStart === undefined ? undefined : tabIndexStart + tabOffset++;
            return (
              <PaginationItem key={token}>
                <PaginationLink
                  isActive={token === safePage}
                  aria-label={`Go to page ${token}`}
                  onClick={() => onPageChange(token)}
                  tabIndex={tabIndex}
                >
                  {token}
                </PaginationLink>
              </PaginationItem>
            );
          })}
          <PaginationItem>
            <PaginationNext
              onClick={() => onPageChange(safePage + 1)}
              disabled={safePage === safeTotalPages}
              tabIndex={tabIndexStart === undefined ? undefined : tabIndexStart + tabOffset}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}