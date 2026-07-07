import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, RefreshControl, TouchableOpacity, Dimensions } from 'react-native';
import { useStore } from '../store';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

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
  warning: '#f59e0b',
  warningBg: '#fef3c7',
  info: '#3b82f6',
  infoBg: '#eff6ff',
  chartColors: ['#e00000', '#ffd400', '#8a3d00']
};

export default function AdminDashboard() {
  const router = useRouter();
  const { user, logout, tables, fetchTables, activeOrders, fetchOrders, kots, fetchKots, dashboardStats, fetchDashboardStats, weeklyReports, fetchWeeklyReports } = useStore();
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    await Promise.all([
      fetchTables(),
      fetchOrders(),
      fetchKots(),
      fetchDashboardStats(),
      fetchWeeklyReports()
    ]);
  };

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadData();
        const interval = setInterval(loadData, 15000);
        return () => clearInterval(interval);
      }
    }, [user])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const safeTables = Array.isArray(tables) ? tables : [];
  const safeOrders = Array.isArray(activeOrders) ? activeOrders : [];
  const safeKots = Array.isArray(kots) ? kots : [];
  const safeWeekly = Array.isArray(weeklyReports) ? weeklyReports : [];

  const occupiedTables = safeTables.filter((t: any) => t.status === 'occupied');
  const pendingOrders = safeOrders.filter((o: any) => o.status === 'open');
  const preparingKots = safeKots.filter((k: any) => k.status === 'preparing');

  // KPI Calculations
  const liveAmount = pendingOrders.reduce((sum, o: any) => sum + Number(o.total || 0), 0);
  const totalRevenue = dashboardStats?.revenue?.today || 0;
  const completedOrders = dashboardStats?.orders?.today || 0;

  const stats = [
    { label: 'Active Tables', value: occupiedTables.length, sub: `${safeTables.length} Total`, color: COLORS.info },
    { label: 'Live Orders', value: pendingOrders.length, sub: 'In progress', color: COLORS.warning },
    { label: 'Today\'s Revenue', value: `₹${Number(totalRevenue).toFixed(0)}`, sub: 'Completed bills', color: COLORS.success },
    { label: 'Pending KOT', value: preparingKots.length, sub: 'In kitchen', color: COLORS.danger },
  ];

  // Channel split calculations
  const channelSplit = dashboardStats?.channel_split || { 'dine-in': 0, takeaway: 0, delivery: 0 };
  const totalChannels = Object.values(channelSplit).reduce((a: any, b: any) => a + b, 0) || 1;
  const channelData = [
    { label: 'Dine-in', value: channelSplit['dine-in'] || 0, color: COLORS.chartColors[0] },
    { label: 'Takeaway', value: channelSplit.takeaway || 0, color: COLORS.chartColors[1] },
    { label: 'Delivery', value: channelSplit.delivery || 0, color: COLORS.chartColors[2] }
  ];

  // Weekly Revenue calculations
  const maxWeeklyRevenue = Math.max(...safeWeekly.map((d: any) => Number(d.revenue || 0)), 100);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerEyebrow}>ADMIN DASHBOARD</Text>
          <Text style={styles.greeting}>Live Monitor</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutButton} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* KPI Grid */}
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsGrid}>
          {stats.map((s, i) => (
            <View key={i} style={styles.statCard}>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statSub}>{s.sub}</Text>
            </View>
          ))}
        </View>

        {/* Visualizations: Weekly Revenue & Order Channels */}
        <Text style={styles.sectionTitle}>Analytics & Split</Text>
        
        {/* Weekly Revenue Bar Chart */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Weekly Revenue (Last 7 Days)</Text>
          {safeWeekly.length === 0 ? (
            <Text style={styles.noDataText}>No revenue data available for this week</Text>
          ) : (
            <View style={styles.chartContainer}>
              <View style={styles.barChartRow}>
                {safeWeekly.map((w: any, index: number) => {
                  const revenue = Number(w.revenue || 0);
                  const barHeightPercent = Math.max(8, (revenue / maxWeeklyRevenue) * 100);
                  return (
                    <View key={index} style={styles.barColumn}>
                      <View style={styles.barWrapper}>
                        <View style={[styles.barFill, { height: `${barHeightPercent}%`, backgroundColor: COLORS.primary }]} />
                      </View>
                      <Text style={styles.barValue}>₹{revenue >= 1000 ? `${(revenue / 1000).toFixed(1)}k` : revenue.toFixed(0)}</Text>
                      <Text style={styles.barLabel}>{w.day}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Order Channels Split progress bars */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Channels split</Text>
          <View style={styles.channelsContainer}>
            {channelData.map((c, i) => {
              const percentage = Math.round((c.value / totalChannels) * 100);
              return (
                <View key={i} style={styles.channelRow}>
                  <View style={styles.channelInfo}>
                    <Text style={styles.channelLabel}>{c.label}</Text>
                    <Text style={styles.channelValue}>{c.value} ({percentage}%)</Text>
                  </View>
                  <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: `${percentage}%`, backgroundColor: c.color }]} />
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* Recent Live Orders */}
        <Text style={styles.sectionTitle}>Recent Live Orders</Text>
        {pendingOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No live orders right now.</Text>
          </View>
        ) : (
          pendingOrders.map((order: any) => (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <Text style={styles.orderId}>Order #{String(order.id).slice(0, 8)}</Text>
                <View style={styles.orderStatusBadge}>
                  <Text style={styles.orderStatusText}>
                    {order.order_type === 'dine-in' ? `Table ${order.table_id}` : order.order_type}
                  </Text>
                </View>
              </View>
              
              <View style={styles.orderBody}>
                <Text style={styles.orderTime}>
                  {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={styles.orderTotal}>₹{Number(order.total).toFixed(2)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

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
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 12,
    marginTop: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statCard: {
    width: '48%',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.inkSoft,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  statSub: {
    fontSize: 11,
    color: COLORS.inkSoft,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.ink,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  noDataText: {
    fontSize: 13,
    color: COLORS.inkSoft,
    textAlign: 'center',
    paddingVertical: 20,
  },
  chartContainer: {
    height: 160,
    justifyContent: 'flex-end',
    paddingTop: 10,
  },
  barChartRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: '100%',
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
  },
  barWrapper: {
    height: 100,
    width: 14,
    backgroundColor: '#f1f5f9',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  barValue: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.inkSoft,
    marginTop: 6,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.ink,
    marginTop: 4,
  },
  channelsContainer: {
    gap: 14,
  },
  channelRow: {
    flexDirection: 'column',
  },
  channelInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  channelLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.ink,
  },
  channelValue: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.inkSoft,
  },
  progressBarBg: {
    height: 10,
    backgroundColor: '#f1f5f9',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: {
    color: COLORS.inkSoft,
    fontWeight: '600',
  },
  orderCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ink,
  },
  orderStatusBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  orderStatusText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
    textTransform: 'uppercase',
  },
  orderBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderTime: {
    fontSize: 13,
    color: COLORS.inkSoft,
    fontWeight: '500',
  },
  orderTotal: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.ink,
  },
});
