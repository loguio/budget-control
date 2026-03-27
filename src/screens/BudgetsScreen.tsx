import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography, Spacing, BorderRadius, CategoryColors } from '../theme';
import { getBudgets, upsertBudget, updateBudgetSpent } from '../database/db';
import GaugeBar from '../components/GaugeBar';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function formatMonth(month: string): string {
  const [y, m] = month.split('-');
  const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

export default function BudgetsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editCategory, setEditCategory] = useState('');
  const [editLimit, setEditLimit] = useState('');
  const month = currentMonth();

  const loadData = useCallback(async () => {
    try {
      await updateBudgetSpent(month);
      const data = await getBudgets(month);
      setBudgets(data);
    } catch (e) {
      console.error('Budgets load error:', e);
    }
  }, [month]);

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

  const handleSaveBudget = async () => {
    if (!editCategory.trim() || !editLimit.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    const limit = parseFloat(editLimit);
    if (isNaN(limit) || limit <= 0) {
      Alert.alert('Erreur', 'Le montant doit être un nombre positif.');
      return;
    }

    await upsertBudget({
      id: uuid(),
      category: editCategory.trim(),
      limit,
      spent: 0,
      month,
      color: CategoryColors[editCategory.trim()] || Colors.primary,
    });

    setShowModal(false);
    setEditCategory('');
    setEditLimit('');
    await loadData();
  };

  const totalBudget = budgets.reduce((s, b) => s + b.budgetLimit, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const overBudgetCount = budgets.filter(b => b.spent > b.budgetLimit).length;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Budgets</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowModal(true)}
          >
            <Text style={styles.addButtonText}>+ Ajouter</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.monthLabel}>{formatMonth(month)}</Text>

        {/* Summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Budget Total</Text>
              <Text style={styles.summaryValue}>{totalBudget.toFixed(0)}€</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Dépensé</Text>
              <Text style={[styles.summaryValue, { color: totalSpent > totalBudget ? Colors.danger : Colors.text }]}>
                {totalSpent.toFixed(0)}€
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Restant</Text>
              <Text style={[styles.summaryValue, { color: Colors.success }]}>
                {Math.max(0, totalBudget - totalSpent).toFixed(0)}€
              </Text>
            </View>
          </View>
          {overBudgetCount > 0 && (
            <View style={styles.alertBanner}>
              <Text style={styles.alertText}>
                ⚠️ {overBudgetCount} budget(s) dépassé(s) ce mois
              </Text>
            </View>
          )}
        </View>

        {/* Budget List */}
        {budgets.map((budget) => (
          <View key={budget.id} style={styles.budgetCard}>
            <View style={styles.budgetHeader}>
              <View style={[styles.budgetDot, { backgroundColor: budget.color }]} />
              <Text style={styles.budgetCategory}>{budget.category}</Text>
              {budget.spent > budget.budgetLimit && (
                <View style={styles.overBadge}>
                  <Text style={styles.overBadgeText}>Dépassé</Text>
                </View>
              )}
            </View>
            <GaugeBar
              value={budget.spent}
              max={budget.budgetLimit}
              color={budget.color}
              height={10}
            />
            <View style={styles.budgetFooter}>
              <Text style={styles.budgetRemaining}>
                Restant : {Math.max(0, budget.budgetLimit - budget.spent).toFixed(0)}€
              </Text>
            </View>
          </View>
        ))}

        {budgets.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📊</Text>
            <Text style={styles.emptyTitle}>Aucun budget défini</Text>
            <Text style={styles.emptyDesc}>
              Créez vos premiers budgets pour suivre vos dépenses par catégorie.
            </Text>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Add Budget Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nouveau Budget</Text>
            <Text style={styles.inputLabel}>Catégorie</Text>
            <TextInput
              style={styles.input}
              value={editCategory}
              onChangeText={setEditCategory}
              placeholder="Ex: Alimentation"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.inputLabel}>Montant limite (€)</Text>
            <TextInput
              style={styles.input}
              value={editLimit}
              onChangeText={setEditLimit}
              placeholder="Ex: 350"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => { setShowModal(false); setEditCategory(''); setEditLimit(''); }}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleSaveBudget}>
                <Text style={styles.saveButtonText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.h1,
  },
  addButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  monthLabel: {
    ...Typography.bodySmall,
    marginBottom: Spacing.lg,
  },
  summaryCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    ...Typography.caption,
    marginBottom: Spacing.xs,
  },
  summaryValue: {
    ...Typography.amountSmall,
    fontSize: 18,
  },
  alertBanner: {
    backgroundColor: Colors.danger + '15',
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.md,
    alignItems: 'center',
  },
  alertText: {
    color: Colors.danger,
    fontWeight: '600',
    fontSize: 13,
  },
  budgetCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  budgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  budgetDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.sm,
  },
  budgetCategory: {
    ...Typography.body,
    fontWeight: '600',
    flex: 1,
  },
  overBadge: {
    backgroundColor: Colors.danger + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.round,
  },
  overBadgeText: {
    color: Colors.danger,
    fontSize: 11,
    fontWeight: '600',
  },
  budgetFooter: {
    marginTop: Spacing.xs,
  },
  budgetRemaining: {
    ...Typography.bodySmall,
    fontSize: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    ...Typography.h3,
    marginBottom: Spacing.sm,
  },
  emptyDesc: {
    ...Typography.bodySmall,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.backgroundLight,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  modalTitle: {
    ...Typography.h2,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  inputLabel: {
    ...Typography.label,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: 16,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  cancelButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.card,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
