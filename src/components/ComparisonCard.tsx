import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius, CategoryColors } from '../theme';

interface ComparisonCardProps {
  category: string;
  currentMonth: number;
  averageThreeMonths: number;
  percentChange: number;
  isAnomaly: boolean;
}

export default function ComparisonCard({
  category,
  currentMonth,
  averageThreeMonths,
  percentChange,
  isAnomaly,
}: ComparisonCardProps) {
  const isIncrease = percentChange > 0;
  const arrow = isIncrease ? '↑' : '↓';
  const changeColor = isIncrease
    ? (isAnomaly ? Colors.danger : Colors.warning)
    : Colors.success;
  const catColor = CategoryColors[category] || Colors.textMuted;

  return (
    <View style={[styles.card, isAnomaly && styles.anomalyCard]}>
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: catColor }]} />
        <Text style={styles.category}>{category}</Text>
        {isAnomaly && (
          <View style={styles.anomalyBadge}>
            <Text style={styles.anomalyText}>Anomalie</Text>
          </View>
        )}
      </View>

      <View style={styles.amounts}>
        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>Ce mois</Text>
          <Text style={styles.amountValue}>{currentMonth.toFixed(0)}€</Text>
        </View>
        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>Moy. 3 mois</Text>
          <Text style={[styles.amountValue, styles.amountSecondary]}>
            {averageThreeMonths.toFixed(0)}€
          </Text>
        </View>
        <View style={styles.amountBlock}>
          <Text style={[styles.changeValue, { color: changeColor }]}>
            {arrow} {Math.abs(percentChange).toFixed(0)}%
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  anomalyCard: {
    borderColor: Colors.danger + '60',
    backgroundColor: Colors.card + 'F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.sm,
  },
  category: {
    ...Typography.h3,
    flex: 1,
    fontSize: 15,
  },
  anomalyBadge: {
    backgroundColor: Colors.danger + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
  },
  anomalyText: {
    color: Colors.danger,
    fontSize: 11,
    fontWeight: '600',
  },
  amounts: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  amountBlock: {
    flex: 1,
  },
  amountLabel: {
    ...Typography.caption,
    marginBottom: 2,
  },
  amountValue: {
    ...Typography.amountSmall,
    fontSize: 16,
  },
  amountSecondary: {
    color: Colors.textSecondary,
  },
  changeValue: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'right',
  },
});
