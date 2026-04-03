/**
 * Platform feature toggles. IDs are stable for localStorage; defaults are all enabled.
 * Add new items under FEATURE_CONTROL_REGISTRY and extend FEATURE_CONTROL_IDS in sync.
 */

export const FEATURE_CONTROL_IDS = [
  // People
  'people.viewProfile',
  'people.editPerson',
  'people.deletePerson',
  'people.recordPayment',
  'people.addPerson',
  // Sidebar (main nav)
  'sidebar.inventory',
  'sidebar.orders',
  'sidebar.people',
  'sidebar.payments',
  'sidebar.register',
  'register.deposit',
  'register.withdraw',
  'payments.list',
  'payments.editLedgerNote',
  'payments.reverseLedgerOperation',
  // Inventory hub cards
  'inventory.hubProducts',
  'inventory.hubPurchaseOrders',
  'inventory.hubMovements',
  'inventory.hubCategories',
  'inventory.hubBrands',
  // Products
  'products.addProduct',
  'products.editProduct',
  'products.deleteProduct',
  'products.stockAdjust',
  // Categories
  'categories.addCategory',
  'categories.editCategory',
  'categories.deleteCategory',
  // Brands
  'brands.addBrand',
  'brands.editBrand',
  'brands.deleteBrand',
  // Purchase orders
  'purchaseOrders.hubList',
  'purchaseOrders.create',
  'purchaseOrders.cancel',
  // Orders / POS
  'orders.hubList',
  'orders.hubNew',
  'orders.editDraftPos',
  'orders.posSaveDraft',
  'orders.posCheckout',
  'orders.printInvoice',
  'orders.cancelOrder',
  'orders.addPayment',
  'orders.editNote',
  // Reports
  'reports.exportCsv',
] as const

export type FeatureControlId = (typeof FEATURE_CONTROL_IDS)[number]

export type FeatureControlItemDef = {
  id: FeatureControlId
  defaultEnabled: boolean
  titleKey: string
  descriptionKey: string
}

export type FeatureGroupDef = {
  titleKey: string
  items: FeatureControlItemDef[]
}

export type FeatureAreaDef = {
  titleKey: string
  groups: FeatureGroupDef[]
}

export const FEATURE_CONTROL_REGISTRY: FeatureAreaDef[] = [
  {
    titleKey: 'control.area.sidebar',
    groups: [
      {
        titleKey: 'control.sidebar.groupNav',
        items: [
          {
            id: 'sidebar.inventory',
            defaultEnabled: true,
            titleKey: 'control.sidebar.inventory.title',
            descriptionKey: 'control.sidebar.inventory.desc',
          },
          {
            id: 'sidebar.orders',
            defaultEnabled: true,
            titleKey: 'control.sidebar.orders.title',
            descriptionKey: 'control.sidebar.orders.desc',
          },
          {
            id: 'sidebar.people',
            defaultEnabled: true,
            titleKey: 'control.sidebar.people.title',
            descriptionKey: 'control.sidebar.people.desc',
          },
          {
            id: 'sidebar.payments',
            defaultEnabled: true,
            titleKey: 'control.sidebar.payments.title',
            descriptionKey: 'control.sidebar.payments.desc',
          },
          {
            id: 'sidebar.register',
            defaultEnabled: true,
            titleKey: 'control.sidebar.register.title',
            descriptionKey: 'control.sidebar.register.desc',
          },
        ],
      },
    ],
  },
  {
    titleKey: 'control.area.register',
    groups: [
      {
        titleKey: 'control.register.group',
        items: [
          {
            id: 'register.deposit',
            defaultEnabled: true,
            titleKey: 'control.register.deposit.title',
            descriptionKey: 'control.register.deposit.desc',
          },
          {
            id: 'register.withdraw',
            defaultEnabled: true,
            titleKey: 'control.register.withdraw.title',
            descriptionKey: 'control.register.withdraw.desc',
          },
        ],
      },
    ],
  },
  {
    titleKey: 'control.area.paymentsApp',
    groups: [
      {
        titleKey: 'control.paymentsApp.group',
        items: [
          {
            id: 'payments.list',
            defaultEnabled: true,
            titleKey: 'control.payments.list.title',
            descriptionKey: 'control.payments.list.desc',
          },
          {
            id: 'payments.editLedgerNote',
            defaultEnabled: true,
            titleKey: 'control.payments.editLedgerNote.title',
            descriptionKey: 'control.payments.editLedgerNote.desc',
          },
          {
            id: 'payments.reverseLedgerOperation',
            defaultEnabled: true,
            titleKey: 'control.payments.reverseLedgerOperation.title',
            descriptionKey: 'control.payments.reverseLedgerOperation.desc',
          },
        ],
      },
    ],
  },
  {
    titleKey: 'control.area.inventoryHub',
    groups: [
      {
        titleKey: 'control.inventoryHub.groupLinks',
        items: [
          {
            id: 'inventory.hubProducts',
            defaultEnabled: true,
            titleKey: 'control.inventoryHub.products.title',
            descriptionKey: 'control.inventoryHub.products.desc',
          },
          {
            id: 'inventory.hubPurchaseOrders',
            defaultEnabled: true,
            titleKey: 'control.inventoryHub.po.title',
            descriptionKey: 'control.inventoryHub.po.desc',
          },
          {
            id: 'inventory.hubMovements',
            defaultEnabled: true,
            titleKey: 'control.inventoryHub.movements.title',
            descriptionKey: 'control.inventoryHub.movements.desc',
          },
          {
            id: 'inventory.hubCategories',
            defaultEnabled: true,
            titleKey: 'control.inventoryHub.categories.title',
            descriptionKey: 'control.inventoryHub.categories.desc',
          },
          {
            id: 'inventory.hubBrands',
            defaultEnabled: true,
            titleKey: 'control.inventoryHub.brands.title',
            descriptionKey: 'control.inventoryHub.brands.desc',
          },
        ],
      },
    ],
  },
  {
    titleKey: 'control.area.people',
    groups: [
      {
        titleKey: 'control.people.groupList',
        items: [
          {
            id: 'people.viewProfile',
            defaultEnabled: true,
            titleKey: 'control.people.viewProfile.title',
            descriptionKey: 'control.people.viewProfile.desc',
          },
          {
            id: 'people.editPerson',
            defaultEnabled: true,
            titleKey: 'control.people.editPerson.title',
            descriptionKey: 'control.people.editPerson.desc',
          },
          {
            id: 'people.deletePerson',
            defaultEnabled: true,
            titleKey: 'control.people.deletePerson.title',
            descriptionKey: 'control.people.deletePerson.desc',
          },
          {
            id: 'people.recordPayment',
            defaultEnabled: true,
            titleKey: 'control.people.recordPayment.title',
            descriptionKey: 'control.people.recordPayment.desc',
          },
        ],
      },
      {
        titleKey: 'control.people.groupCreate',
        items: [
          {
            id: 'people.addPerson',
            defaultEnabled: true,
            titleKey: 'control.people.addPerson.title',
            descriptionKey: 'control.people.addPerson.desc',
          },
        ],
      },
    ],
  },
  {
    titleKey: 'control.area.products',
    groups: [
      {
        titleKey: 'control.products.group',
        items: [
          {
            id: 'products.addProduct',
            defaultEnabled: true,
            titleKey: 'control.products.add.title',
            descriptionKey: 'control.products.add.desc',
          },
          {
            id: 'products.editProduct',
            defaultEnabled: true,
            titleKey: 'control.products.edit.title',
            descriptionKey: 'control.products.edit.desc',
          },
          {
            id: 'products.deleteProduct',
            defaultEnabled: true,
            titleKey: 'control.products.delete.title',
            descriptionKey: 'control.products.delete.desc',
          },
          {
            id: 'products.stockAdjust',
            defaultEnabled: true,
            titleKey: 'control.products.stockAdjust.title',
            descriptionKey: 'control.products.stockAdjust.desc',
          },
        ],
      },
    ],
  },
  {
    titleKey: 'control.area.categories',
    groups: [
      {
        titleKey: 'control.categories.group',
        items: [
          {
            id: 'categories.addCategory',
            defaultEnabled: true,
            titleKey: 'control.categories.add.title',
            descriptionKey: 'control.categories.add.desc',
          },
          {
            id: 'categories.editCategory',
            defaultEnabled: true,
            titleKey: 'control.categories.edit.title',
            descriptionKey: 'control.categories.edit.desc',
          },
          {
            id: 'categories.deleteCategory',
            defaultEnabled: true,
            titleKey: 'control.categories.delete.title',
            descriptionKey: 'control.categories.delete.desc',
          },
        ],
      },
    ],
  },
  {
    titleKey: 'control.area.brands',
    groups: [
      {
        titleKey: 'control.brands.group',
        items: [
          {
            id: 'brands.addBrand',
            defaultEnabled: true,
            titleKey: 'control.brands.add.title',
            descriptionKey: 'control.brands.add.desc',
          },
          {
            id: 'brands.editBrand',
            defaultEnabled: true,
            titleKey: 'control.brands.edit.title',
            descriptionKey: 'control.brands.edit.desc',
          },
          {
            id: 'brands.deleteBrand',
            defaultEnabled: true,
            titleKey: 'control.brands.delete.title',
            descriptionKey: 'control.brands.delete.desc',
          },
        ],
      },
    ],
  },
  {
    titleKey: 'control.area.purchaseOrders',
    groups: [
      {
        titleKey: 'control.purchaseOrders.groupHub',
        items: [
          {
            id: 'purchaseOrders.hubList',
            defaultEnabled: true,
            titleKey: 'control.purchaseOrders.hubList.title',
            descriptionKey: 'control.purchaseOrders.hubList.desc',
          },
        ],
      },
      {
        titleKey: 'control.purchaseOrders.group',
        items: [
          {
            id: 'purchaseOrders.create',
            defaultEnabled: true,
            titleKey: 'control.purchaseOrders.create.title',
            descriptionKey: 'control.purchaseOrders.create.desc',
          },
          {
            id: 'purchaseOrders.cancel',
            defaultEnabled: true,
            titleKey: 'control.purchaseOrders.cancel.title',
            descriptionKey: 'control.purchaseOrders.cancel.desc',
          },
        ],
      },
    ],
  },
  {
    titleKey: 'control.area.orders',
    groups: [
      {
        titleKey: 'control.orders.groupHub',
        items: [
          {
            id: 'orders.hubList',
            defaultEnabled: true,
            titleKey: 'control.orders.hubList.title',
            descriptionKey: 'control.orders.hubList.desc',
          },
          {
            id: 'orders.hubNew',
            defaultEnabled: true,
            titleKey: 'control.orders.hubNew.title',
            descriptionKey: 'control.orders.hubNew.desc',
          },
        ],
      },
      {
        titleKey: 'control.orders.groupPos',
        items: [
          {
            id: 'orders.editDraftPos',
            defaultEnabled: true,
            titleKey: 'control.orders.editDraft.title',
            descriptionKey: 'control.orders.editDraft.desc',
          },
          {
            id: 'orders.posSaveDraft',
            defaultEnabled: true,
            titleKey: 'control.orders.saveDraft.title',
            descriptionKey: 'control.orders.saveDraft.desc',
          },
          {
            id: 'orders.posCheckout',
            defaultEnabled: true,
            titleKey: 'control.orders.checkout.title',
            descriptionKey: 'control.orders.checkout.desc',
          },
        ],
      },
      {
        titleKey: 'control.orders.groupConfirmed',
        items: [
          {
            id: 'orders.printInvoice',
            defaultEnabled: true,
            titleKey: 'control.orders.print.title',
            descriptionKey: 'control.orders.print.desc',
          },
          {
            id: 'orders.cancelOrder',
            defaultEnabled: true,
            titleKey: 'control.orders.cancel.title',
            descriptionKey: 'control.orders.cancel.desc',
          },
          {
            id: 'orders.addPayment',
            defaultEnabled: true,
            titleKey: 'control.orders.addPayment.title',
            descriptionKey: 'control.orders.addPayment.desc',
          },
          {
            id: 'orders.editNote',
            defaultEnabled: true,
            titleKey: 'control.orders.editNote.title',
            descriptionKey: 'control.orders.editNote.desc',
          },
        ],
      },
    ],
  },
  {
    titleKey: 'control.area.reports',
    groups: [
      {
        titleKey: 'control.reports.group',
        items: [
          {
            id: 'reports.exportCsv',
            defaultEnabled: true,
            titleKey: 'control.reports.export.title',
            descriptionKey: 'control.reports.export.desc',
          },
        ],
      },
    ],
  },
]

export function buildDefaultFeatureState(): Record<FeatureControlId, boolean> {
  const out = {} as Record<FeatureControlId, boolean>
  for (const id of FEATURE_CONTROL_IDS) {
    out[id] = true
  }
  for (const area of FEATURE_CONTROL_REGISTRY) {
    for (const g of area.groups) {
      for (const item of g.items) {
        out[item.id] = item.defaultEnabled
      }
    }
  }
  return out
}

export function mergeFeatureState(
  saved: Partial<Record<string, boolean>> | null | undefined
): Record<FeatureControlId, boolean> {
  const defaults = buildDefaultFeatureState()
  if (!saved || typeof saved !== 'object') return defaults
  const next = { ...defaults }
  for (const id of FEATURE_CONTROL_IDS) {
    if (typeof saved[id] === 'boolean') {
      next[id] = saved[id] as boolean
    }
  }
  return next
}
