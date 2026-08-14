import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Skeleton } from '../components/ui/Skeleton';
import ComboSelect from '../components/ui/ComboSelect';
import { Dialog } from '../components/ui/Dialog';
import AdminLayout from '../components/AdminLayout';
import { tableAPI } from '../services/api';

interface LocationRecord {
  [key: string]: any;
  LocationID?: number;
  LocationName?: string;
  LocationTypeID?: number;
}

interface LocationTypeRecord {
  [key: string]: any;
  LocationTypeID?: number;
  LocationTypeName?: string;
}

interface ItemRecord {
  [key: string]: any;
  ItemID?: number;
  LocationID?: number;
}

interface MiniatureRecord {
  [key: string]: any;
  MiniatureID?: number;
  LocationID?: number | null;
}

interface TerrainRecord {
  [key: string]: any;
  TerrainID?: number;
  LocationID?: number | null;
}

type Mode = 'existing' | 'new';

const emptyFormValues = {
  LocationName: '',
  LocationTypeID: '',
};

function SidebarListSkeleton() {
  return (
    <div className="space-y-2 p-2" aria-label="Loading locations list">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-lg border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] px-4 py-3">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

async function getAllTableRows(tableName: string): Promise<any[]> {
  const pageSize = 500;
  const firstResponse = await tableAPI.getTableData(tableName, 1, pageSize);
  const firstData = firstResponse.data;
  const rows = [...(firstData?.data || [])];
  const totalPages = Number(firstData?.totalPages || 1);

  for (let page = 2; page <= totalPages; page++) {
    const response = await tableAPI.getTableData(tableName, page, pageSize);
    rows.push(...(response.data?.data || []));
  }

  return rows;
}

function buildLocationEntityLink(path: '/admin/miniatures' | '/admin/terrain', locationName: string) {
  const params = new URLSearchParams();
  params.set('location', locationName);
  return `${path}?${params.toString()}`;
}

export default function LocationMasterPage() {
  const queryClient = useQueryClient();
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>('existing');
  const [searchInput, setSearchInput] = useState('');
  const [formValues, setFormValues] = useState({ ...emptyFormValues });
  const [initialFormValues, setInitialFormValues] = useState({ ...emptyFormValues });
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const { data: locationRecords = [], isLoading: locationsLoading, error: locationsError } = useQuery<LocationRecord[], Error>({
    queryKey: ['table', 'Location'],
    queryFn: async () => tableAPI.getAllRecords('Location'),
  });

  const { data: locationTypeRecords = [] } = useQuery<LocationTypeRecord[], Error>({
    queryKey: ['table', 'LocationType'],
    queryFn: async () => tableAPI.getTableData('LocationType', 1, 500).then((response) => response.data.data),
  });

  const { data: locationLinkedRows = [] } = useQuery<Array<{ LocationID?: number | null }>, Error>({
    queryKey: ['table', 'Location', 'usage-counts'],
    queryFn: async () => {
      const [items, miniatures, terrain] = await Promise.all([
        getAllTableRows('Item') as Promise<ItemRecord[]>,
        getAllTableRows('Miniature') as Promise<MiniatureRecord[]>,
        getAllTableRows('Terrain') as Promise<TerrainRecord[]>,
      ]);

      // Location usage can be stored on multiple entity tables.
      return [...items, ...miniatures, ...terrain];
    },
  });

  const locationTypeNameById = useMemo(() => {
    return (locationTypeRecords || []).reduce((map: Record<number, string>, item: LocationTypeRecord) => {
      if (item?.LocationTypeID != null) {
        map[Number(item.LocationTypeID)] = String(item.LocationTypeName ?? item.LocationTypeID);
      }
      return map;
    }, {});
  }, [locationTypeRecords]);

  const itemCountByLocation = useMemo(() => {
    return (locationLinkedRows || []).reduce((map: Record<number, number>, row) => {
      const locationId = Number(row?.LocationID);
      if (!Number.isInteger(locationId) || locationId <= 0) {
        return map;
      }

      map[locationId] = (map[locationId] || 0) + 1;
      return map;
    }, {});
  }, [locationLinkedRows]);

  const selectedLocation = useMemo(() => {
    if (mode === 'new' || selectedLocationId === null) {
      return null;
    }

    return locationRecords.find((location) => Number(location.LocationID) === selectedLocationId) ?? null;
  }, [locationRecords, mode, selectedLocationId]);

  const filteredLocations = useMemo(() => {
    const search = searchInput.trim().toLowerCase();

    return [...locationRecords]
      .filter((location) => {
        if (!search) {
          return true;
        }

        return String(location.LocationName || '').toLowerCase().includes(search);
      })
      .sort((a, b) => String(a.LocationName ?? '').toLowerCase().localeCompare(String(b.LocationName ?? '').toLowerCase()));
  }, [locationRecords, searchInput]);

  const locationTypeOptions = useMemo(() => {
    return (locationTypeRecords || [])
      .map((item: LocationTypeRecord) => ({
        value: String(item.LocationTypeID ?? ''),
        label: String(item.LocationTypeName ?? '').trim(),
      }))
      .filter((option) => option.value && option.label)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [locationTypeRecords]);

  const populateFormFromLocation = (location: LocationRecord | null) => {
    if (!location) {
      setFormValues({ ...emptyFormValues });
      setInitialFormValues({ ...emptyFormValues });
      return;
    }

    const nextValues = {
      LocationName: String(location.LocationName ?? '').trim(),
      LocationTypeID: String(location.LocationTypeID ?? '').trim(),
    };

    setFormValues(nextValues);
    setInitialFormValues(nextValues);
    setFormError('');
    setDeleteError('');
  };

  useEffect(() => {
    if (mode === 'new') {
      return;
    }

    if (selectedLocation) {
      populateFormFromLocation(selectedLocation);
      return;
    }

    if (filteredLocations.length > 0 && selectedLocationId === null) {
      setSelectedLocationId(Number(filteredLocations[0].LocationID));
    }
  }, [filteredLocations, mode, selectedLocation, selectedLocationId]);

  useEffect(() => {
    if (mode === 'new' || selectedLocationId !== null || filteredLocations.length === 0) {
      return;
    }

    setSelectedLocationId(Number(filteredLocations[0].LocationID));
  }, [filteredLocations, mode, selectedLocationId]);

  const handleAddLocation = () => {
    setMode('new');
    setSelectedLocationId(null);
    setDeleteError('');
    populateFormFromLocation(null);
    window.setTimeout(() => {
      nameInputRef.current?.focus();
    }, 0);
  };

  const handleSelectLocation = (locationId: number) => {
    setMode('existing');
    setSelectedLocationId(locationId);
    setDeleteError('');
  };

  const refreshLocationsAndSelect = async (preferredName?: string) => {
    const refreshed = await queryClient.fetchQuery({
      queryKey: ['table', 'Location'],
      queryFn: async () => tableAPI.getAllRecords('Location'),
    });

    const refreshedLocations = Array.isArray(refreshed) ? refreshed : [];

    if (preferredName) {
      const normalizedPreferredName = preferredName.trim();
      const matched = refreshedLocations.find((location: LocationRecord) => String(location.LocationName ?? '').trim().toLowerCase() === normalizedPreferredName.toLowerCase());
      if (matched?.LocationID != null) {
        setMode('existing');
        setSelectedLocationId(Number(matched.LocationID));
        populateFormFromLocation(matched);
        return;
      }
    }

    if (selectedLocationId !== null) {
      const matched = refreshedLocations.find((location: LocationRecord) => Number(location.LocationID) === selectedLocationId);
      if (matched) {
        populateFormFromLocation(matched);
        return;
      }
    }

    if (refreshedLocations.length > 0) {
      const firstLocation = refreshedLocations[0];
      setMode('existing');
      setSelectedLocationId(Number(firstLocation.LocationID));
      populateFormFromLocation(firstLocation);
      return;
    }

    setMode('new');
    setSelectedLocationId(null);
    populateFormFromLocation(null);
  };

  const handleSaveDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    const locationName = formValues.LocationName.trim();
    const locationTypeId = parseInt(formValues.LocationTypeID, 10);

    if (!locationName) {
      setFormError('Location Name is required.');
      return;
    }

    if (!Number.isInteger(locationTypeId)) {
      setFormError('Location Type is required.');
      return;
    }

    setIsSaving(true);
    try {
      if (mode === 'existing' && selectedLocationId !== null) {
        await tableAPI.updateRecord('Location', selectedLocationId, {
          LocationID: selectedLocationId,
          LocationName: locationName,
          LocationTypeID: locationTypeId,
        });
      } else {
        await tableAPI.createRecord('Location', {
          LocationName: locationName,
          LocationTypeID: locationTypeId,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['table', 'Location'] });
      await refreshLocationsAndSelect(locationName);
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Error saving record');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLocation = async () => {
    if (selectedLocationId === null || mode === 'new') {
      return;
    }

    if (!confirm('Are you sure you want to delete this location?')) {
      return;
    }

    setDeleteError('');
    setIsSaving(true);
    try {
      await tableAPI.deleteRecord('Location', selectedLocationId);
      await queryClient.invalidateQueries({ queryKey: ['table', 'Location'] });
      const remaining = await queryClient.fetchQuery({
        queryKey: ['table', 'Location'],
        queryFn: async () => tableAPI.getAllRecords('Location'),
      });

      const remainingLocations = Array.isArray(remaining) ? remaining : [];
      if (remainingLocations.length > 0) {
        const firstLocation = remainingLocations[0];
        setMode('existing');
        setSelectedLocationId(Number(firstLocation.LocationID));
        populateFormFromLocation(firstLocation);
      } else {
        setMode('new');
        setSelectedLocationId(null);
        populateFormFromLocation(null);
      }
    } catch (err: any) {
      const backendError = String(err?.response?.data?.error || err?.message || '').trim();
      const backendMessage = backendError.toLowerCase();
      const referentialIntegrityConflict =
        backendMessage.includes('reference constraint') ||
        backendMessage.includes('foreign key') ||
        backendMessage.includes('conflicted with the reference') ||
        backendMessage.includes('still referenced');

      setDeleteError(
        referentialIntegrityConflict
          ? 'Delete failed. This location is still referenced by one or more miniatures or items. Reassign or remove the linked records first, then try again.'
          : backendError || 'Delete failed. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const selectedLocationItemCount = selectedLocationId !== null ? itemCountByLocation[selectedLocationId] || 0 : 0;

  return (
    <AdminLayout title="Locations" subtitle="Manage locations in a master-detail layout with the location type selector built in.">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] shadow-sm">
          <div className="space-y-4 border-b border-[var(--arcane-border-light)] p-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--arcane-ink-900)]">Locations</h2>
              <p className="text-sm text-[var(--arcane-ink-soft)]">Select a location to edit its details.</p>
            </div>
            <Button onClick={handleAddLocation} className="w-full">
              Add Location
            </Button>
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onClear={() => setSearchInput('')}
              clearable
              clearAriaLabel="Clear locations search"
              placeholder="Search locations..."
            />
          </div>

          <div className="max-h-[calc(100vh-260px)] overflow-y-auto p-2">
            {locationsLoading ? (
              <SidebarListSkeleton />
            ) : locationsError ? (
              <div className="p-4 text-sm text-[var(--arcane-danger)]">Error loading locations.</div>
            ) : filteredLocations.length === 0 ? (
              <div className="p-4 text-sm text-[var(--arcane-ink-soft)]">No locations found.</div>
            ) : (
              <div className="space-y-1">
                {filteredLocations.map((location) => {
                  const isSelected = mode === 'existing' && Number(location.LocationID) === selectedLocationId;
                  const itemCount = itemCountByLocation[Number(location.LocationID)] || 0;

                  return (
                    <button
                      key={location.LocationID}
                      type="button"
                      onClick={() => handleSelectLocation(Number(location.LocationID))}
                      className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                        isSelected
                          ? 'border-[var(--arcane-gold-500)]/50 bg-[var(--arcane-gold-soft)] shadow-sm'
                          : 'border-transparent bg-[var(--arcane-paper-raised)] hover:border-[var(--arcane-border-light)] hover:bg-[var(--arcane-paper)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-[var(--arcane-ink-900)]">{location.LocationName}</div>
                          <div className="truncate text-xs text-[var(--arcane-ink-soft)]">{locationTypeNameById[Number(location.LocationTypeID)] ?? location.LocationTypeID ?? 'Unknown type'}</div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1 text-[11px] text-[var(--arcane-ink-soft)]">
                          <span>{itemCount} items</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        <section className="rounded-xl border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] shadow-sm">
          <div className="border-b border-[var(--arcane-border-light)] px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-[var(--arcane-ink-900)]">{mode === 'new' ? 'Add Location' : String(selectedLocation?.LocationName ?? '').trim() || 'Select a location'}</h2>
                <p className="text-sm text-[var(--arcane-ink-soft)]">
                  {mode === 'new'
                    ? 'Create a location and choose its type from the form.'
                    : 'Edit the location name and type from the form below.'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-5">
            {formError ? <div className="mb-4 rounded-lg border border-[var(--arcane-danger-border)] bg-[var(--arcane-danger-soft)] p-3 text-sm text-[var(--arcane-danger-text)]">{formError}</div> : null}
            {deleteError ? <div className="mb-4 rounded-lg border border-[var(--arcane-danger-border)] bg-[var(--arcane-danger-soft)] p-3 text-sm text-[var(--arcane-danger-text)]">{deleteError}</div> : null}

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">
                <form className="space-y-4" onSubmit={handleSaveDetails}>
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-[var(--arcane-ink-900)]">Location Name</span>
                    <Input
                      ref={nameInputRef}
                      type="text"
                      value={formValues.LocationName}
                      onChange={(event) => setFormValues((prev) => ({ ...prev, LocationName: event.target.value }))}
                      placeholder="Enter location name"
                      autoFocus
                    />
                  </label>

                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-[var(--arcane-ink-900)]">Location Type</span>
                    <ComboSelect
                      options={locationTypeOptions}
                      value={formValues.LocationTypeID}
                      onChange={(value) => setFormValues((prev) => ({ ...prev, LocationTypeID: value }))}
                      placeholder="Select location type"
                      className="w-full"
                    />
                  </label>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div>
                      {mode === 'existing' && selectedLocationId !== null ? (
                        <Button type="button" onClick={handleDeleteLocation} disabled={isSaving} className="!bg-[var(--arcane-danger)] hover:!bg-[var(--arcane-danger-hover)] !text-white">
                          Delete Location
                        </Button>
                      ) : null}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        type="button"
                        className="!bg-[var(--arcane-ink-700)] hover:!bg-[var(--arcane-ink-800)] !text-white"
                        onClick={() => {
                          if (mode === 'new') {
                            setMode('existing');
                            if (selectedLocationId !== null) {
                              const location = locationRecords.find((record) => Number(record.LocationID) === selectedLocationId) ?? null;
                              populateFormFromLocation(location);
                            }
                          } else if (selectedLocationId !== null) {
                            const location = locationRecords.find((record) => Number(record.LocationID) === selectedLocationId) ?? null;
                            populateFormFromLocation(location);
                          }
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={isSaving || (mode === 'existing' && JSON.stringify(formValues) === JSON.stringify(initialFormValues))}
                      >
                        {isSaving ? 'Saving...' : mode === 'new' ? 'Add Location' : 'Save Location'}
                      </Button>
                    </div>
                  </div>
                </form>
              </div>

              <aside className="space-y-4 rounded-xl border border-[var(--arcane-border-light)] bg-[var(--arcane-paper)] p-4">
                <div>
                  <div className="text-sm font-semibold text-[var(--arcane-ink-900)]">Location Summary</div>
                  <div className="mt-2 space-y-1 text-sm text-[var(--arcane-ink-soft)]">
                    <div>Items: {selectedLocationItemCount.toLocaleString()}</div>
                    <div>Type: {selectedLocation ? locationTypeNameById[Number(selectedLocation.LocationTypeID)] ?? String(selectedLocation.LocationTypeID ?? '-') : '-'}</div>
                  </div>
                </div>

                {selectedLocation ? (
                  <div className="rounded-lg bg-[var(--arcane-paper-raised)] p-3 shadow-sm">
                    <div className="text-sm font-semibold text-[var(--arcane-ink-900)]">Quick Links</div>
                    <div className="mt-2 space-y-2 text-sm">
                      <Link
                        to={buildLocationEntityLink('/admin/miniatures', String(selectedLocation.LocationName || ''))}
                        className="block text-[var(--arcane-gold-700)] underline hover:text-[var(--arcane-gold-600)]"
                      >
                        View miniatures at this location
                      </Link>
                      <Link
                        to={buildLocationEntityLink('/admin/terrain', String(selectedLocation.LocationName || ''))}
                        className="block text-[var(--arcane-gold-700)] underline hover:text-[var(--arcane-gold-600)]"
                      >
                        View terrain at this location
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-[var(--arcane-paper-raised)] p-3 text-sm text-[var(--arcane-ink-soft)] shadow-sm">Select a location to see summary information.</div>
                )}
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
