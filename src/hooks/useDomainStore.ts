import { useState, useCallback, useEffect } from 'react';
import { Domain, SecurityStatus, SpamhausStatus, DomainHistoryEntry } from '../types/domain';
import { checkDomainSecurity, checkSpamhausStatus } from '../services/securityCheckService';

// Local storage key
const STORAGE_KEY = 'domain-security-monitor-domains';

// 自动检测间隔（15分钟）
const AUTO_CHECK_INTERVAL = 15 * 60 * 1000;

export const useDomainStore = () => {
  const [domains, setDomains] = useState<Domain[]>(() => {
    // Load from localStorage on initialization
    const savedDomains = localStorage.getItem(STORAGE_KEY);
    return savedDomains ? JSON.parse(savedDomains) : [];
  });
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Save to localStorage whenever domains change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(domains));
  }, [domains]);

  // Add a new domain
  const addDomain = useCallback((domainName: string) => {
    const normalizedDomain = domainName.toLowerCase().trim();
    
    // Check if domain already exists
    if (domains.some(domain => domain.name.toLowerCase() === normalizedDomain)) {
      return;
    }
    
    const newDomain: Domain = {
      id: Date.now().toString(),
      name: normalizedDomain,
      securityStatus: SecurityStatus.Unknown,
      spamhausStatus: SpamhausStatus.Safe,
      lastChecked: null,
      isChecking: true,
      history: []
    };
    
    setDomains(prev => [...prev, newDomain]);
    
    // Trigger a check for the new domain
    setTimeout(() => {
      checkDomain(newDomain.id);
    }, 500);
  }, [domains]);

  // Remove a domain
  const removeDomain = useCallback((domainId: string) => {
    setDomains(prev => prev.filter(domain => domain.id !== domainId));
  }, []);

  // Update domain status
  const updateDomainStatus = useCallback((
    domainId: string, 
    securityStatus: SecurityStatus,
    spamhausStatus: SpamhausStatus
  ) => {
    const timestamp = Date.now();
    
    setDomains(prev => prev.map(domain => {
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
    }));
    
    setLastChecked(timestamp);
  }, []);

  // Check a specific domain
  const checkDomain = useCallback(async (domainId: string) => {
    // Set domain to "checking" state
    setDomains(prev => prev.map(domain => 
      domain.id === domainId ? { ...domain, isChecking: true } : domain
    ));
    
    // Find the domain to check
    const domainToCheck = domains.find(d => d.id === domainId);
    if (!domainToCheck) return;
    
    try {
      // 并行检查两个状态
      const [securityStatus, spamhausStatus] = await Promise.all([
        checkDomainSecurity(domainToCheck.name),
        checkSpamhausStatus(domainToCheck.name)
      ]);
      
      updateDomainStatus(domainId, securityStatus, spamhausStatus);
    } catch (error) {
      console.error('检查域名时出错:', error);
      
      // Set to unknown on error
      updateDomainStatus(domainId, SecurityStatus.Unknown, SpamhausStatus.Safe);
    }
  }, [domains, updateDomainStatus]);

  // Check all domains
  const checkAllDomains = useCallback(async () => {
    if (isChecking) return;
    
    setIsChecking(true);
    try {
      // 串行检查所有域名，避免并发请求过多
      for (const domain of domains) {
        await checkDomain(domain.id);
      }
    } catch (error) {
      console.error('批量检查域名时出错:', error);
    } finally {
      setIsChecking(false);
    }
  }, [domains, checkDomain, isChecking]);

  // 自动检查
  useEffect(() => {
    // 立即执行一次检查
    checkAllDomains();
    
    // 设置定时器
    const interval = setInterval(checkAllDomains, AUTO_CHECK_INTERVAL);
    
    // 清理定时器
    return () => clearInterval(interval);
  }, [checkAllDomains]);

  return {
    domains,
    addDomain,
    removeDomain,
    checkDomain,
    checkAllDomains,
    lastChecked,
    isChecking
  };
};