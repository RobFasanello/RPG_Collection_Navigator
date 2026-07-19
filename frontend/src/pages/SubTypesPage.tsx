import SetupLookupPage from '../components/SetupLookupPage';

export default function SubTypesPage() {
  return (
    <SetupLookupPage
      title="Sub Categories"
      subtitle="Use this screen to view, add, remove and modify sub categories used by your collection."
      tableName="SubType"
      idColumn="SubTypeID"
      nameColumn="SubTypeName"
      nameHeader="Name"
      filterLabel="Sub Category Name"
      filterPlaceholder="Filter by sub category name"
      newButtonLabel="New Sub Category"
      newTitle="New Sub Category"
      editTitle="Edit Sub Category"
      deleteConflictMessage="Delete failed. This sub category is still referenced by one or more category/sub category links or linked items. Reassign or remove the linked records first, then try again."
    />
  );
}
