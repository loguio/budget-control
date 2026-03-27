import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius, CategoryColors } from '../theme';

interface TransactionItemProps {
  description: string;
  amount: number;
  category: string;
  date: string;
  type: 'debit' | 'credit';
}

const CATEGORY_ICONS: Record<string, string> = {
  'Alimentation': '🛒',
  'Transport': '🚗',
  'Logement': '🏠',
  'Loisirs': '🎮',
  'Shopping': '🛍️',
  'Santé': '💊',
  'Éducation': '📚',
  'Abonnements': '📺',
  'Restaurants': '🍽️',
  'Épargne': '💰',
  'Salaire': '💼',
  'Autre': '📋',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function TransactionItem({
  description,
  amount,
  category,
  date,
  type,
}: TransactionItemProps) {
  const icon = CATEGORY_ICONS[category] || '📋';
  const catColor = CategoryColors[category] || Colors.textMuted;
  const isCredit = type === 'credit';

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: catColor + '20' }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.details}>
        <Text style={styles.description} numberOfLines={1}>{description}</Text>
        <Text style={styles.category}>{category} · {formatDate(date)}</Text>
      </View>
      <Text style={[styles.amount, isCredit ? styles.credit : styles.debit]}>
        {isCredit ? '+' : ''}{amount.toFixed(2)}€
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder + '40',
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  icon: {
    fontSize: 20,
  },
  details: {
    flex: 1,
  },
  description: {
    ...Typography.body,
    fontSize: 14,
    fontWeight: '500',
  },
  category: {
    ...Typography.bodySmall,
    fontSize: 12,
    marginTop: 2,
  },
  amount: {
    fontWeight: '700',
    fontSize: 15,
  },
  credit: {
    color: Colors.success,
  },
  debit: {
    color: Colors.text,
  },
});
