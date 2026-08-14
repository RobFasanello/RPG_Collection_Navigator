import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';
import AdminLayout from '../components/AdminLayout';
import ReferenceMasterDetailPage, { type ReferenceFieldConfig } from '../components/ReferenceMasterDetailPage';

type ReferenceListConfig = {
  key: string;
  label: string;
  description: string;
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
};

const REFERENCE_LISTS: ReferenceListConfig[] = [
  {
    key: 'collection-types',
    label: 'Collection Types',
    description: 'Lookup values for collection categorization.',
    tableName: 'CollectionType',
    idColumn: 'CollectionTypeID',
    nameColumn: 'CollectionTypeName',
    nameLabel: 'Collection Type Name',
    namePlaceholder: 'Enter collection type name',
    newButtonLabel: 'Add Collection Type',
    newTitle: 'Add Collection Type',
    editTitle: 'Edit Collection Type',
    deleteConflictMessage: 'Delete failed. This collection type is still referenced by one or more collections. Reassign or remove the linked records first, then try again.',
  },
  {
    key: 'rpg-systems',
    label: 'RPG Systems',
    description: 'Lookup values for RPG system classification.',
    tableName: 'RPGSystem',
    idColumn: 'RPGSystemID',
    nameColumn: 'RPGSystemName',
    nameLabel: 'RPG System Name',
    namePlaceholder: 'Enter RPG system name',
    newButtonLabel: 'Add RPG System',
    newTitle: 'Add RPG System',
    editTitle: 'Edit RPG System',
    deleteConflictMessage: 'Delete failed. This RPG system is still referenced by one or more collection/RPG system links. Remove the linked records first, then try again.',
    fields: [
      { key: 'RPGSystemURL', label: 'RPG System URL', placeholder: 'Enter RPG system URL', type: 'url', required: false },
      { key: 'RPGSystemDescription', label: 'RPG System Description', placeholder: 'Enter RPG system description', type: 'textarea', required: false },
    ],
  },
  {
    key: 'location-types',
    label: 'Location Types',
    description: 'Lookup values for location classification.',
    tableName: 'LocationType',
    idColumn: 'LocationTypeID',
    nameColumn: 'LocationTypeName',
    nameLabel: 'Location Type Name',
    namePlaceholder: 'Enter location type name',
    newButtonLabel: 'Add Location Type',
    newTitle: 'Add Location Type',
    editTitle: 'Edit Location Type',
    deleteConflictMessage: 'Delete failed. This location type is still referenced by one or more locations. Reassign or remove the linked locations first, then try again.',
  },
  {
    key: 'stores',
    label: 'Stores',
    description: 'Lookup values for purchase-order vendors.',
    tableName: 'Store',
    idColumn: 'StoreID',
    nameColumn: 'StoreName',
    nameLabel: 'Store Name',
    namePlaceholder: 'Enter store name',
    newButtonLabel: 'Add Store',
    newTitle: 'Add Store',
    editTitle: 'Edit Store',
    deleteConflictMessage: 'Delete failed. This store is still referenced by one or more purchase orders. Reassign or remove the linked records first, then try again.',
  },
  {
    key: 'miniature-sizes',
    label: 'Miniature Sizes',
    description: 'Lookup values for miniature sizing.',
    tableName: 'MiniatureSize',
    idColumn: 'MiniatureSizeID',
    nameColumn: 'MiniatureSizeName',
    nameLabel: 'Miniature Size Name',
    namePlaceholder: 'Enter miniature size name',
    newButtonLabel: 'Add Miniature Size',
    newTitle: 'Add Miniature Size',
    editTitle: 'Edit Miniature Size',
    deleteConflictMessage: 'Delete failed. This miniature size is still referenced by one or more miniatures. Reassign or remove the linked records first, then try again.',
  },
  {
    key: 'miniature-rarities',
    label: 'Miniature Rarities',
    description: 'Lookup values for miniature rarity.',
    tableName: 'MiniatureRarity',
    idColumn: 'MiniatureRarityID',
    nameColumn: 'MiniatureRarityName',
    nameLabel: 'Miniature Rarity Name',
    namePlaceholder: 'Enter miniature rarity name',
    newButtonLabel: 'Add Miniature Rarity',
    newTitle: 'Add Miniature Rarity',
    editTitle: 'Edit Miniature Rarity',
    deleteConflictMessage: 'Delete failed. This miniature rarity is still referenced by one or more miniatures. Reassign or remove the linked records first, then try again.',
  },
  {
    key: 'status',
    label: 'Status',
    description: 'Lookup values shared by order workflows.',
    tableName: 'Status',
    idColumn: 'StatusID',
    nameColumn: 'StatusName',
    nameLabel: 'Status Name',
    namePlaceholder: 'Enter status name',
    newButtonLabel: 'Add Status',
    newTitle: 'Add Status',
    editTitle: 'Edit Status',
    deleteConflictMessage: 'Delete failed. This status is still referenced by one or more purchase orders. Reassign or remove the linked records first, then try again.',
  },
];

function getTableConfig(tableKey: string | null | undefined) {
  return REFERENCE_LISTS.find((item) => item.key === tableKey) ?? REFERENCE_LISTS[0];
}

export default function ReferenceListsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activeTableKey = searchParams.get('table');
  const activeConfig = getTableConfig(activeTableKey);

  return (
    <AdminLayout title="Reference Lists" subtitle="Manage all lookup tables in one place.">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="rounded-xl border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[var(--arcane-border-light)] px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[var(--arcane-ink-900)]">Reference Tables</h2>
              <p className="text-sm text-[var(--arcane-ink-soft)]">Choose the table you want to manage.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 p-3">
            {REFERENCE_LISTS.map((item) => {
              const isActive = item.key === activeConfig.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => navigate({ pathname: '/home/setup/reference-lists', search: `?table=${encodeURIComponent(item.key)}` })}
                  className={`rounded-lg border px-4 py-2.5 text-left text-sm font-medium transition ${
                    isActive
                      ? 'border-[#b8864866] bg-[#b886481a] text-[var(--arcane-ink-900)] shadow-sm'
                      : 'border-transparent bg-[var(--arcane-paper)] text-[var(--arcane-ink-soft)] hover:border-[var(--arcane-border-light)] hover:text-[var(--arcane-ink-900)]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <section className="min-w-0 rounded-xl border border-[var(--arcane-border-light)] bg-[var(--arcane-paper-raised)] shadow-sm">
          <ReferenceMasterDetailPage
            key={activeConfig.key}
            title={activeConfig.label}
            subtitle={activeConfig.description}
            tableName={activeConfig.tableName}
            idColumn={activeConfig.idColumn}
            nameColumn={activeConfig.nameColumn}
            nameLabel={activeConfig.nameLabel}
            namePlaceholder={activeConfig.namePlaceholder}
            newButtonLabel={activeConfig.newButtonLabel}
            newTitle={activeConfig.newTitle}
            editTitle={activeConfig.editTitle}
            deleteConflictMessage={activeConfig.deleteConflictMessage}
            fields={activeConfig.fields}
          />
        </section>
      </div>
    </AdminLayout>
  );
}
