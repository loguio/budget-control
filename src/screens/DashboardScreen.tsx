import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography, Spacing, BorderRadius, CategoryColors } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getTotalBalance, getMonthlySpending, getMonthlyIncome,
  getSpendingByCategory, getAccounts,
} from '../database/db';
import {
  getFinancialHealthScore, getFinancialInsights, getMonthlyComparison,
} from '../services/analytics';
import ProgressRing from '../components/ProgressRing';
import ComparisonCard from '../components/ComparisonCard';
import type { FinancialInsight, MonthlyComparison } from '../types';

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export default function DashboardScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [totalBalance, setTotalBalance] = useState(0);
  const [monthlySpending, setMonthlySpending] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [healthScore, setHealthScore] = useState(0);
  const [insights, setInsights] = useState<FinancialInsight[]>([]);
  const [comparisons, setComparisons] = useState<MonthlyComparison[]>([]);
  const [spendingByCategory, setSpendingByCategory] = useState<{ category: string; total: number }[]>([]);
  const [accountCount, setAccountCount] = useState(0);

  const loadData = useCallback(async () => {
    try {
      const month = currentMonth();
      const [balance, spending, income, score, ins, comp, cats, accs] = await Promise.all([
        getTotalBalance(),
        getMonthlySpending(month),
        getMonthlyIncome(month),
        getFinancialHealthScore(),
        getFinancialInsights(),
        getMonthlyComparison(),
        getSpendingByCategory(month),
        getAccounts(),
      ]);
      setTotalBalance(balance);
      setMonthlySpending(spending);
      setMonthlyIncome(income);
      setHealthScore(score);
      setInsights(ins);
      setComparisons(comp);
      setSpendingByCategory(cats);
      setAccountCount(accs.length);
    } catch (e) {
      console.error('Dashboard load error:', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getScoreColor = () => {
    if (healthScore >= 70) return Colors.success;
    if (healthScore >= 40) return Colors.warning;
    return Colors.danger;
  };

  const getScoreLabel = () => {
    if (healthScore >= 70) return 'Excellente';
    if (healthScore >= 50) return 'Bonne';
    if (healthScore >= 30) return 'Correcte';
    return 'À améliorer';
  };

  const getInsightStyle = (type: string) => {
    switch (type) {
      case 'positive': return { bg: Colors.success + '15', border: Colors.success + '40', icon: '✅' };
      case 'warning': return { bg: Colors.warning + '15', border: Colors.warning + '40', icon: '⚠️' };
      case 'danger': return { bg: Colors.danger + '15', border: Colors.danger + '40', icon: '🚨' };
      default: return { bg: Colors.info + '15', border: Colors.info + '40', icon: 'ℹ️' };
    }
  };

  const savings = monthlyIncome - monthlySpending;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Bonjour 👋</Text>
        <Text style={styles.subtitle}>Voici votre vue d'ensemble</Text>
      </View>

      {/* Balance Card */}
      <LinearGradient
        colors={Colors.gradientPrimary as unknown as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.balanceCard}
      >
        <Text style={styles.balanceLabel}>Solde Total</Text>
        <Text style={styles.balanceAmount}>
          {totalBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
        </Text>
        <View style={styles.balanceDetails}>
          <View style={styles.balanceItem}>
            <Text style={styles.balanceItemLabel}>Revenus</Text>
            <Text style={styles.balanceItemValue}>+{monthlyIncome.toFixed(0)}€</Text>
          </View>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceItem}>
            <Text style={styles.balanceItemLabel}>Dépenses</Text>
            <Text style={styles.balanceItemValue}>-{monthlySpending.toFixed(0)}€</Text>
          </View>
          <View style={styles.balanceDivider} />
          <View style={styles.balanceItem}>
            <Text style={styles.balanceItemLabel}>Épargne</Text>
            <Text style={[styles.balanceItemValue, { color: savings >= 0 ? '#55EFC4' : '#FAB1A0' }]}>
              {savings >= 0 ? '+' : ''}{savings.toFixed(0)}€
            </Text>
          </View>
        </View>
        <Text style={styles.accountCount}>{accountCount} compte(s) · BNP Paribas</Text>
      </LinearGradient>

      {/* Health Score */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Santé Financière</Text>
        <View style={styles.healthCard}>
          <ProgressRing
            progress={healthScore / 100}
            size={110}
            strokeWidth={10}
            color={getScoreColor()}
            centerText={`${healthScore}`}
            centerSubText="/ 100"
          />
          <View style={styles.healthInfo}>
            <Text style={[styles.healthLabel, { color: getScoreColor() }]}>
              {getScoreLabel()}
            </Text>
            <Text style={styles.healthDesc}>
              Score basé sur votre taux d'épargne, respect des budgets et fonds d'urgence.
            </Text>
          </View>
        </View>
      </View>

      {/* Insights */}
      {insights.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insights</Text>
          {insights.map((insight, index) => {
            const style = getInsightStyle(insight.type);
            return (
              <View key={index} style={[styles.insightCard, { backgroundColor: style.bg, borderColor: style.border }]}>
                <Text style={styles.insightIcon}>{style.icon}</Text>
                <View style={styles.insightContent}>
                  <Text style={styles.insightTitle}>{insight.title}</Text>
                  <Text style={styles.insightDesc}>{insight.description}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Spending by Category */}
      {spendingByCategory.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dépenses par Catégorie</Text>
          <View style={styles.categoriesCard}>
            {spendingByCategory.slice(0, 6).map((item, index) => {
              const totalSpending = spendingByCategory.reduce((a, b) => a + b.total, 0);
              const pct = totalSpending > 0 ? (item.total / totalSpending) * 100 : 0;
              const catColor = CategoryColors[item.category] || Colors.textMuted;
              return (
                <View key={index} style={styles.categoryRow}>
                  <View style={[styles.categoryDot, { backgroundColor: catColor }]} />
                  <Text style={styles.categoryName}>{item.category}</Text>
                  <View style={styles.categoryBar}>
                    <View style={[styles.categoryFill, { width: `${pct}%`, backgroundColor: catColor }]} />
                  </View>
                  <Text style={styles.categoryAmount}>{item.total.toFixed(0)}€</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Monthly Comparison */}
      {comparisons.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comparaison vs Moyenne 3 Mois</Text>
          {comparisons.slice(0, 5).map((comp, index) => (
            <ComparisonCard key={index} {...comp} />
          ))}
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  header: {
    marginBottom: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  greeting: {
    ...Typography.h1,
    fontSize: 30,
  },
  subtitle: {
    ...Typography.bodySmall,
    marginTop: Spacing.xs,
    fontSize: 15,
  },
  balanceCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  balanceLabel: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.7)',
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    marginTop: Spacing.xs,
    letterSpacing: -1,
  },
  balanceDetails: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  balanceItem: {
    flex: 1,
    alignItems: 'center',
  },
  balanceDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  balanceItemLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 2,
  },
  balanceItemValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  accountCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: Spacing.sm,
    textAlign: 'right',
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: Spacing.md,
  },
  healthCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  healthInfo: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  healthLabel: {
    ...Typography.h2,
    fontSize: 20,
    marginBottom: Spacing.xs,
  },
  healthDesc: {
    ...Typography.bodySmall,
    lineHeight: 18,
  },
  insightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  insightIcon: {
    fontSize: 18,
    marginRight: Spacing.sm,
    marginTop: 1,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    ...Typography.body,
    fontWeight: '600',
    fontSize: 14,
  },
  insightDesc: {
    ...Typography.bodySmall,
    marginTop: 2,
    fontSize: 13,
  },
  categoriesCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  categoryName: {
    ...Typography.bodySmall,
    color: Colors.text,
    width: 90,
    fontSize: 13,
  },
  categoryBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.cardLight,
    borderRadius: 3,
    marginHorizontal: Spacing.sm,
    overflow: 'hidden',
  },
  categoryFill: {
    height: '100%',
    borderRadius: 3,
  },
  categoryAmount: {
    ...Typography.bodySmall,
    color: Colors.text,
    fontWeight: '600',
    width: 50,
    textAlign: 'right',
    fontSize: 13,
  },
});
