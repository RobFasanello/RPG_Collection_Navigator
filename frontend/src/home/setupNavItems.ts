export type SetupNavItem = {
  label: string;
  path: string;
  description: string;
};

export const SETUP_NAV_ITEMS: SetupNavItem[] = [
  {
    label: 'Categories',
    path: '/home/setup/categories',
    description: 'Select to view, add, delete or update Category reference data and associated reference data.',
  },
  {
    label: 'Collections',
    path: '/home/setup/collections',
    description: 'Select to view, add, delete or update Collection reference data and associated reference data.',
  },
  {
    label: 'Locations',
    path: '/home/setup/locations',
    description: 'Select to view, add, delete or update Location reference data and associated reference data.',
  },
  {
    label: 'Publishers',
    path: '/home/setup/publishers',
    description: 'Select to view, add, delete or update Publisher reference data and associated reference data.',
  },
  {
    label: 'Reference Lists',
    path: '/home/setup/reference-lists',
    description: 'Select to view, add, delete or update Reference List data and associated reference data.',
  },
];
