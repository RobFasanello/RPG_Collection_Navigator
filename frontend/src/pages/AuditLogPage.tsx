import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleHelp } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import MasterTablePagination from '../components/MasterTablePagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Dialog } from '../components/ui/Dialog';
import AlertDialog from '../components/ui/AlertDialog';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import SelectionScopeMenu from '../components/ui/SelectionScopeMenu';
import { useToast } from '../components/ui/ToastProvider';
import FilterChipBar, { type FilterChipField } from '../components/inventory/FilterChipBar';
import { auditAPI, type AuditLogEntry, type AuditLogFilters } from '../services/api';

const ACTION_LABELS: Record<AuditLogEntry['Action'], string> = {
  INSERT: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
};

const ACTION_BADGE_CLASSES: Record<AuditLogEntry['Action'], string> = {
  INSERT: 'border-[var(--arcane-success-border)] bg-[var(--arcane-success-soft)] text-[var(--arcane-success-text)]',
  UPDATE: 'border-[var(--arcane-info-border)] bg-[var(--arcane-info-soft)] text-[var(--arcane-info-text)]',
  DELETE: 'border-[var(--arcane-danger-border)] bg-[var(--arcane-danger-soft)] text-[var(--arcane-danger-text)]',
};

const EMPTY_FILTERS: AuditLogFilters = {
  search: '',
  changedAtFrom: '',
  changedAtTo: '',
  action: '',
  tableName: '',
  recordId: '',
  user: '',
  isUndone: undefined,
};

type ValueMap = Record<string, unknown>;

function parseValues(raw: string | null): ValueMap | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as ValueMap) : null;
  } catch {
    return null;
  }
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  const text = String(value);
  return text.trim() === '' ? '—' : text;
}

function isSameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || a === undefined) return b === null || b === undefined;
  if (typeof a === 'object' || typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
  return String(a) === String(b);
}

export default function AuditLogPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('ChangedAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [searchInput, setSearchInput] = useState('');
  const [filterValues, setFilterValues] = useState<AuditLogFilters>(EMPTY_FILTERS);
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [restoreError, setRestoreError] = useState('');
  const [pendingDetailNavigation, setPendingDetailNavigation] = useState<
    { direction: 'previous' | 'next'; targetPage: number } | null
  >(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<number[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState('');
  const [bulkDeleteError, setBulkDeleteError] = useState('');
  const bulkDeleteConfirmInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['auditLog', page, sortBy, sortOrder, filterValues],
    queryFn: async () => {
      const response = await auditAPI.getLog({ page, pageSize: 10, sortBy, sortOrder, ...filterValues });
      return response.data;
    },
    keepPreviousData: true,
  });

  useEffect(() => {
    setSelectedEntryIds([]);
    setIsBulkDeleteOpen(false);
    setBulkDeleteConfirmText('');
    setBulkDeleteError('');
  }, [page, sortBy, sortOrder, filterValues]);

  useEffect(() => {
    if (!isBulkDeleteOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      bulkDeleteConfirmInputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isBulkDeleteOpen]);

  useEffect(() => {
    const handle = setTimeout(() => {
      const trimmed = searchInput.trim();
      setFilterValues((current) => {
        if (trimmed === (current.search ?? '')) {
          return current;
        }
        return { ...current, search: trimmed };
      });
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const handleFilterChange = (patch: Partial<AuditLogFilters>) => {
    setFilterValues((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const clearAllChipFilters = () => {
    setFilterValues((current) => ({ ...EMPTY_FILTERS, search: current.search }));
    setPage(1);
  };

  const filterChipFields: FilterChipField[] = [
    {
      key: 'changedAt',
      label: 'Changed At',
      kind: 'dateRange',
      from: filterValues.changedAtFrom ?? '',
      to: filterValues.changedAtTo ?? '',
      onApply: (from, to) => handleFilterChange({ changedAtFrom: from, changedAtTo: to }),
      onClear: () => handleFilterChange({ changedAtFrom: '', changedAtTo: '' }),
    },
    {
      key: 'action',
      label: 'Action',
      kind: 'singleSelect',
      options: [
        { value: 'INSERT', label: ACTION_LABELS.INSERT },
        { value: 'UPDATE', label: ACTION_LABELS.UPDATE },
        { value: 'DELETE', label: ACTION_LABELS.DELETE },
      ],
      value: filterValues.action ?? '',
      onApply: (value) => handleFilterChange({ action: value as AuditLogEntry['Action'] }),
      onClear: () => handleFilterChange({ action: '' }),
    },
    {
      key: 'tableName',
      label: 'Table',
      kind: 'text',
      value: filterValues.tableName ?? '',
      onApply: (value) => handleFilterChange({ tableName: value }),
      onClear: () => handleFilterChange({ tableName: '' }),
    },
    {
      key: 'recordId',
      label: 'Record ID',
      kind: 'text',
      value: filterValues.recordId ?? '',
      onApply: (value) => handleFilterChange({ recordId: value }),
      onClear: () => handleFilterChange({ recordId: '' }),
    },
    {
      key: 'user',
      label: 'User',
      kind: 'text',
      value: filterValues.user ?? '',
      onApply: (value) => handleFilterChange({ user: value }),
      onClear: () => handleFilterChange({ user: '' }),
    },
    {
      key: 'isUndone',
      label: 'Undone',
      kind: 'yesNo',
      value: filterValues.isUndone,
      onApply: (value) => handleFilterChange({ isUndone: value }),
    },
  ];

  const detailRows = useMemo(() => {
    if (!selectedEntry) return [];
    const oldValues = parseValues(selectedEntry.OldValues);
    const newValues = parseValues(selectedEntry.NewValues);
    const fields = Array.from(new Set([...Object.keys(oldValues ?? {}), ...Object.keys(newValues ?? {})])).sort();

    return fields.map((field) => {
      const before = oldValues ? oldValues[field] : undefined;
      const after = newValues ? newValues[field] : undefined;
      return {
        field,
        before,
        after,
        changed: !!oldValues && !!newValues && !isSameValue(before, after),
      };
    });
  }, [selectedEntry]);

  const changedRows = useMemo(() => detailRows.filter((row) => row.changed), [detailRows]);

  const currentPageEntries: AuditLogEntry[] = Array.isArray(data?.data) ? data.data : [];
  const currentEntryIndex = useMemo(() => {
    if (!selectedEntry) {
      return -1;
    }
    return currentPageEntries.findIndex((entry) => entry.AuditLogID === selectedEntry.AuditLogID);
  }, [currentPageEntries, selectedEntry]);
  const totalPages = data?.totalPages ?? 1;
  const canNavigateToPreviousEntry = Boolean(selectedEntry && (currentEntryIndex > 0 || page > 1));
  const canNavigateToNextEntry = Boolean(
    selectedEntry && ((currentEntryIndex >= 0 && currentEntryIndex < currentPageEntries.length - 1) || page < totalPages)
  );

  const selectedEntryIdSet = useMemo(() => new Set(selectedEntryIds), [selectedEntryIds]);
  const areAllCurrentPageEntriesSelected =
    currentPageEntries.length > 0 && currentPageEntries.every((entry) => selectedEntryIdSet.has(entry.AuditLogID));

  const selectCurrentPageEntries = () => {
    setSelectedEntryIds(currentPageEntries.map((entry) => entry.AuditLogID));
  };

  const selectAllFilteredEntries = async () => {
    const allIds: number[] = [];
    let nextPage = 1;
    let lastPage = 1;

    while (nextPage <= lastPage) {
      const response = await auditAPI.getLog({
        page: nextPage,
        pageSize: 100,
        sortBy,
        sortOrder,
        ...filterValues,
      });

      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      rows.forEach((entry) => allIds.push(entry.AuditLogID));
      lastPage = Number(response.data?.totalPages || 1);
      nextPage += 1;
    }

    setSelectedEntryIds(allIds);
  };

  const toggleEntrySelection = (auditLogId: number) => {
    setSelectedEntryIds((current) =>
      current.includes(auditLogId) ? current.filter((id) => id !== auditLogId) : [...current, auditLogId]
    );
  };

  const openDetailEntry = (entry: AuditLogEntry) => {
    setPendingDetailNavigation(null);
    setSelectedEntry(entry);
    setRestoreError('');
  };

  const handleNavigateDetail = (direction: 'previous' | 'next') => {
    if (!selectedEntry) {
      return;
    }

    if (direction === 'previous') {
      if (currentEntryIndex > 0) {
        openDetailEntry(currentPageEntries[currentEntryIndex - 1]);
        return;
      }

      if (page > 1) {
        setPendingDetailNavigation({ direction: 'previous', targetPage: page - 1 });
        setPage((current) => Math.max(1, current - 1));
      }
      return;
    }

    if (currentEntryIndex >= 0 && currentEntryIndex < currentPageEntries.length - 1) {
      openDetailEntry(currentPageEntries[currentEntryIndex + 1]);
      return;
    }

    if (page < totalPages) {
      setPendingDetailNavigation({ direction: 'next', targetPage: page + 1 });
      setPage((current) => current + 1);
    }
  };

  useEffect(() => {
    if (!selectedEntry || !pendingDetailNavigation || !currentPageEntries.length) {
      return;
    }

    if ((data?.page ?? 0) !== pendingDetailNavigation.targetPage) {
      return;
    }

    setPendingDetailNavigation(null);

    if (pendingDetailNavigation.direction === 'previous') {
      setSelectedEntry(currentPageEntries[currentPageEntries.length - 1]);
      return;
    }

    setSelectedEntry(currentPageEntries[0]);
  }, [selectedEntry, pendingDetailNavigation, currentPageEntries, data?.page]);

  const restoreMutation = useMutation({
    mutationFn: (auditLogId: number) => auditAPI.undo(auditLogId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditLog'] });
      toast({ title: 'Change restored', variant: 'success' });
      setSelectedEntry(null);
      setRestoreError('');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Failed to restore this change.';
      setRestoreError(message);
      toast({ title: message, variant: 'error' });
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (auditLogId: number) => auditAPI.deleteEntry(auditLogId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auditLog'] });
      toast({ title: 'Audit Entry Deleted', description: 'Deleted the selected audit log entry.', variant: 'success' });
      setPendingDetailNavigation(null);
      setSelectedEntry(null);
      setRestoreError('');
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Failed to delete audit entry.';
      setRestoreError(message);
      toast({ title: message, variant: 'error' });
    },
  });

  const handleDeleteAuditEntry = () => {
    if (!selectedEntry) {
      return;
    }

    const confirmed = confirm('Delete this audit log entry? This cannot be undone.');
    if (!confirmed) {
      return;
    }

    setRestoreError('');
    deleteEntryMutation.mutate(selectedEntry.AuditLogID);
  };

  const closeDetail = () => {
    setPendingDetailNavigation(null);
    setSelectedEntry(null);
    setRestoreError('');
  };

  const bulkDeleteMutation = useMutation({
    mutationFn: async (auditLogIds: number[]) => {
      const response = await auditAPI.bulkDeleteEntries(auditLogIds);
      return response.data;
    },
    onSuccess: () => {
      const deletedCount = selectedEntryIds.length;
      queryClient.invalidateQueries({ queryKey: ['auditLog'] });
      setSelectedEntryIds([]);
      setIsBulkDeleteOpen(false);
      setBulkDeleteConfirmText('');
      setBulkDeleteError('');
      toast({
        title: deletedCount === 1 ? 'Audit Entry Deleted' : 'Audit Entries Deleted',
        description:
          deletedCount === 1
            ? 'Removed 1 selected audit log entry.'
            : `Removed ${deletedCount} selected audit log entries.`,
        variant: 'success',
      });
    },
    onError: (error: any) => {
      setBulkDeleteError(error.response?.data?.error || 'Failed to bulk delete selected audit log entries');
    },
  });

  const openBulkDeleteDialog = () => {
    if (selectedEntryIds.length < 1) {
      return;
    }

    setBulkDeleteError('');
    setBulkDeleteConfirmText('');
    setIsBulkDeleteOpen(true);
  };

  const closeBulkDeleteDialog = () => {
    setIsBulkDeleteOpen(false);
    setBulkDeleteConfirmText('');
    setBulkDeleteError('');
  };

  const handleBulkDeleteConfirm = () => {
    if (bulkDeleteConfirmText.trim() !== 'DELETE') {
      setBulkDeleteError('Type DELETE exactly to enable bulk delete.');
      return;
    }

    setBulkDeleteError('');
    bulkDeleteMutation.mutate(selectedEntryIds);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
    } else {
      setSortBy(column);
      setSortOrder('ASC');
    }
    setPage(1);
  };

  const SortIndicator = ({ column }: { column: string }) => {
    if (sortBy !== column) {
      return <span className="ml-1 text-[var(--arcane-ink-soft)]">↕</span>;
    }
    return <span className="ml-1">{sortOrder === 'ASC' ? '↑' : '↓'}</span>;
  };

  return (
    <AdminLayout
      title={
        <span className="inline-flex items-center gap-2">
          <span>Audit Log</span>
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[var(--arcane-ink-soft)] hover:text-[var(--arcane-ink-900)]"
            title="Use this screen to view and remove audit log entries in the application database."
            aria-label="Audit Log page information"
          >
            <CircleHelp className="h-4 w-4" aria-hidden="true" />
          </span>
        </span>
      }
      subtitle={null}
    >
      <div className="max-w-[1920px] mx-auto space-y-6 px-0 2xl:px-2">
        <section className="bg-[var(--arcane-paper-raised)] shadow rounded-lg p-6">
          {isLoading && <p className="text-[var(--arcane-ink-soft)]">Loading audit log...</p>}
          {!!error && <p className="text-red-600">Error loading audit log.</p>}

          {!isLoading && !error && (
            <>
              {selectedEntryIds.length > 0 ? (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--arcane-gold-500-border)] bg-[var(--arcane-gold-soft)] px-4 py-3">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-semibold text-[var(--arcane-gold-700)]">{selectedEntryIds.length} selected</span>
                    <button
                      type="button"
                      className="text-[var(--arcane-gold-700)] hover:text-[var(--arcane-gold-700)] underline underline-offset-2"
                      onClick={() => setSelectedEntryIds([])}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      className="border border-red-300 !bg-[var(--arcane-paper-raised)] !text-red-700 hover:!bg-red-50"
                      onClick={openBulkDeleteDialog}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <Input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    onClear={() => setSearchInput('')}
                    clearable
                    clearAriaLabel="Clear audit log search"
                    placeholder="Search by record number, user, or old/new values..."
                    className="max-w-xl flex-shrink-0"
                    autoFocus
                  />
                  <div className="min-w-0 flex-1">
                    <FilterChipBar fields={filterChipFields} onClearAll={clearAllChipFilters} />
                  </div>
                </div>
              )}

              <div className="h-[608px] overflow-hidden">
                <Table className="table-fixed [&_th]:overflow-hidden [&_th_button]:overflow-hidden [&_th_button]:whitespace-nowrap [&_tbody_tr]:h-14 [&_tbody_td]:overflow-hidden [&_tbody_td]:text-ellipsis [&_tbody_td]:whitespace-nowrap">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[4%] whitespace-nowrap px-2 text-center">
                        <SelectionScopeMenu
                          checked={areAllCurrentPageEntriesSelected}
                          disabled={currentPageEntries.length === 0}
                          ariaLabel="Select audit log entries"
                          onSelectPage={selectCurrentPageEntries}
                          onSelectAll={() => {
                            void selectAllFilteredEntries();
                          }}
                        />
                      </TableHead>
                      <TableHead className="w-[15%]">
                        <button onClick={() => handleSort('ChangedAt')} className="flex items-center hover:text-[var(--arcane-gold-700)]">
                          Changed At <SortIndicator column="ChangedAt" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[9%]">
                        <button onClick={() => handleSort('Action')} className="flex items-center hover:text-[var(--arcane-gold-700)]">
                          Action <SortIndicator column="Action" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[15%]">
                        <button onClick={() => handleSort('TableName')} className="flex items-center hover:text-[var(--arcane-gold-700)]">
                          Table <SortIndicator column="TableName" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[13%]">
                        <button onClick={() => handleSort('RecordID')} className="flex items-center hover:text-[var(--arcane-gold-700)]">
                          Record ID <SortIndicator column="RecordID" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[20%]">
                        <button onClick={() => handleSort('UserName')} className="flex items-center hover:text-[var(--arcane-gold-700)]">
                          User <SortIndicator column="UserName" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[9%] text-center">
                        <button onClick={() => handleSort('IsUndone')} className="flex items-center justify-center w-full hover:text-[var(--arcane-gold-700)]">
                          Undone <SortIndicator column="IsUndone" />
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(data?.data) && data.data.length ? (
                      data.data.map((entry) => (
                        <TableRow
                          key={entry.AuditLogID}
                          onClick={() => openDetailEntry(entry)}
                          tabIndex={0}
                          role="button"
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              openDetailEntry(entry);
                            }
                          }}
                          className="cursor-pointer hover:bg-[var(--arcane-paper)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--arcane-gold-600)]"
                        >
                          <TableCell className="w-px whitespace-nowrap px-2 text-center" onClick={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedEntryIdSet.has(entry.AuditLogID)}
                              onChange={() => toggleEntrySelection(entry.AuditLogID)}
                              aria-label={`Select audit log entry ${entry.AuditLogID}`}
                            />
                          </TableCell>
                          <TableCell title={new Date(entry.ChangedAt).toLocaleString()}>
                            {new Date(entry.ChangedAt).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${ACTION_BADGE_CLASSES[entry.Action]}`}
                            >
                              {ACTION_LABELS[entry.Action]}
                            </span>
                          </TableCell>
                          <TableCell>{entry.TableName}</TableCell>
                          <TableCell>{entry.RecordID}</TableCell>
                          <TableCell>{entry.UserName || entry.UserEmail}</TableCell>
                          <TableCell className="text-center">{entry.IsUndone ? 'Yes' : '-'}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-10 text-[var(--arcane-ink-soft)]">
                          No audit log entries found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <MasterTablePagination
                currentCount={data?.data?.length ?? 0}
                total={data?.total ?? 0}
                page={data?.page ?? page}
                totalPages={data?.totalPages ?? 1}
                onPageChange={setPage}
              />
            </>
          )}
        </section>
      </div>

      <Dialog
        open={!!selectedEntry}
        onOpenChange={(open) => {
          if (!open) closeDetail();
        }}
        title="Edit Audit Log Detail"
        showCloseButton={false}
        contentClassName="max-w-5xl h-[min(720px,90vh)]"
        topRightActions={
          <>
            <Button
              type="button"
              className="h-9 !bg-[var(--arcane-border-light)] !text-[var(--arcane-ink-900)] hover:!bg-[var(--arcane-border-light)]"
              onClick={() => handleNavigateDetail('previous')}
              disabled={!canNavigateToPreviousEntry || restoreMutation.isLoading || deleteEntryMutation.isLoading}
              aria-label="Previous entry"
              title="Previous entry"
            >
              Prev
            </Button>
            <Button
              type="button"
              className="h-9 !bg-[var(--arcane-border-light)] !text-[var(--arcane-ink-900)] hover:!bg-[var(--arcane-border-light)]"
              onClick={() => handleNavigateDetail('next')}
              disabled={!canNavigateToNextEntry || restoreMutation.isLoading || deleteEntryMutation.isLoading}
              aria-label="Next entry"
              title="Next entry"
            >
              Next
            </Button>
          </>
        }
      >
        {selectedEntry && (
          <div className="flex h-full min-h-0 flex-col gap-4">
            <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--arcane-ink-soft)]">Changed At</dt>
                <dd className="text-[var(--arcane-ink-900)]">{new Date(selectedEntry.ChangedAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--arcane-ink-soft)]">Action</dt>
                <dd>
                  <span
                    className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${ACTION_BADGE_CLASSES[selectedEntry.Action]}`}
                  >
                    {ACTION_LABELS[selectedEntry.Action]}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--arcane-ink-soft)]">Table / Record</dt>
                <dd className="text-[var(--arcane-ink-900)]">
                  {selectedEntry.TableName} · {selectedEntry.RecordID}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--arcane-ink-soft)]">User</dt>
                <dd className="text-[var(--arcane-ink-900)]">{selectedEntry.UserName || selectedEntry.UserEmail}</dd>
              </div>
            </dl>

            {detailRows.length === 0 ? (
              <p className="text-sm text-[var(--arcane-ink-soft)]">No field-level data was recorded for this entry.</p>
            ) : (
              <>
                {selectedEntry.Action === 'UPDATE' && (
                  <p className="shrink-0 text-sm text-[var(--arcane-ink-soft)]">
                    {changedRows.length} of {detailRows.length} fields changed. Changed fields are highlighted.
                  </p>
                )}
                <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[var(--arcane-border-light)]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[24%]">Field</TableHead>
                        <TableHead className="w-[38%]">Original</TableHead>
                        <TableHead className="w-[38%]">Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailRows.map((row) => (
                        <TableRow
                          key={row.field}
                          className={row.changed ? 'bg-[var(--arcane-info-soft)]' : undefined}
                        >
                          <TableCell className="font-medium text-[var(--arcane-ink-900)]">{row.field}</TableCell>
                          <TableCell className="whitespace-pre-wrap break-words align-top text-[var(--arcane-ink-900)]">
                            {selectedEntry.Action === 'INSERT' ? '—' : formatValue(row.before)}
                          </TableCell>
                          <TableCell className="whitespace-pre-wrap break-words align-top text-[var(--arcane-ink-900)]">
                            {selectedEntry.Action === 'DELETE' ? '—' : formatValue(row.after)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            {restoreError && <p className="shrink-0 text-sm text-[var(--arcane-danger-text)]">{restoreError}</p>}

            <div className="flex shrink-0 items-center justify-end gap-2">
              <Button
                type="button"
                className="bg-red-600 hover:bg-red-700 mr-auto"
                onClick={handleDeleteAuditEntry}
                disabled={restoreMutation.isLoading || deleteEntryMutation.isLoading}
              >
                {deleteEntryMutation.isLoading ? 'Deleting...' : 'Delete Audit Entry'}
              </Button>
              <Button
                type="button"
                onClick={closeDetail}
                className="border border-[var(--arcane-border-light)] !bg-[var(--arcane-paper-raised)] !text-[var(--arcane-ink-900)] hover:!bg-[var(--arcane-paper)]"
                disabled={restoreMutation.isLoading || deleteEntryMutation.isLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => restoreMutation.mutate(selectedEntry.AuditLogID)}
                disabled={selectedEntry.IsUndone || restoreMutation.isLoading || deleteEntryMutation.isLoading}
                title={selectedEntry.IsUndone ? 'This change has already been restored' : 'Reverse this change'}
              >
                {restoreMutation.isLoading ? 'Restoring...' : 'Restore'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {isBulkDeleteOpen ? (
        <AlertDialog
          open={isBulkDeleteOpen}
          onOpenChange={(open) => {
            if (open) {
              setIsBulkDeleteOpen(true);
              return;
            }

            closeBulkDeleteDialog();
          }}
          title="Confirm Bulk Delete"
          description={`You are about to permanently delete ${selectedEntryIds.length} selected audit log entr${selectedEntryIds.length === 1 ? 'y' : 'ies'}. This action cannot be undone.`}
          footer={(
            <>
              <Button
                type="button"
                className="!bg-[var(--arcane-ink-700)] hover:!bg-[var(--arcane-ink-800)] !text-white"
                onClick={closeBulkDeleteDialog}
                disabled={bulkDeleteMutation.isLoading}
              >
                Cancel
              </Button>
              {bulkDeleteConfirmText.trim() === 'DELETE' ? (
                <Button
                  type="button"
                  className="bg-red-600 hover:bg-red-700"
                  onClick={handleBulkDeleteConfirm}
                  disabled={bulkDeleteMutation.isLoading}
                >
                  {bulkDeleteMutation.isLoading ? 'Deleting...' : `Delete ${selectedEntryIds.length} Entries`}
                </Button>
              ) : null}
            </>
          )}
        >
          <div className="space-y-5">
            {bulkDeleteError ? (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                {bulkDeleteError}
              </div>
            ) : null}

            <div>
              <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">
                Type DELETE to confirm
              </label>
              <Input
                ref={bulkDeleteConfirmInputRef}
                value={bulkDeleteConfirmText}
                onChange={(event) => {
                  setBulkDeleteError('');
                  setBulkDeleteConfirmText(event.target.value);
                }}
                placeholder="DELETE"
                disabled={bulkDeleteMutation.isLoading}
              />
            </div>
          </div>
        </AlertDialog>
      ) : null}
    </AdminLayout>
  );
}
