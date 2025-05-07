/**
 * 域名安全状态枚举
 */
export enum SecurityStatus {
  Safe = 'safe',
  Unsafe = 'unsafe',
  PartiallySafe = 'partially_safe',
  Unknown = 'unknown'
}

/**
 * Spamhaus 状态枚举
 */
export enum SpamhausStatus {
  Safe = 'safe',
  Blacklisted = 'blacklisted',
  Unknown = 'unknown'
}

/**
 * 域名信息接口
 */
export interface Domain {
  id: string;
  name: string;
  securityStatus: SecurityStatus;
  spamhausStatus: SpamhausStatus;
  lastChecked: number | null;
  isChecking: boolean;
  checkStatus?: string;
}

/**
 * 域名检查结果接口
 */
export interface DomainCheckResult {
  domain: string;
  securityStatus: SecurityStatus;
  spamhausStatus: SpamhausStatus;
  checkTime: number;
  error?: string;
}

/**
 * 域名状态更新接口
 */
export interface DomainStatusUpdate {
  id: string;
  securityStatus?: SecurityStatus;
  spamhausStatus?: SpamhausStatus;
  lastChecked?: number;
  isChecking?: boolean;
  checkStatus?: string;
}