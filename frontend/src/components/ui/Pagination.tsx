import * as React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

const Pagination = ({ className = '', ...props }: React.ComponentProps<'nav'>) => (
  <nav
    aria-label="Pagination"
    className={`flex w-full justify-center ${className}`}
    {...props}
  />
);

const PaginationContent = React.forwardRef<HTMLUListElement, React.ComponentProps<'ul'>>(
  ({ className = '', ...props }, ref) => (
    <ul ref={ref} className={`flex flex-row items-center gap-1 ${className}`} {...props} />
  ),
);
PaginationContent.displayName = 'PaginationContent';

const PaginationItem = React.forwardRef<HTMLLIElement, React.ComponentProps<'li'>>(
  ({ className = '', ...props }, ref) => <li ref={ref} className={className} {...props} />,
);
PaginationItem.displayName = 'PaginationItem';

type PaginationLinkProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isActive?: boolean;
  size?: 'icon' | 'default';
};

const PaginationLink = React.forwardRef<HTMLButtonElement, PaginationLinkProps>(
  ({ className = '', isActive = false, size = 'icon', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-current={isActive ? 'page' : undefined}
      className={`inline-flex h-9 items-center justify-center rounded-md border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--arcane-gold-600)] focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
        size === 'default' ? 'gap-1 px-2.5 sm:px-3' : 'w-9'
      } ${
        isActive
          ? 'border-[var(--arcane-gold-500)] bg-[var(--arcane-gold-500)] text-[var(--arcane-ink-950)]'
          : 'border-transparent bg-transparent text-[var(--arcane-ink-900)] hover:border-[var(--arcane-border-light)] hover:bg-[var(--arcane-paper-raised)]'
      } ${className}`}
      {...props}
    />
  ),
);
PaginationLink.displayName = 'PaginationLink';

const PaginationPrevious = React.forwardRef<HTMLButtonElement, PaginationLinkProps>(
  ({ children = 'Previous', ...props }, ref) => (
    <PaginationLink ref={ref} aria-label="Go to previous page" size="default" {...props}>
      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">{children}</span>
    </PaginationLink>
  ),
);
PaginationPrevious.displayName = 'PaginationPrevious';

const PaginationNext = React.forwardRef<HTMLButtonElement, PaginationLinkProps>(
  ({ children = 'Next', ...props }, ref) => (
    <PaginationLink ref={ref} aria-label="Go to next page" size="default" {...props}>
      <span className="hidden sm:inline">{children}</span>
      <ChevronRight className="h-4 w-4" aria-hidden="true" />
    </PaginationLink>
  ),
);
PaginationNext.displayName = 'PaginationNext';

const PaginationEllipsis = ({ className = '', ...props }: React.ComponentProps<'span'>) => (
  <span
    aria-hidden="true"
    className={`flex h-9 w-9 items-center justify-center text-[var(--arcane-ink-soft)] ${className}`}
    {...props}
  >
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More pages</span>
  </span>
);

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
};