export const ALL_PERMISSIONS = [
  { key: 'orders',       label: 'Objednavky',    description: 'Vidiet a spravovat objednavky od zakaznikov' },
  { key: 'kitchen',      label: 'Kuchyna (KDS)', description: 'Kuchynsky displej pre kucharov' },
  { key: 'bar',          label: 'Bar (KDS)',     description: 'Bar displej pre barmanov' },
  { key: 'tables',       label: 'Stoly',         description: 'Otvarat a zatvatat sedenia pri stoloch' },
  { key: 'payments',     label: 'Platby',        description: 'Spracovavat platby pri stole' },
  { key: 'waiter_calls', label: 'Volania',       description: 'Prijimat volania casnika od zakaznikov' },
] as const

export type PermissionKey = typeof ALL_PERMISSIONS[number]['key']
