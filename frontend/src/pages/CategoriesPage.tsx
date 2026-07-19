import SetupLookupPage from '../components/SetupLookupPage';

export default function CategoriesPage() {
  return (
    <SetupLookupPage
      title="Categories"
      subtitle="Use this screen to view, add, remove and modify the categories in your collection."
      tableName="Category"
      idColumn="CategoryID"
      nameColumn="CategoryName"
      nameHeader="Name"
      filterLabel="Category Name"
      filterPlaceholder="Filter by category name"
      newButtonLabel="New Category"
      newTitle="New Category"
      editTitle="Edit Category"
      deleteConflictMessage="Delete failed. This category is still referenced by one or more category/sub category links or linked items. Reassign or remove the linked records first, then try again."
    />
  );
}
