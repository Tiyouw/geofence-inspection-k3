/**
 * Deklarasi minimal node:sqlite (Node 22.13+, tanpa bendera). @types/node 20 di proyek
 * ini belum memuatnya; hanya bagian yang dipakai skrip migrasi.
 */
declare module "node:sqlite" {
  export class DatabaseSync {
    constructor(path: string, options?: { readOnly?: boolean; open?: boolean });
    prepare(sql: string): { all(...params: unknown[]): unknown[]; get(...params: unknown[]): unknown; run(...params: unknown[]): unknown };
    exec(sql: string): void;
    close(): void;
  }
}
