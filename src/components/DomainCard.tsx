import React from 'react';
import { Domain } from '../types/domain';
import { SecurityStatus, SpamhausStatus } from '../types/domain';

interface DomainCardProps {
  domain: Domain;
  onRemove: () => void;
  onCheck: () => void;
}

export const DomainCard: React.FC<DomainCardProps> = ({ domain, onRemove, onCheck }) => {
  // 获取安全状态样式
  const getSecurityStatusStyle = (status: SecurityStatus) => {
    switch (status) {
      case SecurityStatus.Safe:
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case SecurityStatus.Unsafe:
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case SecurityStatus.PartiallySafe:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  // 获取 Spamhaus 状态样式
  const getSpamhausStatusStyle = (status: SpamhausStatus) => {
    switch (status) {
      case SpamhausStatus.Safe:
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case SpamhausStatus.Blacklisted:
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  // 获取状态文本
  const getStatusText = (status: SecurityStatus | SpamhausStatus) => {
    switch (status) {
      case SecurityStatus.Safe:
        return '安全';
      case SecurityStatus.Unsafe:
        return '不安全';
      case SecurityStatus.PartiallySafe:
        return '部分安全';
      case SecurityStatus.Unknown:
        return '未知';
      case SpamhausStatus.Safe:
        return '未列入黑名单';
      case SpamhausStatus.Blacklisted:
        return '已列入黑名单';
      default:
        return '未知';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {domain.name}
        </h3>
        <button
          onClick={onRemove}
          className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
          title="删除域名"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">安全状态</div>
          <div className={`inline-block px-2 py-1 rounded-full text-sm ${getSecurityStatusStyle(domain.securityStatus)}`}>
            {getStatusText(domain.securityStatus)}
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Spamhaus 状态</div>
          <div className={`inline-block px-2 py-1 rounded-full text-sm ${getSpamhausStatusStyle(domain.spamhausStatus)}`}>
            {getStatusText(domain.spamhausStatus)}
          </div>
        </div>

        <div className="text-sm text-gray-500 dark:text-gray-400">
          最后检查: {domain.lastChecked ? new Date(domain.lastChecked).toLocaleString() : '未检查'}
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={onCheck}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          disabled={domain.isChecking}
        >
          {domain.isChecking ? '检查中...' : '立即检查'}
        </button>
      </div>
    </div>
  );
};