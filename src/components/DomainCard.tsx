import React from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Domain, SecurityStatus, SpamhausStatus } from '../types/domain';
import { getStatusColor } from '../utils/domainUtils';

interface DomainCardProps {
  domain: Domain;
  onRemove: () => void;
  onCheck: () => void;
}

export const DomainCard: React.FC<DomainCardProps> = ({ domain, onRemove, onCheck }) => {
  const securityStatusColor = getStatusColor(domain.securityStatus);
  const spamhausStatusColor = domain.spamhausStatus === SpamhausStatus.Safe ? 'bg-green-500' : 'bg-red-500';
  
  const getStatusText = (status: SecurityStatus): string => {
    switch (status) {
      case SecurityStatus.Safe:
        return '安全';
      case SecurityStatus.Unsafe:
        return '不安全';
      case SecurityStatus.PartiallySafe:
        return '部分不安全';
      case SecurityStatus.Unknown:
        return '检查中...';
      default:
        return '未知';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden transition-all hover:shadow-md">
      <div className="p-6">
        <div className="flex justify-between items-start">
          <h2 className="text-xl font-semibold truncate" title={domain.name}>
            {domain.name}
          </h2>
          <div className="flex space-x-2">
            <button 
              onClick={onCheck}
              className="text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
              title="立即检查"
            >
              <RefreshCw size={18} className={domain.isChecking ? "animate-spin" : ""} />
            </button>
            <button 
              onClick={onRemove}
              className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
              title="删除域名"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
        
        <div className="mt-4 space-y-3">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300 w-28">谷歌安全状态:</span>
            <div className="flex items-center">
              <span className={`inline-block w-3 h-3 rounded-full ${securityStatusColor} mr-2`}></span>
              <span className="text-sm">{getStatusText(domain.securityStatus)}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300 w-28">Spamhaus状态:</span>
            <div className="flex items-center">
              <span className={`inline-block w-3 h-3 rounded-full ${spamhausStatusColor} mr-2`}></span>
              <span className="text-sm">{domain.spamhausStatus === SpamhausStatus.Safe ? '未被列入黑名单' : '已被列入黑名单'}</span>
            </div>
          </div>
          
          {domain.lastChecked && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              上次检查: {new Date(domain.lastChecked).toLocaleString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};