import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('budgetcontrol.db');
  await initializeDatabase(db);
  return db;
}

async function initializeDatabase(database: SQLite.SQLiteDatabase): Promise<void> {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'checking',
      balance REAL NOT NULL DEFAULT 0,
      bankName TEXT NOT NULL DEFAULT 'BNP Paribas',
      iban TEXT,
      lastSync TEXT,
      bridgeId INTEGER
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Autre',
      date TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'debit',
      isRecurring INTEGER NOT NULL DEFAULT 0,
      bridgeId INTEGER,
      FOREIGN KEY (accountId) REFERENCES accounts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      budgetLimit REAL NOT NULL,
      spent REAL NOT NULL DEFAULT 0,
      month TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6C5CE7'
    );

    CREATE TABLE IF NOT EXISTS savings_goals (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      targetAmount REAL NOT NULL,
      currentAmount REAL NOT NULL DEFAULT 0,
      deadline TEXT,
      color TEXT NOT NULL DEFAULT '#00CEC9',
      icon TEXT NOT NULL DEFAULT '🎯'
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'monthly',
      nextDate TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Abonnements',
      color TEXT NOT NULL DEFAULT '#F7DC6F'
    );

    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_accountId ON transactions(accountId);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
    CREATE INDEX IF NOT EXISTS idx_budgets_month ON budgets(month);
  `);
}

// --- Generic Helpers ---

export async function queryAll<T>(sql: string, params: any[] = []): Promise<T[]> {
  const database = await getDatabase();
  return await database.getAllAsync(sql, params) as T[];
}

export async function queryFirst<T>(sql: string, params: any[] = []): Promise<T | null> {
  const database = await getDatabase();
  const result = await database.getFirstAsync(sql, params);
  return result as T | null;
}

export async function runQuery(sql: string, params: any[] = []): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(sql, params);
}

// --- Accounts ---

export async function getAccounts() {
  return queryAll<any>('SELECT * FROM accounts ORDER BY type, name');
}

export async function upsertAccount(account: {
  id: string; name: string; type: string; balance: number;
  bankName: string; iban?: string; lastSync?: string; bridgeId?: number;
}) {
  await runQuery(
    `INSERT OR REPLACE INTO accounts (id, name, type, balance, bankName, iban, lastSync, bridgeId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [account.id, account.name, account.type, account.balance,
     account.bankName, account.iban || null, account.lastSync || null, account.bridgeId || null]
  );
}

// --- Transactions ---

export async function getTransactions(options?: {
  accountId?: string; category?: string; limit?: number; offset?: number;
  startDate?: string; endDate?: string;
}) {
  let sql = 'SELECT * FROM transactions WHERE 1=1';
  const params: any[] = [];

  if (options?.accountId) {
    sql += ' AND accountId = ?';
    params.push(options.accountId);
  }
  if (options?.category) {
    sql += ' AND category = ?';
    params.push(options.category);
  }
  if (options?.startDate) {
    sql += ' AND date >= ?';
    params.push(options.startDate);
  }
  if (options?.endDate) {
    sql += ' AND date <= ?';
    params.push(options.endDate);
  }

  sql += ' ORDER BY date DESC';

  if (options?.limit) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }
  if (options?.offset) {
    sql += ' OFFSET ?';
    params.push(options.offset);
  }

  return queryAll<any>(sql, params);
}

export async function insertTransaction(tx: {
  id: string; accountId: string; amount: number; description: string;
  category: string; date: string; type: string; isRecurring: boolean; bridgeId?: number;
}) {
  await runQuery(
    `INSERT OR REPLACE INTO transactions (id, accountId, amount, description, category, date, type, isRecurring, bridgeId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tx.id, tx.accountId, tx.amount, tx.description, tx.category,
     tx.date, tx.type, tx.isRecurring ? 1 : 0, tx.bridgeId || null]
  );
}

// --- Budgets ---

export async function getBudgets(month: string) {
  return queryAll<any>('SELECT * FROM budgets WHERE month = ? ORDER BY category', [month]);
}

export async function upsertBudget(budget: {
  id: string; category: string; limit: number; spent: number; month: string; color: string;
}) {
  await runQuery(
    `INSERT OR REPLACE INTO budgets (id, category, budgetLimit, spent, month, color)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [budget.id, budget.category, budget.limit, budget.spent, budget.month, budget.color]
  );
}

export async function updateBudgetSpent(month: string) {
  const startDate = `${month}-01`;
  const endMonth = parseInt(month.split('-')[1]) + 1;
  const endYear = parseInt(month.split('-')[0]) + (endMonth > 12 ? 1 : 0);
  const endDate = `${endYear}-${String(endMonth > 12 ? 1 : endMonth).padStart(2, '0')}-01`;

  const budgets = await getBudgets(month);
  for (const budget of budgets) {
    const result = await queryFirst<any>(
      `SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM transactions
       WHERE category = ? AND date >= ? AND date < ? AND type = 'debit'`,
      [budget.category, startDate, endDate]
    );
    await runQuery(
      'UPDATE budgets SET spent = ? WHERE id = ?',
      [result?.total || 0, budget.id]
    );
  }
}

// --- Savings Goals ---

export async function getSavingsGoals() {
  return queryAll<any>('SELECT * FROM savings_goals ORDER BY name');
}

export async function upsertSavingsGoal(goal: {
  id: string; name: string; targetAmount: number; currentAmount: number;
  deadline?: string; color: string; icon: string;
}) {
  await runQuery(
    `INSERT OR REPLACE INTO savings_goals (id, name, targetAmount, currentAmount, deadline, color, icon)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [goal.id, goal.name, goal.targetAmount, goal.currentAmount,
     goal.deadline || null, goal.color, goal.icon]
  );
}

export async function deleteSavingsGoal(id: string) {
  await runQuery('DELETE FROM savings_goals WHERE id = ?', [id]);
}

// --- Subscriptions ---

export async function getSubscriptions() {
  return queryAll<any>('SELECT * FROM subscriptions ORDER BY nextDate');
}

export async function upsertSubscription(sub: {
  id: string; name: string; amount: number; frequency: string;
  nextDate: string; category: string; color: string;
}) {
  await runQuery(
    `INSERT OR REPLACE INTO subscriptions (id, name, amount, frequency, nextDate, category, color)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sub.id, sub.name, sub.amount, sub.frequency, sub.nextDate, sub.category, sub.color]
  );
}

export async function deleteSubscription(id: string) {
  await runQuery('DELETE FROM subscriptions WHERE id = ?', [id]);
}

// --- Analytics Queries ---

export async function getTotalBalance(): Promise<number> {
  const result = await queryFirst<any>('SELECT COALESCE(SUM(balance), 0) as total FROM accounts');
  return result?.total || 0;
}

export async function getMonthlySpending(month: string): Promise<number> {
  const startDate = `${month}-01`;
  const endMonth = parseInt(month.split('-')[1]) + 1;
  const endYear = parseInt(month.split('-')[0]) + (endMonth > 12 ? 1 : 0);
  const endDate = `${endYear}-${String(endMonth > 12 ? 1 : endMonth).padStart(2, '0')}-01`;

  const result = await queryFirst<any>(
    `SELECT COALESCE(SUM(ABS(amount)), 0) as total FROM transactions
     WHERE type = 'debit' AND date >= ? AND date < ?`,
    [startDate, endDate]
  );
  return result?.total || 0;
}

export async function getMonthlyIncome(month: string): Promise<number> {
  const startDate = `${month}-01`;
  const endMonth = parseInt(month.split('-')[1]) + 1;
  const endYear = parseInt(month.split('-')[0]) + (endMonth > 12 ? 1 : 0);
  const endDate = `${endYear}-${String(endMonth > 12 ? 1 : endMonth).padStart(2, '0')}-01`;

  const result = await queryFirst<any>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
     WHERE type = 'credit' AND date >= ? AND date < ?`,
    [startDate, endDate]
  );
  return result?.total || 0;
}

export async function getSpendingByCategory(month: string) {
  const startDate = `${month}-01`;
  const endMonth = parseInt(month.split('-')[1]) + 1;
  const endYear = parseInt(month.split('-')[0]) + (endMonth > 12 ? 1 : 0);
  const endDate = `${endYear}-${String(endMonth > 12 ? 1 : endMonth).padStart(2, '0')}-01`;

  return queryAll<{ category: string; total: number }>(
    `SELECT category, COALESCE(SUM(ABS(amount)), 0) as total FROM transactions
     WHERE type = 'debit' AND date >= ? AND date < ?
     GROUP BY category ORDER BY total DESC`,
    [startDate, endDate]
  );
}

export async function getCategorySpendingForMonths(months: string[]) {
  const results: Record<string, Record<string, number>> = {};

  for (const month of months) {
    const data = await getSpendingByCategory(month);
    results[month] = {};
    for (const item of data) {
      results[month][item.category] = item.total;
    }
  }

  return results;
}
