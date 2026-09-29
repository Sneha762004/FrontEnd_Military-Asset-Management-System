/** Mirrors the API's response shapes. Kept hand-written and narrow on purpose -
 *  the client only declares the fields it actually renders, so a field the
 *  server stops sending is a compile error rather than a silent `undefined`. */

export type RoleKey = 'ADMIN' | 'BASE_COMMANDER' | 'LOGISTICS_OFFICER';

/**
 * Every permission the API can grant, as reported in the login/`me` response.
 *
 * Deliberately a closed union rather than `string`: the UI gates buttons and
 * routes on these, and a silent typo there is invisible at runtime - the check
 * just quietly returns false and hides a control from everyone.
 */
export type Permission =
  | 'assignment:create'
  | 'assignment:delete'
  | 'assignment:read'
  | 'assignment:update'
  | 'audit:read'
  | 'base:read'
  | 'dashboard:read'
  | 'equipment:create'
  | 'equipment:read'
  | 'equipment:update'
  | 'expenditure:create'
  | 'expenditure:delete'
  | 'expenditure:read'
  | 'openingBalance:create'
  | 'openingBalance:read'
  | 'openingBalance:update'
  | 'personnel:create'
  | 'personnel:read'
  | 'purchase:create'
  | 'purchase:delete'
  | 'purchase:read'
  | 'purchase:update'
  | 'transfer:approve'
  | 'transfer:create'
  | 'transfer:read'
  | 'transfer:update'
  | 'user:create'
  | 'user:delete'
  | 'user:read'
  | 'user:update';

export interface CurrentUser {
  id: number;
  username: string;
  fullName: string;
  rank: string;
  role: RoleKey;
  permissions: Permission[];
  baseId: number | null;
  baseCode: string | null;
  baseName: string | null;
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: Record<string, unknown> & {
    total?: number;
    page?: number;
    pageSize?: number;
    pageCount?: number;
  };
}

export interface PaginatedMeta {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  summary?: Record<string, number>;
  actions?: { value: string; count: number }[];
  breakdown?: NetMovementBreakdown;
  baseOptions?: { id: number; code: string; name: string }[];
}

/** The filter triple every reporting screen shares. */
export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  baseId: number | null;
  equipmentTypeId: number | null;
  category: string | null;
}

export interface Base {
  id: number;
  code: string;
  name: string;
  location: string;
  country: string;
  commander: string;
  is_active: number;
}

export type EquipmentCategory = 'WEAPON' | 'VEHICLE' | 'AMMUNITION' | 'EQUIPMENT' | 'SPARES' | 'FUEL';

export interface EquipmentType {
  id: number;
  code: string;
  name: string;
  category: EquipmentCategory;
  unit: string;
  serialised: number;
  description: string;
}

export interface Personnel {
  id: number;
  service_number: string;
  full_name: string;
  rank: string;
  unit: string;
  base_id: number;
  base_code: string;
  base_name: string;
}

export interface DashboardTotals {
  opening_balance: number;
  purchases: number;
  transfer_in: number;
  transfer_out: number;
  net_movement: number;
  expended: number;
  assigned: number;
  closing_balance: number;
  available: number;
  totals_are_meaningful: boolean;
  unit: string;
}

export interface DashboardSummary {
  filters: ReportFilters;
  scope: { role: RoleKey; baseId: number | null; baseLabel: string };
  totals: DashboardTotals;
  document_counts: {
    purchases: { n: number };
    transfers: { documents: number; units: number };
    assignments: { documents: number; units: number };
    expenditures: { n: number };
  };
}

export interface NetMovementBreakdown {
  purchases: number;
  transfer_in: number;
  transfer_out: number;
  net_movement: number;
  formula: string;
}

export interface MovementRow {
  id: number;
  txn_type: string;
  ref_type: string;
  ref_id: number;
  ref_reference: string;
  quantity: number;
  direction: 'IN' | 'OUT';
  delta_on_hand: number;
  delta_committed?: number;
  balance_on_hand?: number;
  base_code: string;
  base_name: string;
  equipment_code: string;
  equipment_name: string;
  equipment_unit: string;
  effective_date: string;
  note: string;
  actor_username: string | null;
  created_at: string;
}

export interface ByEquipmentRow {
  equipment_type_id: number;
  equipment_code: string;
  equipment_name: string;
  equipment_category: EquipmentCategory;
  equipment_unit: string;
  opening_balance: number;
  purchases: number;
  transfer_in: number;
  transfer_out: number;
  net_movement: number;
  expended: number;
  assigned: number;
  closing_balance: number;
  available: number;
}

export interface ByBaseRow {
  base_id: number;
  base_code: string;
  base_name: string;
  opening_balance: number;
  purchases: number;
  transfer_in: number;
  transfer_out: number;
  net_movement: number;
  expended: number;
  assigned: number;
  closing_balance: number;
  available: number;
}

export interface TrendPoint {
  period: string;
  purchases: number;
  transfer_in: number;
  transfer_out: number;
  expended: number;
  net_movement: number;
}

export interface Purchase {
  id: number;
  reference: string;
  base_id: number;
  base_code: string;
  base_name: string;
  equipment_type_id: number;
  equipment_code: string;
  equipment_name: string;
  equipment_category: EquipmentCategory;
  equipment_unit: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  supplier: string;
  contract_ref: string;
  purchase_date: string;
  received_date: string;
  status: string;
  notes: string;
  created_by_username: string;
  created_at: string;
}

export interface TransferItem {
  id: number;
  equipment_type_id: number;
  equipment_code: string;
  equipment_name: string;
  equipment_unit: string;
  quantity: number;
  quantity_received: number | null;
}

export interface Transfer {
  id: number;
  reference: string;
  from_base_id: number;
  from_base_code: string;
  from_base_name: string;
  to_base_id: number;
  to_base_code: string;
  to_base_name: string;
  status: 'DRAFT' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
  transfer_date: string;
  received_date: string | null;
  vehicle_ref: string;
  notes: string;
  created_by_username: string;
  created_at: string;
  updated_at: string;
  line_count: number;
  total_quantity: number;
  items?: TransferItem[];
}

export interface Assignment {
  id: number;
  reference: string;
  base_id: number;
  base_code: string;
  base_name: string;
  equipment_type_id: number;
  equipment_code: string;
  equipment_name: string;
  equipment_unit: string;
  personnel_id: number;
  service_number: string;
  personnel_name: string;
  personnel_rank: string;
  unit: string;
  quantity: number;
  quantity_returned: number;
  quantity_expended: number;
  quantity_outstanding: number;
  status: string;
  assigned_date: string;
  due_date: string | null;
  returned_date: string | null;
  purpose: string;
  notes: string;
  created_by_username: string;
  created_at: string;
}

export interface Expenditure {
  id: number;
  reference: string;
  base_id: number;
  base_code: string;
  base_name: string;
  equipment_type_id: number;
  equipment_code: string;
  equipment_name: string;
  equipment_unit: string;
  quantity: number;
  source: 'DIRECT' | 'ASSIGNED';
  assignment_id: number | null;
  assignment_reference: string | null;
  assigned_to: string | null;
  reason: string;
  expended_date: string;
  authorised_by: string;
  notes: string;
  created_by_username: string;
  created_at: string;
}

export interface LedgerBalance {
  base_id: number;
  base_code: string;
  base_name: string;
  equipment_type_id: number;
  equipment_code: string;
  equipment_name: string;
  equipment_category: EquipmentCategory;
  equipment_unit: string;
  on_hand: number;
  committed: number;
  available: number;
  last_movement_date: string;
}

export interface OpeningBalance {
  id: number;
  base_id: number;
  base_code: string;
  base_name: string;
  equipment_type_id: number;
  equipment_code: string;
  equipment_name: string;
  equipment_unit: string;
  period_start: string;
  quantity: number;
  notes: string;
  recorded_by_username: string | null;
  created_at: string;
}

export interface ManagedUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  rank: string;
  role: RoleKey;
  role_name: string;
  base_id: number | null;
  base_code: string | null;
  base_name: string | null;
  is_active: number;
  last_login_at: string | null;
  created_at: string;
}

export interface RoleDefinition {
  key: RoleKey;
  name: string;
  description: string;
  scope: 'GLOBAL' | 'BASE';
  permissions: string[];
}

export interface AuditLog {
  id: number;
  request_id: string;
  actor_username: string;
  actor_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  method: string;
  path: string;
  status_code: number;
  outcome: 'SUCCESS' | 'DENIED' | 'FAILURE';
  message: string;
  duration_ms: number | null;
  created_at: string;
}

/** One day of activity from `GET /api/audit-logs/summary`. */
export interface AuditActivity {
  day: string;
  outcome: 'SUCCESS' | 'DENIED' | 'FAILURE';
  events: number;
}
