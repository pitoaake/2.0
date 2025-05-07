import { useState, useCallback, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Domain, SecurityStatus, SpamhausStatus, DomainStatusUpdate } from '../types/domain';
import { checkWithGoogleSafeBrowsing } from '../services/securityCheckService';
import { formatDomain } from '../utils/domainUtils';

const STORAGE_KEY = 'monitored_domains';
const AUTO_CHECK_INTERVAL = 15 * 60 * 1000; // 15分钟

export const useDomainStore = () => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkStatus, setCheckStatus] = useState<string>('');
  
  const isCheckingRef = useRef(false);
  const lastCheckTimeRef = useRef<number | null>(null);

  // 从本地存储加载域名列表
  useEffect(() => {
    try {
      const savedDomains = localStorage.getItem(STORAGE_KEY);
      if (savedDomains) {
        setDomains(JSON.parse(savedDomains));
      }
    } catch (error) {
      console.error('加载域名列表失败:', error);
    }
  }, []);

  // 保存域名列表到本地存储
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(domains));
    } catch (error) {
      console.error('保存域名列表失败:', error);
    }
  }, [domains]);

  // 更新域名状态
  const updateDomainStatus = useCallback((update: DomainStatusUpdate) => {
    setDomains(prev => prev.map(domain => 
      domain.id === update.id
        ? { ...domain, ...update }
        : domain
    ));
  }, []);

  // 添加域名
  const addDomain = useCallback(async (domainName: string) => {
    const formattedName = formatDomain(domainName);
    
    // 检查域名是否已存在
    if (domains.some(d => d.name === formattedName)) {
      throw new Error('该域名已在监控列表中');
    }

    const newDomain: Domain = {
      id: uuidv4(),
      name: formattedName,
      securityStatus: SecurityStatus.Unknown,
      spamhausStatus: SpamhausStatus.Unknown,
      lastChecked: null,
      isChecking: true,
      checkStatus: '正在检查域名...'
    };

    setDomains(prev => [...prev, newDomain]);
    setCheckStatus(`正在检查域名: ${formattedName}`);

    try {
      const result = await checkWithGoogleSafeBrowsing(formattedName);
      
      updateDomainStatus({
        id: newDomain.id,
        securityStatus: result.securityStatus,
        spamhausStatus: result.spamhausStatus,
        lastChecked: Date.now(),
        isChecking: false,
        checkStatus: undefined
      });

      setLastChecked(Date.now());
      setCheckStatus(`域名 ${formattedName} 检查完成`);
    } catch (error) {
      updateDomainStatus({
        id: newDomain.id,
        isChecking: false,
        checkStatus: error instanceof Error ? error.message : '检查失败'
      });
      throw error;
    }
  }, [domains, updateDomainStatus]);

  // 删除域名
  const removeDomain = useCallback((domainId: string) => {
    setDomains(prev => prev.filter(d => d.id !== domainId));
  }, []);

  // 检查单个域名
  const checkDomain = useCallback(async (domainId: string) => {
    const domain = domains.find(d => d.id === domainId);
    if (!domain) return;

    if (isCheckingRef.current) {
      throw new Error('已有检查正在进行中');
    }

    isCheckingRef.current = true;
    updateDomainStatus({
      id: domainId,
      isChecking: true,
      checkStatus: '正在检查域名...'
    });

    try {
      const result = await checkWithGoogleSafeBrowsing(domain.name);
      
      updateDomainStatus({
        id: domainId,
        securityStatus: result.securityStatus,
        spamhausStatus: result.spamhausStatus,
        lastChecked: Date.now(),
        isChecking: false,
        checkStatus: undefined
      });

      setLastChecked(Date.now());
      setCheckStatus(`域名 ${domain.name} 检查完成`);
    } catch (error) {
      updateDomainStatus({
        id: domainId,
        isChecking: false,
        checkStatus: error instanceof Error ? error.message : '检查失败'
      });
      throw error;
    } finally {
      isCheckingRef.current = false;
    }
  }, [domains, updateDomainStatus]);

  // 批量检查域名
  const batchCheckDomains = useCallback(async () => {
    if (isCheckingRef.current) {
      throw new Error('已有检查正在进行中');
    }

    isCheckingRef.current = true;
    setIsChecking(true);
    setCheckStatus('开始批量检查域名...');

    try {
      for (const domain of domains) {
        await checkDomain(domain.id);
      }
      setLastChecked(Date.now());
      setCheckStatus('所有域名检查完成');
    } catch (error) {
      setCheckStatus(error instanceof Error ? error.message : '批量检查失败');
      throw error;
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
  }, [domains, checkDomain]);

  // 自动检查定时器
  useEffect(() => {
    const shouldCheck = () => {
      if (!lastCheckTimeRef.current) return true;
      return Date.now() - lastCheckTimeRef.current >= AUTO_CHECK_INTERVAL;
    };

    const checkInterval = setInterval(() => {
      if (shouldCheck() && !isCheckingRef.current) {
        batchCheckDomains().catch(console.error);
        lastCheckTimeRef.current = Date.now();
      }
    }, AUTO_CHECK_INTERVAL);

    return () => clearInterval(checkInterval);
  }, [batchCheckDomains]);

  return {
    domains,
    lastChecked,
    isChecking,
    checkStatus,
    addDomain,
    removeDomain,
    checkDomain,
    batchCheckDomains
  };
};