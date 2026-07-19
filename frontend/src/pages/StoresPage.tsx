import SetupLookupPage from '../components/SetupLookupPage';

export default function StoresPage() {
  return (
    <SetupLookupPage
      title="Stores"
      subtitle="Use this screen to view, add, remove and modify stores used by your purchase orders."
      tableName="Store"
      idColumn="StoreID"
      nameColumn="StoreName"
      nameHeader="Name"
      filterLabel="Store Name"
      filterPlaceholder="Filter by store name"
      newButtonLabel="New Store"
      newTitle="New Store"
      editTitle="Edit Store"
      deleteConflictMessage="Delete failed. This store is still referenced by one or more purchase orders. Reassign or remove the linked records first, then try again."
    />
  );
}
