import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../store';

export default function MenuScreen() {
  const router = useRouter();
  const { menuItems, categories, fetchMenu, posState, addToCart, removeFromCart } = useStore();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchMenu();
  }, []);

  const filteredItems = menuItems.filter((item: any) => {
    const matchesCategory = activeCategory ? item.category_id === activeCategory : true;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const cartTotalItems = posState.cart.reduce((sum: number, item: any) => sum + item.qty, 0);
  const cartTotalValue = posState.cart.reduce((sum: number, item: any) => sum + item.qty * item.price, 0);

  const getCartQty = (itemId: number) => {
    const item = posState.cart.find((i: any) => i.id === itemId);
    return item ? item.qty : 0;
  };

  const renderCategory = ({ item }: { item: any }) => {
    const isActive = activeCategory === item.id;
    return (
      <TouchableOpacity
        style={[styles.categoryPill, isActive && styles.categoryPillActive]}
        onPress={() => setActiveCategory(isActive ? null : item.id)}
        activeOpacity={0.85}
      >
        <Text style={[styles.categoryText, isActive && styles.categoryTextActive]}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderMenuItem = ({ item }: { item: any }) => {
    const qty = getCartQty(item.id);
    const inCart = qty > 0;

    return (
      <View style={[styles.menuItemCard, inCart && styles.menuItemCardActive]}>
        <View style={styles.menuItemInfo}>
          <Text style={styles.menuItemName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.menuItemPrice}>₹{item.price}</Text>
        </View>
        <View style={styles.actionRow}>
          {inCart ? (
            <View style={styles.qtyContainer}>
              <TouchableOpacity onPress={() => removeFromCart(item.id)} style={styles.qtyBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.qtyBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.qtyText}>{qty}</Text>
              <TouchableOpacity onPress={() => addToCart(item)} style={styles.qtyBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.qtyBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => addToCart(item)} style={styles.addBtn} activeOpacity={0.85}>
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
          <TouchableOpacity onPress={() => router.push('/')} style={{ marginRight: 12, padding: 4 }}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: 'bold' }}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.tableLabel, { marginBottom: 0 }]}>Table {posState.selectedTable?.table_no}</Text>
        </View>
        <View style={styles.searchWrapper}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search items..."
            placeholderTextColor="#b98a00"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <View style={styles.categoriesWrapper}>
        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderCategory}
          contentContainerStyle={styles.categoriesList}
        />
      </View>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMenuItem}
        contentContainerStyle={styles.menuList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Text style={styles.emptyIcon}>🔍</Text>
            </View>
            <Text style={styles.emptyTitle}>No items found</Text>
            <Text style={styles.emptySubtitle}>Try a different search or category</Text>
          </View>
        }
      />

      {cartTotalItems > 0 && (
        <View style={styles.bottomBar}>
          <View>
            <Text style={styles.cartInfoText}>{cartTotalItems} item{cartTotalItems > 1 ? 's' : ''} · ₹{cartTotalValue}</Text>
            <Text style={styles.cartInfoSub}>Ready to send to kitchen</Text>
          </View>
          <TouchableOpacity style={styles.checkoutBtn} onPress={() => router.push('/cart')} activeOpacity={0.85}>
            <Text style={styles.checkoutBtnText}>View Cart</Text>
          </TouchableOpacity>
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
  success: '#1f9254',
  successBg: '#e6f7ec',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },

  header: {
    padding: 20,
    paddingTop: 56,
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  tableLabel: { fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 14 },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  searchIcon: { fontSize: 16, color: '#b98a00', marginRight: 8, fontWeight: '700' },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.ink, height: '100%' },

  categoriesWrapper: { backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  categoriesList: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  categoryPill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: COLORS.bg,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryPillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  categoryText: { color: COLORS.inkSoft, fontWeight: '600', fontSize: 13 },
  categoryTextActive: { color: '#ffffff' },

  menuList: { padding: 16, paddingBottom: 120, flexGrow: 1 },
  menuItemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  menuItemCardActive: { borderColor: COLORS.accentDark, borderWidth: 1.5 },
  menuItemInfo: { flex: 1 },
  menuItemName: { fontSize: 16, fontWeight: '700', color: COLORS.ink },
  menuItemPrice: { fontSize: 14, color: COLORS.inkSoft, marginTop: 4, fontWeight: '600' },
  actionRow: { marginLeft: 16 },
  addBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 10,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  qtyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  qtyBtn: { paddingHorizontal: 14, paddingVertical: 9 },
  qtyBtnText: { fontSize: 18, fontWeight: '700', color: COLORS.primary },
  qtyText: { fontSize: 15, fontWeight: '700', width: 24, textAlign: 'center', color: COLORS.ink },

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

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.card,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 26,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
  },
  cartInfoText: { fontSize: 16, fontWeight: '800', color: COLORS.ink },
  cartInfoSub: { fontSize: 12, color: COLORS.inkSoft, marginTop: 2 },
  checkoutBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 26, paddingVertical: 14, borderRadius: 14 },
  checkoutBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});