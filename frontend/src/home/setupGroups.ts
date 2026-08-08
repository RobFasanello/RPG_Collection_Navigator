export type SetupGroupItem = {
  label: string;
  path: string;
  description: string;
};

export type SetupGroup = {
  title: string;
  description: string;
  items: SetupGroupItem[];
};

export const SETUP_GROUPS: SetupGroup[] = [
  {
    title: 'Publishers',
    description: 'Publisher records and linked collections.',
    items: [
      {
        label: 'Publishers',
        path: '/home/setup/publishers',
        description: 'Create and maintain publisher records and linked collections.',
      },
    ],
  },
  {
    title: 'Collections',
    description: 'Collection records and linked RPG systems.',
    items: [
      {
        label: 'Collections',
        path: '/home/setup/collections',
        description: 'Create and maintain collection records and linked RPG systems.',
      },
    ],
  },
  {
    title: 'Categories',
    description: 'Category records and linked sub categories.',
    items: [
      {
        label: 'Categories',
        path: '/home/setup/categories',
        description: 'Create and maintain category records and linked sub categories.',
      },
    ],
  },
  {
    title: 'Locations',
    description: 'Location records.',
    items: [
      {
        label: 'Locations',
        path: '/home/setup/locations',
        description: 'Create and maintain location records.',
      },
    ],
  },
  {
    title: 'Reference Lists',
    description: 'Reusable lookup tables that support the rest of the schema.',
    items: [
      {
        label: 'Reference Lists',
        path: '/home/setup/reference-lists',
        description: 'Manage all lookup tables from one screen.',
      },
    ],
  },
  {
    title: 'Users',
    description: 'Sign-in access and entitlements.',
    items: [
      {
        label: 'Users',
        path: '/home/setup/users',
        description: 'Manage who can sign in and their access mode.',
      },
    ],
  },
];
