import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import { getAccounts, getTransactions } from '../database/db';
import { bridgeApi } from '../services/bridgeApi';
import { syncBankData } from '../services/syncService';
import AccountCard from '../components/AccountCard';
import TransactionItem from '../components/TransactionItem';

export default function AccountsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [syncing, setSyncing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const accs = await getAccounts();
      const txs = await getTransactions({ limit: 20 });
      setAccounts(accs);
      setRecentTx(txs);
    } catch (e) {
      console.error('Accounts load error:', e);
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

  const handleSync = async () => {
    if (!bridgeApi.isConfigured()) {
      Alert.alert(
        'Configuration requise',
        'Pour synchroniser vos comptes BNP Paribas, ajoutez vos identifiants Bridge API dans le fichier .env\n\n' +
        'BRIDGE_CLIENT_ID=votre_id\nBRIDGE_CLIENT_SECRET=votre_secret',
        [{ text: 'Compris' }]
      );
      return;
    }

    setSyncing(true);
    // v3: Auth uses user_uuid. In production, store this UUID after createUser().
    // For now, use the UUID from the Bridge dashboard or call initBridgeUser() first.
    const userUuid = bridgeApi.getCurrentUserUuid() || 'YOUR_BRIDGE_USER_UUID';
    const result = await syncBankData(userUuid);
    setSyncing(false);

    if (result.success) {
      Alert.alert('Synchronisation réussie', `${result.accountsSynced} compte(s), ${result.transactionsSynced} transaction(s) synchronisée(s).`);
      await loadData();
    } else {
      Alert.alert('Erreur de synchronisation', result.error || 'Erreur inconnue');
    }
  };

  const checkingAccounts = accounts.filter(a => a.type === 'checking');
  const savingsAccounts = accounts.filter(a => a.type === 'savings');
  const totalBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Mes Comptes</Text>
        <TouchableOpacity
          style={[styles.syncButton, syncing && styles.syncingButton]}
          onPress={handleSync}
          disabled={syncing}
        >
          <Text style={styles.syncButtonText}>
            {syncing ? '⏳ Sync...' : '🔄 Synchroniser'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Total Balance */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Patrimoine Total</Text>
        <Text style={styles.totalAmount}>
          {totalBalance.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
        </Text>
      </View>

      {/* Checking Accounts */}
      {checkingAccounts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Comptes Courants</Text>
          {checkingAccounts.map((account) => (
            <AccountCard
              key={account.id}
              name={account.name}
              type={account.type}
              balance={account.balance}
              bankName={account.bankName}
              lastSync={account.lastSync}
            />
          ))}
        </View>
      )}

      {/* Savings Accounts */}
      {savingsAccounts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Épargne</Text>
          {savingsAccounts.map((account) => (
            <AccountCard
              key={account.id}
              name={account.name}
              type={account.type}
              balance={account.balance}
              bankName={account.bankName}
              lastSync={account.lastSync}
            />
          ))}
        </View>
      )}

      {/* Recent Transactions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Transactions Récentes</Text>
        <View style={styles.txCard}>
          {recentTx.length > 0 ? (
            recentTx.slice(0, 10).map((tx) => (
              <TransactionItem
                key={tx.id}
                description={tx.description}
                amount={tx.amount}
                category={tx.category}
                date={tx.date}
                type={tx.type}
              />
            ))
          ) : (
            <Text style={styles.emptyText}>Aucune transaction</Text>
          )}
        </View>
      </View>

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
    paddingTop: Spacing.xxl + Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h1,
  },
  syncButton: {
    backgroundColor: Colors.primary + '30',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    borderWidth: 1,
    borderColor: Colors.primary + '50',
  },
  syncingButton: {
    opacity: 0.5,
  },
  syncButtonText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: 13,
  },
  totalCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    alignItems: 'center',
  },
  totalLabel: {
    ...Typography.caption,
  },
  totalAmount: {
    ...Typography.amount,
    marginTop: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: Spacing.md,
  },
  txCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  emptyText: {
    ...Typography.bodySmall,
    textAlign: 'center',
    padding: Spacing.xl,
  },
});
