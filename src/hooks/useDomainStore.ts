import { useState, useCallback, useEffect, useRef } from 'react';
import { Domain, SecurityStatus, SpamhausStatus, DomainHistoryEntry } from '../types/domain';
import { checkDomainSecurity, checkSpamhausStatus } from '../services/securityCheckService';

// 自动检测间隔（15分钟）
const AUTO_CHECK_INTERVAL = 15 * 60 * 1000;

// 本地存储键
const STORAGE_KEY = 'domain-monitor-list';

export const useDomainStore = () => {
  // 使用 useRef 来保存定时器引用
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialCheckRef = useRef(false);

  // 从本地存储加载域名列表
  const [domains, setDomains] = useState<Domain[]>(() => {
    if (typeof window !== 'undefined') {
      const savedDomains = localStorage.getItem(STORAGE_KEY);
      return savedDomains ? JSON.parse(savedDomains) : [];
    }
    return [];
  });
  
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkStatus, setCheckStatus] = useState<string>('');

  // 保存域名列表到本地存储
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(domains));
    }
  }, [domains]);

  // 清理定时器
  const clearCheckInterval = useCallback(() => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
  }, []);

  // Add a new domain
  const addDomain = useCallback(async (domainName: string) => {
    const normalizedDomain = domainName.toLowerCase().trim();
    
    // Check if domain already exists
    if (domains.some(domain => domain.name.toLowerCase() === normalizedDomain)) {
      setCheckStatus(`域名 ${normalizedDomain} 已存在，无需重复添加`);
      return;
    }
    
    setCheckStatus(`正在添加域名: ${normalizedDomain}`);
    
    const newDomain: Domain = {
      id: Date.now().toString(),
      name: normalizedDomain,
      securityStatus: SecurityStatus.Unknown,
      spamhausStatus: SpamhausStatus.Unknown,
      lastChecked: null,
      isChecking: true,
      history: []
    };
    
    // 先添加到列表
    setDomains(prev => {
      const newDomains = [...prev, newDomain];
      // 立即保存到本地存储
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newDomains));
      }
      return newDomains;
    });
    
    try {
      setCheckStatus(`正在检查域名 ${normalizedDomain} 的安全状态...`);
      
      // 立即检查新域名
      const [securityStatus, spamhausStatus] = await Promise.all([
        checkDomainSecurity(normalizedDomain),
        checkSpamhausStatus(normalizedDomain)
      ]);
      
      setCheckStatus(`域名 ${normalizedDomain} 检查完成:
        安全状态: ${securityStatus}
        Spamhaus状态: ${spamhausStatus}`);
      
      // 更新域名状态
      setDomains(prev => {
        const updatedDomains = prev.map(domain => 
          domain.name === normalizedDomain
            ? {
                ...domain,
                securityStatus,
                spamhausStatus,
                lastChecked: Date.now(),
                isChecking: false,
                history: [{
                  timestamp: Date.now(),
                  securityStatus,
                  spamhausStatus
                }]
              }
            : domain
        );
        // 立即保存到本地存储
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDomains));
        }
        return updatedDomains;
      });
      
      setLastChecked(Date.now());
    } catch (error) {
      console.error('检查新域名时出错:', error);
      setCheckStatus(`检查域名 ${normalizedDomain} 时出错: ${error.message}`);
      
      // 更新为未知状态
      setDomains(prev => {
        const updatedDomains = prev.map(domain => 
          domain.name === normalizedDomain
            ? {
                ...domain,
                securityStatus: SecurityStatus.Unknown,
                spamhausStatus: SpamhausStatus.Unknown,
                lastChecked: Date.now(),
                isChecking: false
              }
            : domain
        );
        // 立即保存到本地存储
        if (typeof window !== 'undefined') {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDomains));
        }
        return updatedDomains;
      });
    }
  }, [domains]);

  // Remove a domain
  const removeDomain = useCallback((domainId: string) => {
    const domain = domains.find(d => d.id === domainId);
    if (domain) {
      setCheckStatus(`已移除域名: ${domain.name}`);
    }
    setDomains(prev => {
      const newDomains = prev.filter(domain => domain.id !== domainId);
      // 立即保存到本地存储
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newDomains));
      }
      return newDomains;
    });
  }, [domains]);

  // Update domain status
  const updateDomainStatus = useCallback((
    domainId: string, 
    securityStatus: SecurityStatus,
    spamhausStatus: SpamhausStatus
  ) => {
    const timestamp = Date.now();
    
    setDomains(prev => {
      const updatedDomains = prev.map(domain => {
        if (domain.id === domainId) {
          // Create history entry
          const historyEntry: DomainHistoryEntry = {
            timestamp,
            securityStatus,
            spamhausStatus
          };
          
          // Only add history entry if status changed
          const history = 
            domain.securityStatus !== securityStatus || 
            domain.spamhausStatus !== spamhausStatus
              ? [...domain.history, historyEntry].slice(-20) // Keep only last 20 entries
              : domain.history;
          
          setCheckStatus(`更新域名 ${domain.name} 状态:
            安全状态: ${securityStatus}
            Spamhaus状态: ${spamhausStatus}`);
          
          return {
            ...domain,
            securityStatus,
            spamhausStatus,
            lastChecked: timestamp,
            isChecking: false,
            history
          };
        }
        return domain;
      });
      
      // 立即保存到本地存储
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDomains));
      }
      
      return updatedDomains;
    });
    
    setLastChecked(timestamp);
  }, []);

  // Check a specific domain
  const checkDomain = useCallback(async (domainId: string) => {
    // Set domain to "checking" state
    setDomains(prev => {
      const updatedDomains = prev.map(domain => 
        domain.id === domainId ? { ...domain, isChecking: true } : domain
      );
      // 立即保存到本地存储
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDomains));
      }
      return updatedDomains;
    });
    
    // Find the domain to check
    const domainToCheck = domains.find(d => d.id === domainId);
    if (!domainToCheck) {
      setCheckStatus(`未找到域名 ID: ${domainId}`);
      return;
    }
    
    try {
      setCheckStatus(`开始检查域名: ${domainToCheck.name}`);
      
      // 并行检查两个状态
      const [securityStatus, spamhausStatus] = await Promise.all([
        checkDomainSecurity(domainToCheck.name),
        checkSpamhausStatus(domainToCheck.name)
      ]);
      
      setCheckStatus(`域名 ${domainToCheck.name} 检查完成:
        安全状态: ${securityStatus}
        Spamhaus状态: ${spamhausStatus}`);
      
      updateDomainStatus(domainId, securityStatus, spamhausStatus);
    } catch (error) {
      console.error('检查域名时出错:', error);
      setCheckStatus(`检查域名 ${domainToCheck.name} 时出错: ${error.message}`);
      
      // Set to unknown on error
      updateDomainStatus(domainId, SecurityStatus.Unknown, SpamhausStatus.Unknown);
    }
  }, [domains, updateDomainStatus]);

  // Check all domains
  const checkAllDomains = useCallback(async () => {
    if (isChecking) {
      setCheckStatus('已有检查正在进行中，跳过本次检查');
      return;
    }
    
    if (domains.length === 0) {
      setCheckStatus('没有需要检查的域名');
      return;
    }
    
    setCheckStatus(`开始检查所有域名，共 ${domains.length} 个`);
    setIsChecking(true);
    
    try {
      // 串行检查所有域名，避免并发请求过多
      for (const domain of domains) {
        setCheckStatus(`正在检查域名: ${domain.name}`);
        await checkDomain(domain.id);
      }
      setCheckStatus('所有域名检查完成');
    } catch (error) {
      console.error('批量检查域名时出错:', error);
      setCheckStatus(`批量检查域名时出错: ${error.message}`);
    } finally {
      setIsChecking(false);
    }
  }, [domains, checkDomain, isChecking]);

  // 自动检查
  useEffect(() => {
    // 只在组件挂载时执行一次初始检查
    if (!isInitialCheckRef.current && domains.length > 0) {
      isInitialCheckRef.current = true;
      setCheckStatus('执行初始域名安全检查');
      checkAllDomains();
    }
    
    // 清理之前的定时器
    clearCheckInterval();
    
    // 设置新的定时器
    if (domains.length > 0) {
      checkIntervalRef.current = setInterval(() => {
        setCheckStatus('执行定期域名安全检查');
        checkAllDomains();
      }, AUTO_CHECK_INTERVAL);
    }
    
    // 组件卸载时清理定时器
    return () => {
      clearCheckInterval();
    };
  }, [checkAllDomains, domains.length, clearCheckInterval]);

  return {
    domains,
    addDomain,
    removeDomain,
    checkDomain,
    checkAllDomains,
    lastChecked,
    isChecking,
    checkStatus
  };
};