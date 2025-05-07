import { useState, useCallback, useEffect } from 'react';
import { Domain, SecurityStatus, SpamhausStatus, DomainHistoryEntry } from '../types/domain';
import { checkDomainSecurity, checkSpamhausStatus } from '../services/securityCheckService';

// 自动检测间隔（15分钟）
const AUTO_CHECK_INTERVAL = 15 * 60 * 1000;

export const useDomainStore = () => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  // Add a new domain
  const addDomain = useCallback(async (domainName: string) => {
    const normalizedDomain = domainName.toLowerCase().trim();
    
    // Check if domain already exists
    if (domains.some(domain => domain.name.toLowerCase() === normalizedDomain)) {
      console.log(`域名 ${normalizedDomain} 已存在`);
      return;
    }
    
    console.log(`开始添加域名: ${normalizedDomain}`);
    
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
      console.log(`开始检查新添加的域名: ${normalizedDomain}`);
      
      // 立即检查新域名
      const [securityStatus, spamhausStatus] = await Promise.all([
        checkDomainSecurity(normalizedDomain),
        checkSpamhausStatus(normalizedDomain)
      ]);
      
      console.log(`域名 ${normalizedDomain} 检查完成:`, {
        securityStatus,
        spamhausStatus
      });
      
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
        
        console.log(`更新域名 ${domain.name} 状态:`, {
          securityStatus,
          spamhausStatus,
          isChecking: false
        });
        
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
      console.log(`未找到域名 ID: ${domainId}`);
      return;
    }
    
    try {
      console.log(`开始检查域名: ${domainToCheck.name}`);
      
      // 并行检查两个状态
      const [securityStatus, spamhausStatus] = await Promise.all([
        checkDomainSecurity(domainToCheck.name),
        checkSpamhausStatus(domainToCheck.name)
      ]);
      
      console.log(`域名 ${domainToCheck.name} 检查完成:`, {
        securityStatus,
        spamhausStatus
      });
      
      updateDomainStatus(domainId, securityStatus, spamhausStatus);
    } catch (error) {
      console.error('检查域名时出错:', error);
      
      // Set to unknown on error
      updateDomainStatus(domainId, SecurityStatus.Unknown, SpamhausStatus.Unknown);
    }
  }, [domains, updateDomainStatus]);

  // Check all domains
  const checkAllDomains = useCallback(async () => {
    if (isChecking) {
      console.log('已有检查正在进行中，跳过本次检查');
      return;
    }
    
    if (domains.length === 0) {
      console.log('没有需要检查的域名');
      return;
    }
    
    console.log(`开始检查所有域名，共 ${domains.length} 个`);
    setIsChecking(true);
    
    try {
      // 串行检查所有域名，避免并发请求过多
      for (const domain of domains) {
        console.log(`检查域名: ${domain.name}`);
        await checkDomain(domain.id);
      }
      console.log('所有域名检查完成');
    } catch (error) {
      console.error('批量检查域名时出错:', error);
    } finally {
      setIsChecking(false);
    }
  }, [domains, checkDomain, isChecking]);

  // 自动检查
  useEffect(() => {
    if (domains.length > 0) {
      console.log('初始化检查所有域名');
      checkAllDomains();
    }
    
    const interval = setInterval(() => {
      if (domains.length > 0) {
        console.log('执行定期域名安全检查');
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
    isChecking
  };
};