import SetupLookupPage from '../components/SetupLookupPage';

export default function MiniatureSizesPage() {
  return (
    <SetupLookupPage
      title="Miniature Size"
      subtitle="Use this screen to view, add, remove and modify miniature sizes."
      tableName="MiniatureSize"
      idColumn="MiniatureSizeID"
      hiddenColumns={['MiniatureSizeID']}
      nameColumn="MiniatureSizeName"
      nameHeader="Name"
      filterLabel="Miniature Size Name"
      filterPlaceholder="Filter by miniature size name"
      newButtonLabel="New Miniature Size"
      newTitle="New Miniature Size"
      editTitle="Edit Miniature Size"
      deleteConflictMessage="Delete failed. This miniature size is still referenced by one or more miniatures. Reassign or remove the linked records first, then try again."
    />
  );
}