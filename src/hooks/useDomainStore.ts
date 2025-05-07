import { useState, useCallback, useEffect, useRef } from 'react';
import { Domain, SecurityStatus, SpamhausStatus, DomainHistoryEntry } from '../types/domain';
import { checkDomainSecurity, checkSpamhausStatus } from '../services/securityCheckService';

// 自动检测间隔（15分钟）
const AUTO_CHECK_INTERVAL = 15 * 60 * 1000;

// 本地存储键
const STORAGE_KEY = 'domain-monitor-list';
const LAST_CHECK_TIME_KEY = 'domain-last-check-time';

export const useDomainStore = () => {
  // 使用 useRef 来保存定时器引用和检查状态
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialCheckRef = useRef(false);
  const isCheckingRef = useRef(false);
  const lastCheckTimeRef = useRef<number | null>(null);

  // 从本地存储加载域名列表和上次检查时间
  const [domains, setDomains] = useState<Domain[]>(() => {
    if (typeof window !== 'undefined') {
      const savedDomains = localStorage.getItem(STORAGE_KEY);
      const savedLastCheckTime = localStorage.getItem(LAST_CHECK_TIME_KEY);
      if (savedLastCheckTime) {
        lastCheckTimeRef.current = parseInt(savedLastCheckTime);
      }
      return savedDomains ? JSON.parse(savedDomains) : [];
    }
    return [];
  });
  
  const [lastChecked, setLastChecked] = useState<number | null>(lastCheckTimeRef.current);
  const [isChecking, setIsChecking] = useState(false);
  const [checkStatus, setCheckStatus] = useState<string>('');

  // 保存域名列表和上次检查时间到本地存储
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(domains));
      if (lastChecked) {
        localStorage.setItem(LAST_CHECK_TIME_KEY, lastChecked.toString());
      }
    }
  }, [domains, lastChecked]);

  // 清理定时器
  const clearCheckInterval = useCallback(() => {
    if (checkIntervalRef.current) {
      clearInterval(checkIntervalRef.current);
      checkIntervalRef.current = null;
    }
  }, []);

  // 检查是否需要执行检测
  const shouldCheck = useCallback(() => {
    if (!lastCheckTimeRef.current) return true;
    const now = Date.now();
    return now - lastCheckTimeRef.current >= AUTO_CHECK_INTERVAL;
  }, []);

  // 批量检查域名
  const batchCheckDomains = useCallback(async (domainList: Domain[]) => {
    if (isCheckingRef.current) {
      console.log('已有检查正在进行中，跳过本次检查');
      return;
    }

    if (domainList.length === 0) {
      console.log('没有需要检查的域名');
      return;
    }

    try {
      isCheckingRef.current = true;
      setIsChecking(true);
      setCheckStatus(`开始批量检查 ${domainList.length} 个域名`);

      // 串行检查所有域名
      for (const domain of domainList) {
        setCheckStatus(`正在检查域名: ${domain.name}`);
        await checkDomain(domain.id);
      }

      setCheckStatus('批量检查完成');
      const now = Date.now();
      setLastChecked(now);
      lastCheckTimeRef.current = now;
    } catch (error) {
      console.error('批量检查域名时出错:', error);
      setCheckStatus(`批量检查域名时出错: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
  }, [checkDomain]);

  // 自动检查
  useEffect(() => {
    // 只在组件挂载时执行一次初始检查
    if (!isInitialCheckRef.current && domains.length > 0) {
      isInitialCheckRef.current = true;
      setCheckStatus('执行初始域名安全检查');
      batchCheckDomains(domains);
    }

    // 清理之前的定时器
    clearCheckInterval();

    // 设置新的定时器
    if (domains.length > 0) {
      checkIntervalRef.current = setInterval(() => {
        if (shouldCheck()) {
          setCheckStatus('执行定期域名安全检查');
          batchCheckDomains(domains);
        } else {
          console.log('距离上次检查未超过15分钟，跳过本次检查');
        }
      }, AUTO_CHECK_INTERVAL);
    }

    // 组件卸载时清理定时器
    return () => {
      clearCheckInterval();
    };
  }, [domains, batchCheckDomains, clearCheckInterval, shouldCheck]);

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

  return {
    domains,
    addDomain,
    removeDomain,
    checkDomain,
    batchCheckDomains,
    lastChecked,
    isChecking,
    checkStatus
  };
};