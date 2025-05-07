export enum SecurityStatus {
  Safe = 'SAFE',
  Unsafe = 'UNSAFE',
  PartiallySafe = 'PARTIALLY_SAFE',
  Unknown = 'UNKNOWN'
}

export enum SpamhausStatus {
  Safe = 'SAFE',
  Blacklisted = 'BLACKLISTED'
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