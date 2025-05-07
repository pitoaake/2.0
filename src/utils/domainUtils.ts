import { SecurityStatus } from '../types/domain';

/**
 * Get the CSS class for the status indicator based on security status
 */
export const getStatusColor = (status: SecurityStatus): string => {
  switch (status) {
    case SecurityStatus.Safe:
      return 'bg-green-500';
    case SecurityStatus.Unsafe:
      return 'bg-red-500';
    case SecurityStatus.PartiallySafe:
      return 'bg-yellow-500';
    case SecurityStatus.Unknown:
      return 'bg-purple-500';
    default:
      return 'bg-gray-500';
  }
};

/**
 * Format a timestamp into a readable date string
 */
export const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString();
};

/**
 * Validate a domain name format
 */
export const isValidDomain = (domain: string): boolean => {
  const pattern = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
  return pattern.test(domain);
};