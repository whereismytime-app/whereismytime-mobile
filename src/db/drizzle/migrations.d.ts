// TypeScript declarations for Drizzle migrations module

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

interface MigrationsExport {
  journal: Journal;
  migrations: {
    [key: string]: string;
  };
}

declare const migrations: MigrationsExport;
export default migrations;