import { useState, useCallback, useEffect } from 'react';
import { Domain, SecurityStatus, SpamhausStatus, DomainHistoryEntry } from '../types/domain';
import { checkDomainSecurity, checkSpamhausStatus } from '../services/securityCheckService';

// 自动检测间隔（15分钟）
const AUTO_CHECK_INTERVAL = 15 * 60 * 1000;

export const useDomainStore = () => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkStatus, setCheckStatus] = useState<string>('');

  // Add a new domain
  const addDomain = useCallback(async (domainName: string) => {
    const normalizedDomain = domainName.toLowerCase().trim();
    
    // Check if domain already exists
    if (domains.some(domain => domain.name.toLowerCase() === normalizedDomain)) {
      setCheckStatus(`域名 ${normalizedDomain} 已存在，无需重复添加`);
      return;
    }
    
    setCheckStatus(`开始添加域名: ${normalizedDomain}`);
    
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
    setDomains(prev => [...prev, newDomain]);
    
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
      setDomains(prev => prev.map(domain => 
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
      ));
      
      setLastChecked(Date.now());
    } catch (error) {
      console.error('检查新域名时出错:', error);
      setCheckStatus(`检查域名 ${normalizedDomain} 时出错: ${error.message}`);
      
      // 更新为未知状态
      setDomains(prev => prev.map(domain => 
        domain.name === normalizedDomain
          ? {
              ...domain,
              securityStatus: SecurityStatus.Unknown,
              spamhausStatus: SpamhausStatus.Unknown,
              lastChecked: Date.now(),
              isChecking: false
            }
          : domain
      ));
    }
  }, [domains]);

  // Remove a domain
  const removeDomain = useCallback((domainId: string) => {
    const domain = domains.find(d => d.id === domainId);
    if (domain) {
      setCheckStatus(`已移除域名: ${domain.name}`);
    }
    setDomains(prev => prev.filter(domain => domain.id !== domainId));
  }, [domains]);

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
    if (domains.length > 0) {
      setCheckStatus('初始化检查所有域名');
      checkAllDomains();
    }
    
    const interval = setInterval(() => {
      if (domains.length > 0) {
        setCheckStatus('执行定期域名安全检查');
        checkAllDomains();
      }
    }, AUTO_CHECK_INTERVAL);
    
    return () => clearInterval(interval);
  }, [checkAllDomains, domains.length]);

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