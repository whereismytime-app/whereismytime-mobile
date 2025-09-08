import type { DrizzleDB } from '@/db/SQLiteProvider';
import { events, categories, calendars, type DBEvent, type Category } from '@/db/schema';
import {
  CategoryService,
  UNCATEGORIZED_CATEGORY,
  type CategoryWithChildren,
} from '../category/CategoryService';
import { eq, and, gte, lte, isNull } from 'drizzle-orm';
import { CalendarService } from '../calendar/CalendarService';

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface EventWithCategory extends DBEvent {
  category?: {
    id: string;
    name: string;
    color: string;
    parentCategoryId: string | null;
  } | null;
  calendar?: {
    id: string;
    title: string;
  } | null;
}

export interface CategoryReport {
  category: Category;
  isDummyParent?: boolean;
  directDuration: number; // Duration from events directly assigned to this category
  totalDuration: number; // Direct + all descendant categories
  eventCount: number; // Direct events count
  totalEventCount: number; // Direct + descendant events count
  children: CategoryReport[];
  categoryPath: string[]; // Array of category names from root to this category
}

export interface ReportSummary {
  totalDuration: number;
  totalEvents: number;
  categorizedDuration: number;
  categorizedEvents: number;
  uncategorizedDuration: number;
  uncategorizedEvents: number;
  categoryBreakdown: CategoryReport[];
}

export class CategoryReportService {
  private calendarService: CalendarService;
  private categoryService: CategoryService;
  private primaryTimezone: string | null = null;

  constructor(private db: DrizzleDB) {
    this.calendarService = new CalendarService(db);
    this.categoryService = new CategoryService(db);
  }

  /**
   * Generate a comprehensive report for all categories within a time range
   */
  async generateFullReport(timeRange: TimeRange): Promise<ReportSummary> {
    // Get all events in the time range with category and calendar info
    const eventsWithDetails = await this.getEventsWithDetails({ timeRange });

    // Build category tree
    const categoryTree = await this.categoryService.getCategoriesTree();

    // Calculate category reports
    const categoryBreakdown = await this.buildCategoryReports(categoryTree, eventsWithDetails);

    // Add uncategorized events as a separate category if there are any
    const uncategorizedEvents = eventsWithDetails.filter((event) => !event.categoryId);
    if (uncategorizedEvents.length > 0) {
      const uncategorizedReport: CategoryReport = {
        category: UNCATEGORIZED_CATEGORY,
        directDuration: this.sumDuration(uncategorizedEvents),
        totalDuration: this.sumDuration(uncategorizedEvents),
        eventCount: uncategorizedEvents.length,
        totalEventCount: uncategorizedEvents.length,
        children: [],
        categoryPath: [UNCATEGORIZED_CATEGORY.name],
      };
      categoryBreakdown.push(uncategorizedReport);
    }

    // Calculate summary statistics
    const summary = this.calculateSummary(eventsWithDetails, categoryBreakdown);

    return summary;
  }

  /**
   * Generate report for a specific category and its descendants
   */
  async getCategoryReport(
    categoryId: string,
    timeRange: TimeRange,
    includeDescendants: boolean = true
  ): Promise<CategoryReport | null> {
    const category = await this.categoryService.getCategoryById(categoryId);
    if (!category) return null;

    // Get events for this category
    const eventsWithDetails = await this.getEventsWithDetails({ timeRange });

    if (includeDescendants) {
      // Get the category with all its descendants
      const categoryWithChildren = await this.buildSingleCategoryWithChildren(category);
      const [report] = await this.buildCategoryReports([categoryWithChildren], eventsWithDetails);
      return report || null;
    } else {
      // Only direct events for this category
      const directEvents = eventsWithDetails.filter((event) => event.categoryId === categoryId);
      const categoryPath = (await this.categoryService.getCategoryPath(categoryId)).map(
        (c) => c.name
      );

      return {
        category,
        directDuration: this.sumDuration(directEvents),
        totalDuration: this.sumDuration(directEvents),
        eventCount: directEvents.length,
        totalEventCount: directEvents.length,
        children: [],
        categoryPath,
      };
    }
  }

  /**
   * Helper: Get all events in time range with category and calendar details
   */
  async getEventsWithDetails({
    timeRange,
    categoryId,
  }: {
    timeRange: TimeRange;
    categoryId?: string;
  }): Promise<EventWithCategory[]> {
    let query = this.db
      .select({
        // Event fields
        id: events.id,
        calendarId: events.calendarId,
        title: events.title,
        description: events.description,
        eventType: events.eventType,
        isAllDay: events.isAllDay,
        start: events.start,
        end: events.end,
        effectiveDuration: events.effectiveDuration,
        categoryId: events.categoryId,
        isManuallyCategorized: events.isManuallyCategorized,
        updatedAt: events.updatedAt,
        createdAt: events.createdAt,
        // Category fields
        categoryName: categories.name,
        categoryColor: categories.color,
        categoryParentId: categories.parentCategoryId,
        // Calendar fields
        calendarTitle: calendars.title,
      })
      .from(events)
      .leftJoin(categories, eq(events.categoryId, categories.id))
      .leftJoin(calendars, eq(events.calendarId, calendars.id));

    const conditions = [
      eq(events.isAllDay, false),
      gte(events.start, timeRange.start),
      lte(events.start, new Date()),
      lte(events.end, timeRange.end),
    ];

    if (categoryId) {
      conditions.push(
        categoryId === UNCATEGORIZED_CATEGORY.id
          ? isNull(events.categoryId)
          : eq(events.categoryId, categoryId)
      );
    }

    const results = await query.where(and(...conditions));

    return results.map((row) => ({
      id: row.id,
      calendarId: row.calendarId,
      title: row.title,
      description: row.description,
      eventType: row.eventType,
      isAllDay: row.isAllDay,
      start: row.start,
      end: row.end,
      effectiveDuration: row.effectiveDuration,
      categoryId: row.categoryId,
      isManuallyCategorized: row.isManuallyCategorized,
      updatedAt: row.updatedAt,
      createdAt: row.createdAt,
      category: row.categoryId
        ? {
            id: row.categoryId,
            name: row.categoryName!,
            color: row.categoryColor!,
            parentCategoryId: row.categoryParentId,
          }
        : null,
      calendar: row.calendarTitle
        ? {
            id: row.calendarId,
            title: row.calendarTitle,
          }
        : null,
    }));
  }

  /**
   * Build category reports with hierarchical aggregation
   */
  private async buildCategoryReports(
    categoryTree: CategoryWithChildren[],
    allEvents: EventWithCategory[]
  ): Promise<CategoryReport[]> {
    const reports: CategoryReport[] = [];

    for (const category of categoryTree) {
      const report = await this.buildSingleCategoryReport(category, allEvents);
      reports.push(report);
    }

    return reports;
  }

  /**
   * Build a single category report with recursive aggregation
   */
  private async buildSingleCategoryReport(
    category: CategoryWithChildren,
    allEvents: EventWithCategory[]
  ): Promise<CategoryReport> {
    // Get direct events for this category
    const directEvents = allEvents.filter(
      (event) =>
        event.categoryId === category.id ||
        (event.categoryId === null && category.id === UNCATEGORIZED_CATEGORY.id)
    );
    const directDuration = this.sumDuration(directEvents);

    // Build child reports recursively
    const childReports = await this.buildCategoryReports(category.children, allEvents);

    // Calculate totals including children
    const childrenTotalDuration = childReports.reduce((sum, child) => sum + child.totalDuration, 0);
    const childrenTotalEvents = childReports.reduce((sum, child) => sum + child.totalEventCount, 0);

    const categoryPath = (await this.categoryService.getCategoryPath(category.id)).map(
      (c) => c.name
    );

    if (directDuration > 0 && childReports.length > 0) {
      // We insert a dummy child for the direct events
      childReports.unshift({
        category,
        isDummyParent: true,
        directDuration,
        totalDuration: directDuration,
        eventCount: directEvents.length,
        totalEventCount: directEvents.length,
        children: [],
        categoryPath,
      });
    }

    return {
      category,
      directDuration,
      totalDuration: directDuration + childrenTotalDuration,
      eventCount: directEvents.length,
      totalEventCount: directEvents.length + childrenTotalEvents,
      children: childReports,
      categoryPath,
    };
  }

  /**
   * Build a category with its children structure
   */
  private async buildSingleCategoryWithChildren(category: Category): Promise<CategoryWithChildren> {
    const children = await this.categoryService.getCategoriesByParent(category.id);
    const childrenWithDescendants: CategoryWithChildren[] = [];

    for (const child of children) {
      const childWithDescendants = await this.buildSingleCategoryWithChildren(child);
      childrenWithDescendants.push(childWithDescendants);
    }

    return {
      ...category,
      children: childrenWithDescendants,
    };
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(
    allEvents: EventWithCategory[],
    categoryReports: CategoryReport[]
  ): ReportSummary {
    const totalDuration = this.sumDuration(allEvents);
    const totalEvents = allEvents.length;

    const categorizedEvents = allEvents.filter((event) => event.categoryId);
    const categorizedDuration = this.sumDuration(categorizedEvents);

    const uncategorizedEvents = allEvents.filter((event) => !event.categoryId);
    const uncategorizedDuration = this.sumDuration(uncategorizedEvents);

    return {
      totalDuration,
      totalEvents,
      categorizedDuration,
      categorizedEvents: categorizedEvents.length,
      uncategorizedDuration,
      uncategorizedEvents: uncategorizedEvents.length,
      categoryBreakdown: categoryReports,
    };
  }

  /**
   * Sum effective duration of events (in minutes)
   */
  private sumDuration(events: EventWithCategory[]): number {
    return events.reduce((sum, event) => sum + (event.effectiveDuration || 0), 0);
  }

  /**
   * Format duration for display (converts minutes to hours/minutes)
   */
  static formatDuration(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours === 0) {
      return `${remainingMinutes}m`;
    } else if (remainingMinutes === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${remainingMinutes}m`;
    }
  }

  /**
   * Create common time ranges
   */
  static getTimeRanges() {
    const now = new Date();

    return {
      today: {
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
        end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
      },
      thisWeek: {
        start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()),
        end: new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - now.getDay() + 6,
          23,
          59,
          59
        ),
      },
      thisMonth: {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
      },
      lastMonth: {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
      },
      last7Days: {
        start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        end: now,
      },
      last30Days: {
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        end: now,
      },
    };
  }
}
