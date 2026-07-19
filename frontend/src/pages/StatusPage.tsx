import SetupLookupPage from '../components/SetupLookupPage';

export default function StatusPage() {
  return (
    <SetupLookupPage
      title="Status"
      subtitle="Use this screen to view, add, remove and modify order statuses."
      tableName="Status"
      idColumn="StatusID"
      nameColumn="StatusName"
      nameHeader="Name"
      filterLabel="Status Name"
      filterPlaceholder="Filter by status name"
      newButtonLabel="New Status"
      newTitle="New Status"
      editTitle="Edit Status"
      deleteConflictMessage="Delete failed. This status is still referenced by one or more purchase orders. Reassign or remove the linked records first, then try again."
    />
  );
}
