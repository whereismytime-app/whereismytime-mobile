import type { DrizzleDB } from '@/db/SQLiteProvider';
import { categories, type Category } from '@/db/schema';
import type { CategoryRule } from '@/types/category_rule';
import { desc, eq, isNull } from 'drizzle-orm';

export interface CreateCategoryInput {
  name: string;
  color: string;
  priority?: number;
  rules?: CategoryRule[];
  parentCategoryId?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  color?: string;
  priority?: number;
  rules?: CategoryRule[];
  parentCategoryId?: string;
}

export interface CategoryWithChildren extends Category {
  children: CategoryWithChildren[];
}

// Virtual category for uncategorized events
export const UNCATEGORIZED_CATEGORY: Category = {
  id: '__uncategorized__',
  name: 'Uncategorized',
  color: '#9CA3AF',
  priority: -1,
  rules: null,
  parentCategoryId: null,
};

export class CategoryService {
  constructor(private db: DrizzleDB) {}

  async createCategory(input: CreateCategoryInput): Promise<Category> {
    const [category] = await this.db
      .insert(categories)
      .values({
        name: input.name,
        color: input.color,
        priority: input.priority ?? 0,
        rules: input.rules,
        parentCategoryId: input.parentCategoryId,
      })
      .returning();

    return category;
  }

  async updateCategory(id: string, input: UpdateCategoryInput): Promise<Category | null> {
    // Prevent circular references
    if (input.parentCategoryId) {
      const isCircular = await this.wouldCreateCircularReference(id, input.parentCategoryId);
      if (isCircular) {
        throw new Error('Cannot set parent category: would create circular reference');
      }
    }

    const [category] = await this.db
      .update(categories)
      .set({
        ...(input.name && { name: input.name }),
        ...(input.color && { color: input.color }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.rules !== undefined && { rules: input.rules }),
        ...(input.parentCategoryId !== undefined && { parentCategoryId: input.parentCategoryId }),
      })
      .where(eq(categories.id, id))
      .returning();

    return category || null;
  }

  async deleteCategory(id: string): Promise<boolean> {
    // Check if category has children
    const children = await this.db
      .select()
      .from(categories)
      .where(eq(categories.parentCategoryId, id))
      .limit(1);

    if (children.length > 0) {
      throw new Error('Cannot delete category with child categories');
    }

    const result = await this.db.delete(categories).where(eq(categories.id, id));

    return result.changes > 0;
  }

  async getCategoryById(id: string): Promise<Category | null> {
    if (id === UNCATEGORIZED_CATEGORY.id) {
      return UNCATEGORIZED_CATEGORY;
    }

    const [category] = await this.db
      .select()
      .from(categories)
      .where(eq(categories.id, id))
      .limit(1);

    return category || null;
  }

  async getRootCategories(): Promise<Category[]> {
    return await this.db
      .select()
      .from(categories)
      .where(isNull(categories.parentCategoryId))
      .orderBy(desc(categories.priority), categories.name);
  }

  async getCategoriesByParent(parentId: string): Promise<Category[]> {
    return await this.db
      .select()
      .from(categories)
      .where(eq(categories.parentCategoryId, parentId))
      .orderBy(desc(categories.priority), categories.name);
  }

  async getAllCategories(): Promise<Category[]> {
    return await this.db
      .select()
      .from(categories)
      .orderBy(desc(categories.priority), categories.name);
  }

  async getCategoriesTree(): Promise<CategoryWithChildren[]> {
    const allCategories = await this.getAllCategories();
    const categoryMap = new Map<string, CategoryWithChildren>();

    // Create map with children arrays
    allCategories.forEach((category) => {
      categoryMap.set(category.id, { ...category, children: [] });
    });

    const rootCategories: CategoryWithChildren[] = [];

    // Build tree structure
    allCategories.forEach((category) => {
      const categoryWithChildren = categoryMap.get(category.id)!;

      if (category.parentCategoryId) {
        const parent = categoryMap.get(category.parentCategoryId);
        if (parent) {
          parent.children.push(categoryWithChildren);
        }
      } else {
        rootCategories.push(categoryWithChildren);
      }
    });

    return rootCategories;
  }

  async getCategoryPath(categoryId: string): Promise<Category[]> {
    const path: Category[] = [];
    let currentId: string | null = categoryId;

    while (currentId) {
      const category = await this.getCategoryById(currentId);
      if (!category) break;

      path.unshift(category);
      currentId = category.parentCategoryId;
    }

    return path;
  }

  async moveCategory(categoryId: string, newParentId: string | null): Promise<Category | null> {
    if (newParentId) {
      const isCircular = await this.wouldCreateCircularReference(categoryId, newParentId);
      if (isCircular) {
        throw new Error('Cannot move category: would create circular reference');
      }
    }

    return await this.updateCategory(categoryId, { parentCategoryId: newParentId || undefined });
  }

  private async wouldCreateCircularReference(
    categoryId: string,
    potentialParentId: string
  ): Promise<boolean> {
    if (categoryId === potentialParentId) {
      return true;
    }

    let currentId: string | null = potentialParentId;
    while (currentId) {
      if (currentId === categoryId) {
        return true;
      }

      const parent = await this.getCategoryById(currentId);
      if (!parent) break;

      currentId = parent.parentCategoryId;
    }

    return false;
  }

  async searchCategories(query: string): Promise<Category[]> {
    const allCategories = await this.getAllCategories();
    const lowerQuery = query.toLowerCase();

    return allCategories.filter((category) => category.name.toLowerCase().includes(lowerQuery));
  }

  async getCategoryDepth(categoryId: string): Promise<number> {
    const path = await this.getCategoryPath(categoryId);
    return path.length - 1; // Depth is 0-based (root = 0)
  }
}
