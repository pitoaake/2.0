import React, { useState, useCallback, ChangeEvent } from 'react';
import { useDomainStore } from '../hooks/useDomainStore';
import { DomainCard } from './DomainCard';
import { isValidDomain, formatDomain } from '../utils/domainUtils';
import { SecurityStatus, SpamhausStatus, Domain } from '../types/domain';
import { getStatusColor } from '../utils/domainUtils';
import { toast } from 'react-hot-toast';

export const DomainDashboard: React.FC = () => {
  const [domainName, setDomainName] = useState('');
  const [isValid, setIsValid] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  
  const {
    domains,
    addDomain,
    removeDomain,
    checkDomain,
    batchCheckDomains,
    lastChecked,
    isChecking,
    checkStatus
  } = useDomainStore();

  // 添加日志
  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev: string[]) => [`[${timestamp}] ${message}`, ...prev].slice(0, 100));
  }, []);

  // 显示提示
  const showToast = useCallback(({ title, message, type }: { title: string; message: string; type: 'success' | 'error' | 'info' }) => {
    toast[type](message, {
      duration: 3000,
      position: 'top-right',
    });
  }, []);

  // 处理表单提交
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isValid) {
      showToast({
        title: '输入错误',
        message: '请输入有效的域名',
        type: 'error'
      });
      return;
    }

    try {
      addLog(`正在添加域名: ${domainName}`);
      await addDomain(domainName);
      setDomainName('');
      setIsValid(true);
      
      showToast({
        title: '添加成功',
        message: `已添加域名 ${domainName}`,
        type: 'success'
      });
    } catch (error) {
      showToast({
        title: '添加失败',
        message: error instanceof Error ? error.message : '添加域名时出错',
        type: 'error'
      });
    }
  }, [domainName, isValid, addDomain, addLog, showToast]);

  // 处理域名检查
  const handleCheck = useCallback(async (domainId: string) => {
    try {
      addLog(`开始检查域名 ID: ${domainId}`);
      await checkDomain(domainId);
      showToast({
        title: '检查完成',
        message: '域名安全检查已完成',
        type: 'info'
      });
    } catch (error) {
      showToast({
        title: '检查失败',
        message: error instanceof Error ? error.message : '检查域名时出错',
        type: 'error'
      });
    }
  }, [checkDomain, addLog, showToast]);

  // 处理域名删除
  const handleRemove = useCallback((domainId: string) => {
    try {
      const domain = domains.find((d: Domain) => d.id === domainId);
      if (domain) {
        addLog(`已移除域名: ${domain.name}`);
        removeDomain(domainId);
        showToast({
          title: '删除成功',
          message: `已删除域名 ${domain.name}`,
          type: 'success'
        });
      }
    } catch (error) {
      showToast({
        title: '删除失败',
        message: error instanceof Error ? error.message : '删除域名时出错',
        type: 'error'
      });
    }
  }, [domains, removeDomain, addLog, showToast]);

  // 监听检查状态变化
  React.useEffect(() => {
    if (checkStatus) {
      addLog(checkStatus);
    }
  }, [checkStatus, addLog]);

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
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setDomainName(e.target.value);
                  setIsValid(e.target.value.trim() === '' || isValidDomain(e.target.value));
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

        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            正在监控 {domains.length} 个域名
            {domains.length > 0 && domains.map((d: Domain) => d.name).join(', ')}
          </div>
          {lastChecked && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              上次检查时间: {new Date(lastChecked).toLocaleTimeString()}
            </div>
          )}
        </div>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {domains.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500 dark:text-gray-400">
            还没有添加域名。添加域名开始监控。
          </div>
        ) : (
          domains.map((domain: Domain) => (
            <DomainCard
              key={domain.id}
              domain={domain}
              onRemove={() => handleRemove(domain.id)}
              onCheck={() => handleCheck(domain.id)}
            />
          ))
        )}
      </main>

      <section className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h2 className="text-lg font-semibold mb-4">运行日志</h2>
        <div className="h-64 overflow-y-auto font-mono text-sm">
          {logs.map((log: string, index: number) => (
            <div key={index} className="py-1">
              {log}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};