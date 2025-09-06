import type { DrizzleDB } from '@/db/SQLiteProvider';
import { events, categories, type DBEvent, type Category } from '@/db/schema';
import type { CategoryRule } from '@/types/category_rule';
import { eq, isNull, desc, and, or, inArray } from 'drizzle-orm';

export interface CategorizationResult {
  eventId: string;
  categoryId: string | null;
  matchedRule?: CategoryRule;
  isManuallyCategorized?: boolean;
}

export interface CategorizationStats {
  total: number;
  categorized: number;
  uncategorized: number;
  autoCategories: { [categoryName: string]: number };
}

export class EventCategorizationService {
  private categories: Category[] | null = null;

  constructor(private db: DrizzleDB) {}

  async getCategories(refresh = false) {
    if (this.categories && !refresh) return this.categories;

    // Get all categories with rules ordered by priority (highest first)
    this.categories = await this.db
      .select()
      .from(categories)
      .orderBy(desc(categories.priority), categories.name);

    return this.categories;
  }

  /**
   * Auto-categorize a single event based on category rules
   */
  async categorizeEvent(event: DBEvent): Promise<CategorizationResult> {
    // Skip if already manually categorized
    if (event.isManuallyCategorized) {
      return {
        eventId: event.id,
        categoryId: event.categoryId,
        isManuallyCategorized: true,
      };
    }

    const categories = await this.getCategories();

    // Find the first matching category
    for (const category of categories) {
      const rules = category.rules as CategoryRule[];
      if (!rules || rules.length === 0) continue;

      for (const rule of rules) {
        if (await this.eventMatchesRule(event, rule)) {
          // Update event with the matched category
          await this.db
            .update(events)
            .set({
              categoryId: category.id,
              isManuallyCategorized: false,
            })
            .where(eq(events.id, event.id));

          return {
            eventId: event.id,
            categoryId: category.id,
            matchedRule: rule,
            isManuallyCategorized: false,
          };
        }
      }
    }

    // No match found - clear any existing auto categorization
    if (!event.isManuallyCategorized && event.categoryId) {
      await this.db
        .update(events)
        .set({
          categoryId: null,
          isManuallyCategorized: null,
        })
        .where(eq(events.id, event.id));
    }

    return {
      eventId: event.id,
      categoryId: null,
      isManuallyCategorized: false,
    };
  }

  /**
   * Manually assign a category to an event
   */
  async manuallyAssignCategory(eventId: string, categoryId: string | null): Promise<void> {
    await this.db
      .update(events)
      .set({
        categoryId,
        isManuallyCategorized: categoryId ? true : false,
      })
      .where(eq(events.id, eventId));
  }

  /**
   * Batch categorize multiple events
   */
  async categorizeEvents(eventIds?: string[]): Promise<CategorizationStats> {
    let eventsToProcess: DBEvent[];

    if (eventIds) {
      // Categorize specific events
      eventsToProcess = await this.db.select().from(events).where(inArray(events.id, eventIds));
    } else {
      // Categorize all events that are not manually categorized
      eventsToProcess = await this.db
        .select()
        .from(events)
        .where(
          or(
            eq(events.isManuallyCategorized, false), // Not manually categorized
            isNull(events.isManuallyCategorized) // Or never categorized
          )
        );
    }

    const stats: CategorizationStats = {
      total: eventsToProcess.length,
      categorized: 0,
      uncategorized: 0,
      autoCategories: {},
    };

    // Process each event
    for (const event of eventsToProcess) {
      const result = await this.categorizeEvent(event);

      if (result.categoryId) {
        stats.categorized++;
        stats.autoCategories[result.categoryId] =
          (stats.autoCategories[result.categoryId] || 0) + 1;
      } else {
        stats.uncategorized++;
      }
    }

    return stats;
  }

  /**
   * Re-categorize events when category rules change
   */
  async recategorizeEventsForCategory(categoryId: string): Promise<number> {
    // Get all events currently assigned to this category via auto-categorization
    const categoryEvents = await this.db
      .select()
      .from(events)
      .where(and(eq(events.categoryId, categoryId), eq(events.isManuallyCategorized, false)));

    let recategorizedCount = 0;

    // Clear Categorization on all events
    await this.db
      .update(events)
      .set({
        categoryId: null,
        isManuallyCategorized: null,
      })
      .where(
        inArray(
          events.id,
          categoryEvents.map((e) => e.id)
        )
      );

    // Re-process each event
    for (const event of categoryEvents) {
      // Re-categorize the event
      const updatedEvent = { ...event, categoryId: null, isManuallyCategorized: null };
      await this.categorizeEvent(updatedEvent);
      recategorizedCount++;
    }

    return recategorizedCount;
  }

  /**
   * Get categorization statistics
   */
  async getCategorizationStats(): Promise<CategorizationStats> {
    const allEvents = await this.db.select().from(events);

    const stats: CategorizationStats = {
      total: allEvents.length,
      categorized: 0,
      uncategorized: 0,
      autoCategories: {},
    };

    for (const event of allEvents) {
      if (event.categoryId) {
        stats.categorized++;

        if (!event.isManuallyCategorized) {
          stats.autoCategories[event.categoryId] =
            (stats.autoCategories[event.categoryId] || 0) + 1;
        }
      } else {
        stats.uncategorized++;
      }
    }

    return stats;
  }

  /**
   * Check if an event matches a specific rule
   */
  private async eventMatchesRule(event: DBEvent, rule: CategoryRule): Promise<boolean> {
    const title = (event.title || '');
    const rule_content = rule.content;

    switch (rule.type) {
      case 'EQUALS':
        return title === rule_content;

      case 'STARTS_WITH':
        return title.startsWith(rule_content);

      case 'ENDS_WITH':
        return title.endsWith(rule_content);

      case 'CONTAINS':
        return title.includes(rule_content);

      case 'REGEX':
        try {
          const regex = new RegExp(rule_content, 'i');
          return regex.test(event.title || '');
        } catch (error) {
          console.warn(`Invalid regex in category rule: ${rule_content}`, error);
          return false;
        }

      default:
        return false;
    }
  }
}
