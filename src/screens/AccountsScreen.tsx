import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, TouchableOpacity, Linking,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import { getAccounts, getTransactions } from '../database/db';
import { bridgeApi } from '../services/bridgeApi';
import { getBankConnectUrl, initBridgeUser, syncBankData } from '../services/syncService';
import { getStoredBridgeUserUuid, setStoredBridgeUserUuid } from '../services/bridgeUserStore';
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
      (async () => {
        const stored = await getStoredBridgeUserUuid();
        if (stored) bridgeApi.setCurrentUserUuid(stored);
      })();
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
      console.warn(
        '[Accounts/Sync] Configuration Bridge manquante. Ajoutez dans .env :\n' +
          'EXPO_PUBLIC_BRIDGE_CLIENT_ID=…\n' +
          'EXPO_PUBLIC_BRIDGE_CLIENT_SECRET=…\n' +
          'EXPO_PUBLIC_BRIDGE_API_URL=https://api.bridgeapi.io/v3'
      );
      return;
    }
    setSyncing(true);
    // v3: Auth uses user_uuid. If the user has not linked a bank yet,
    // create a Bridge user and open a Connect session so they can add BNP.
    let userUuid = bridgeApi.getCurrentUserUuid();
    if (!userUuid) {
      try {
        userUuid = await initBridgeUser();
        await setStoredBridgeUserUuid(userUuid);
        bridgeApi.setCurrentUserUuid(userUuid);
        await bridgeApi.authenticate({ userUuid });
        const connectUrl = await getBankConnectUrl({ userUuid });
        setSyncing(false);
        console.log(
          '[Accounts/Sync] Première connexion — ouverture Bridge Connect. Puis relancez Synchroniser.',
          connectUrl
        );
        await Linking.openURL(connectUrl);
        return;
      } catch (e: any) {
        setSyncing(false);
        console.error('[Accounts/Sync] Init Bridge / Connect:', e?.message ?? e, e);
        return;
      }
    }

    const result = await syncBankData(userUuid);
    setSyncing(false);

    if (result.success) {
      console.log('[Accounts/Sync] OK', {
        accountsSynced: result.accountsSynced,
        transactionsSynced: result.transactionsSynced,
      });
      await loadData();
    } else {
      // If Bridge indicates we must (re)connect, behave like first sync: open Bridge Connect.
      if (result.action?.type === 'connect') {
        try {
          if (!bridgeApi.isTokenValid()) {
            await bridgeApi.authenticate({ userUuid });
          }
          const connectUrl = await getBankConnectUrl({
            userUuid,
            itemId: result.action.itemId,
            forceReauthentication: result.action.forceReauthentication,
          });
          console.warn(
            '[Accounts/Sync] Connexion / SCA requise — ouverture Bridge. Puis relancez Synchroniser.',
            { itemId: result.action.itemId, url: connectUrl }
          );
          await Linking.openURL(connectUrl);
          return;
        } catch (e: any) {
          console.error('[Accounts/Sync] Connect session:', e?.message ?? e, e);
          return;
        }
      }
      console.error('[Accounts/Sync]', result.error || 'Erreur inconnue');
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
