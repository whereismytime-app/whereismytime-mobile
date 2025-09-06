import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import type { DrizzleDB } from '@/db/SQLiteProvider';
import { categories, events } from '@/db/schema';
import { CategoryService, type CreateCategoryInput } from '../CategoryService';
import type { CategoryExportData, ExportedCategory } from './CategoryExportService';
import { z } from 'zod';
import { CategoryRuleSchema } from '@/types/category_rule';

// Validation schema for imported data
const ExportedCategorySchema: z.ZodType<ExportedCategory> = z.object({
  name: z.string(),
  color: z.string(),
  priority: z.number(),
  rules: z.array(CategoryRuleSchema).optional(),
  children: z.lazy(() => z.array(ExportedCategorySchema).optional()),
});

const CategoryExportDataSchema = z.object({
  version: z.literal('1.0'),
  exportDate: z.string(),
  categories: z.array(ExportedCategorySchema),
});

export interface ImportResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  errors: string[];
}

export class CategoryImportService {
  private categoryService: CategoryService;

  constructor(private db: DrizzleDB) {
    this.categoryService = new CategoryService(db);
  }

  /**
   * Opens document picker and imports categories from selected JSON file
   */
  async importCategories(): Promise<ImportResult> {
    try {
      // Open document picker
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return {
          success: false,
          importedCount: 0,
          skippedCount: 0,
          errors: ['Import cancelled by user'],
        };
      }

      const file = result.assets[0];
      if (!file || !file.uri) {
        return {
          success: false,
          importedCount: 0,
          skippedCount: 0,
          errors: ['No file selected'],
        };
      }

      // Read file content
      const fileContent = await FileSystem.readAsStringAsync(file.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      return await this.importFromJsonString(fileContent);
    } catch (error) {
      console.error('Error importing categories:', error);
      return {
        success: false,
        importedCount: 0,
        skippedCount: 0,
        errors: [
          error instanceof Error 
            ? `Import failed: ${error.message}` 
            : 'Import failed: Unknown error'
        ],
      };
    }
  }

  /**
   * Imports categories from JSON string
   */
  async importFromJsonString(jsonString: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      errors: [],
    };

    try {
      // Parse JSON
      let jsonData: any;
      try {
        jsonData = JSON.parse(jsonString);
      } catch {
        result.errors.push('Invalid JSON format');
        return result;
      }

      // Validate structure
      const validationResult = CategoryExportDataSchema.safeParse(jsonData);
      if (!validationResult.success) {
        result.errors.push('Invalid category export format');
        result.errors.push(...validationResult.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`));
        return result;
      }

      const importData: CategoryExportData = validationResult.data;

      // Clear existing categories and reset event category references
      await this.clearExistingCategories();

      // Import categories
      const importResult = await this.importCategoriesFromData(importData.categories);
      
      result.importedCount = importResult.importedCount;
      result.skippedCount = importResult.skippedCount;
      result.errors.push(...importResult.errors);
      result.success = importResult.importedCount > 0;

      return result;
    } catch (error) {
      console.error('Error during import:', error);
      result.errors.push(
        error instanceof Error 
          ? `Import processing failed: ${error.message}` 
          : 'Import processing failed: Unknown error'
      );
      return result;
    }
  }

  /**
   * Clears all existing categories and sets event categoryId to NULL
   */
  private async clearExistingCategories(): Promise<void> {
    try {
      // Set all event categoryId to NULL where it's not already null
      await this.db
        .update(events)
        .set({ categoryId: null });

      // Delete all categories
      await this.db.delete(categories);
    } catch (error) {
      console.error('Error clearing existing categories:', error);
      throw new Error('Failed to clear existing categories');
    }
  }

  /**
   * Imports categories from validated data
   */
  private async importCategoriesFromData(
    categoriesData: ExportedCategory[]
  ): Promise<{ importedCount: number; skippedCount: number; errors: string[] }> {
    const result = {
      importedCount: 0,
      skippedCount: 0,
      errors: [] as string[],
    };

    // Import categories with their children
    await this.processCategories(categoriesData, undefined, result);
    
    return result;
  }

  /**
   * Recursively processes categories and their children
   */
  private async processCategories(
    categories: ExportedCategory[],
    parentId: string | undefined,
    result: { importedCount: number; skippedCount: number; errors: string[] }
  ): Promise<void> {
    for (const categoryData of categories) {
      try {
        const createInput: CreateCategoryInput = {
          name: categoryData.name,
          color: categoryData.color,
          priority: categoryData.priority,
          rules: categoryData.rules,
          parentCategoryId: parentId,
        };

        const newCategory = await this.categoryService.createCategory(createInput);
        
        result.importedCount++;
        
        // Process children if they exist
        if (categoryData.children && categoryData.children.length > 0) {
          await this.processCategories(
            categoryData.children,
            newCategory.id,
            result
          );
        }
      } catch (error) {
        result.skippedCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Failed to import category "${categoryData.name}": ${errorMessage}`);
      }
    }
    // Don't return anything as the function is marked to return void
  }

  // No longer need sortCategoriesByDependency since we process nested categories directly

  /**
   * Validates import data without actually importing
   */
  async validateImportData(jsonString: string): Promise<{
    valid: boolean;
    errors: string[];
    categoryCount: number;
  }> {
    try {
      const jsonData = JSON.parse(jsonString);
      const validationResult = CategoryExportDataSchema.safeParse(jsonData);
      
      if (!validationResult.success) {
        return {
          valid: false,
          errors: validationResult.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`),
          categoryCount: 0,
        };
      }

      return {
        valid: true,
        errors: [],
        categoryCount: validationResult.data.categories.length,
      };
    } catch {
      return {
        valid: false,
        errors: ['Invalid JSON format'],
        categoryCount: 0,
      };
    }
  }
}
