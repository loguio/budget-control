import {
  getTotalBalance, getMonthlySpending, getMonthlyIncome,
  getSpendingByCategory, getCategorySpendingForMonths,
  getBudgets, getSavingsGoals,
} from '../database/db';
import type { FinancialInsight, MonthlyComparison } from '../types';

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function prevMonths(count: number): string[] {
  const months: string[] = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }
  return months;
}

// --- Financial Health Score (0-100) ---
export async function getFinancialHealthScore(): Promise<number> {
  const month = currentMonth();
  const income = await getMonthlyIncome(month);
  const spending = await getMonthlySpending(month);
  const balance = await getTotalBalance();
  const budgets = await getBudgets(month);

  let score = 50; // Base

  // Savings rate factor (0-30 pts)
  if (income > 0) {
    const savingsRate = (income - spending) / income;
    score += Math.min(30, Math.max(-20, savingsRate * 100));
  }

  // Budget adherence factor (0-20 pts)
  if (budgets.length > 0) {
    const overBudget = budgets.filter((b: any) => b.spent > b.budgetLimit).length;
    const adherenceRate = 1 - (overBudget / budgets.length);
    score += adherenceRate * 20;
  }

  // Emergency fund factor (0-10 pts)
  if (balance > 0 && income > 0) {
    const monthsCovered = balance / (spending || 1);
    score += Math.min(10, monthsCovered * 2);
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// --- Financial Insights ---
export async function getFinancialInsights(): Promise<FinancialInsight[]> {
  const insights: FinancialInsight[] = [];
  const month = currentMonth();
  const income = await getMonthlyIncome(month);
  const spending = await getMonthlySpending(month);
  const budgets = await getBudgets(month);
  const goals = await getSavingsGoals();

  // Savings rate
  if (income > 0) {
    const savingsRate = ((income - spending) / income) * 100;
    if (savingsRate >= 20) {
      insights.push({
        type: 'positive',
        title: 'Excellent taux d\'épargne',
        description: `Vous épargnez ${savingsRate.toFixed(0)}% de vos revenus ce mois-ci. Continuez ainsi !`,
        value: savingsRate,
      });
    } else if (savingsRate >= 10) {
      insights.push({
        type: 'info',
        title: 'Taux d\'épargne correct',
        description: `${savingsRate.toFixed(0)}% de vos revenus sont épargnés. L'objectif idéal est 20%.`,
        value: savingsRate,
      });
    } else if (savingsRate > 0) {
      insights.push({
        type: 'warning',
        title: 'Taux d\'épargne faible',
        description: `Seulement ${savingsRate.toFixed(0)}% d'épargne. Essayez de réduire vos dépenses.`,
        value: savingsRate,
      });
    } else {
      insights.push({
        type: 'danger',
        title: 'Dépenses supérieures aux revenus',
        description: 'Vos dépenses dépassent vos revenus ce mois-ci. Attention !',
        value: savingsRate,
      });
    }
  }

  // Budget alerts
  const overBudget = budgets.filter((b: any) => b.spent > b.budgetLimit);
  const nearBudget = budgets.filter((b: any) => b.spent > b.budgetLimit * 0.8 && b.spent <= b.budgetLimit);

  if (overBudget.length > 0) {
    insights.push({
      type: 'danger',
      title: `${overBudget.length} budget(s) dépassé(s)`,
      description: `Catégories : ${overBudget.map((b: any) => b.category).join(', ')}`,
    });
  }

  if (nearBudget.length > 0) {
    insights.push({
      type: 'warning',
      title: `${nearBudget.length} budget(s) presque atteint(s)`,
      description: `Catégories approchant la limite : ${nearBudget.map((b: any) => b.category).join(', ')}`,
    });
  }

  // Goals progress
  const completedGoals = goals.filter((g: any) => g.currentAmount >= g.targetAmount);
  if (completedGoals.length > 0) {
    insights.push({
      type: 'positive',
      title: '🎉 Objectif(s) atteint(s) !',
      description: `${completedGoals.map((g: any) => g.name).join(', ')}`,
    });
  }

  // Goals with deadlines approaching
  const now = new Date();
  const nearDeadline = goals.filter((g: any) => {
    if (!g.deadline) return false;
    const deadline = new Date(g.deadline);
    const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysLeft <= 30 && g.currentAmount < g.targetAmount;
  });

  if (nearDeadline.length > 0) {
    insights.push({
      type: 'warning',
      title: 'Objectif(s) avec échéance proche',
      description: `${nearDeadline.map((g: any) => g.name).join(', ')} — moins de 30 jours restants.`,
    });
  }

  return insights;
}

// --- Monthly Comparison (Current vs 3-month average) ---
export async function getMonthlyComparison(): Promise<MonthlyComparison[]> {
  const month = currentMonth();
  const prev = prevMonths(3);

  const allMonths = [month, ...prev];
  const data = await getCategorySpendingForMonths(allMonths);

  // Collect all categories
  const categories = new Set<string>();
  for (const m of allMonths) {
    if (data[m]) {
      Object.keys(data[m]).forEach(c => categories.add(c));
    }
  }

  const comparisons: MonthlyComparison[] = [];

  for (const category of categories) {
    if (category === 'Salaire') continue; // Skip income

    const currentSpending = data[month]?.[category] || 0;
    const prevSpendings = prev.map(m => data[m]?.[category] || 0);
    const avgPrev = prevSpendings.reduce((a, b) => a + b, 0) / prevSpendings.length;

    if (avgPrev === 0 && currentSpending === 0) continue;

    const percentChange = avgPrev > 0
      ? ((currentSpending - avgPrev) / avgPrev) * 100
      : currentSpending > 0 ? 100 : 0;

    // Anomaly if > 30% increase or new spending category
    const isAnomaly = Math.abs(percentChange) > 30;

    comparisons.push({
      category,
      currentMonth: currentSpending,
      averageThreeMonths: avgPrev,
      percentChange,
      isAnomaly,
    });
  }

  // Sort by absolute percent change descending
  comparisons.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));

  return comparisons;
}

// --- Spending Trend (last N months) ---
export async function getSpendingTrend(months: number = 6): Promise<{ month: string; total: number }[]> {
  const trend: { month: string; total: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const m = d.toISOString().slice(0, 7);
    const spending = await getMonthlySpending(m);
    trend.push({ month: m, total: spending });
  }
  return trend;
}
