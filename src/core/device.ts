/** Outcome of handing a file to the user. */
export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

/**
 * Browser facts and actions the UI needs. Core declares the interface;
 * platform implements it (SPEC 3.2).
 */
export interface Device {
  /** Share sheet where it accepts files (iOS: Save to Files), else a download. */
  saveFile(name: string, text: string): Promise<SaveResult>;
  /** Running as an installed app rather than in a browser tab (SPEC 18). */
  isStandalone(): boolean;
  /**
   * Answers this browser has seen before, from a marker kept outside the
   * database, to notice when the database was wiped (SPEC 19).
   */
  readUsage(): number;
  writeUsage(answers: number): void;
  reload(): void;
}
