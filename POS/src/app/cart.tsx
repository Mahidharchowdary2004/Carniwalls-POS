import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useStore } from '../store';
import { useCallback } from 'react';

export default function CartScreen() {
  const router = useRouter();
  const { posState, updateCartQty, removeFromCart, createOrder, updateOrder, generateBill, clearCart, activeOrders, fetchOrders } = useStore();
  const { cart, selectedTable } = posState;
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, [])
  );

  const activeOrder = activeOrders?.find((o: any) => o.table_id === selectedTable?.id && o.status === 'open');

  const totalAmount = cart.reduce((sum: number, item: any) => sum + (item.price * item.qty), 0);

  const activeOrderItems = activeOrder ? (typeof activeOrder.items === 'string' ? JSON.parse(activeOrder.items) : (activeOrder.items || [])) : [];
  const displayItems = [
    ...activeOrderItems.map((item: any, idx: number) => ({ ...item, isSent: true, displayId: `sent_${idx}` })),
    ...cart.map((item: any) => ({ ...item, isSent: false, displayId: `new_${item.id}` }))
  ];

  const grandTotal = totalAmount + (activeOrder ? Number(activeOrder.subtotal || 0) : 0);
  const newItemsCount = cart.reduce((sum: number, item: any) => sum + item.qty, 0);

  const handleSendKOT = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      if (activeOrder) {
        const existingItems = typeof activeOrder.items === 'string' ? JSON.parse(activeOrder.items) : (activeOrder.items || []);
        const newItems = cart.map((item: any) => ({
          menu_item_id: item.id,
          name: item.name,
          qty: item.qty,
          price: item.price,
          total: item.price * item.qty,
          notes: ''
        }));
        const mergedItems = [...existingItems];
        newItems.forEach((ni: any) => {
          const ex = mergedItems.find(mi => mi.menu_item_id === ni.menu_item_id);
          if (ex) ex.qty += ni.qty;
          else mergedItems.push(ni);
        });

        await updateOrder(activeOrder.id, {
          items: mergedItems,
        });
      } else {
        const orderPayload = {
          table_id: selectedTable?.id,
          items: cart.map((item: any) => ({
            menu_item_id: item.id,
            name: item.name,
            qty: item.qty,
            price: item.price,
            total: item.price * item.qty,
            notes: ''
          })),
          total_amount: totalAmount,
          order_type: 'dine-in',
          status: 'open'
        };
        await createOrder(orderPayload);
      }
      clearCart();
      Alert.alert('Success', 'KOT sent to kitchen!');
      router.replace('/');
    } catch (err) {
      Alert.alert('Error', 'Failed to send KOT.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateBill = async () => {
    if (!activeOrder) return;
    setLoading(true);
    try {
      await generateBill(activeOrder.id, 'cash', 0);
      Alert.alert('Success', 'Bill generated & Table cleared!');
      router.replace('/');
    } catch (err) {
      Alert.alert('Error', 'Failed to generate bill.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const renderCartItem = ({ item, index }: { item: any; index: number }) => {
    const isFirstNew = !item.isSent && (index === 0 || displayItems[index - 1].isSent);
    return (
      <View>
        {isFirstNew && (
          <Text style={styles.sectionLabel}>NEW ITEMS</Text>
        )}
        <View style={[styles.cartItemCard, item.isSent && styles.cartItemCardSent]}>
          <View style={styles.itemInfo}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.itemPrice}>₹{item.price} · Qty {item.qty}</Text>
            </View>
            <Text style={styles.itemTotal}>₹{item.price * item.qty}</Text>
          </View>

          <View style={styles.itemActions}>
            {!item.isSent ? (
              <>
                <View style={styles.qtyControls}>
                  <TouchableOpacity onPress={() => updateCartQty(item.id, item.qty - 1)} style={styles.qtyBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.qty}</Text>
                  <TouchableOpacity onPress={() => updateCartQty(item.id, item.qty + 1)} style={styles.qtyBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => removeFromCart(item.id)} style={styles.deleteBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.deleteBtnText}>Remove</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.sentChip}>
                <View style={styles.sentDot} />
                <Text style={styles.sentChipText}>Sent to kitchen</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => router.push('/')} style={{ marginRight: 16, padding: 4 }}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold' }}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerEyebrow}>DINE-IN ORDER</Text>
            <Text style={styles.headerTitle}>Table {selectedTable?.number || selectedTable?.table_no}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.addMoreBtn} onPress={() => router.push('/menu')} activeOpacity={0.8}>
          <Text style={styles.addMoreText}>+ Add Items</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayItems}
        keyExtractor={(item) => item.displayId}
        renderItem={renderCartItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>🍽️</Text>
            </View>
            <Text style={styles.emptyTitle}>Cart is empty</Text>
            <Text style={styles.emptySubtitle}>Add items from the menu to get started</Text>
          </View>
        }
      />

      {(cart.length > 0 || activeOrder) && (
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <View>
              <Text style={styles.totalLabel}>Total Amount</Text>
              {newItemsCount > 0 && (
                <Text style={styles.totalSubLabel}>{newItemsCount} new item{newItemsCount > 1 ? 's' : ''} to send</Text>
              )}
            </View>
            <Text style={styles.totalValue}>₹{grandTotal}</Text>
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.btn, styles.kotBtn, (loading || cart.length === 0) && styles.disabledBtn]}
              onPress={handleSendKOT}
              disabled={loading || cart.length === 0}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{activeOrder ? 'Update KOT' : 'Send KOT'}</Text>}
            </TouchableOpacity>

            {activeOrder && (
              <TouchableOpacity
                style={[styles.btn, styles.billBtn, loading && styles.disabledBtn]}
                onPress={handleGenerateBill}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? <ActivityIndicator color={COLORS.ink} /> : <Text style={styles.billBtnText}>Print Bill</Text>}
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
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
  danger: '#c62828',
  dangerBg: '#fdecec',
  success: '#1f9254',
  successBg: '#e6f7ec',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 20,
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#ffffff' },
  addMoreBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  addMoreText: { fontSize: 13, fontWeight: '700', color: '#ffffff' },

  listContent: { padding: 16, paddingTop: 20, paddingBottom: 140, flexGrow: 1 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.inkSoft,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
    marginLeft: 4,
  },

  cartItemCard: {
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cartItemCardSent: {
    backgroundColor: '#fafaf9',
    opacity: 0.9,
  },

  itemInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  itemName: { fontSize: 16, fontWeight: '700', color: COLORS.ink, marginBottom: 3 },
  itemPrice: { fontSize: 13, color: COLORS.inkSoft },
  itemTotal: { fontSize: 17, fontWeight: '800', color: COLORS.ink, marginLeft: 12 },

  itemActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  qtyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    overflow: 'hidden',
  },
  qtyBtn: { paddingHorizontal: 16, paddingVertical: 9 },
  qtyBtnText: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  qtyText: { fontSize: 15, fontWeight: '700', width: 28, textAlign: 'center', color: COLORS.ink },

  deleteBtn: { paddingHorizontal: 12, paddingVertical: 9, backgroundColor: COLORS.dangerBg, borderRadius: 10 },
  deleteBtnText: { color: COLORS.danger, fontWeight: '700', fontSize: 13 },

  sentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.successBg,
    borderRadius: 20,
  },
  sentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.success, marginRight: 6 },
  sentChipText: { fontSize: 12, fontWeight: '700', color: COLORS.success },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  emptyIcon: { fontSize: 30 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: COLORS.ink, marginBottom: 4 },
  emptySubtitle: { fontSize: 14, color: COLORS.inkSoft },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.card,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 28,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18 },
  totalLabel: { fontSize: 13, fontWeight: '600', color: COLORS.inkSoft, marginBottom: 2 },
  totalSubLabel: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  totalValue: { fontSize: 28, fontWeight: '800', color: COLORS.ink },

  actionButtons: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, paddingVertical: 15, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  kotBtn: { backgroundColor: COLORS.primary },
  billBtn: { backgroundColor: COLORS.accent },
  disabledBtn: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  billBtnText: { color: COLORS.ink, fontSize: 15, fontWeight: '700' },
});