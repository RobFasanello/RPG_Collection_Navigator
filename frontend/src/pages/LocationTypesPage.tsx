import ManualIdLookupPage from '../components/ManualIdLookupPage';

export default function LocationTypesPage() {
  return (
    <ManualIdLookupPage
      title="Location Types"
      subtitle="Use this screen to view, add, remove and modify location types."
      tableName="LocationType"
      idColumn="LocationTypeID"
      nameColumn="LocationTypeName"
      nameHeader="Name"
      filterLabel="Location Type Name"
      filterPlaceholder="Filter by location type name"
      newButtonLabel="New Location Type"
      newTitle="New Location Type"
      editTitle="Edit Location Type"
      nameLabel="Location Type Name"
      namePlaceholder="Enter location type name"
      deleteConflictMessage="Delete failed. This location type is still referenced by one or more locations. Reassign or remove the linked locations first, then try again."
    />
  );
}
