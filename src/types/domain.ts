export enum SecurityStatus {
  Safe = 'safe',
  Unsafe = 'unsafe',
  PartiallySafe = 'partially_safe',
  Unknown = 'unknown'
}

export enum SpamhausStatus {
  Safe = 'safe',
  Blacklisted = 'blacklisted',
  Unknown = 'unknown'
}

export interface Domain {
  id: string;
  name: string;
  securityStatus: SecurityStatus;
  spamhausStatus: SpamhausStatus;
  lastChecked: number | null;
  isChecking: boolean;
  history: DomainHistoryEntry[];
}

export interface DomainHistoryEntry {
  timestamp: number;
  securityStatus: SecurityStatus;
  spamhausStatus: SpamhausStatus;
}