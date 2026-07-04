import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, SafeAreaView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useStore } from '../store';
import { useCallback } from 'react';

export default function TablesScreen() {
  const router = useRouter();
  const { tables, fetchTables, fetchOrders, setSelectedTable, logout, user } = useStore();
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchTables();
      fetchOrders();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchTables(), fetchOrders()]);
    setRefreshing(false);
  };

  const handleTableSelect = (table: any) => {
    setSelectedTable(table);
    if (table.status === 'occupied') {
      router.push('/cart');
    } else {
      router.push('/menu');
    }
  };

  const freeCount = tables?.filter((t: any) => t.status === 'free').length || 0;
  const occupiedCount = tables?.filter((t: any) => t.status === 'occupied').length || 0;

  const renderTable = ({ item }: { item: any }) => {
    const isFree = item.status === 'free';

    return (
      <TouchableOpacity
        style={[styles.tableCard, isFree ? styles.freeTable : styles.occupiedTable]}
        onPress={() => handleTableSelect(item)}
        activeOpacity={0.85}
      >
        <View style={[styles.statusDot, isFree ? styles.freeDot : styles.occupiedDot]} />
        <Text style={[styles.tableNumber, isFree ? styles.freeText : styles.occupiedText]}>
          {item.number}
        </Text>
        <Text style={[styles.statusText, isFree ? styles.freeText : styles.occupiedText]}>
          {isFree ? 'Free' : 'Occupied'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>WELCOME BACK</Text>
          <Text style={styles.greeting}>{user?.name || 'Staff'}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutButton} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryPill}>
          <View style={[styles.summaryDot, styles.freeDot]} />
          <Text style={styles.summaryText}>{freeCount} Free</Text>
        </View>
        <View style={styles.summaryPill}>
          <View style={[styles.summaryDot, styles.occupiedDot]} />
          <Text style={styles.summaryText}>{occupiedCount} Occupied</Text>
        </View>
      </View>

      <FlatList
        data={tables}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderTable}
        numColumns={3}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>🍦</Text>
            </View>
            <Text style={styles.emptyTitle}>No tables found</Text>
            <Text style={styles.emptySubtitle}>Pull down to refresh</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const COLORS = {
  bg: '#fff8e6',
  primary: '#e00000',
  primaryDark: '#b30000',
  accent: '#ffd400',
  accentDark: '#e0ac00',
  ink: '#2a0a00',
  inkSoft: '#8a6a4a',
  border: '#ffe9b0',
  card: '#ffffff',
  success: '#1f9254',
  successBg: '#e6f7ec',
  danger: '#c62828',
  dangerBg: '#fdecec',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 56,
    paddingBottom: 20,
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  headerEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 1,
    marginBottom: 2,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  logoutButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  logoutText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },

  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  summaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  summaryText: { fontSize: 13, fontWeight: '700', color: COLORS.ink },

  listContent: {
    padding: 12,
    paddingBottom: 24,
    flexGrow: 1,
  },
  tableCard: {
    flex: 1,
    margin: 6,
    height: 104,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  freeTable: {
    borderColor: COLORS.success,
  },
  occupiedTable: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerBg,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    top: 12,
    right: 12,
  },
  freeDot: { backgroundColor: COLORS.success },
  occupiedDot: { backgroundColor: COLORS.danger },
  tableNumber: {
    fontSize: 24,
    fontWeight: '800',
  },
  statusText: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '700',
  },
  freeText: {
    color: COLORS.success,
  },
  occupiedText: {
    color: COLORS.danger,
  },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyIcon: { fontSize: 28 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.ink, marginBottom: 4 },
  emptySubtitle: { fontSize: 14, color: COLORS.inkSoft },
});