import SetupLookupPage from '../components/SetupLookupPage';

export default function CollectionTypesPage() {
  return (
    <SetupLookupPage
      title="Collection Types"
      subtitle="Use this screen to view, add, remove and modify the collection types in your collection."
      tableName="CollectionType"
      idColumn="CollectionTypeID"
      nameColumn="CollectionTypeName"
      nameHeader="Name"
      filterLabel="Collection Type Name"
      filterPlaceholder="Filter by collection type name"
      newButtonLabel="New Collection Type"
      newTitle="New Collection Type"
      editTitle="Edit Collection Type"
      deleteConflictMessage="Delete failed. This collection type is still referenced by one or more collections. Reassign or remove the linked records first, then try again."
    />
  );
}
