export type SetupNavItem = {
  label: string;
  path: string;
  description: string;
};

// Note: Menu label "Administrator" is in HomeShell.tsx
export const SETUP_NAV_ITEMS: SetupNavItem[] = [
  {
    label: 'Audit Log',
    path: '/home/setup/audit-log',
    description: 'Select to view and delete Audit Log information within the application.',
  },
  {
    label: 'Categories',
    path: '/home/setup/categories',
    description: 'Select to view, add, delete and update Category reference data and associated reference data.',
  },
  {
    label: 'Collections',
    path: '/home/setup/collections',
    description: 'Select to view, add, delete and update Collection reference data and associated reference data.',
  },
  {
    label: 'Locations',
    path: '/home/setup/locations',
    description: 'Select to view, add, delete and update Location reference data and associated reference data.',
  },
  {
    label: 'Publishers',
    path: '/home/setup/publishers',
    description: 'Select to view, add, delete and update Publisher reference data and associated reference data.',
  },
  {
    label: 'Reference Lists',
    path: '/home/setup/reference-lists',
    description: 'Select to view, add, delete and update Reference List data and associated reference data.',
  },
  {
    label: 'Users',
    path: '/home/setup/users',
    description: 'Select to view and update User Access information within the application.',
  },
];
