export type SetupNavItem = {
  label: string;
  path: string;
};

export const SETUP_NAV_ITEMS: SetupNavItem[] = [
  { label: 'Publishers', path: '/home/setup/publishers' },
  { label: 'RPG Systems', path: '/home/setup/rpg-systems' },
  { label: 'Collections', path: '/home/setup/collections' },
  { label: 'Publisher / Collections', path: '/home/setup/publisher-collections' },
  { label: 'Collection / RPG Systems', path: '/home/setup/collection-rpg-systems' },
  { label: 'Collection Types', path: '/home/setup/collection-types' },
  { label: 'Categories', path: '/home/setup/categories' },
  { label: 'Sub Categories', path: '/home/setup/sub-categories' },
  { label: 'Category / Sub Categories', path: '/home/setup/category-sub-categories' },
  { label: 'Locations', path: '/home/setup/locations' },
  { label: 'Location Types', path: '/home/setup/location-types' },
  { label: 'Stores', path: '/home/setup/stores' },
  { label: 'Miniature Size', path: '/home/setup/miniature-sizes' },
  { label: 'Miniature Rarity', path: '/home/setup/miniature-rarities' },
  { label: 'Status', path: '/home/setup/status' },
];
