import {
  CategoryService,
  type CategoryWithChildren,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '@/services/CategoryService';
import { type CategoryRule } from '@/types/category_rule';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useDrizzle } from '../db/SQLiteProvider';

interface CategoryFormProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: CreateCategoryInput | { id: string; data: UpdateCategoryInput }) => void;
  category?: CategoryWithChildren;
  parentCategory?: CategoryWithChildren;
}

interface RuleItemProps {
  rule: CategoryRule;
  index: number;
  onUpdate: (index: number, rule: CategoryRule) => void;
  onRemove: (index: number) => void;
}

const RuleItem: React.FC<RuleItemProps> = ({ rule, index, onUpdate, onRemove }) => {
  const ruleTypes = [
    { label: 'Contains', value: 'CONTAINS' },
    { label: 'Starts with', value: 'STARTS_WITH' },
    { label: 'Ends with', value: 'ENDS_WITH' },
    { label: 'Regex pattern', value: 'REGEX' },
  ] as const;

  const updateRuleType = (type: CategoryRule['type']) => {
    onUpdate(index, { ...rule, type });
  };

  const updateRuleContent = (content: string) => {
    onUpdate(index, { ...rule, content });
  };

  return (
    <View className="mb-3 rounded-lg border border-gray-300 p-3">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="font-medium text-gray-700">Rule {index + 1}</Text>
        <TouchableOpacity onPress={() => onRemove(index)} className="p-1">
          <Ionicons name="close" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      <View className="mb-3">
        <Text className="mb-2 text-sm font-medium text-gray-700">Match Type</Text>
        <View className="rounded-lg border border-gray-300">
          <Picker selectedValue={rule.type} onValueChange={updateRuleType} style={{ height: 50 }}>
            {ruleTypes.map((type) => (
              <Picker.Item key={type.value} label={type.label} value={type.value} />
            ))}
          </Picker>
        </View>
      </View>

      <View>
        <Text className="mb-2 text-sm font-medium text-gray-700">
          {rule.type === 'REGEX' ? 'Regex Pattern' : 'Text to Match'}
        </Text>
        <TextInput
          className="rounded-lg border border-gray-300 px-3 py-2"
          value={rule.content}
          onChangeText={updateRuleContent}
          placeholder={
            rule.type === 'CONTAINS'
              ? 'e.g., meeting'
              : rule.type === 'STARTS_WITH'
                ? 'e.g., Work:'
                : rule.type === 'ENDS_WITH'
                  ? 'e.g., - Personal'
                  : 'e.g., ^(Meeting|Call).*'
          }
          multiline={rule.type === 'REGEX'}
        />
        {rule.type === 'REGEX' && (
          <Text className="mt-1 text-xs text-gray-500">
            Use JavaScript regex syntax. Events with titles matching this pattern will be
            categorized.
          </Text>
        )}
      </View>
    </View>
  );
};

const CategoryForm: React.FC<CategoryFormProps> = ({
  visible,
  onClose,
  onSave,
  category,
  parentCategory,
}) => {
  const { drizzle: drizzleDB } = useDrizzle();
  const categoryServiceRef = useRef<CategoryService>(new CategoryService(drizzleDB));

  const [name, setName] = useState('');
  const [color, setColor] = useState('#3B82F6');
  const [priority, setPriority] = useState('0');
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState<CategoryWithChildren[]>([]);

  const colors = [
    '#3B82F6',
    '#EF4444',
    '#10B981',
    '#F59E0B',
    '#8B5CF6',
    '#EC4899',
    '#06B6D4',
    '#84CC16',
  ];

  useEffect(() => {
    if (category) {
      setName(category.name);
      setColor(category.color);
      setPriority((category.priority ?? 0).toString());
      setRules(category.rules || []);
      setSelectedParentId(category.parentCategoryId || null);
    } else {
      setName('');
      setColor('#3B82F6');
      setPriority('0');
      setRules([]);
      setSelectedParentId(parentCategory?.id || null);
    }
  }, [category, parentCategory]);

  // Load all categories for parent selection when editing
  useEffect(() => {
    if (visible && category) {
      const loadCategories = async () => {
        try {
          const categoriesTree = await categoryServiceRef.current!.getCategoriesTree();
          setAllCategories(categoriesTree);
        } catch (error) {
          console.error('Failed to load categories for parent selection:', error);
        }
      };
      loadCategories();
    }
  }, [visible, category]);

  const addRule = () => {
    const newRule: CategoryRule = {
      type: 'CONTAINS',
      content: '',
    };
    setRules([...rules, newRule]);
  };

  const updateRule = (index: number, updatedRule: CategoryRule) => {
    const newRules = [...rules];
    newRules[index] = updatedRule;
    setRules(newRules);
  };

  const removeRule = (index: number) => {
    const newRules = rules.filter((_, i) => i !== index);
    setRules(newRules);
  };

  // Helper function to flatten categories tree for picker display
  const flattenCategories = (
    cats: CategoryWithChildren[],
    level: number = 0,
    currentCategoryId?: string
  ): { id: string; name: string; level: number }[] => {
    const result: { id: string; name: string; level: number }[] = [];

    for (const cat of cats) {
      // Don't include the current category being edited or its descendants
      if (
        currentCategoryId &&
        (cat.id === currentCategoryId || isDescendantOf(cat.id, currentCategoryId, allCategories))
      ) {
        continue;
      }

      result.push({
        id: cat.id,
        name: cat.name,
        level,
      });

      if (cat.children.length > 0) {
        result.push(...flattenCategories(cat.children, level + 1, currentCategoryId));
      }
    }

    return result;
  };

  // Helper function to check if a category is a descendant of another
  const isDescendantOf = (
    categoryId: string,
    potentialAncestorId: string,
    categories: CategoryWithChildren[]
  ): boolean => {
    for (const cat of categories) {
      if (cat.id === categoryId) {
        let current = cat;
        while (current.parentCategoryId) {
          if (current.parentCategoryId === potentialAncestorId) {
            return true;
          }
          // Find parent category
          const parent = findCategoryInTree(current.parentCategoryId, categories);
          if (!parent) break;
          current = parent;
        }
      } else if (cat.children.length > 0) {
        if (isDescendantOf(categoryId, potentialAncestorId, cat.children)) {
          return true;
        }
      }
    }
    return false;
  };

  // Helper function to find a category in the tree
  const findCategoryInTree = (
    categoryId: string,
    categories: CategoryWithChildren[]
  ): CategoryWithChildren | null => {
    for (const cat of categories) {
      if (cat.id === categoryId) {
        return cat;
      }
      if (cat.children.length > 0) {
        const found = findCategoryInTree(categoryId, cat.children);
        if (found) return found;
      }
    }
    return null;
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Category name is required');
      return;
    }

    const data = {
      name: name.trim(),
      color,
      priority: parseInt(priority) || 0,
      rules: rules.length > 0 ? rules : undefined,
      parentCategoryId: selectedParentId || undefined,
    };

    if (category) {
      onSave({ id: category.id, data });
    } else {
      onSave(data);
    }
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View className="flex-1 bg-white">
        <View className="flex-row items-center justify-between border-b border-gray-200 p-4">
          <TouchableOpacity onPress={onClose}>
            <Text className="text-lg text-blue-500">Cancel</Text>
          </TouchableOpacity>
          <Text className="text-xl font-semibold">
            {category ? 'Edit Category' : 'New Category'}
          </Text>
          <TouchableOpacity onPress={handleSave}>
            <Text className="text-lg font-semibold text-blue-500">Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 p-4">
          {parentCategory && !category && (
            <View className="mb-4 rounded-lg bg-gray-50 p-3">
              <Text className="mb-1 text-sm text-gray-600">Parent Category</Text>
              <Text className="text-lg font-medium">{parentCategory.name}</Text>
            </View>
          )}

          {category && (
            <View className="mb-4">
              <Text className="mb-2 text-lg font-medium">Parent Category</Text>
              <View className="rounded-lg border border-gray-300">
                <Picker
                  selectedValue={selectedParentId || ''}
                  onValueChange={(value) => setSelectedParentId(value || null)}
                  style={{ height: 50 }}>
                  <Picker.Item label="No Parent (Root Category)" value="" />
                  {flattenCategories(allCategories, 0, category.id).map((cat) => (
                    <Picker.Item
                      key={cat.id}
                      label={'  '.repeat(cat.level) + cat.name}
                      value={cat.id}
                    />
                  ))}
                </Picker>
              </View>
            </View>
          )}

          <View className="mb-4">
            <Text className="mb-2 text-lg font-medium">Category Name</Text>
            <TextInput
              className="rounded-lg border border-gray-300 px-3 py-2 text-lg"
              value={name}
              onChangeText={setName}
              placeholder="Enter category name"
            />
          </View>

          <View className="mb-4">
            <Text className="mb-2 text-lg font-medium">Color</Text>
            <View className="flex-row flex-wrap gap-3">
              {colors.map((colorOption) => (
                <TouchableOpacity
                  key={colorOption}
                  onPress={() => setColor(colorOption)}
                  className="h-12 w-12 rounded-full border-2"
                  style={{
                    backgroundColor: colorOption,
                    borderColor: color === colorOption ? '#000' : 'transparent',
                  }}
                />
              ))}
            </View>
          </View>

          <View className="mb-4">
            <Text className="mb-2 text-lg font-medium">Priority</Text>
            <TextInput
              className="rounded-lg border border-gray-300 px-3 py-2 text-lg"
              value={priority}
              onChangeText={setPriority}
              placeholder="0"
              keyboardType="numeric"
            />
            <Text className="mt-1 text-sm text-gray-600">
              When an Event matches multiple categories, the one with the highest priority (highest
              number) will be used.
            </Text>
          </View>

          <View className="mb-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-lg font-medium">Rules</Text>
              <TouchableOpacity
                onPress={addRule}
                className="flex-row items-center rounded-lg bg-blue-500 px-3 py-2">
                <Ionicons name="add" size={16} color="white" />
                <Text className="ml-1 text-sm font-semibold text-white">Add Rule</Text>
              </TouchableOpacity>
            </View>
            {rules.length === 0 ? (
              <Text className="text-gray-500">
                No rules defined. Events won&apos;t be automatically categorized.
              </Text>
            ) : (
              rules.map((rule, index) => (
                <RuleItem
                  key={index}
                  rule={rule}
                  index={index}
                  onUpdate={updateRule}
                  onRemove={removeRule}
                />
              ))
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

interface CategoryItemProps {
  category: CategoryWithChildren;
  level: number;
  onEdit: (category: CategoryWithChildren) => void;
  onDelete: (category: CategoryWithChildren) => void;
  onAddChild: (parent: CategoryWithChildren) => void;
  expanded: boolean;
  onToggleExpand: (categoryId: string) => void;
}

const CategoryItem: React.FC<CategoryItemProps> = ({
  category,
  level,
  onEdit,
  onDelete,
  onAddChild,
  expanded,
  onToggleExpand,
}) => {
  const hasChildren = category.children.length > 0;

  return (
    <View>
      <View
        className="flex-row items-center border-b border-gray-100 px-4 py-3"
        style={{ paddingLeft: 16 + level * 24 }}>
        <TouchableOpacity
          onPress={() => hasChildren && onToggleExpand(category.id)}
          className="mr-2 h-6 w-6 items-center justify-center">
          {hasChildren ? (
            <Ionicons name={expanded ? 'chevron-down' : 'chevron-forward'} size={16} color="#666" />
          ) : null}
        </TouchableOpacity>

        <View className="mr-3 h-4 w-4 rounded-full" style={{ backgroundColor: category.color }} />

        <Text className="flex-1 text-lg font-medium">{category.name}</Text>

        <Text className="mr-2 text-sm text-gray-500">{category.priority}</Text>

        <View className="flex-row">
          <TouchableOpacity onPress={() => onAddChild(category)} className="mr-1 p-2">
            <Ionicons name="add" size={20} color="#3B82F6" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onEdit(category)} className="mr-1 p-2">
            <Ionicons name="pencil" size={20} color="#6B7280" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(category)} className="p-2">
            <Ionicons name="trash" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      {expanded && hasChildren && (
        <View>
          {category.children.map((child) => (
            <CategoryItem
              key={child.id}
              category={child}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
              expanded={expanded}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </View>
      )}
    </View>
  );
};

export const CategoriesManagement: React.FC = () => {
  const { drizzle: drizzleDB } = useDrizzle();
  const [categoryService] = useState(() => new CategoryService(drizzleDB));
  const [categories, setCategories] = useState<CategoryWithChildren[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryWithChildren | undefined>();
  const [parentCategory, setParentCategory] = useState<CategoryWithChildren | undefined>();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const categoriesTree = await categoryService.getCategoriesTree();
      setCategories(categoriesTree);
    } catch (error) {
      Alert.alert('Error', 'Failed to load categories');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [categoryService]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleSave = async (
    data: CreateCategoryInput | { id: string; data: UpdateCategoryInput }
  ) => {
    try {
      if ('id' in data) {
        await categoryService.updateCategory(data.id, data.data);
      } else {
        await categoryService.createCategory(data);
      }
      await loadCategories();
      setEditingCategory(undefined);
      setParentCategory(undefined);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save category');
    }
  };

  const handleDelete = async (category: CategoryWithChildren) => {
    Alert.alert('Delete Category', `Are you sure you want to delete "${category.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await categoryService.deleteCategory(category.id);
            await loadCategories();
          } catch (error) {
            Alert.alert(
              'Error',
              error instanceof Error ? error.message : 'Failed to delete category'
            );
          }
        },
      },
    ]);
  };

  const handleEdit = (category: CategoryWithChildren) => {
    setEditingCategory(category);
    setParentCategory(undefined);
    setShowForm(true);
  };

  const handleAddChild = (parent: CategoryWithChildren) => {
    setEditingCategory(undefined);
    setParentCategory(parent);
    setShowForm(true);
  };

  const handleAddRoot = () => {
    setEditingCategory(undefined);
    setParentCategory(undefined);
    setShowForm(true);
  };

  const toggleExpand = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const renderCategory = (category: CategoryWithChildren, level: number = 0) => (
    <CategoryItem
      key={category.id}
      category={category}
      level={level}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onAddChild={handleAddChild}
      expanded={expandedCategories.has(category.id)}
      onToggleExpand={toggleExpand}
    />
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-lg text-gray-600">Loading categories...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="flex-row items-center justify-between border-b border-gray-200 p-4">
        <Text className="text-2xl font-bold">Categories</Text>
        <TouchableOpacity
          onPress={handleAddRoot}
          className="flex-row items-center rounded-lg bg-blue-500 px-4 py-2">
          <Ionicons name="add" size={20} color="white" />
          <Text className="ml-1 font-semibold text-white">Add Category</Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1">
        {categories.length === 0 ? (
          <View className="flex-1 items-center justify-center p-8">
            <Ionicons name="folder-outline" size={64} color="#9CA3AF" />
            <Text className="mb-2 mt-4 text-xl text-gray-500">No categories yet</Text>
            <Text className="text-center text-gray-400">
              Create your first category to start organizing your events
            </Text>
          </View>
        ) : (
          categories.map((category) => renderCategory(category))
        )}
      </ScrollView>

      <CategoryForm
        visible={showForm}
        onClose={() => setShowForm(false)}
        onSave={handleSave}
        category={editingCategory}
        parentCategory={parentCategory}
      />
    </View>
  );
};
