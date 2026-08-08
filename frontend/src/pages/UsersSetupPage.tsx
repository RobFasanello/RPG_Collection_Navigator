import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../components/AdminLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/ToastProvider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/Table';
import { tablesAPI } from '../services/api';
import { useAppMode } from '../context/AppModeContext';
import type { AppMode } from '../state/appMode';

interface UserRecord {
  UserID: number;
  Email: string;
  DisplayName: string | null;
  AppMode: AppMode;
  LastLoginDate: string | null;
}

const MODE_OPTIONS: AppMode[] = ['read-only', 'update', 'administrator'];

function formatDate(value: string | null) {
  if (!value) return 'Never';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export default function UsersSetupPage() {
  const { toast } = useToast();
  const { email: currentUserEmail } = useAppMode();
  const queryClient = useQueryClient();
  const [newEmail, setNewEmail] = useState('');
  const [newMode, setNewMode] = useState<AppMode>('read-only');

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const rows = await tablesAPI.getAllRecords('User');
      return rows as UserRecord[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['users'] });

  const addUserMutation = useMutation({
    mutationFn: () => tablesAPI.createRecord('User', { Email: newEmail.trim(), AppMode: newMode }),
    onSuccess: () => {
      setNewEmail('');
      setNewMode('read-only');
      invalidate();
      toast({ title: 'User added', variant: 'success' });
    },
    onError: () => toast({ title: 'Failed to add user', variant: 'error' }),
  });

  const updateModeMutation = useMutation({
    mutationFn: ({ id, mode }: { id: number; mode: AppMode }) =>
      tablesAPI.updateRecord('User', id, { AppMode: mode }),
    onSuccess: invalidate,
    onError: () => toast({ title: 'Failed to update mode', variant: 'error' }),
  });

  const removeUserMutation = useMutation({
    mutationFn: (id: number) => tablesAPI.deleteRecord('User', id),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Access removed', variant: 'success' });
    },
    onError: () => toast({ title: 'Failed to remove user', variant: 'error' }),
  });

  const handleAddUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newEmail.trim()) return;
    addUserMutation.mutate();
  };

  return (
    <AdminLayout title="Users" subtitle="Manage who can sign in and what they can do.">
      <div className="space-y-6">
        <form onSubmit={handleAddUser} className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="font-medium">Email</span>
            <Input
              type="email"
              required
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder="name@example.com"
              className="w-64"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-700">
            <span className="font-medium">Mode</span>
            <select
              value={newMode}
              onChange={(event) => setNewMode(event.target.value as AppMode)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {MODE_OPTIONS.map((mode) => (
                <option key={mode} value={mode}>
                  {mode}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={addUserMutation.isPending}>
            {addUserMutation.isPending ? 'Adding...' : 'Grant Access'}
          </Button>
        </form>

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users && users.length ? (
                users.map((user) => (
                  <TableRow key={user.UserID}>
                    <TableCell>{user.Email}</TableCell>
                    <TableCell>{user.DisplayName || '-'}</TableCell>
                    <TableCell>
                      <select
                        value={user.AppMode}
                        onChange={(event) =>
                          updateModeMutation.mutate({ id: user.UserID, mode: event.target.value as AppMode })
                        }
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
                      >
                        {MODE_OPTIONS.map((mode) => (
                          <option key={mode} value={mode}>
                            {mode}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>{formatDate(user.LastLoginDate)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        className="border border-red-300 !bg-white !text-red-700 hover:!bg-red-50"
                        disabled={user.Email === currentUserEmail}
                        title={user.Email === currentUserEmail ? "You can't remove your own access" : undefined}
                        onClick={() => removeUserMutation.mutate(user.UserID)}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                    No users yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </AdminLayout>
  );
}
