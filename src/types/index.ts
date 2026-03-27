export interface Account {
  id: string;
  name: string;
  type: 'checking' | 'savings';
  balance: number;
  bankName: string;
  iban?: string;
  lastSync?: string;
  bridgeId?: number;
}

export interface Transaction {
  id: string;
  accountId: string;
  amount: number;
  description: string;
  category: string;
  date: string;
  type: 'debit' | 'credit';
  isRecurring: boolean;
  bridgeId?: number;
}

export interface Budget {
  id: string;
  category: string;
  limit: number;
  spent: number;
  month: string; // YYYY-MM
  color: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  color: string;
  icon: string;
}

export interface Subscription {
  id: string;
  name: string;
  amount: number;
  frequency: 'monthly' | 'yearly' | 'weekly';
  nextDate: string;
  category: string;
  color: string;
}

export interface FinancialInsight {
  type: 'positive' | 'warning' | 'danger' | 'info';
  title: string;
  description: string;
  value?: number;
}

export interface MonthlyComparison {
  category: string;
  currentMonth: number;
  averageThreeMonths: number;
  percentChange: number;
  isAnomaly: boolean;
}
