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
    },
    whenNo: {
      'purchaseOrders.hubList': false,
      'purchaseOrders.create': false,
      'purchaseOrders.confirmReceive': false,
    },
  },
  {
    id: 'po_manage',
    titleKey: 'members.onboard.q.poManage.title',
    descriptionKey: 'members.onboard.q.poManage.desc',
    whenYes: {
      'purchaseOrders.editNote': true,
      'purchaseOrders.costOverridePriceDialog': true,
      'purchaseOrders.cancel': true,
      'purchaseOrders.importCsv': true,
      'purchaseOrders.exportCsv': true,
    },
    whenNo: {
      'purchaseOrders.editNote': false,
      'purchaseOrders.costOverridePriceDialog': false,
      'purchaseOrders.cancel': false,
      'purchaseOrders.importCsv': false,
      'purchaseOrders.exportCsv': false,
    },
  },
  {
    id: 'inventory_add',
    titleKey: 'members.onboard.q.inventoryAdd.title',
    descriptionKey: 'members.onboard.q.inventoryAdd.desc',
    whenYes: {
      'products.addProduct': true,
      'categories.addCategory': true,
      'brands.addBrand': true,
    },
    whenNo: {
      'products.addProduct': false,
      'categories.addCategory': false,
      'brands.addBrand': false,
    },
  },
  {
    id: 'inventory_edit_delete',
    titleKey: 'members.onboard.q.inventoryEditDelete.title',
    descriptionKey: 'members.onboard.q.inventoryEditDelete.desc',
    whenYes: {
      'products.editProduct': true,
      'products.deleteProduct': true,
      'products.stockAdjust': true,
      'categories.editCategory': true,
      'categories.deleteCategory': true,
      'brands.editBrand': true,
      'brands.deleteBrand': true,
    },
    whenNo: {
      'products.editProduct': false,
      'products.deleteProduct': false,
      'products.stockAdjust': false,
      'categories.editCategory': false,
      'categories.deleteCategory': false,
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
    id: 'people_access',
    titleKey: 'members.onboard.q.peopleAccess.title',
    descriptionKey: 'members.onboard.q.peopleAccess.desc',
    whenYes: {
      'people.viewProfile': true,
      'people.addPerson': true,
      'people.recordPayment': true,
      'payments.list': true,
      'payments.fullLedgerView': true,
      'register.deposit': true,
      'register.withdraw': true,
      'register.viewActivity': true,
    },
    whenNo: {
      'people.viewProfile': false,
      'people.addPerson': false,
      'people.recordPayment': false,
      'payments.list': false,
      'payments.fullLedgerView': false,
      'register.deposit': false,
      'register.withdraw': false,
      'register.viewActivity': false,
    },
  },
  {
    id: 'people_edit_delete',
    titleKey: 'members.onboard.q.peopleEditDelete.title',
    descriptionKey: 'members.onboard.q.peopleEditDelete.desc',
    whenYes: {
      'people.editPerson': true,
      'people.deletePerson': true,
      'payments.editLedgerNote': true,
      'payments.reverseLedgerOperation': true,
    },
    whenNo: {
      'people.editPerson': false,
      'people.deletePerson': false,
      'payments.editLedgerNote': false,
      'payments.reverseLedgerOperation': false,
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
  'admin.dataSync': false,
}
