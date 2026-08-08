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

interface CategoryRecord {
  [key: string]: any;
  CategoryID?: number;
  CategoryName?: string;
}

interface SubTypeRecord {
  [key: string]: any;
  SubTypeID?: number;
  SubTypeName?: string;
}

interface CategorySubTypeRecord {
  [key: string]: any;
  CategorySubTypeID?: number;
  CategoryID?: number;
  SubTypeID?: number;
}

interface ItemRecord {
  [key: string]: any;
  ItemID?: number;
  CategoryID?: number;
  SubTypeID?: number;
}

type Mode = 'existing' | 'new';
type EditorTab = 'details' | 'sub-categories';

const emptyFormValues = {
  CategoryName: '',
};

function SidebarListSkeleton() {
  return (
    <div className="space-y-2 p-2" aria-label="Loading categories list">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <Skeleton className="h-4 w-2/3" />
          <div className="mt-2 flex justify-end">
            <Skeleton className="h-3 w-20" />
          </div>
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

function buildCategoryInventoryLink(categoryName: string, ownedOnly: boolean) {
  const params = new URLSearchParams();
  params.set('category', categoryName);
  if (ownedOnly) {
    params.set('hasPurchaseOrder', 'true');
  }

  return `/admin/inventory?${params.toString()}`;
}

export default function CategoryMasterPage() {
  const queryClient = useQueryClient();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [mode, setMode] = useState<Mode>('existing');
  const [activeTab, setActiveTab] = useState<EditorTab>('details');
  const [searchInput, setSearchInput] = useState('');
  const [formValues, setFormValues] = useState({ ...emptyFormValues });
  const [initialFormValues, setInitialFormValues] = useState({ ...emptyFormValues });
  const [formError, setFormError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [subTypeToLinkId, setSubTypeToLinkId] = useState('');
  const [linkError, setLinkError] = useState('');
  const [isLinkSaving, setIsLinkSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const { data: categoryRecords = [], isLoading: categoriesLoading, error: categoriesError } = useQuery<CategoryRecord[], Error>({
    queryKey: ['table', 'Category'],
    queryFn: async () => tableAPI.getAllRecords('Category'),
  });

  const { data: subTypeRecords = [] } = useQuery<SubTypeRecord[], Error>({
    queryKey: ['table', 'SubType'],
    queryFn: async () => tableAPI.getTableData('SubType', 1, 500).then((response) => response.data.data),
  });

  const { data: categorySubTypeRecords = [] } = useQuery<CategorySubTypeRecord[], Error>({
    queryKey: ['table', 'CategorySubType'],
    queryFn: async () => tableAPI.getAllRecords('CategorySubType'),
  });

  const { data: allItems = [] } = useQuery<ItemRecord[], Error>({
    queryKey: ['table', 'Item', 'all-for-category-counts'],
    queryFn: async () => getAllTableRows('Item'),
  });

  const subTypeNameById = useMemo(() => {
    return (subTypeRecords || []).reduce((map: Record<number, string>, item: SubTypeRecord) => {
      if (item?.SubTypeID != null) {
        map[Number(item.SubTypeID)] = String(item.SubTypeName ?? item.SubTypeID);
      }
      return map;
    }, {});
  }, [subTypeRecords]);

  const itemCountByCategory = useMemo(() => {
    return (allItems || []).reduce((map: Record<number, number>, item: ItemRecord) => {
      const categoryId = Number(item?.CategoryID);
      if (!Number.isFinite(categoryId)) {
        return map;
      }

      map[categoryId] = (map[categoryId] || 0) + 1;
      return map;
    }, {});
  }, [allItems]);

  const linkCountByCategory = useMemo(() => {
    return (categorySubTypeRecords || []).reduce((map: Record<number, number>, record: CategorySubTypeRecord) => {
      const categoryId = Number(record?.CategoryID);
      if (!Number.isFinite(categoryId)) {
        return map;
      }

      map[categoryId] = (map[categoryId] || 0) + 1;
      return map;
    }, {});
  }, [categorySubTypeRecords]);

  const selectedCategory = useMemo(() => {
    if (mode === 'new' || selectedCategoryId === null) {
      return null;
    }

    return categoryRecords.find((category) => Number(category.CategoryID) === selectedCategoryId) ?? null;
  }, [categoryRecords, mode, selectedCategoryId]);

  const selectedCategoryLinks = useMemo(() => {
    if (selectedCategoryId === null) {
      return [] as CategorySubTypeRecord[];
    }

    return categorySubTypeRecords.filter((record) => Number(record.CategoryID) === selectedCategoryId);
  }, [categorySubTypeRecords, selectedCategoryId]);

  const subTypeOptions = useMemo(() => {
    return (subTypeRecords || [])
      .map((item: SubTypeRecord) => ({
        value: String(item.SubTypeID ?? ''),
        label: String(item.SubTypeName ?? '').trim(),
      }))
      .filter((option) => option.value && option.label)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));
  }, [subTypeRecords]);

  const filteredCategories = useMemo(() => {
    const search = searchInput.trim().toLowerCase();

    return [...categoryRecords]
      .filter((category) => {
        if (!search) {
          return true;
        }

        return String(category.CategoryName || '').toLowerCase().includes(search);
      })
      .sort((a, b) => String(a.CategoryName ?? '').toLowerCase().localeCompare(String(b.CategoryName ?? '').toLowerCase()));
  }, [categoryRecords, searchInput]);

  const populateFormFromCategory = (category: CategoryRecord | null) => {
    if (!category) {
      setFormValues({ ...emptyFormValues });
      setInitialFormValues({ ...emptyFormValues });
      return;
    }

    const nextValues = {
      CategoryName: String(category.CategoryName ?? ''),
    };

    setFormValues(nextValues);
    setInitialFormValues(nextValues);
    setFormError('');
    setDeleteError('');
    setLinkError('');
  };

  useEffect(() => {
    if (mode === 'new') {
      return;
    }

    if (selectedCategory) {
      populateFormFromCategory(selectedCategory);
      return;
    }

    if (filteredCategories.length > 0 && selectedCategoryId === null) {
      setSelectedCategoryId(Number(filteredCategories[0].CategoryID));
    }
  }, [filteredCategories, mode, selectedCategory, selectedCategoryId]);

  useEffect(() => {
    if (mode === 'new' || selectedCategoryId !== null || filteredCategories.length === 0) {
      return;
    }

    setSelectedCategoryId(Number(filteredCategories[0].CategoryID));
  }, [filteredCategories, mode, selectedCategoryId]);

  const handleAddCategory = () => {
    setMode('new');
    setSelectedCategoryId(null);
    setActiveTab('details');
    setSubTypeToLinkId('');
    setLinkError('');
    setDeleteError('');
    populateFormFromCategory(null);
    window.setTimeout(() => {
      nameInputRef.current?.focus();
    }, 0);
  };

  const handleSelectCategory = (categoryId: number) => {
    setMode('existing');
    setSelectedCategoryId(categoryId);
    setSubTypeToLinkId('');
    setLinkError('');
    setDeleteError('');
  };

  const refreshCategoriesAndSelect = async (preferredName?: string) => {
    const refreshed = await queryClient.fetchQuery({
      queryKey: ['table', 'Category'],
      queryFn: async () => tableAPI.getAllRecords('Category'),
    });

    const refreshedCategories = Array.isArray(refreshed) ? refreshed : [];

    if (preferredName) {
      const matched = refreshedCategories.find((category: CategoryRecord) => String(category.CategoryName ?? '').trim().toLowerCase() === preferredName.trim().toLowerCase());
      if (matched?.CategoryID != null) {
        setMode('existing');
        setSelectedCategoryId(Number(matched.CategoryID));
        populateFormFromCategory(matched);
        return;
      }
    }

    if (selectedCategoryId !== null) {
      const matched = refreshedCategories.find((category: CategoryRecord) => Number(category.CategoryID) === selectedCategoryId);
      if (matched) {
        populateFormFromCategory(matched);
        return;
      }
    }

    if (refreshedCategories.length > 0) {
      const firstCategory = refreshedCategories[0];
      setMode('existing');
      setSelectedCategoryId(Number(firstCategory.CategoryID));
      populateFormFromCategory(firstCategory);
      return;
    }

    setMode('new');
    setSelectedCategoryId(null);
    populateFormFromCategory(null);
  };

  const handleSaveDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    const categoryName = formValues.CategoryName.trim();
    if (!categoryName) {
      setFormError('Category Name is required.');
      return;
    }

    setIsSaving(true);
    try {
      if (mode === 'existing' && selectedCategoryId !== null) {
        await tableAPI.updateRecord('Category', selectedCategoryId, {
          CategoryName: categoryName,
        });
      } else {
        await tableAPI.createRecord('Category', {
          CategoryName: categoryName,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['table', 'Category'] });
      await refreshCategoriesAndSelect(categoryName);
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Error saving record');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (selectedCategoryId === null || mode === 'new') {
      return;
    }

    if (!confirm('Are you sure you want to delete this category?')) {
      return;
    }

    setDeleteError('');
    setIsSaving(true);
    try {
      await tableAPI.deleteRecord('Category', selectedCategoryId);
      await queryClient.invalidateQueries({ queryKey: ['table', 'Category'] });
      await queryClient.invalidateQueries({ queryKey: ['table', 'CategorySubType'] });
      const remaining = await queryClient.fetchQuery({
        queryKey: ['table', 'Category'],
        queryFn: async () => tableAPI.getAllRecords('Category'),
      });

      const remainingCategories = Array.isArray(remaining) ? remaining : [];
      if (remainingCategories.length > 0) {
        const firstCategory = remainingCategories[0];
        setMode('existing');
        setSelectedCategoryId(Number(firstCategory.CategoryID));
        populateFormFromCategory(firstCategory);
      } else {
        setMode('new');
        setSelectedCategoryId(null);
        populateFormFromCategory(null);
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
          ? 'Delete failed. This category is still referenced by linked items or category/sub-category assignments. Remove the linked records first, then try again.'
          : backendError || 'Delete failed. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSubTypeLink = async () => {
    if (selectedCategoryId === null || mode === 'new') {
      setLinkError('Save the category before assigning sub categories.');
      return;
    }

    const subTypeId = parseInt(subTypeToLinkId, 10);
    if (!Number.isInteger(subTypeId) || subTypeId <= 0) {
      setLinkError('Select a sub category to add.');
      return;
    }

    const duplicateExists = selectedCategoryLinks.some((record) => Number(record.SubTypeID) === subTypeId);
    if (duplicateExists) {
      setLinkError('That sub category is already linked to this category.');
      return;
    }

    setLinkError('');
    setIsLinkSaving(true);
    try {
      await tableAPI.createRecord('CategorySubType', {
        CategoryID: selectedCategoryId,
        SubTypeID: subTypeId,
      });
      await queryClient.invalidateQueries({ queryKey: ['table', 'CategorySubType'] });
      setSubTypeToLinkId('');
    } catch (err: any) {
      setLinkError(err.response?.data?.error || 'Error adding sub category link');
    } finally {
      setIsLinkSaving(false);
    }
  };

  const handleRemoveSubTypeLink = async (record: CategorySubTypeRecord) => {
    if (selectedCategoryId === null) {
      return;
    }

    setLinkError('');
    setIsLinkSaving(true);
    try {
      if (record.CategorySubTypeID != null) {
        await tableAPI.deleteRecord('CategorySubType', record.CategorySubTypeID);
      } else {
        await tableAPI.deleteRecord('CategorySubType', {
          categoryId: Number(record.CategoryID),
          subTypeId: Number(record.SubTypeID),
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['table', 'CategorySubType'] });
    } catch (err: any) {
      setLinkError(err.response?.data?.error || 'Error removing sub category link');
    } finally {
      setIsLinkSaving(false);
    }
  };

  const selectedCategoryItemCount = selectedCategoryId !== null ? itemCountByCategory[selectedCategoryId] || 0 : 0;
  const selectedCategoryLinkCount = selectedCategoryId !== null ? linkCountByCategory[selectedCategoryId] || 0 : 0;

  return (
    <AdminLayout title="Categories" subtitle="Manage categories and their linked sub categories in one place.">
      <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="space-y-4 border-b border-slate-200 p-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Categories</h2>
              <p className="text-sm text-slate-500">Select a category to edit details and linked sub categories.</p>
            </div>
            <Button onClick={handleAddCategory} className="w-full bg-green-600 hover:bg-green-700">
              Add Category
            </Button>
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              onClear={() => setSearchInput('')}
              clearable
              clearAriaLabel="Clear categories search"
              placeholder="Search categories..."
            />
          </div>

          <div className="max-h-[calc(100vh-260px)] overflow-y-auto p-2">
            {categoriesLoading ? (
              <SidebarListSkeleton />
            ) : categoriesError ? (
              <div className="p-4 text-sm text-red-600">Error loading categories.</div>
            ) : filteredCategories.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">No categories found.</div>
            ) : (
              <div className="space-y-1">
                {filteredCategories.map((category) => {
                  const isSelected = mode === 'existing' && Number(category.CategoryID) === selectedCategoryId;
                  const itemCount = itemCountByCategory[Number(category.CategoryID)] || 0;
                  const linkCount = linkCountByCategory[Number(category.CategoryID)] || 0;

                  return (
                    <button
                      key={category.CategoryID}
                      type="button"
                      onClick={() => handleSelectCategory(Number(category.CategoryID))}
                      className={`w-full rounded-lg border px-4 py-3 text-left transition ${
                        isSelected
                          ? 'border-sky-200 bg-sky-50 shadow-sm'
                          : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">{category.CategoryName}</div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1 text-[11px] text-slate-500">
                          <span>{linkCount} sub cats</span>
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

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{mode === 'new' ? 'Add Category' : selectedCategory?.CategoryName || 'Select a category'}</h2>
                <p className="text-sm text-slate-500">
                  {mode === 'new'
                    ? 'Create a category, then link sub categories from the second tab.'
                    : 'Edit category details or manage linked sub categories from the tabs below.'}
                </p>
              </div>

              {selectedCategoryId !== null && mode === 'existing' ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className={activeTab === 'details'
                      ? 'border border-sky-600 !bg-sky-600 !text-white hover:!bg-sky-700'
                      : 'border border-slate-300 !bg-white !text-slate-800 hover:!bg-slate-50'}
                    onClick={() => setActiveTab('details')}
                  >
                    Details
                  </Button>
                  <Button
                    type="button"
                    className={activeTab === 'sub-categories'
                      ? 'border border-sky-600 !bg-sky-600 !text-white hover:!bg-sky-700'
                      : 'border border-slate-300 !bg-white !text-slate-800 hover:!bg-slate-50'}
                    onClick={() => setActiveTab('sub-categories')}
                  >
                    Sub Categories
                  </Button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="p-5">
            {formError ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{formError}</div> : null}
            {deleteError ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{deleteError}</div> : null}
            {linkError ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{linkError}</div> : null}

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0">
                {activeTab === 'details' ? (
                  <form className="space-y-4" onSubmit={handleSaveDetails}>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-slate-700">Category Name</span>
                      <Input
                        ref={nameInputRef}
                        type="text"
                        value={formValues.CategoryName}
                        onChange={(event) => setFormValues((prev) => ({ ...prev, CategoryName: event.target.value }))}
                        placeholder="Enter category name"
                        autoFocus
                      />
                    </label>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                      <div>
                        {mode === 'existing' && selectedCategoryId !== null ? (
                          <Button type="button" onClick={handleDeleteCategory} disabled={isSaving} className="bg-red-600 hover:bg-red-700">
                            Delete Category
                          </Button>
                        ) : null}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          className="bg-slate-600 hover:bg-slate-700"
                          onClick={() => {
                            if (mode === 'new') {
                              setMode('existing');
                              if (selectedCategoryId !== null) {
                                const category = categoryRecords.find((record) => Number(record.CategoryID) === selectedCategoryId) ?? null;
                                populateFormFromCategory(category);
                              }
                            } else if (selectedCategoryId !== null) {
                              const category = categoryRecords.find((record) => Number(record.CategoryID) === selectedCategoryId) ?? null;
                              populateFormFromCategory(category);
                            }
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="bg-green-600 hover:bg-green-700"
                          disabled={isSaving || (mode === 'existing' && JSON.stringify(formValues) === JSON.stringify(initialFormValues))}
                        >
                          {isSaving ? 'Saving...' : mode === 'new' ? 'Add Category' : 'Save Category'}
                        </Button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    {selectedCategoryId === null || mode === 'new' ? (
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                        Save this category first to manage linked sub categories.
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-slate-900">Add linked sub category</div>
                            <div className="text-xs text-slate-500">Choose a sub category and link it immediately to this category.</div>
                          </div>
                          <div className="min-w-[240px] flex-1">
                            <ComboSelect
                              options={subTypeOptions}
                              value={subTypeToLinkId}
                              onChange={(value) => setSubTypeToLinkId(value)}
                              placeholder="Select sub category"
                              className="w-full"
                              disablePortal
                              openOnFocus={false}
                            />
                          </div>
                          <Button type="button" className="bg-blue-600 hover:bg-blue-700" onClick={handleAddSubTypeLink} disabled={isLinkSaving}>
                            Add
                          </Button>
                        </div>

                        <div className="rounded-xl border border-slate-200">
                          <div className="border-b border-slate-200 bg-white px-4 py-3">
                            <div className="text-sm font-semibold text-slate-900">Linked Sub Categories</div>
                            <div className="text-xs text-slate-500">{selectedCategoryLinkCount} linked sub category{selectedCategoryLinkCount === 1 ? '' : 'ies'}</div>
                          </div>
                          <div className="divide-y divide-slate-200">
                            {selectedCategoryLinks.length === 0 ? (
                              <div className="px-4 py-5 text-sm text-slate-500">No sub categories linked yet.</div>
                            ) : (
                              selectedCategoryLinks.map((record) => (
                                <div key={record.CategorySubTypeID ?? `${record.CategoryID}-${record.SubTypeID}`} className="flex items-center justify-between gap-4 px-4 py-3">
                                  <div className="text-sm font-medium text-slate-900">{subTypeNameById[Number(record.SubTypeID)] ?? record.SubTypeID}</div>
                                  <Button type="button" className="border border-red-300 !bg-white !text-red-700 hover:!bg-red-50" onClick={() => handleRemoveSubTypeLink(record)} disabled={isLinkSaving}>
                                    Remove
                                  </Button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <aside className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Category Summary</div>
                  <div className="mt-2 space-y-1 text-sm text-slate-600">
                    <div>Items: {selectedCategoryItemCount.toLocaleString()}</div>
                    <div>Sub Categories: {selectedCategoryLinkCount.toLocaleString()}</div>
                  </div>
                </div>

                {selectedCategory && mode === 'existing' ? (
                  <div className="rounded-lg bg-white p-3 shadow-sm">
                    <div className="text-sm font-semibold text-slate-900">Quick Links</div>
                    <div className="mt-2 space-y-2 text-sm">
                      <Link
                        to={buildCategoryInventoryLink(String(selectedCategory.CategoryName || ''), false)}
                        className="block text-blue-600 underline hover:text-blue-700"
                      >
                        View items for this category
                      </Link>
                      <Link
                        to={buildCategoryInventoryLink(String(selectedCategory.CategoryName || ''), true)}
                        className="block text-blue-600 underline hover:text-blue-700"
                      >
                        View owned items for this category
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-white p-3 text-sm text-slate-500 shadow-sm">Select a category to see summary information.</div>
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
            <Button onClick={() => setDeleteError('')} className="bg-red-600 hover:bg-red-700">
              OK
            </Button>
          </div>
        </div>
      </Dialog>
    </AdminLayout>
  );
}
