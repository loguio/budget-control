import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';

interface AccountCardProps {
  name: string;
  type: 'checking' | 'savings';
  balance: number;
  bankName: string;
  lastSync?: string;
}

export default function AccountCard({
  name,
  type,
  balance,
  bankName,
  lastSync,
}: AccountCardProps) {
  const gradient = type === 'checking'
    ? Colors.gradientPrimary
    : Colors.gradientAccent;

  const typeLabel = type === 'checking' ? 'Compte Courant' : 'Épargne';

  return (
    <LinearGradient
      colors={gradient as unknown as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.header}>
        <Text style={styles.bankName}>{bankName}</Text>
        <Text style={styles.type}>{typeLabel}</Text>
      </View>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.balance}>
        {balance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
      </Text>
      {lastSync && (
        <Text style={styles.sync}>
          Dernière sync : {new Date(lastSync).toLocaleDateString('fr-FR')}
        </Text>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    minHeight: 140,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bankName: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.7)',
  },
  type: {
    ...Typography.caption,
    color: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
  },
  name: {
    ...Typography.h3,
    color: '#fff',
    marginTop: Spacing.sm,
  },
  balance: {
    ...Typography.amount,
    color: '#fff',
    marginTop: Spacing.xs,
  },
  sync: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: Spacing.xs,
  },
});
