import React from 'react';
import { DomainCard } from './DomainCard';
import { useDomainStore } from '../hooks/useDomainStore';
import { Domain } from '../types/domain';

export const DomainList: React.FC = () => {
  const { domains, removeDomain, checkDomain } = useDomainStore();

  if (domains.length === 0) {
    return (
      <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
        <p className="text-gray-500 dark:text-gray-400">
          还没有添加域名。添加域名开始监控。
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {domains.map((domain: Domain) => (
        <DomainCard
          key={domain.id}
          domain={domain}
          onRemove={() => removeDomain(domain.id)}
          onCheck={() => checkDomain(domain.id)}
        />
      ))}
    </div>
  );
};