import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import AdminLayout from './AdminLayout';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Dialog } from './ui/Dialog';
import { tableAPI } from '../services/api';

type FieldType = 'text' | 'url' | 'textarea';

type QuickLink = {
  label: string;
  to: string;
};

export type ReferenceFieldConfig = {
  key: string;
  label: string;
  placeholder?: string;
  type?: FieldType;
  required?: boolean;
};

type ReferenceMasterDetailPageProps = {
  title: string;
  subtitle: string;
  tableName: string;
  idColumn: string;
  nameColumn: string;
  nameLabel: string;
  namePlaceholder: string;
  newButtonLabel: string;
  newTitle: string;
  editTitle: string;
  deleteConflictMessage: string;
  fields?: ReferenceFieldConfig[];
  listItemSummary?: (record: Record<string, any>) => ReactNode;
};

const makeInitialFormValues = (fields: ReferenceFieldConfig[]) => {
  return fields.reduce((values, field) => {
    values[field.key] = '';
    return values;
  }, {} as Record<string, string>);
};

const buildQueryLink = (path: string, params: Record<string, string>) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (String(value).trim()) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
};

const buildReferenceQuickLinks = (tableName: string, selectedName: string): QuickLink[] => {
  switch (tableName) {
    case 'CollectionType':
      return [
        { label: 'Open Collections setup', to: '/home/setup/collections' },
      ];

    case 'RPGSystem':
      return [
        { label: 'View collections for this RPG system', to: buildQueryLink('/home/setup/collections', { rpgSystem: selectedName }) },
      ];

    case 'LocationType':
      return [
        { label: 'Open Locations setup', to: '/home/setup/locations' },
      ];

    case 'Store':
      return [
        { label: 'View orders for this store', to: buildQueryLink('/home/orders', { store: selectedName }) },
        { label: 'Open all orders', to: '/home/orders' },
      ];

    case 'MiniatureSize':
      return [
        { label: 'View miniatures with this size', to: buildQueryLink('/home/miniatures', { miniatureSize: selectedName }) },
      ];

    case 'MiniatureRarity':
      return [
        { label: 'View miniatures with this rarity', to: buildQueryLink('/home/miniatures', { miniatureRarity: selectedName }) },
      ];

    case 'Status':
      return [
        { label: 'View orders with this status', to: buildQueryLink('/home/orders', { status: selectedName }) },
        { label: 'Open all orders', to: '/home/orders' },
      ];

    default:
      return [];
  }
};

export default function ReferenceMasterDetailPage({
  title,
  subtitle,
  tableName,
  idColumn,
  nameColumn,
  nameLabel,
  namePlaceholder,
  newButtonLabel,
  newTitle,
  editTitle,
  deleteConflictMessage,
  fields = [],
  listItemSummary,
}: ReferenceMasterDetailPageProps) {
  const queryClient = useQueryClient();
  const allFields = useMemo<ReferenceFieldConfig[]>(() => {
    const baseField: ReferenceFieldConfig = {
      key: nameColumn,
      label: nameLabel,
      placeholder: namePlaceholder,
      type: 'text',
      required: true,
    };

    return [baseField, ...fields.filter((field) => field.key !== nameColumn)];
  }, [fields, nameColumn, nameLabel, namePlaceholder]);

  const initialFormValues = useMemo(() => makeInitialFormValues(allFields), [allFields]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [searchInput, setSearchInput] = useState('');
  const [formValues, setFormValues] = useState<Record<string, string>>(initialFormValues);
  const [initialSelectedValues, setInitialSelectedValues] = useState<Record<string, string>>(initialFormValues);
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const { data: records = [], isLoading, error } = useQuery<Record<string, any>[], Error>({
    queryKey: ['table', tableName],
    queryFn: async () => tableAPI.getAllRecords(tableName),
  });

  const selectedRecord = useMemo(() => {
    if (mode === 'new' || selectedId === null) {
      return null;
    }

    return records.find((record) => Number(record[idColumn]) === selectedId) ?? null;
  }, [idColumn, mode, records, selectedId]);

  const filteredRecords = useMemo(() => {
    const search = searchInput.trim().toLowerCase();
    if (!search) {
      return [...records].sort((a, b) => String(a[nameColumn] ?? '').localeCompare(String(b[nameColumn] ?? '')));
    }

    return [...records]
      .filter((record) => String(record[nameColumn] ?? '').toLowerCase().includes(search))
      .sort((a, b) => String(a[nameColumn] ?? '').localeCompare(String(b[nameColumn] ?? '')));
  }, [nameColumn, records, searchInput]);

  const populateForm = (record: Record<string, any> | null) => {
    if (!record) {
      setFormValues(initialFormValues);
      setInitialSelectedValues(initialFormValues);
      return;
    }

    const nextValues = allFields.reduce((values, field) => {
      values[field.key] = String(record[field.key] ?? '').trim();
      return values;
    }, {} as Record<string, string>);

    setFormValues(nextValues);
    setInitialSelectedValues(nextValues);
    setFormError('');
    setDeleteError('');
  };

  useEffect(() => {
    if (mode === 'new') {
      return;
    }

    if (selectedRecord) {
      populateForm(selectedRecord);
      return;
    }

    if (filteredRecords.length > 0 && selectedId === null) {
      setSelectedId(Number(filteredRecords[0][idColumn]));
    }
  }, [filteredRecords, idColumn, mode, selectedRecord, selectedId]);

  useEffect(() => {
    if (mode === 'new' || selectedId !== null || filteredRecords.length === 0) {
      return;
    }

    setSelectedId(Number(filteredRecords[0][idColumn]));
  }, [filteredRecords, idColumn, mode, selectedId]);

  const closeToExisting = () => {
    setMode('existing');
    if (selectedId !== null) {
      const record = records.find((item) => Number(item[idColumn]) === selectedId) ?? null;
      populateForm(record);
    }
  };

  const handleAdd = () => {
    setMode('new');
    setSelectedId(null);
    setFormError('');
    setDeleteError('');
    populateForm(null);
    window.setTimeout(() => {
      nameInputRef.current?.focus();
    }, 0);
  };

  const handleSelect = (recordId: number) => {
    setMode('existing');
    setSelectedId(recordId);
    setFormError('');
    setDeleteError('');
  };

  const refreshAndSelect = async (preferredName?: string) => {
    const refreshed = await queryClient.fetchQuery({
      queryKey: ['table', tableName],
      queryFn: async () => tableAPI.getAllRecords(tableName),
    });

    const refreshedRecords = Array.isArray(refreshed) ? refreshed : [];

    if (preferredName) {
      const matched = refreshedRecords.find((record: Record<string, any>) => String(record[nameColumn] ?? '').trim().toLowerCase() === preferredName.trim().toLowerCase());
      if (matched?.[idColumn] != null) {
        setMode('existing');
        setSelectedId(Number(matched[idColumn]));
        populateForm(matched);
        return;
      }
    }

    if (selectedId !== null) {
      const matched = refreshedRecords.find((record: Record<string, any>) => Number(record[idColumn]) === selectedId);
      if (matched) {
        populateForm(matched);
        return;
      }
    }

    if (refreshedRecords.length > 0) {
      const firstRecord = refreshedRecords[0];
      setMode('existing');
      setSelectedId(Number(firstRecord[idColumn]));
      populateForm(firstRecord);
      return;
    }

    setMode('new');
    setSelectedId(null);
    populateForm(null);
  };

  const handleDelete = async () => {
    if (selectedId === null || !confirm('Are you sure you want to delete this record?')) {
      return;
    }

    setDeleteError('');
    setIsSaving(true);
    try {
      await tableAPI.deleteRecord(tableName, selectedId);
      await queryClient.invalidateQueries({ queryKey: ['table', tableName] });
      const remaining = await queryClient.fetchQuery({
        queryKey: ['table', tableName],
        queryFn: async () => tableAPI.getAllRecords(tableName),
      });

      const remainingRecords = Array.isArray(remaining) ? remaining : [];
      if (remainingRecords.length > 0) {
        const firstRecord = remainingRecords[0];
        setMode('existing');
        setSelectedId(Number(firstRecord[idColumn]));
        populateForm(firstRecord);
      } else {
        setMode('new');
        setSelectedId(null);
        populateForm(null);
      }
    } catch (error: any) {
      const backendError = String(error?.response?.data?.error || error?.message || '').trim();
      const backendMessage = backendError.toLowerCase();
      const referentialIntegrityConflict =
        backendMessage.includes('reference constraint') ||
        backendMessage.includes('foreign key') ||
        backendMessage.includes('conflicted with the reference') ||
        backendMessage.includes('still referenced');

      setDeleteError(referentialIntegrityConflict ? deleteConflictMessage : backendError || 'Delete failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const hasFormInput = allFields.some((field) => String(formValues[field.key] ?? '').trim() !== '');
  const hasChanges = mode === 'existing'
    ? allFields.some((field) => String(formValues[field.key] ?? '').trim() !== String(initialSelectedValues[field.key] ?? '').trim())
    : false;
  const selectedRecordName = selectedRecord ? String(selectedRecord[nameColumn] ?? '').trim() : '';
  const quickLinks = useMemo(() => {
    if (!selectedRecord || mode !== 'existing') {
      return [];
    }

    return buildReferenceQuickLinks(tableName, selectedRecordName);
  }, [mode, selectedRecord, selectedRecordName, tableName]);

  return (
    <AdminLayout title={title} subtitle={subtitle}>
      <div className="mx-auto grid max-w-[1500px] gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] shadow-sm">
          <div className="space-y-4 border-b border-[var(--arcane-border-light)] p-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--arcane-ink-900)]">{title}</h2>
              <p className="text-sm text-[var(--arcane-ink-soft)]">Select a record to edit it.</p>
            </div>
            <Button onClick={handleAdd} className="w-full">
              {newButtonLabel}
            </Button>
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onClear={() => setSearchInput('')}
              clearable
              clearAriaLabel={`Clear ${title.toLowerCase()} search`}
              placeholder={`Search ${title.toLowerCase()}...`}
            />
          </div>

          <div className="max-h-[calc(100vh-260px)] overflow-y-auto p-2">
            {isLoading ? (
              <div className="p-4 text-sm text-[var(--arcane-ink-soft)]">Loading...</div>
            ) : error ? (
              <div className="p-4 text-sm text-red-600">Error loading records.</div>
            ) : filteredRecords.length === 0 ? (
              <div className="p-4 text-sm text-[var(--arcane-ink-soft)]">No records found.</div>
            ) : (
              <div className="space-y-1">
                {filteredRecords.map((record) => {
                  const isSelected = mode === 'existing' && Number(record[idColumn]) === selectedId;

                  return (
                    <button
                      key={record[idColumn]}
                      type="button"
                      onClick={() => handleSelect(Number(record[idColumn]))}
                      className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                        isSelected
                          ? 'border-[#b8864866] bg-[#b886481a] shadow-sm'
                          : 'border-transparent bg-[var(--arcane-paper-raised)] hover:border-[var(--arcane-border-light)] hover:bg-[var(--arcane-paper)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--arcane-ink-900)]">{String(record[nameColumn] ?? '').trim()}</div>
                          {listItemSummary ? <div className="text-xs text-[var(--arcane-ink-soft)]">{listItemSummary(record)}</div> : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <section className="min-w-0 rounded-xl border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] shadow-sm xl:min-w-[720px]">
          <div className="border-b border-[var(--arcane-border-light)] px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[var(--arcane-ink-900)]">
                  {mode === 'new' ? newTitle : editTitle}
                </h2>
                <p className="text-sm text-[var(--arcane-ink-soft)]">
                  {mode === 'new'
                    ? `Create a new ${title.toLowerCase()}.`
                    : selectedRecord
                      ? `Editing ${String(selectedRecord[nameColumn] ?? '').trim()}.`
                      : `Edit this ${title.toLowerCase()} using the form below.`}
                </p>
              </div>
            </div>
          </div>

          <div className="p-5">
            {formError ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</div> : null}
            {deleteError ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{deleteError}</div> : null}

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">
                <form
                  className="space-y-4"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setFormError('');

                    const payload = allFields.reduce((values, field) => {
                      const value = String(formValues[field.key] ?? '').trim();
                      if (field.required !== false && !value) {
                        setFormError(`${field.label} is required.`);
                        return values;
                      }
                      values[field.key] = value;
                      return values;
                    }, {} as Record<string, string>);

                    if (!payload[nameColumn]) {
                      return;
                    }

                    setIsSaving(true);
                    try {
                      if (mode === 'existing' && selectedId !== null) {
                        await tableAPI.updateRecord(tableName, selectedId, {
                          [idColumn]: selectedId,
                          ...payload,
                        });
                      } else {
                        await tableAPI.createRecord(tableName, payload);
                      }

                      await queryClient.invalidateQueries({ queryKey: ['table', tableName] });
                      await refreshAndSelect(payload[nameColumn]);
                    } catch (err: any) {
                      setFormError(err.response?.data?.error || 'Error saving record');
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    {allFields.map((field) => {
                      const isTextarea = field.type === 'textarea';

                      return (
                        <label key={field.key} className={isTextarea ? 'block space-y-2 sm:col-span-2' : 'block space-y-2 sm:col-span-2'}>
                          <span className="text-sm font-medium text-[var(--arcane-ink-900)]">{field.label}</span>
                          {isTextarea ? (
                            <textarea
                              className="min-h-24 w-full rounded-md border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] px-3 py-2 text-sm text-[var(--arcane-ink-900)] shadow-sm outline-none transition placeholder:text-[var(--arcane-ink-soft)] focus:border-[var(--arcane-gold-500)] focus:ring-2 focus:ring-[var(--arcane-gold-600)]"
                              value={formValues[field.key]}
                              onChange={(event) => setFormValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                              placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
                              rows={4}
                            />
                          ) : (
                            <Input
                              ref={field.key === nameColumn ? nameInputRef : undefined}
                              type={field.type === 'url' ? 'url' : 'text'}
                              value={formValues[field.key]}
                              onChange={(event) => setFormValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                              placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
                              autoFocus={field.key === nameColumn}
                            />
                          )}
                        </label>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div>
                      {mode === 'existing' && selectedId !== null ? (
                        <Button type="button" onClick={handleDelete} disabled={isSaving} className="!bg-[var(--arcane-danger)] hover:!bg-[var(--arcane-danger-hover)] !text-white">
                          Delete
                        </Button>
                      ) : null}
                    </div>

                    <div className="flex gap-2">
                      <Button type="button" className="!bg-[var(--arcane-ink-700)] !text-white hover:!bg-[var(--arcane-ink-800)]" onClick={closeToExisting}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSaving || (mode === 'new' ? !hasFormInput : !hasChanges)}>
                        {isSaving ? 'Saving...' : mode === 'new' ? newButtonLabel : `Save ${title}`}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>

              <aside className="space-y-4 rounded-xl border border-[var(--arcane-border-light)] bg-[var(--arcane-paper)] p-4">
                <div>
                  <div className="text-sm font-semibold text-[var(--arcane-ink-900)]">{title} Summary</div>
                  <div className="mt-2 space-y-1 text-sm text-[var(--arcane-ink-soft)]">
                    <div>Records: {records.length.toLocaleString()}</div>
                    <div>Selected: {selectedRecord ? String(selectedRecord[nameColumn] ?? '').trim() : '-'}</div>
                  </div>
                </div>

                {quickLinks.length > 0 ? (
                  <div className="rounded-lg bg-[var(--arcane-paper-raised)] p-3 shadow-sm">
                    <div className="text-sm font-semibold text-[var(--arcane-ink-900)]">Quick Links</div>
                    <div className="mt-2 space-y-2 text-sm">
                      {quickLinks.map((link) => (
                        <Link key={`${link.label}-${link.to}`} to={link.to} className="block text-[var(--arcane-gold-700)] underline hover:text-[var(--arcane-gold-600)]">
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
              </aside>
            </div>
          </div>
        </section>
      </div>

      <Dialog
        open={!!deleteError}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteError('');
          }
        }}
        title="Delete Failed"
        onClose={() => setDeleteError('')}
        contentClassName="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-red-700">{deleteError}</p>
          <div className="flex justify-end">
            <Button onClick={() => setDeleteError('')} className="!bg-[var(--arcane-danger)] hover:!bg-[var(--arcane-danger-hover)] !text-white">
              OK
            </Button>
          </div>
        </div>
      </Dialog>
    </AdminLayout>
  );
}
