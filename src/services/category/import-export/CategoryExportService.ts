import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import type { DrizzleDB } from '@/db/SQLiteProvider';
import { CategoryService, type CategoryWithChildren } from '../CategoryService';
import type { CategoryRule } from '@/types/category_rule';

export interface ExportedCategory {
  name: string;
  color: string;
  priority: number;
  rules?: CategoryRule[];
  children?: ExportedCategory[];
}

export interface CategoryExportData {
  version: '1.0';
  exportDate: string;
  categories: ExportedCategory[];
}

export class CategoryExportService {
  private categoryService: CategoryService;

  constructor(private db: DrizzleDB) {
    this.categoryService = new CategoryService(db);
  }

  /**
   * Exports all categories as a JSON file and shares it
   */
  async exportCategories(): Promise<void> {
    try {
      // Get all categories with their tree structure
      const categoriesTree = await this.categoryService.getCategoriesTree();

      // Convert to export format
      const exportData: CategoryExportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        categories: this.convertToExportFormat(categoriesTree),
      };

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `categories-export-${timestamp}.json`;
      const fileUri = FileSystem.documentDirectory + filename;

      // Write to file
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(exportData, null, 2), {
        encoding: FileSystem.EncodingType.UTF8,
      });

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Sharing is not available on this device');
      }

      // Share the file
      await Sharing.shareAsync(fileUri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Categories',
      });

      // Clean up the temporary file
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch (error) {
      console.error('Error exporting categories:', error);
      throw new Error(
        error instanceof Error ? `Export failed: ${error.message}` : 'Export failed: Unknown error'
      );
    }
  }

  /**
   * Converts category tree to export format (nested structure)
   */
  private convertToExportFormat(categories: CategoryWithChildren[]): ExportedCategory[] {
    const convertCategory = (category: CategoryWithChildren): ExportedCategory => {
      const exportedCategory: ExportedCategory = {
        name: category.name,
        color: category.color,
        priority: category.priority ?? 0,
        rules: category.rules || undefined,
      };

      // Add children if they exist
      if (category.children && category.children.length > 0) {
        exportedCategory.children = category.children.map((child) => convertCategory(child));
      }

      return exportedCategory;
    };

    return categories.map((category) => convertCategory(category));
  }

  /**
   * Gets export data without actually exporting (for preview/testing)
   */
  async getExportData(): Promise<CategoryExportData> {
    const categoriesTree = await this.categoryService.getCategoriesTree();

    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      categories: this.convertToExportFormat(categoriesTree),
    };
  }
}
