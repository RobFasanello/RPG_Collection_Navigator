import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleHelp } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import MasterTablePagination from '../components/MasterTablePagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { Dialog } from '../components/ui/Dialog';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/ToastProvider';
import { auditAPI, type AuditLogEntry } from '../services/api';

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
  const [selectedEntry, setSelectedEntry] = useState<AuditLogEntry | null>(null);
  const [restoreError, setRestoreError] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['auditLog', page, sortBy, sortOrder],
    queryFn: async () => {
      const response = await auditAPI.getLog({ page, pageSize: 10, sortBy, sortOrder });
      return response.data;
    },
    keepPreviousData: true,
  });

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

  const closeDetail = () => {
    setSelectedEntry(null);
    setRestoreError('');
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
            title="View a log of all changes made to records in your collection."
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
              <div className="h-[608px] overflow-hidden">
                <Table className="table-fixed [&_th]:overflow-hidden [&_th_button]:overflow-hidden [&_th_button]:whitespace-nowrap [&_tbody_tr]:h-14 [&_tbody_td]:overflow-hidden [&_tbody_td]:text-ellipsis [&_tbody_td]:whitespace-nowrap">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[16%]">
                        <button onClick={() => handleSort('ChangedAt')} className="flex items-center hover:text-[var(--arcane-gold-700)]">
                          Changed At <SortIndicator column="ChangedAt" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[10%]">
                        <button onClick={() => handleSort('Action')} className="flex items-center hover:text-[var(--arcane-gold-700)]">
                          Action <SortIndicator column="Action" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[16%]">
                        <button onClick={() => handleSort('TableName')} className="flex items-center hover:text-[var(--arcane-gold-700)]">
                          Table <SortIndicator column="TableName" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[14%]">
                        <button onClick={() => handleSort('RecordID')} className="flex items-center hover:text-[var(--arcane-gold-700)]">
                          Record ID <SortIndicator column="RecordID" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[22%]">
                        <button onClick={() => handleSort('UserName')} className="flex items-center hover:text-[var(--arcane-gold-700)]">
                          User <SortIndicator column="UserName" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[10%] text-center">
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
                          onClick={() => setSelectedEntry(entry)}
                          tabIndex={0}
                          role="button"
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedEntry(entry);
                            }
                          }}
                          className="cursor-pointer hover:bg-[var(--arcane-paper)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--arcane-gold-600)]"
                        >
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
                        <TableCell colSpan={6} className="text-center py-10 text-[var(--arcane-ink-soft)]">
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
        title="Audit Log Detail"
        showCloseButton={false}
        contentClassName="max-w-5xl h-[min(720px,90vh)]"
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

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[var(--arcane-border-light)] pt-4">
              <Button
                type="button"
                onClick={closeDetail}
                className="border border-[var(--arcane-border-light)] !bg-[var(--arcane-paper-raised)] !text-[var(--arcane-ink-900)] hover:!bg-[var(--arcane-paper)]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => restoreMutation.mutate(selectedEntry.AuditLogID)}
                disabled={selectedEntry.IsUndone || restoreMutation.isLoading}
                title={selectedEntry.IsUndone ? 'This change has already been restored' : 'Reverse this change'}
              >
                {restoreMutation.isLoading ? 'Restoring...' : 'Restore'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </AdminLayout>
  );
}
