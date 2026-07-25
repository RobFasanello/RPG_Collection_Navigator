import SetupLookupPage from '../components/SetupLookupPage';

export default function MiniatureRaritiesPage() {
  return (
    <SetupLookupPage
      title="Miniature Rarity"
      subtitle="Use this screen to view, add, remove and modify miniature rarities."
      tableName="MiniatureRarity"
      idColumn="MiniatureRarityID"
      hiddenColumns={['MiniatureRarityID']}
      nameColumn="MiniatureRarityName"
      nameHeader="Name"
      filterLabel="Miniature Rarity Name"
      filterPlaceholder="Filter by miniature rarity name"
      newButtonLabel="New Miniature Rarity"
      newTitle="New Miniature Rarity"
      editTitle="Edit Miniature Rarity"
      deleteConflictMessage="Delete failed. This miniature rarity is still referenced by one or more miniatures. Reassign or remove the linked records first, then try again."
    />
  );
}