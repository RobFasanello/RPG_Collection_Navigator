import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, Plus } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { Button } from '../components/ui/Button';
import ComboSelect from '../components/ui/ComboSelect';
import SetupTablePagination from '../components/SetupTablePagination';
import useModalFocusTrap from '../hooks/useModalFocusTrap';
import useSetupPagination from '../hooks/useSetupPagination';
import { tableAPI } from '../services/api';

type SortDirection = 'asc' | 'desc' | null;
type SortColumn = 'location' | 'locationType' | null;

type LocationRecord = {
  LocationID: number;
  LocationName: string;
  LocationTypeID: number;
};

export default function LocationTypeAssignmentsPage() {
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [sortColumn, setSortColumn] = useState<SortColumn>('location');
  const [filterInputs, setFilterInputs] = useState({ locationName: '', locationTypeName: '' });
  const [activeFilters, setActiveFilters] = useState({ locationName: '', locationTypeName: '' });
  const [formValues, setFormValues] = useState({ LocationID: '', LocationTypeID: '' });
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const modalRef = useModalFocusTrap<HTMLDivElement>(isAdding || isEditing, () => closeForm());
  const queryClient = useQueryClient();
  const tableName = 'Location';

  const { data: records = [], isLoading, error } = useQuery<any, Error>({
    queryKey: ['table', tableName],
    queryFn: async () => {
      return tableAPI.getAllRecords(tableName);
    },
  });

  const { data: locationTypeRecords = [] } = useQuery<any, Error>({
    queryKey: ['table', 'LocationType'],
    queryFn: async () => {
      const response = await tableAPI.getTableData('LocationType', 1, 500);
      return response.data.data;
    },
  });

  const locationNameById = (records || []).reduce((map: Record<number, string>, item: any) => {
    if (item?.LocationID != null) {
      map[Number(item.LocationID)] = String(item.LocationName ?? '').trim();
    }
    return map;
  }, {});

  const locationTypeNameById = (locationTypeRecords || []).reduce((map: Record<number, string>, item: any) => {
    if (item?.LocationTypeID != null) {
      map[Number(item.LocationTypeID)] = String(item.LocationTypeName ?? '').trim();
    }
    return map;
  }, {});

  const locationOptions = (records || []).map((location: LocationRecord) => ({
    value: String(location.LocationID || ''),
    label: String(location.LocationName || '').trim(),
  })).sort((a: { value: string; label: string }, b: { value: string; label: string }) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
  );

  const locationTypeOptions = (locationTypeRecords || []).map((locationType: any) => ({
    value: String(locationType.LocationTypeID || ''),
    label: String(locationType.LocationTypeName || '').trim(),
  })).sort((a: { value: string; label: string }, b: { value: string; label: string }) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
  );

  const hasFilterChanges =
    filterInputs.locationName !== activeFilters.locationName ||
    filterInputs.locationTypeName !== activeFilters.locationTypeName;

  const getNewFormValuesFromFilters = () => ({
    LocationID: activeFilters.locationName,
    LocationTypeID: activeFilters.locationTypeName,
  });

  const handleAdd = () => {
    setIsAdding(true);
    setIsEditing(false);
    setFormValues(getNewFormValuesFromFilters());
    setFormError('');
  };

  const handleEdit = (record: LocationRecord) => {
    setIsAdding(false);
    setIsEditing(true);
    setFormValues({
      LocationID: String(record.LocationID ?? ''),
      LocationTypeID: String(record.LocationTypeID ?? ''),
    });
    setFormError('');
  };

  const closeForm = () => {
    setIsAdding(false);
    setIsEditing(false);
    setFormValues({ LocationID: '', LocationTypeID: '' });
    setFormError('');
  };

  const handleSort = (column: Exclude<SortColumn, null>) => {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection('asc');
      return;
    }

    if (sortDirection === 'asc') {
      setSortDirection('desc');
    } else if (sortDirection === 'desc') {
      setSortDirection(null);
      setSortColumn(null);
    } else {
      setSortDirection('asc');
    }
  };

  const getSortedRecords = () => {
    if (!Array.isArray(records)) {
      return [];
    }

    const locationFilterId = parseInt(activeFilters.locationName, 10);
    const locationTypeFilterId = parseInt(activeFilters.locationTypeName, 10);

    const filteredRecords = records.filter((record: LocationRecord) => {
      const locationId = Number(record.LocationID);
      const locationTypeId = Number(record.LocationTypeID);

      const locationMatches = !Number.isInteger(locationFilterId) || locationId === locationFilterId;
      const locationTypeMatches = !Number.isInteger(locationTypeFilterId) || locationTypeId === locationTypeFilterId;

      return locationMatches && locationTypeMatches;
    });

    if (!sortDirection || !sortColumn) {
      return filteredRecords;
    }

    return [...filteredRecords].sort((a: LocationRecord, b: LocationRecord) => {
      const valueA =
        sortColumn === 'location'
          ? (locationNameById[Number(a.LocationID)] || '')
          : (locationTypeNameById[Number(a.LocationTypeID)] || '');
      const valueB =
        sortColumn === 'location'
          ? (locationNameById[Number(b.LocationID)] || '')
          : (locationTypeNameById[Number(b.LocationTypeID)] || '');

      return sortDirection === 'asc'
        ? String(valueA).toLowerCase().localeCompare(String(valueB).toLowerCase())
        : String(valueB).toLowerCase().localeCompare(String(valueA).toLowerCase());
    });
  };

  const applyFilters = () => {
    setActiveFilters({
      locationName: filterInputs.locationName,
      locationTypeName: filterInputs.locationTypeName,
    });
  };

  const clearFilters = () => {
    setFilterInputs({ locationName: '', locationTypeName: '' });
    setActiveFilters({ locationName: '', locationTypeName: '' });
  };

  const getSortIcon = (column: Exclude<SortColumn, null>) => {
    if (sortColumn !== column) return null;
    if (sortDirection === 'asc') return <ChevronUp className="w-4 h-4" />;
    if (sortDirection === 'desc') return <ChevronDown className="w-4 h-4" />;
    return null;
  };

  const sortedRecords = getSortedRecords();
  const pagination = useSetupPagination(sortedRecords, [activeFilters.locationName, activeFilters.locationTypeName, sortColumn, sortDirection]);

  return (
    <AdminLayout title="Location / Types" subtitle="Use this screen to view and modify the type assigned to each location.">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 bg-white p-4 rounded-lg shadow space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Location Name</label>
              <ComboSelect
                options={locationOptions}
                value={filterInputs.locationName}
                onChange={(value) => setFilterInputs((prev) => ({ ...prev, locationName: value }))}
                placeholder="Select location"
                className="w-full"
                tabIndex={1}
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Location Type</label>
              <ComboSelect
                options={locationTypeOptions}
                value={filterInputs.locationTypeName}
                onChange={(value) => setFilterInputs((prev) => ({ ...prev, locationTypeName: value }))}
                placeholder="Select location type"
                className="w-full"
                tabIndex={2}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <Button onClick={handleAdd} className="gap-2 bg-green-600 hover:bg-green-700" tabIndex={999}>
              <Plus className="w-4 h-4" />
              Add Location / Type
            </Button>
            <Button onClick={applyFilters} tabIndex={3} disabled={!hasFilterChanges}>Apply Filters</Button>
            <Button onClick={clearFilters} className="bg-gray-600 hover:bg-gray-700" tabIndex={4} disabled={!hasFilterChanges}>
              Clear
            </Button>
          </div>
        </div>

        {isAdding || isEditing ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div ref={modalRef} tabIndex={-1} className="w-full max-w-2xl bg-white p-6 rounded-lg shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">{isEditing ? 'Edit Location / Type' : 'New Location / Type'}</h2>
              </div>

              {formError ? (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
                  {formError}
                </div>
              ) : null}

              <form
                onSubmit={async (event) => {
                  event.preventDefault();
                  setFormError('');

                  const locationId = parseInt(formValues.LocationID, 10);
                  const locationTypeId = parseInt(formValues.LocationTypeID, 10);
                  const selectedLocation = (records || []).find((location: LocationRecord) => Number(location.LocationID) === locationId);

                  if (!selectedLocation) {
                    setFormError('Please select a location.');
                    return;
                  }

                  if (!Number.isInteger(locationTypeId)) {
                    setFormError('Please select a location type.');
                    return;
                  }

                  setIsSaving(true);
                  try {
                    await tableAPI.updateRecord(tableName, selectedLocation.LocationID, {
                      LocationID: selectedLocation.LocationID,
                      LocationName: String(selectedLocation.LocationName ?? '').trim(),
                      LocationTypeID: locationTypeId,
                    });

                    queryClient.invalidateQueries({ queryKey: ['table', tableName] });
                    closeForm();
                  } catch (err: any) {
                    setFormError(err.response?.data?.error || 'Error saving record');
                  } finally {
                    setIsSaving(false);
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm font-medium mb-1">Location Name</label>
                  <ComboSelect
                    options={locationOptions}
                    value={formValues.LocationID}
                    onChange={(value) => setFormValues((prev) => ({ ...prev, LocationID: value }))}
                    placeholder="Select location"
                    className="w-full"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Location Type</label>
                  <ComboSelect
                    options={locationTypeOptions}
                    value={formValues.LocationTypeID}
                    onChange={(value) => setFormValues((prev) => ({ ...prev, LocationTypeID: value }))}
                    placeholder="Select location type"
                    className="w-full"
                  />
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <Button type="button" onClick={closeForm} className="bg-gray-200 text-gray-800 hover:bg-gray-300">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? 'Saving...' : isEditing ? 'Update' : 'Save'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {isLoading && <p className="text-gray-500">Loading...</p>}
        {error && <p className="text-red-600">Error loading records</p>}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-200 transition" onClick={() => handleSort('location')} tabIndex={5}>
                  <div className="flex items-center gap-2">
                    Location Name
                    {getSortIcon('location')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-gray-200 transition" onClick={() => handleSort('locationType')} tabIndex={6}>
                  <div className="flex items-center gap-2">
                    Location Type
                    {getSortIcon('locationType')}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pagination.paginatedRows.map((record: LocationRecord) => (
                <tr key={record.LocationID} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleEdit(record)}>
                  <td className="px-6 py-4">{locationNameById[Number(record.LocationID)] || 'Unknown'}</td>
                  <td className="px-6 py-4">{locationTypeNameById[Number(record.LocationTypeID)] || 'Unknown'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <SetupTablePagination
          currentCount={pagination.paginatedRows.length}
          total={pagination.total}
          page={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={pagination.setPage}
        />
      </div>
    </AdminLayout>
  );
}
