import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import { bridgeApi } from '../services/bridgeApi';
import { getStoredBridgeUserUuid } from '../services/bridgeUserStore';
import { getAccounts as getLocalAccounts } from '../database/db';

function jsonBlock(label: string, data: unknown) {
  const text =
    data === undefined || data === null
      ? '(vide)'
      : typeof data === 'string'
        ? data
        : JSON.stringify(data, null, 2);
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{label}</Text>
      <Text selectable style={styles.mono}>{text}</Text>
    </View>
  );
}

export default function SyncDebugScreen() {
  const [loading, setLoading] = useState(false);
  const [storedUuid, setStoredUuid] = useState<string | null>(null);
  const [localAccountCount, setLocalAccountCount] = useState<number>(0);
  const [probe, setProbe] = useState<Awaited<
    ReturnType<typeof bridgeApi.fetchDebugPipelineSnapshot>
  > | null>(null);

  const loadStatic = useCallback(async () => {
    const u = await getStoredBridgeUserUuid();
    setStoredUuid(u);
    if (u) bridgeApi.setCurrentUserUuid(u);
    const accs = await getLocalAccounts();
    setLocalAccountCount(accs.length);
  }, []);

  const runProbe = useCallback(async () => {
    setLoading(true);
    try {
      const u = await getStoredBridgeUserUuid();
      setStoredUuid(u);
      if (u) bridgeApi.setCurrentUserUuid(u);
      const accs = await getLocalAccounts();
      setLocalAccountCount(accs.length);

      const userUuid = bridgeApi.getCurrentUserUuid() || u;
      if (!bridgeApi.isConfigured()) {
        setProbe({
          ok: false,
          error: 'Bridge non configuré (EXPO_PUBLIC_BRIDGE_CLIENT_ID / SECRET)',
          tokenExpiresAt: null,
          items: [],
          accounts: [],
          transactionsSample: [],
        });
        return;
      }
      if (!userUuid) {
        setProbe({
          ok: false,
          error:
            'Pas de user_uuid Bridge. Va sur Comptes → Synchroniser une fois pour créer l’utilisateur.',
          tokenExpiresAt: null,
          items: [],
          accounts: [],
          transactionsSample: [],
        });
        return;
      }
      const result = await bridgeApi.fetchDebugPipelineSnapshot(userUuid);
      setProbe(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStatic();
    }, [loadStatic])
  );

  const meta = bridgeApi.getDebugMeta();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Debug synchro Bridge</Text>
      <Text style={styles.hint}>
        Aperçu des étapes côté API : user → token → items → accounts → transactions (échantillon).
      </Text>

      <TouchableOpacity style={styles.btn} onPress={runProbe} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={Colors.primary} />
        ) : (
          <Text style={styles.btnText}>Rafraîchir l’aperçu API</Text>
        )}
      </TouchableOpacity>

      {jsonBlock('Stockage local — user_uuid (SecureStore)', storedUuid)}
      {jsonBlock('SQLite — nombre de comptes locaux', localAccountCount)}
      {jsonBlock('Méta Bridge (mémoire)', meta)}

      {probe && jsonBlock(probe.ok ? 'Résultat API (OK)' : 'Résultat API (erreur)', probe)}
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
  title: {
    ...Typography.h1,
    marginBottom: Spacing.sm,
  },
  hint: {
    ...Typography.bodySmall,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
  },
  btn: {
    backgroundColor: Colors.primary + '25',
    borderWidth: 1,
    borderColor: Colors.primary + '50',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  btnText: {
    color: Colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  block: {
    marginBottom: Spacing.lg,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  blockTitle: {
    ...Typography.caption,
    marginBottom: Spacing.sm,
    color: Colors.textSecondary,
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: Colors.text,
  },
});
