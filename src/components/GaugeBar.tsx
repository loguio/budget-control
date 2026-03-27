import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Text } from 'react-native';
import { Colors, BorderRadius, Spacing, Typography } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';

interface GaugeBarProps {
  value: number;
  max: number;
  color?: string;
  gradientColors?: readonly [string, string, ...string[]];
  label?: string;
  showAmount?: boolean;
  height?: number;
}

export default function GaugeBar({
  value,
  max,
  color = Colors.primary,
  gradientColors,
  label,
  showAmount = true,
  height = 12,
}: GaugeBarProps) {
  const animValue = useRef(new Animated.Value(0)).current;
  const percentage = max > 0 ? Math.min(value / max, 1) : 0;
  const isOverBudget = value > max;

  useEffect(() => {
    Animated.spring(animValue, {
      toValue: percentage,
      tension: 40,
      friction: 8,
      useNativeDriver: false,
    }).start();
  }, [percentage]);

  const width = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const barColor = isOverBudget ? Colors.danger : color;
  const barGradient = isOverBudget
    ? (Colors.gradientDanger as unknown as [string, string, ...string[]])
    : (gradientColors || [barColor, barColor] as [string, string, ...string[]]);

  return (
    <View style={styles.container}>
      {(label || showAmount) && (
        <View style={styles.header}>
          {label && <Text style={styles.label}>{label}</Text>}
          {showAmount && (
            <Text style={[styles.amount, isOverBudget && styles.overBudget]}>
              {value.toFixed(0)}€ / {max.toFixed(0)}€
            </Text>
          )}
        </View>
      )}
      <View style={[styles.track, { height }]}>
        <Animated.View style={[styles.fill, { width, height }]}>
          <LinearGradient
            colors={barGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.gradient, { height }]}
          />
        </Animated.View>
      </View>
      {showAmount && (
        <Text style={styles.percentage}>
          {(percentage * 100).toFixed(0)}%
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  label: {
    ...Typography.label,
  },
  amount: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  overBudget: {
    color: Colors.danger,
    fontWeight: '600',
  },
  track: {
    backgroundColor: Colors.cardLight,
    borderRadius: BorderRadius.round,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: BorderRadius.round,
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
    borderRadius: BorderRadius.round,
  },
  percentage: {
    ...Typography.caption,
    textAlign: 'right',
    marginTop: 2,
    color: Colors.textMuted,
  },
});
