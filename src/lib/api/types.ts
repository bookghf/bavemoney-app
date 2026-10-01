/**
 * Request/response shapes of the Ledger API (money-api, /api/v1).
 * Mirrors the Go structs in money-api/internal/<domain>/<domain>.go.
 *
 * Note: every amount and balance is a decimal *string* ("1234.50"); use
 * lib/money for exact arithmetic.
 */

export type ApiErrorBody = { error: string };

// --- auth / user ---------------------------------------------------------

export type User = {
  id: string;
  email: string;
  display_name: string;
  default_currency: string;
  status: string;
  created_at: string;
};

export type AuthResponse = {
  token: string;
  expires_in: number;
  refresh_token: string;
  refresh_token_expires_in: number;
  user: User;
};

export type LoginRequest = { email: string; password: string };

export type RegisterRequest = LoginRequest & {
  display_name?: string;
  default_currency?: string;
};

export type LogoutRequest = { refresh_token: string; all?: boolean };

/** PATCH /me; omitted fields are left unchanged. Email can not be changed. */
export type UpdateProfileRequest = { display_name?: string; default_currency?: string };

/** POST /me/reset: erases the user's ledger data; the login stays. */
export type ResetAccountResponse = {
  message: string;
  deleted: { transactions: number; accounts: number; budgets: number; categories: number };
};

/** POST /me/password; signs out every other device. */
export type ChangePasswordRequest = { current_password: string; new_password: string };

// --- accounts ------------------------------------------------------------

export const ACCOUNT_TYPES = ['cash', 'bank', 'credit_card', 'e_wallet'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export type Account = {
  id: string;
  name: string;
  type: AccountType | (string & {});
  currency: string;
  initial_balance: string;
  current_balance: string;
  is_archived: boolean;
  created_at: string;
};

export type CreateAccountRequest = {
  name: string;
  type: AccountType;
  currency: string;
  /** Decimal string; negative only for credit cards (amount owed). */
  initial_balance: string;
};

/** PATCH /accounts/:id; omitted fields are left unchanged. Currency can only change while the account has no transactions. */
export type UpdateAccountRequest = Partial<CreateAccountRequest> & { is_archived?: boolean };

export type Currency = { code: string; name: string; symbol: string };

// --- categories ----------------------------------------------------------

export type CategoryType = 'income' | 'expense';

export type Category = {
  id: string;
  parent_id?: string;
  name: string;
  type: CategoryType | (string & {});
  icon?: string;
  color?: string;
  /** Global default category: every user sees it, only admins can change it. */
  is_system: boolean;
  children?: Category[];
};

// --- transactions --------------------------------------------------------

/** A transfer moves `amount` from `account_id` to `to_account_id` (same currency). */
export type TransactionType = 'income' | 'expense' | 'transfer';

export type TransactionCategory = {
  id: string;
  name: string;
  parent?: TransactionCategory;
};

export type Transaction = {
  id: string;
  account_id: string;
  account_name: string;
  /** Set on transfers only. */
  to_account_id?: string;
  to_account_name?: string;
  category: TransactionCategory | null;
  type: TransactionType | (string & {});
  amount: string;
  currency: string;
  /** Null when no exchange rate to the user's default currency is known. */
  amount_in_default_currency: string | null;
  note?: string;
  tags: string[] | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
};

export type Pagination = {
  page: number;
  limit: number;
  total_items: number;
  total_pages: number;
};

export type TransactionListResponse = {
  transactions: Transaction[];
  pagination: Pagination;
};

export type CreateTransactionRequest = {
  account_id: string;
  /** Optional: income/expense take the account's currency. */
  /** Required for, and only allowed on, transfers. */
  to_account_id?: string;
  /** Not allowed on transfers. */
  category_id?: string;
  type: TransactionType;
  amount: string;
  currency?: string;
  note?: string;
  tags: string[];
  /** RFC 3339 timestamp. */
  occurred_at: string;
};

/**
 * PATCH /transactions/:id; omitted fields are left unchanged. The account and
 * transfer target can not change, and a transfer stays a transfer. An empty
 * category_id clears the category.
 */
export type UpdateTransactionRequest = {
  category_id?: string;
  type?: 'income' | 'expense';
  amount?: string;
  note?: string;
  tags?: string[];
  occurred_at?: string;
};

export type TransactionListParams = {
  page?: number;
  limit?: number;
  account?: string;
  category?: string;
  type?: TransactionType;
  /** YYYY-MM-DD, inclusive, in `tz`. */
  from?: string;
  to?: string;
  search?: string;
  tz?: string;
};

// --- reports -------------------------------------------------------------

export type ReportPeriod = 'day' | 'week' | 'month' | 'year' | 'custom';

export type ReportCategory = {
  /** Empty for the "Uncategorized" bucket. */
  id: string;
  name: string;
  type: CategoryType | (string & {});
  icon?: string;
  color?: string;
};

export type ReportSubcategory = {
  /** Empty for "Other": entries filed on the parent with no subcategory. */
  id: string;
  name: string;
  total: string;
  /** Share of the report's total for its type, 0-100. */
  percentage: number;
  transaction_count: number;
};

export type ReportCategorySummary = {
  category: ReportCategory;
  total: string;
  percentage: number;
  transaction_count: number;
  /** Empty when the category has no subcategory spending. */
  subcategories: ReportSubcategory[];
};

export type ReportDay = { date: string; income: string; expense: string };

export type ReportSummary = {
  period: ReportPeriod | (string & {});
  start_date: string;
  end_date: string;
  currency: string;
  time_zone: string;
  /** Which transactions by_category breaks down. */
  type: CategoryType | (string & {});
  total_income: string;
  total_expense: string;
  net: string;
  transaction_count: number;
  /** Largest first. */
  by_category: ReportCategorySummary[];
  /** One row per day in the range, zero days included. */
  daily_breakdown: ReportDay[];
};

export type ReportSummaryParams = {
  period: ReportPeriod;
  /** YYYY-MM-DD, any day inside the period. Not used for custom. */
  date?: string;
  /** Custom period bounds, YYYY-MM-DD inclusive. */
  from?: string;
  to?: string;
  account_id?: string;
  /** A top-level category (includes its subcategories) or one subcategory. */
  category_id?: string;
  /** Defaults to expense. */
  type?: CategoryType;
  currency?: string;
};

// --- budgets ---------------------------------------------------------------

export type BudgetPeriod = 'weekly' | 'monthly' | 'yearly';

export type Budget = {
  id: string;
  /** Null for an overall budget across every expense category. */
  category: { id: string; name: string } | null;
  amount: string;
  currency: string;
  period: BudgetPeriod;
  start_date: string;
  alert_threshold_pct: number;
  /** Bounds (inclusive) of the period that contains today. */
  period_start: string;
  period_end: string;
  current_spend: string;
  remaining: string;
  percent_used: number;
  is_over_budget: boolean;
  created_at: string;
};

export type CreateBudgetRequest = {
  category_id?: string;
  amount: string;
  currency: string;
  period: BudgetPeriod;
  start_date: string;
  alert_threshold_pct?: number;
};

export type UpdateBudgetRequest = {
  amount?: string;
  period?: BudgetPeriod;
  alert_threshold_pct?: number;
};
