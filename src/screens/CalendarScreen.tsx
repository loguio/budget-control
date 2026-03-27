import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, TouchableOpacity, Modal, TextInput, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import { getSubscriptions, upsertSubscription, deleteSubscription } from '../database/db';

// Configure French locale
LocaleConfig.locales['fr'] = {
  monthNames: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
  monthNamesShort: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'],
  dayNames: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
  dayNamesShort: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
  today: "Aujourd'hui"
};
LocaleConfig.defaultLocale = 'fr';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function CalendarScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDay, setEditDay] = useState('');

  const loadData = useCallback(async () => {
    try {
      const data = await getSubscriptions();
      setSubscriptions(data);
    } catch (e) {
      console.error('Calendar load error:', e);
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

  // Build calendar marks from subscriptions
  const getMarkedDates = () => {
    const marks: Record<string, any> = {};
    const today = new Date().toISOString().split('T')[0];

    // Mark today
    marks[today] = {
      ...(marks[today] || {}),
      customStyles: {
        container: { backgroundColor: Colors.primary + '30' },
        text: { color: Colors.primary, fontWeight: '700' },
      },
    };

    // Generate subscription dates for current and next month
    for (const sub of subscriptions) {
      const nextDate = sub.nextDate;
      if (!marks[nextDate]) {
        marks[nextDate] = { dots: [] };
      }
      if (!marks[nextDate].dots) marks[nextDate].dots = [];
      marks[nextDate].dots.push({
        key: sub.id,
        color: sub.color,
      });
      marks[nextDate].marked = true;

      // Also mark for next month if monthly
      if (sub.frequency === 'monthly') {
        const d = new Date(nextDate);
        d.setMonth(d.getMonth() + 1);
        const nextMonth = d.toISOString().split('T')[0];
        if (!marks[nextMonth]) marks[nextMonth] = { dots: [] };
        if (!marks[nextMonth].dots) marks[nextMonth].dots = [];
        marks[nextMonth].dots.push({ key: sub.id + '-next', color: sub.color });
        marks[nextMonth].marked = true;
      }
    }

    // Highlight selected date
    if (selectedDate) {
      marks[selectedDate] = {
        ...(marks[selectedDate] || {}),
        selected: true,
        selectedColor: Colors.primary + '50',
      };
    }

    return marks;
  };

  const getSubsForDate = (date: string) => {
    const day = new Date(date).getDate();
    return subscriptions.filter(sub => {
      const subDay = new Date(sub.nextDate).getDate();
      return subDay === day;
    });
  };

  const handleAddSubscription = async () => {
    if (!editName.trim() || !editAmount.trim() || !editDay.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    const amount = parseFloat(editAmount);
    const day = parseInt(editDay);
    if (isNaN(amount) || amount <= 0 || isNaN(day) || day < 1 || day > 31) {
      Alert.alert('Erreur', 'Vérifiez les valeurs saisies.');
      return;
    }

    const nextDate = new Date();
    nextDate.setDate(day);
    if (nextDate < new Date()) nextDate.setMonth(nextDate.getMonth() + 1);

    await upsertSubscription({
      id: uuid(),
      name: editName.trim(),
      amount,
      frequency: 'monthly',
      nextDate: nextDate.toISOString().split('T')[0],
      category: 'Abonnements',
      color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
    });

    setShowModal(false);
    setEditName(''); setEditAmount(''); setEditDay('');
    await loadData();
  };

  const handleDeleteSub = (id: string, name: string) => {
    Alert.alert('Supprimer', `Supprimer "${name}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => { await deleteSubscription(id); await loadData(); } },
    ]);
  };

  const totalMonthly = subscriptions
    .filter(s => s.frequency === 'monthly')
    .reduce((sum, s) => sum + s.amount, 0);

  const selectedSubs = selectedDate ? getSubsForDate(selectedDate) : [];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Abonnements</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)}>
            <Text style={styles.addButtonText}>+ Ajouter</Text>
          </TouchableOpacity>
        </View>

        {/* Monthly Total */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Coût Mensuel Total</Text>
          <Text style={styles.totalAmount}>{totalMonthly.toFixed(2)} €</Text>
          <Text style={styles.totalSub}>{subscriptions.length} abonnement(s) actif(s)</Text>
        </View>

        {/* Calendar */}
        <View style={styles.calendarContainer}>
          <Calendar
            markingType="multi-dot"
            markedDates={getMarkedDates()}
            onDayPress={(day: any) => setSelectedDate(day.dateString)}
            theme={{
              calendarBackground: Colors.card,
              textSectionTitleColor: Colors.textSecondary,
              selectedDayBackgroundColor: Colors.primary,
              selectedDayTextColor: '#fff',
              todayTextColor: Colors.primary,
              dayTextColor: Colors.text,
              textDisabledColor: Colors.textMuted,
              monthTextColor: Colors.text,
              arrowColor: Colors.primary,
              textMonthFontWeight: '700',
              textDayFontSize: 14,
              textMonthFontSize: 16,
            }}
            style={styles.calendar}
          />
        </View>

        {/* Selected Date Subscriptions */}
        {selectedDate && selectedSubs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Prélèvements du {new Date(selectedDate).getDate()}
            </Text>
            {selectedSubs.map((sub) => (
              <TouchableOpacity
                key={sub.id}
                style={styles.subItem}
                onLongPress={() => handleDeleteSub(sub.id, sub.name)}
              >
                <View style={[styles.subDot, { backgroundColor: sub.color }]} />
                <View style={styles.subDetails}>
                  <Text style={styles.subName}>{sub.name}</Text>
                  <Text style={styles.subFreq}>{sub.frequency === 'monthly' ? 'Mensuel' : sub.frequency === 'yearly' ? 'Annuel' : 'Hebdomadaire'}</Text>
                </View>
                <Text style={styles.subAmount}>-{sub.amount.toFixed(2)}€</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* All Subscriptions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tous les Abonnements</Text>
          {subscriptions.map((sub) => (
            <TouchableOpacity
              key={sub.id}
              style={styles.subItem}
              onLongPress={() => handleDeleteSub(sub.id, sub.name)}
            >
              <View style={[styles.subDot, { backgroundColor: sub.color }]} />
              <View style={styles.subDetails}>
                <Text style={styles.subName}>{sub.name}</Text>
                <Text style={styles.subFreq}>
                  Prochain : {new Date(sub.nextDate).toLocaleDateString('fr-FR')}
                </Text>
              </View>
              <Text style={styles.subAmount}>-{sub.amount.toFixed(2)}€</Text>
            </TouchableOpacity>
          ))}
          {subscriptions.length === 0 && (
            <Text style={styles.emptyText}>Aucun abonnement enregistré</Text>
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Add Subscription Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nouvel Abonnement</Text>
            <Text style={styles.inputLabel}>Nom</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Ex: Netflix"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.inputLabel}>Montant (€)</Text>
            <TextInput
              style={styles.input}
              value={editAmount}
              onChangeText={setEditAmount}
              placeholder="Ex: 9.99"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
            />
            <Text style={styles.inputLabel}>Jour du mois</Text>
            <TextInput
              style={styles.input}
              value={editDay}
              onChangeText={setEditDay}
              placeholder="Ex: 15"
              placeholderTextColor={Colors.textMuted}
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => { setShowModal(false); setEditName(''); setEditAmount(''); setEditDay(''); }}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleAddSubscription}>
                <Text style={styles.saveButtonText}>Ajouter</Text>
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
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h1,
  },
  addButton: {
    backgroundColor: Colors.warning,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
  },
  addButtonText: {
    color: '#222',
    fontWeight: '600',
    fontSize: 13,
  },
  totalCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  totalLabel: {
    ...Typography.caption,
  },
  totalAmount: {
    ...Typography.amount,
    color: Colors.warning,
    marginTop: Spacing.xs,
  },
  totalSub: {
    ...Typography.bodySmall,
    marginTop: Spacing.xs,
  },
  calendarContainer: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  calendar: {
    borderRadius: BorderRadius.lg,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: Spacing.md,
  },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  subDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.md,
  },
  subDetails: {
    flex: 1,
  },
  subName: {
    ...Typography.body,
    fontWeight: '600',
    fontSize: 14,
  },
  subFreq: {
    ...Typography.bodySmall,
    fontSize: 12,
    marginTop: 2,
  },
  subAmount: {
    ...Typography.amountSmall,
    fontSize: 16,
    color: Colors.danger,
  },
  emptyText: {
    ...Typography.bodySmall,
    textAlign: 'center',
    padding: Spacing.xl,
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
    backgroundColor: Colors.warning,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#222',
    fontWeight: '600',
  },
});
