import React, { useState, useEffect } from 'react';
import { DomainList } from './DomainList';
import { useDomainStore } from '../hooks/useDomainStore';
import { useToast } from './ui/Toast';

export const DomainDashboard: React.FC = () => {
  const [domainName, setDomainName] = useState('');
  const [isValid, setIsValid] = useState(true);
  const { domains, checkAllDomains, lastChecked, addDomain } = useDomainStore();
  const { showToast } = useToast();
  
  const validateDomain = (domain: string): boolean => {
    const pattern = /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    return pattern.test(domain);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!domainName.trim() || !validateDomain(domainName)) {
      setIsValid(false);
      return;
    }
    
    addDomain(domainName.trim());
    showToast({
      title: '添加成功',
      message: `${domainName} 已添加到监控列表`,
      type: 'success'
    });
    setDomainName('');
    setIsValid(true);
  };

  // 每15分钟检查一次
  useEffect(() => {
    checkAllDomains();
    
    const interval = setInterval(() => {
      checkAllDomains();
      showToast({
        title: '安全检查',
        message: '已完成所有域名的谷歌安全状态检查',
        type: 'info'
      });
    }, 15 * 60 * 1000); // 15分钟
    
    return () => clearInterval(interval);
  }, [checkAllDomains, showToast]);

  return (
    <div className="container mx-auto py-8 px-4">
      <header className="mb-8">
        <h1 className="text-3xl font-bold mb-6">域名安全监控</h1>
        
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={domainName}
                onChange={(e) => {
                  setDomainName(e.target.value);
                  setIsValid(e.target.value.trim() === '' || validateDomain(e.target.value));
                }}
                placeholder="输入域名 (example.com)"
                className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 
                  ${isValid 
                    ? 'border-gray-300 focus:ring-blue-500 dark:border-gray-600' 
                    : 'border-red-500 focus:ring-red-500'}`}
              />
              {!isValid && (
                <p className="text-red-500 text-sm mt-1">请输入有效的域名</p>
              )}
            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              添加域名
            </button>
          </div>
        </form>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <p className="text-gray-600 dark:text-gray-400">
            正在监控 {domains.length} 个域名
            {domains.length > 0 && domains.map(domain => domain.name).join(', ')}
          </p>
          {lastChecked && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              上次检查时间: {new Date(lastChecked).toLocaleTimeString()}
            </p>
          )}
        </div>
      </header>
      
      <DomainList />
    </div>
  );
};