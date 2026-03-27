import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import { getSavingsGoals, upsertSavingsGoal, deleteSavingsGoal } from '../database/db';
import ProgressRing from '../components/ProgressRing';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const GOAL_ICONS = ['🎯', '🏖️', '💻', '🚗', '🏠', '💍', '🎓', '🛡️', '✈️', '📱'];
const GOAL_COLORS = ['#00CEC9', '#6C5CE7', '#00B894', '#E17055', '#FDCB6E', '#74B9FF', '#DDA0DD', '#55EFC4', '#FAB1A0', '#A29BFE'];

export default function GoalsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [goals, setGoals] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editCurrent, setEditCurrent] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('🎯');
  const [selectedColor, setSelectedColor] = useState('#00CEC9');

  const loadData = useCallback(async () => {
    try {
      const data = await getSavingsGoals();
      setGoals(data);
    } catch (e) {
      console.error('Goals load error:', e);
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

  const handleSaveGoal = async () => {
    if (!editName.trim() || !editTarget.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir le nom et le montant cible.');
      return;
    }
    const target = parseFloat(editTarget);
    const current = parseFloat(editCurrent) || 0;
    if (isNaN(target) || target <= 0) {
      Alert.alert('Erreur', 'Le montant cible doit être positif.');
      return;
    }

    await upsertSavingsGoal({
      id: uuid(),
      name: editName.trim(),
      targetAmount: target,
      currentAmount: current,
      deadline: editDeadline.trim() || undefined,
      color: selectedColor,
      icon: selectedIcon,
    });

    setShowModal(false);
    resetForm();
    await loadData();
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Supprimer l\'objectif',
      `Voulez-vous vraiment supprimer "${name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await deleteSavingsGoal(id);
            await loadData();
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setEditName('');
    setEditTarget('');
    setEditCurrent('');
    setEditDeadline('');
    setSelectedIcon('🎯');
    setSelectedColor('#00CEC9');
  };

  const getDaysRemaining = (deadline: string) => {
    const d = new Date(deadline);
    const now = new Date();
    return Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Objectifs</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowModal(true)}
          >
            <Text style={styles.addButtonText}>+ Nouveau</Text>
          </TouchableOpacity>
        </View>

        {/* Goals Grid */}
        <View style={styles.grid}>
          {goals.map((goal) => {
            const progress = goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0;
            const daysLeft = goal.deadline ? getDaysRemaining(goal.deadline) : null;
            const isComplete = goal.currentAmount >= goal.targetAmount;

            return (
              <TouchableOpacity
                key={goal.id}
                style={styles.goalCard}
                onLongPress={() => handleDelete(goal.id, goal.name)}
                activeOpacity={0.7}
              >
                <Text style={styles.goalIcon}>{goal.icon}</Text>
                <ProgressRing
                  progress={progress}
                  size={100}
                  strokeWidth={8}
                  color={isComplete ? Colors.success : goal.color}
                  centerText={`${(progress * 100).toFixed(0)}%`}
                />
                <Text style={styles.goalName} numberOfLines={1}>{goal.name}</Text>
                <Text style={styles.goalAmount}>
                  {goal.currentAmount.toLocaleString('fr-FR')}€ / {goal.targetAmount.toLocaleString('fr-FR')}€
                </Text>
                {daysLeft !== null && (
                  <Text style={[styles.goalDeadline, daysLeft <= 30 && styles.urgentDeadline]}>
                    {isComplete ? '✅ Atteint !' : daysLeft > 0 ? `${daysLeft}j restants` : '⏰ Échéance dépassée'}
                  </Text>
                )}
                {isComplete && !daysLeft && (
                  <Text style={styles.goalComplete}>✅ Objectif atteint !</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {goals.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🎯</Text>
            <Text style={styles.emptyTitle}>Aucun objectif d'épargne</Text>
            <Text style={styles.emptyDesc}>
              Définissez vos objectifs pour suivre votre progression.
            </Text>
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Add Goal Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView style={styles.modalScroll}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Nouvel Objectif</Text>

              {/* Icon Picker */}
              <Text style={styles.inputLabel}>Icône</Text>
              <View style={styles.iconPicker}>
                {GOAL_ICONS.map((icon) => (
                  <TouchableOpacity
                    key={icon}
                    style={[styles.iconOption, selectedIcon === icon && styles.iconSelected]}
                    onPress={() => setSelectedIcon(icon)}
                  >
                    <Text style={styles.iconText}>{icon}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Color Picker */}
              <Text style={styles.inputLabel}>Couleur</Text>
              <View style={styles.colorPicker}>
                {GOAL_COLORS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[styles.colorOption, { backgroundColor: color }, selectedColor === color && styles.colorSelected]}
                    onPress={() => setSelectedColor(color)}
                  />
                ))}
              </View>

              <Text style={styles.inputLabel}>Nom</Text>
              <TextInput
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Ex: Vacances Été"
                placeholderTextColor={Colors.textMuted}
              />
              <Text style={styles.inputLabel}>Montant cible (€)</Text>
              <TextInput
                style={styles.input}
                value={editTarget}
                onChangeText={setEditTarget}
                placeholder="Ex: 2000"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
              />
              <Text style={styles.inputLabel}>Montant actuel (€)</Text>
              <TextInput
                style={styles.input}
                value={editCurrent}
                onChangeText={setEditCurrent}
                placeholder="Ex: 500"
                placeholderTextColor={Colors.textMuted}
                keyboardType="numeric"
              />
              <Text style={styles.inputLabel}>Échéance (YYYY-MM-DD, optionnel)</Text>
              <TextInput
                style={styles.input}
                value={editDeadline}
                onChangeText={setEditDeadline}
                placeholder="Ex: 2026-07-01"
                placeholderTextColor={Colors.textMuted}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => { setShowModal(false); resetForm(); }}
                >
                  <Text style={styles.cancelButtonText}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveGoal}>
                  <Text style={styles.saveButtonText}>Créer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
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
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h1,
  },
  addButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  goalCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    width: '48%',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  goalIcon: {
    fontSize: 28,
    marginBottom: Spacing.sm,
  },
  goalName: {
    ...Typography.body,
    fontWeight: '600',
    marginTop: Spacing.sm,
    fontSize: 14,
    textAlign: 'center',
  },
  goalAmount: {
    ...Typography.bodySmall,
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  goalDeadline: {
    ...Typography.caption,
    marginTop: 4,
    color: Colors.info,
    fontSize: 10,
  },
  urgentDeadline: {
    color: Colors.warning,
  },
  goalComplete: {
    ...Typography.caption,
    marginTop: 4,
    color: Colors.success,
    fontSize: 10,
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
  },
  modalScroll: {
    flex: 1,
    marginTop: 80,
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
  iconPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  iconOption: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.card,
  },
  iconSelected: {
    backgroundColor: Colors.primary + '40',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  iconText: {
    fontSize: 24,
  },
  colorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: '#fff',
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
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
