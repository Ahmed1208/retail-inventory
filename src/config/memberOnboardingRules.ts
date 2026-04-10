import type { FeatureControlId } from '@/config/featureControls'

export type OnboardingAnswerMap = Partial<Record<FeatureControlId, boolean>>

export type MemberOnboardingQuestion = {
  id: string
  titleKey: string
  descriptionKey: string
  /** Applied when the user answers Yes. */
  whenYes: OnboardingAnswerMap
  /** Applied when the user answers No. */
  whenNo: OnboardingAnswerMap
}

/** Yes/No flow: each answer merges into `feature_overrides` (later keys win). */
export const MEMBER_ONBOARDING_QUESTIONS: MemberOnboardingQuestion[] = [
  {
    id: 'sales_pos',
    titleKey: 'members.onboard.q.salesPos.title',
    descriptionKey: 'members.onboard.q.salesPos.desc',
    whenYes: {
      'orders.hubList': true,
      'orders.hubNew': true,
      'orders.editDraftPos': true,
      'orders.posCheckout': true,
      'orders.printInvoice': true,
    },
    whenNo: {
      'orders.hubList': false,
      'orders.hubNew': false,
      'orders.editDraftPos': false,
      'orders.posCheckout': false,
      'orders.printInvoice': false,
    },
  },
  {
    id: 'orders_manage',
    titleKey: 'members.onboard.q.ordersManage.title',
    descriptionKey: 'members.onboard.q.ordersManage.desc',
    whenYes: {
      'orders.cancelOrder': true,
      'orders.addPayment': true,
      'orders.editNote': true,
    },
    whenNo: {
      'orders.cancelOrder': false,
      'orders.addPayment': false,
      'orders.editNote': false,
    },
  },
  {
    id: 'orders_csv',
    titleKey: 'members.onboard.q.ordersCsv.title',
    descriptionKey: 'members.onboard.q.ordersCsv.desc',
    whenYes: {
      'orders.importCsv': true,
      'orders.exportCsv': true,
    },
    whenNo: {
      'orders.importCsv': false,
      'orders.exportCsv': false,
    },
  },
  {
    id: 'purchase_orders',
    titleKey: 'members.onboard.q.purchaseOrders.title',
    descriptionKey: 'members.onboard.q.purchaseOrders.desc',
    whenYes: {
      'purchaseOrders.hubList': true,
      'purchaseOrders.create': true,
      'purchaseOrders.confirmReceive': true,
      'purchaseOrders.editNote': true,
    },
    whenNo: {
      'purchaseOrders.hubList': false,
      'purchaseOrders.create': false,
      'purchaseOrders.confirmReceive': false,
      'purchaseOrders.editNote': false,
    },
  },
  {
    id: 'po_advanced',
    titleKey: 'members.onboard.q.poAdvanced.title',
    descriptionKey: 'members.onboard.q.poAdvanced.desc',
    whenYes: {
      'purchaseOrders.costOverridePriceDialog': true,
      'purchaseOrders.cancel': true,
      'purchaseOrders.importCsv': true,
      'purchaseOrders.exportCsv': true,
    },
    whenNo: {
      'purchaseOrders.costOverridePriceDialog': false,
      'purchaseOrders.cancel': false,
      'purchaseOrders.importCsv': false,
      'purchaseOrders.exportCsv': false,
    },
  },
  {
    id: 'inventory_catalog',
    titleKey: 'members.onboard.q.inventoryCatalog.title',
    descriptionKey: 'members.onboard.q.inventoryCatalog.desc',
    whenYes: {
      'products.addProduct': true,
      'products.editProduct': true,
      'products.deleteProduct': true,
      'products.stockAdjust': true,
      'categories.addCategory': true,
      'categories.editCategory': true,
      'categories.deleteCategory': true,
      'brands.addBrand': true,
      'brands.editBrand': true,
      'brands.deleteBrand': true,
    },
    whenNo: {
      'products.addProduct': false,
      'products.editProduct': false,
      'products.deleteProduct': false,
      'products.stockAdjust': false,
      'categories.addCategory': false,
      'categories.editCategory': false,
      'categories.deleteCategory': false,
      'brands.addBrand': false,
      'brands.editBrand': false,
      'brands.deleteBrand': false,
    },
  },
  {
    id: 'inventory_transfers',
    titleKey: 'members.onboard.q.inventoryTransfers.title',
    descriptionKey: 'members.onboard.q.inventoryTransfers.desc',
    whenYes: {
      'inventoryTransfers.create': true,
      'inventoryTransfers.list': true,
    },
    whenNo: {
      'inventoryTransfers.create': false,
      'inventoryTransfers.list': false,
    },
  },
  {
    id: 'people_payments',
    titleKey: 'members.onboard.q.peoplePayments.title',
    descriptionKey: 'members.onboard.q.peoplePayments.desc',
    whenYes: {
      'people.addPerson': true,
      'people.editPerson': true,
      'people.deletePerson': true,
      'people.recordPayment': true,
      'payments.list': true,
      'payments.editLedgerNote': true,
      'payments.reverseLedgerOperation': true,
      'register.deposit': true,
      'register.withdraw': true,
      'register.viewActivity': true,
    },
    whenNo: {
      'people.addPerson': false,
      'people.editPerson': false,
      'people.deletePerson': false,
      'people.recordPayment': false,
      'payments.list': false,
      'payments.editLedgerNote': false,
      'payments.reverseLedgerOperation': false,
      'register.deposit': false,
      'register.withdraw': false,
      'register.viewActivity': false,
    },
  },
  {
    id: 'reports_movements',
    titleKey: 'members.onboard.q.reportsMovements.title',
    descriptionKey: 'members.onboard.q.reportsMovements.desc',
    whenYes: {
      'reports.exportCsv': true,
      'inventory.hubMovements': true,
    },
    whenNo: {
      'reports.exportCsv': false,
      'inventory.hubMovements': false,
    },
  },
]

/** Always forced for operator-created members (server still enforces admin-only paths). */
export const MEMBER_BASE_DENY_ADMIN: OnboardingAnswerMap = {
  'sidebar.admin': false,
  'sidebar.control': false,
}
