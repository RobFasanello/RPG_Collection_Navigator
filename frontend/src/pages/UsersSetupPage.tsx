import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
import useSetupPagination from '../hooks/useSetupPagination';
import { tablesAPI } from '../services/api';
import { useAppMode } from '../context/AppModeContext';
import type { AppMode } from '../state/appMode';

interface UserRecord {
  UserID: number;
  Email: string;
  DisplayName: string | null;
  AppMode: AppMode;
  CreatedDate: string | null;
  LastLoginDate: string | null;
}

type SortOrder = 'ASC' | 'DESC';
type SortColumn = 'Email' | 'DisplayName' | 'AppMode' | 'CreatedDate' | 'LastLoginDate';

type FilterValues = {
  mode: AppMode | '';
  createdDateFrom: string;
  createdDateTo: string;
  lastLoginDateFrom: string;
  lastLoginDateTo: string;
};

const EMPTY_FILTERS: FilterValues = {
  mode: '',
  createdDateFrom: '',
  createdDateTo: '',
  lastLoginDateFrom: '',
  lastLoginDateTo: '',
};

const MODE_OPTIONS: AppMode[] = ['read-only', 'update', 'administrator'];

const MODE_LABELS: Record<AppMode, string> = {
  'read-only': 'Read Only',
  update: 'Update',
  administrator: 'Administrator',
};

const MODE_BADGE_CLASSES: Record<AppMode, string> = {
  'read-only': 'border-[var(--arcane-border-light)] bg-[var(--arcane-paper)] text-[var(--arcane-ink-soft)]',
  update: 'border-[var(--arcane-info-border)] bg-[var(--arcane-info-soft)] text-[var(--arcane-info-text)]',
  administrator: 'border-[var(--arcane-success-border)] bg-[var(--arcane-success-soft)] text-[var(--arcane-success-text)]',
};

const selectClassName =
  'w-full min-h-[2.75rem] rounded-md border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] px-3 py-2 text-sm text-[var(--arcane-ink-900)]';

const emptyAddValues = { Email: '', DisplayName: '', AppMode: 'read-only' as AppMode };

function formatDate(value: string | null) {
  if (!value) return 'Never';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  const day = String(parsed.getUTCDate()).padStart(2, '0');
  const year = parsed.getUTCFullYear();
  const hours24 = parsed.getUTCHours();
  const minutes = String(parsed.getUTCMinutes()).padStart(2, '0');
  const seconds = String(parsed.getUTCSeconds()).padStart(2, '0');
  const ampm = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = String(hours24 % 12 || 12).padStart(2, '0');

  return `${month}/${day}/${year} ${hours12}:${minutes}:${seconds} ${ampm}`;
}

function toDateKey(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

export default function UsersSetupPage() {
  const { toast } = useToast();
  const { email: currentUserEmail } = useAppMode();
  const queryClient = useQueryClient();

  const [sortBy, setSortBy] = useState<SortColumn>('Email');
  const [sortOrder, setSortOrder] = useState<SortOrder>('ASC');
  const [searchInput, setSearchInput] = useState('');
  const [filterValues, setFilterValues] = useState<FilterValues>(EMPTY_FILTERS);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addValues, setAddValues] = useState(emptyAddValues);
  const [addError, setAddError] = useState('');
  const addEmailInputRef = useRef<HTMLInputElement | null>(null);

  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [pendingEditNavigation, setPendingEditNavigation] = useState<
    { direction: 'previous' | 'next'; targetPage: number } | null
  >(null);
  const [editValues, setEditValues] = useState(emptyAddValues);
  const [editError, setEditError] = useState('');
  const editEmailInputRef = useRef<HTMLInputElement | null>(null);

  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [bulkStep, setBulkStep] = useState<'edit' | 'confirm'>('edit');
  const [bulkMode, setBulkMode] = useState<AppMode | ''>('');
  const [bulkError, setBulkError] = useState('');

  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState('');
  const [bulkDeleteError, setBulkDeleteError] = useState('');
  const bulkDeleteConfirmInputRef = useRef<HTMLInputElement | null>(null);

  const queryKey = ['table', 'User'];

  const { data: userRecords = [], isLoading, error } = useQuery<UserRecord[], Error>({
    queryKey,
    queryFn: async () => tablesAPI.getAllRecords('User') as Promise<UserRecord[]>,
  });

  useEffect(() => {
    const handle = setTimeout(() => {
      setFilterValues((current) => current);
    }, 0);
    return () => clearTimeout(handle);
  }, []);

  useEffect(() => {
    if (!isBulkDeleteOpen) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      bulkDeleteConfirmInputRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isBulkDeleteOpen]);

  const modeOptions = useMemo(
    () => MODE_OPTIONS.map((mode) => ({ value: mode, label: MODE_LABELS[mode] })),
    []
  );

  const filteredRows = useMemo(() => {
    const search = searchInput.trim().toLowerCase();
    const createdFrom = filterValues.createdDateFrom.trim();
    const createdTo = filterValues.createdDateTo.trim();
    const lastLoginFrom = filterValues.lastLoginDateFrom.trim();
    const lastLoginTo = filterValues.lastLoginDateTo.trim();

    const filtered = userRecords.filter((user) => {
      const searchMatches =
        !search ||
        String(user.Email || '').toLowerCase().includes(search) ||
        String(user.DisplayName || '').toLowerCase().includes(search);
      const modeMatches = !filterValues.mode || user.AppMode === filterValues.mode;

      const createdKey = toDateKey(user.CreatedDate);
      const createdMatches =
        (!createdFrom || (createdKey && createdKey >= createdFrom)) &&
        (!createdTo || (createdKey && createdKey <= createdTo));

      const lastLoginKey = toDateKey(user.LastLoginDate);
      const lastLoginMatches =
        (!lastLoginFrom || (lastLoginKey && lastLoginKey >= lastLoginFrom)) &&
        (!lastLoginTo || (lastLoginKey && lastLoginKey <= lastLoginTo));

      return searchMatches && modeMatches && createdMatches && lastLoginMatches;
    });

    return [...filtered].sort((a, b) => {
      let valueA: string | number = '';
      let valueB: string | number = '';

      if (sortBy === 'CreatedDate' || sortBy === 'LastLoginDate') {
        const rawA = a[sortBy];
        const rawB = b[sortBy];
        valueA = rawA ? new Date(rawA).getTime() : -Infinity;
        valueB = rawB ? new Date(rawB).getTime() : -Infinity;
      } else {
        valueA = String(a[sortBy] ?? '').toLowerCase();
        valueB = String(b[sortBy] ?? '').toLowerCase();
      }

      if (valueA < valueB) return sortOrder === 'ASC' ? -1 : 1;
      if (valueA > valueB) return sortOrder === 'ASC' ? 1 : -1;
      return String(a.Email || '').localeCompare(String(b.Email || ''), undefined, { sensitivity: 'base' });
    });
  }, [userRecords, searchInput, filterValues, sortBy, sortOrder]);

  const pagination = useSetupPagination(filteredRows, [filterValues, searchInput, sortBy, sortOrder], 10);
  const currentPageRows = pagination.paginatedRows;

  const currentEditUserIndex = useMemo(() => {
    if (!editingUser) {
      return -1;
    }
    return currentPageRows.findIndex((row) => row.UserID === editingUser.UserID);
  }, [currentPageRows, editingUser]);

  const canNavigateToPreviousEditUser = Boolean(editingUser && (currentEditUserIndex > 0 || pagination.page > 1));
  const canNavigateToNextEditUser = Boolean(
    editingUser &&
      ((currentEditUserIndex >= 0 && currentEditUserIndex < currentPageRows.length - 1) ||
        pagination.page < pagination.totalPages)
  );

  const selectedUserIdSet = useMemo(() => new Set(selectedUserIds), [selectedUserIds]);
  const selectableCurrentPageRows = useMemo(
    () => currentPageRows.filter((row) => row.Email !== currentUserEmail),
    [currentPageRows, currentUserEmail]
  );
  const areAllCurrentPageRowsSelected =
    selectableCurrentPageRows.length > 0 &&
    selectableCurrentPageRows.every((row) => selectedUserIdSet.has(row.UserID));

  const selectCurrentPageRows = () => {
    setSelectedUserIds(selectableCurrentPageRows.map((row) => row.UserID));
  };

  const selectAllFilteredRows = () => {
    setSelectedUserIds(filteredRows.filter((row) => row.Email !== currentUserEmail).map((row) => row.UserID));
  };

  useEffect(() => {
    setSelectedUserIds([]);
  }, [filterValues, searchInput]);

  const toggleUserSelection = (userId: number) => {
    setSelectedUserIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );
  };

  const addMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => tablesAPI.createRecord('User', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      closeAddModal();
      toast({ title: 'User Added', description: `Granted access to "${addValues.Email}".`, variant: 'success' });
    },
    onError: (mutationError: any) => {
      setAddError(mutationError.response?.data?.error || 'Failed to add user');
    },
  });

  const editMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      if (!editingUser) {
        throw new Error('No user is selected for editing.');
      }
      return tablesAPI.updateRecord('User', editingUser.UserID, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      closeEditModal();
      toast({ title: 'User Saved', description: `Saved changes for "${editingUser?.Email}".`, variant: 'success' });
    },
    onError: (mutationError: any) => {
      setEditError(mutationError.response?.data?.error || 'Failed to update user');
    },
  });

  const editDeleteMutation = useMutation({
    mutationFn: async () => {
      if (!editingUser) {
        throw new Error('No user is selected for deletion.');
      }
      return tablesAPI.deleteRecord('User', editingUser.UserID);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setSelectedUserIds((current) => current.filter((id) => id !== editingUser?.UserID));
      closeEditModal();
      toast({ title: 'Access Removed', description: `Removed access for "${editingUser?.Email}".`, variant: 'success' });
    },
    onError: (mutationError: any) => {
      setEditError(mutationError.response?.data?.error || 'Failed to remove user');
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (mode: AppMode) => {
      await Promise.all(selectedUserIds.map((userId) => tablesAPI.updateRecord('User', userId, { AppMode: mode })));
    },
    onSuccess: () => {
      const updatedCount = selectedUserIds.length;
      queryClient.invalidateQueries({ queryKey });
      setSelectedUserIds([]);
      closeBulkUpdateDialog();
      toast({
        title: 'Users Updated',
        description:
          updatedCount === 1
            ? 'Applied bulk changes to 1 selected user.'
            : `Applied bulk changes to ${updatedCount} selected users.`,
        variant: 'success',
      });
    },
    onError: (mutationError: any) => {
      setBulkError(mutationError.response?.data?.error || 'Failed to bulk update selected users');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (userIds: number[]) => {
      await Promise.all(userIds.map((userId) => tablesAPI.deleteRecord('User', userId)));
    },
    onSuccess: () => {
      const deletedCount = selectedUserIds.length;
      queryClient.invalidateQueries({ queryKey });
      setSelectedUserIds([]);
      closeBulkDeleteDialog();
      toast({
        title: 'Access Removed',
        description:
          deletedCount === 1
            ? 'Removed access for 1 selected user.'
            : `Removed access for ${deletedCount} selected users.`,
        variant: 'success',
      });
    },
    onError: (mutationError: any) => {
      setBulkDeleteError(mutationError.response?.data?.error || 'Failed to bulk remove selected users');
    },
  });

  const handleChipFiltersChange = (patch: Partial<FilterValues>) => {
    setFilterValues((current) => ({ ...current, ...patch }));
  };

  const clearAllChipFilters = () => {
    setFilterValues(EMPTY_FILTERS);
  };

  const filterChipFields: FilterChipField[] = [
    {
      key: 'mode',
      label: 'Mode',
      kind: 'singleSelect',
      options: modeOptions,
      value: filterValues.mode,
      onApply: (value) => handleChipFiltersChange({ mode: value as AppMode }),
      onClear: () => handleChipFiltersChange({ mode: '' }),
    },
    {
      key: 'createdDate',
      label: 'Created Date',
      kind: 'dateRange',
      from: filterValues.createdDateFrom,
      to: filterValues.createdDateTo,
      onApply: (from, to) => handleChipFiltersChange({ createdDateFrom: from, createdDateTo: to }),
      onClear: () => handleChipFiltersChange({ createdDateFrom: '', createdDateTo: '' }),
    },
    {
      key: 'lastLoginDate',
      label: 'Last Login',
      kind: 'dateRange',
      from: filterValues.lastLoginDateFrom,
      to: filterValues.lastLoginDateTo,
      onApply: (from, to) => handleChipFiltersChange({ lastLoginDateFrom: from, lastLoginDateTo: to }),
      onClear: () => handleChipFiltersChange({ lastLoginDateFrom: '', lastLoginDateTo: '' }),
    },
  ];

  const handleSort = (column: SortColumn) => {
    if (sortBy === column) {
      setSortOrder((current) => (current === 'ASC' ? 'DESC' : 'ASC'));
    } else {
      setSortBy(column);
      setSortOrder('ASC');
    }
  };

  const SortIndicator = ({ column }: { column: SortColumn }) => {
    if (sortBy !== column) {
      return <span className="ml-1 text-[var(--arcane-ink-soft)]">↕</span>;
    }
    return <span className="ml-1">{sortOrder === 'ASC' ? '↑' : '↓'}</span>;
  };

  const openAddModal = () => {
    setAddValues(emptyAddValues);
    setAddError('');
    setIsAddOpen(true);
    window.setTimeout(() => addEmailInputRef.current?.focus(), 0);
  };

  const closeAddModal = () => {
    setIsAddOpen(false);
    setAddError('');
    setAddValues(emptyAddValues);
  };

  const openEditModal = (user: UserRecord) => {
    setPendingEditNavigation(null);
    setEditingUser(user);
    setEditValues({
      Email: user.Email || '',
      DisplayName: user.DisplayName || '',
      AppMode: user.AppMode,
    });
    setEditError('');
  };

  const closeEditModal = () => {
    setPendingEditNavigation(null);
    setEditingUser(null);
    setEditError('');
    setEditValues(emptyAddValues);
  };

  const originalEditValues = useMemo(() => {
    if (!editingUser) {
      return null;
    }
    return {
      Email: editingUser.Email || '',
      DisplayName: editingUser.DisplayName || '',
      AppMode: editingUser.AppMode,
    };
  }, [editingUser]);

  const isEditDirty = useMemo(() => {
    if (!originalEditValues) {
      return false;
    }
    return (
      editValues.Email.trim() !== originalEditValues.Email.trim() ||
      editValues.DisplayName.trim() !== originalEditValues.DisplayName.trim() ||
      editValues.AppMode !== originalEditValues.AppMode
    );
  }, [editValues, originalEditValues]);

  const requestCloseEditModal = () => {
    if (isEditDirty) {
      const confirmed = window.confirm('Changes have not been applied. Close without saving?');
      if (!confirmed) {
        return;
      }
    }
    closeEditModal();
  };

  const handleNavigateEditUser = (direction: 'previous' | 'next') => {
    if (!editingUser) {
      return;
    }

    if (isEditDirty) {
      const confirmed = window.confirm('Changes have not been applied. Move to another user without saving?');
      if (!confirmed) {
        return;
      }
    }

    if (direction === 'previous') {
      if (currentEditUserIndex > 0) {
        openEditModal(currentPageRows[currentEditUserIndex - 1]);
        return;
      }
      if (pagination.page > 1) {
        setPendingEditNavigation({ direction: 'previous', targetPage: pagination.page - 1 });
        pagination.setPage((current) => Math.max(1, current - 1));
      }
      return;
    }

    if (currentEditUserIndex >= 0 && currentEditUserIndex < currentPageRows.length - 1) {
      openEditModal(currentPageRows[currentEditUserIndex + 1]);
      return;
    }

    if (pagination.page < pagination.totalPages) {
      setPendingEditNavigation({ direction: 'next', targetPage: pagination.page + 1 });
      pagination.setPage((current) => current + 1);
    }
  };

  useEffect(() => {
    if (!editingUser || !pendingEditNavigation || !currentPageRows.length) {
      return;
    }
    if (pagination.page !== pendingEditNavigation.targetPage) {
      return;
    }
    if (pendingEditNavigation.direction === 'previous') {
      openEditModal(currentPageRows[currentPageRows.length - 1]);
      return;
    }
    openEditModal(currentPageRows[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingUser, pendingEditNavigation, currentPageRows, pagination.page]);

  const openBulkUpdateDialog = () => {
    if (selectedUserIds.length < 1) {
      return;
    }
    setBulkMode('');
    setBulkError('');
    setBulkStep('edit');
    setIsBulkUpdateOpen(true);
  };

  const closeBulkUpdateDialog = () => {
    setIsBulkUpdateOpen(false);
    setBulkStep('edit');
    setBulkError('');
    setBulkMode('');
  };

  const openBulkDeleteDialog = () => {
    if (selectedUserIds.length < 1) {
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

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleAddSubmit = (event: FormEvent) => {
    event.preventDefault();
    setAddError('');

    const email = addValues.Email.trim();
    const displayName = addValues.DisplayName.trim();

    if (!email) {
      setAddError('Email is required.');
      return;
    }

    if (!isValidEmail(email)) {
      setAddError('Enter a valid email address.');
      return;
    }

    addMutation.mutate({
      Email: email,
      DisplayName: displayName || null,
      AppMode: addValues.AppMode,
    });
  };

  const handleEditSubmit = (event: FormEvent) => {
    event.preventDefault();
    setEditError('');

    if (!editingUser || !isEditDirty) {
      return;
    }

    const email = editValues.Email.trim();
    const displayName = editValues.DisplayName.trim();

    if (!email) {
      setEditError('Email is required.');
      return;
    }

    if (!isValidEmail(email)) {
      setEditError('Enter a valid email address.');
      return;
    }

    editMutation.mutate({
      Email: email,
      DisplayName: displayName || null,
      AppMode: editValues.AppMode,
    });
  };

  const handleDeleteUser = () => {
    if (!editingUser || editingUser.Email === currentUserEmail) {
      return;
    }

    const confirmed = confirm(`Remove access for "${editingUser.Email}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    editDeleteMutation.mutate();
  };

  const handleBulkUpdateSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (bulkStep === 'confirm') {
      if (!bulkMode) {
        setBulkError('Choose a mode to apply.');
        setBulkStep('edit');
        return;
      }
      bulkUpdateMutation.mutate(bulkMode);
      return;
    }

    if (!bulkMode) {
      setBulkError('Choose a mode to apply.');
      return;
    }

    setBulkError('');
    setBulkStep('confirm');
  };

  const handleBulkDeleteConfirm = () => {
    if (bulkDeleteConfirmText.trim() !== 'DELETE') {
      setBulkDeleteError('Type DELETE exactly to enable bulk removal.');
      return;
    }

    setBulkDeleteError('');
    bulkDeleteMutation.mutate(selectedUserIds);
  };

  return (
    <AdminLayout
      title={
        <span className="inline-flex items-center gap-2">
          <span>Users</span>
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[var(--arcane-ink-soft)] hover:text-[var(--arcane-ink-900)]"
            title="Use this screen to view, add, remove, and modify user access within the application."
            aria-label="Users page information"
          >
            <CircleHelp className="h-4 w-4" aria-hidden="true" />
          </span>
        </span>
      }
      subtitle={null}
    >
      <div className="max-w-[1920px] mx-auto space-y-6 px-0 2xl:px-2">
        <section className="bg-[var(--arcane-paper-raised)] shadow rounded-lg p-6">
          {isLoading && <p className="text-[var(--arcane-ink-soft)]">Loading users...</p>}
          {!!error && <p className="text-red-600">Error loading users.</p>}

          {!isLoading && !error && (
            <>
              {selectedUserIds.length > 0 ? (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--arcane-gold-500-border)] bg-[var(--arcane-gold-soft)] px-4 py-3">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-semibold text-[var(--arcane-gold-700)]">{selectedUserIds.length} selected</span>
                    <button
                      type="button"
                      className="text-[var(--arcane-gold-700)] hover:text-[var(--arcane-gold-700)] underline underline-offset-2"
                      onClick={() => setSelectedUserIds([])}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {selectedUserIds.length > 1 ? (
                      <Button
                        type="button"
                        className="border border-[var(--arcane-border-light)] !bg-[var(--arcane-paper-raised)] !text-[var(--arcane-ink-900)] hover:!bg-[var(--arcane-paper)]"
                        onClick={openBulkUpdateDialog}
                      >
                        Bulk Update
                      </Button>
                    ) : null}
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
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                    <Input
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      onClear={() => setSearchInput('')}
                      clearable
                      clearAriaLabel="Clear users search"
                      placeholder="Search by email or display name..."
                      className="max-w-xl flex-shrink-0"
                      autoFocus
                    />
                    <div className="min-w-0 flex-1">
                      <FilterChipBar fields={filterChipFields} onClearAll={clearAllChipFilters} />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <Button
                      type="button"
                      className="!bg-[var(--arcane-gold-500)] !text-[var(--arcane-ink-950)] hover:!bg-[var(--arcane-gold-300)]"
                      onClick={openAddModal}
                    >
                      Add User
                    </Button>
                  </div>
                </div>
              )}

              <div className="h-[608px] overflow-hidden">
                <Table className="table-fixed [&_th]:overflow-hidden [&_th_button]:overflow-hidden [&_th_button]:whitespace-nowrap [&_tbody_tr]:h-14 [&_tbody_td]:overflow-hidden [&_tbody_td]:text-ellipsis [&_tbody_td]:whitespace-nowrap">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[4%] whitespace-nowrap px-2 text-center">
                        <SelectionScopeMenu
                          checked={areAllCurrentPageRowsSelected}
                          disabled={selectableCurrentPageRows.length === 0}
                          ariaLabel="Select users"
                          onSelectPage={selectCurrentPageRows}
                          onSelectAll={selectAllFilteredRows}
                        />
                      </TableHead>
                      <TableHead className="w-[26%]">
                        <button onClick={() => handleSort('Email')} className="flex items-center hover:text-[var(--arcane-gold-700)]">
                          Email <SortIndicator column="Email" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[20%]">
                        <button onClick={() => handleSort('DisplayName')} className="flex items-center hover:text-[var(--arcane-gold-700)]">
                          Display Name <SortIndicator column="DisplayName" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[14%]">
                        <button onClick={() => handleSort('AppMode')} className="flex items-center hover:text-[var(--arcane-gold-700)]">
                          Mode <SortIndicator column="AppMode" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[18%]">
                        <button onClick={() => handleSort('CreatedDate')} className="flex items-center hover:text-[var(--arcane-gold-700)]">
                          Created Date <SortIndicator column="CreatedDate" />
                        </button>
                      </TableHead>
                      <TableHead className="w-[18%]">
                        <button onClick={() => handleSort('LastLoginDate')} className="flex items-center hover:text-[var(--arcane-gold-700)]">
                          Last Login <SortIndicator column="LastLoginDate" />
                        </button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentPageRows.length ? (
                      currentPageRows.map((user) => (
                        <TableRow
                          key={user.UserID}
                          className="cursor-pointer hover:bg-[var(--arcane-gold-soft)]"
                          onClick={() => openEditModal(user)}
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if ((event.key === 'Enter' || event.key === ' ') && event.target === event.currentTarget) {
                              event.preventDefault();
                              openEditModal(user);
                            }
                          }}
                        >
                          <TableCell className="w-px whitespace-nowrap px-2 text-center" onClick={(event) => event.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedUserIdSet.has(user.UserID)}
                              disabled={user.Email === currentUserEmail}
                              title={user.Email === currentUserEmail ? "You can't include your own account in bulk actions" : undefined}
                              onChange={() => toggleUserSelection(user.UserID)}
                              aria-label={`Select ${user.Email}`}
                            />
                          </TableCell>
                          <TableCell>{user.Email}</TableCell>
                          <TableCell>{user.DisplayName || '-'}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${MODE_BADGE_CLASSES[user.AppMode]}`}
                            >
                              {MODE_LABELS[user.AppMode]}
                            </span>
                          </TableCell>
                          <TableCell>{formatDate(user.CreatedDate)}</TableCell>
                          <TableCell>{formatDate(user.LastLoginDate)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-[var(--arcane-ink-soft)]">
                          No matching users found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <MasterTablePagination
                currentCount={currentPageRows.length}
                total={pagination.total}
                page={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={pagination.setPage}
              />
            </>
          )}
        </section>
      </div>

      <Dialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onClose={closeAddModal}
        title="Add User"
        showCloseButton={false}
        contentClassName="max-w-2xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          addEmailInputRef.current?.focus();
        }}
      >
        <form className="space-y-4" onSubmit={handleAddSubmit}>
          {addError ? <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{addError}</div> : null}
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--arcane-ink-900)]">Email</span>
            <Input
              ref={addEmailInputRef}
              type="email"
              autoFocus
              value={addValues.Email}
              onChange={(event) => setAddValues((current) => ({ ...current, Email: event.target.value }))}
              placeholder="name@example.com"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--arcane-ink-900)]">Display Name</span>
            <Input
              type="text"
              value={addValues.DisplayName}
              onChange={(event) => setAddValues((current) => ({ ...current, DisplayName: event.target.value }))}
              placeholder="Optional name"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--arcane-ink-900)]">Mode</span>
            <select
              value={addValues.AppMode}
              onChange={(event) => setAddValues((current) => ({ ...current, AppMode: event.target.value as AppMode }))}
              className={selectClassName}
            >
              {MODE_OPTIONS.map((mode) => (
                <option key={mode} value={mode}>
                  {MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" className="!bg-[var(--arcane-ink-700)] hover:!bg-[var(--arcane-ink-800)] !text-white" onClick={closeAddModal}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="!bg-[var(--arcane-gold-500)] !text-[var(--arcane-ink-950)] hover:!bg-[var(--arcane-gold-300)]"
              disabled={addMutation.isLoading}
            >
              {addMutation.isLoading ? 'Saving...' : 'Add User'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={Boolean(editingUser)}
        onOpenChange={(open) => {
          if (open) {
            return;
          }
          requestCloseEditModal();
        }}
        onClose={requestCloseEditModal}
        title="Edit User Detail"
        showCloseButton={false}
        contentClassName="max-w-2xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          editEmailInputRef.current?.focus();
        }}
      >
        <form className="space-y-4" onSubmit={handleEditSubmit}>
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-[var(--arcane-ink-soft)]">Update user access and save changes.</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                className="h-9 !bg-[var(--arcane-border-light)] !text-[var(--arcane-ink-900)] hover:!bg-[var(--arcane-border-light)]"
                onClick={() => handleNavigateEditUser('previous')}
                disabled={!canNavigateToPreviousEditUser || editMutation.isLoading || editDeleteMutation.isLoading}
                aria-label="Previous user"
                title="Previous user"
              >
                Prev
              </Button>
              <Button
                type="button"
                className="h-9 !bg-[var(--arcane-border-light)] !text-[var(--arcane-ink-900)] hover:!bg-[var(--arcane-border-light)]"
                onClick={() => handleNavigateEditUser('next')}
                disabled={!canNavigateToNextEditUser || editMutation.isLoading || editDeleteMutation.isLoading}
                aria-label="Next user"
                title="Next user"
              >
                Next
              </Button>
            </div>
          </div>
          {editError ? <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{editError}</div> : null}
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--arcane-ink-900)]">Email</span>
            <Input
              ref={editEmailInputRef}
              type="email"
              autoFocus
              value={editValues.Email}
              onChange={(event) => setEditValues((current) => ({ ...current, Email: event.target.value }))}
              placeholder="name@example.com"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--arcane-ink-900)]">Display Name</span>
            <Input
              type="text"
              value={editValues.DisplayName}
              onChange={(event) => setEditValues((current) => ({ ...current, DisplayName: event.target.value }))}
              placeholder="Optional name"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--arcane-ink-900)]">Mode</span>
            <select
              value={editValues.AppMode}
              onChange={(event) => setEditValues((current) => ({ ...current, AppMode: event.target.value as AppMode }))}
              className={selectClassName}
            >
              {MODE_OPTIONS.map((mode) => (
                <option key={mode} value={mode}>
                  {MODE_LABELS[mode]}
                </option>
              ))}
            </select>
          </label>
          {editingUser ? (
            <div className="w-full rounded-lg border border-[var(--arcane-border-light)] bg-[var(--arcane-paper)] px-4 py-3">
              <div className="grid gap-x-6 gap-y-1 text-sm leading-6 sm:grid-cols-2">
                <p className="text-[var(--arcane-ink-soft)]">
                  Created On (UTC): <span className="font-medium text-[var(--arcane-ink-900)]">{formatDate(editingUser.CreatedDate)}</span>
                </p>
                <p className="text-[var(--arcane-ink-soft)]">
                  Last Updated On (UTC): <span className="font-medium text-[var(--arcane-ink-900)]">{formatDate(editingUser.LastLoginDate)}</span>
                </p>
              </div>
            </div>
          ) : null}
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              className="bg-red-600 hover:bg-red-700 sm:mr-auto"
              onClick={handleDeleteUser}
              disabled={editMutation.isLoading || editDeleteMutation.isLoading || editingUser?.Email === currentUserEmail}
              title={editingUser?.Email === currentUserEmail ? "You can't remove your own access" : undefined}
            >
              {editDeleteMutation.isLoading ? 'Removing...' : 'Remove Access'}
            </Button>
            <Button
              type="button"
              className="!bg-[var(--arcane-ink-700)] hover:!bg-[var(--arcane-ink-800)] !text-white"
              onClick={requestCloseEditModal}
              disabled={editMutation.isLoading || editDeleteMutation.isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isEditDirty || editMutation.isLoading || editDeleteMutation.isLoading}>
              {editMutation.isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={isBulkUpdateOpen}
        onOpenChange={setIsBulkUpdateOpen}
        onClose={closeBulkUpdateDialog}
        title={bulkStep === 'confirm' ? 'Confirm Bulk Update' : 'Bulk Update Users'}
        showCloseButton={false}
        contentClassName="max-w-2xl"
      >
        <form className="space-y-4" onSubmit={handleBulkUpdateSubmit}>
          {bulkError ? <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{bulkError}</div> : null}

          {bulkStep === 'edit' ? (
            <>
              <p className="text-sm text-[var(--arcane-ink-soft)]">Bulk updates apply to {selectedUserIds.length} selected users.</p>
              <label className="block space-y-2">
                <span className="text-sm font-medium text-[var(--arcane-ink-900)]">Mode</span>
                <select
                  autoFocus
                  value={bulkMode}
                  onChange={(event) => setBulkMode(event.target.value as AppMode)}
                  className={selectClassName}
                >
                  <option value="">Select a mode</option>
                  {MODE_OPTIONS.map((mode) => (
                    <option key={mode} value={mode}>
                      {MODE_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" className="bg-[var(--arcane-border-light)] text-[var(--arcane-ink-900)] hover:bg-[var(--arcane-border-light)]" onClick={closeBulkUpdateDialog}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700" disabled={bulkUpdateMutation.isLoading}>
                  {bulkUpdateMutation.isLoading
                    ? 'Updating...'
                    : `Review ${selectedUserIds.length} Update${selectedUserIds.length === 1 ? '' : 's'}`}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-lg border border-[var(--arcane-border-light)] bg-[var(--arcane-paper)] p-4 text-sm text-[var(--arcane-ink-900)]">
                You are about to update {selectedUserIds.length} user{selectedUserIds.length === 1 ? '' : 's'}. Confirm only after
                checking the summary below.
              </div>

              <div className="rounded-lg border border-[var(--arcane-border-light)]">
                <div className="border-b border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] px-4 py-3 text-sm font-semibold text-[var(--arcane-ink-900)]">
                  Update Summary
                </div>
                <div className="space-y-2 px-4 py-3 text-sm text-[var(--arcane-ink-900)]">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium text-[var(--arcane-ink-soft)]">Mode</span>
                    <span className="text-right">{bulkMode ? MODE_LABELS[bulkMode] : '-'}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  className="bg-[var(--arcane-border-light)] text-[var(--arcane-ink-900)] hover:bg-[var(--arcane-border-light)]"
                  onClick={() => setBulkStep('edit')}
                  disabled={bulkUpdateMutation.isLoading}
                >
                  Back
                </Button>
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700" disabled={bulkUpdateMutation.isLoading}>
                  {bulkUpdateMutation.isLoading ? 'Updating...' : `Confirm Update (${selectedUserIds.length})`}
                </Button>
              </div>
            </>
          )}
        </form>
      </Dialog>

      <AlertDialog
        open={isBulkDeleteOpen}
        onOpenChange={(open) => {
          if (open) {
            setIsBulkDeleteOpen(true);
            return;
          }
          closeBulkDeleteDialog();
        }}
        title="Confirm Bulk Removal"
        description={`You are about to remove access for ${selectedUserIds.length} selected user${selectedUserIds.length === 1 ? '' : 's'}. This action cannot be undone.`}
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
                {bulkDeleteMutation.isLoading ? 'Removing...' : `Remove ${selectedUserIds.length} Users`}
              </Button>
            ) : null}
          </>
        )}
      >
        <div className="space-y-5">
          {bulkDeleteError ? (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">{bulkDeleteError}</div>
          ) : null}

          <div>
            <label className="block text-sm font-medium text-[var(--arcane-ink-900)] mb-1">Type DELETE to confirm</label>
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
    </AdminLayout>
  );
}
