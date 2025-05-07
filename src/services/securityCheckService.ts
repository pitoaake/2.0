import { SecurityStatus, SpamhausStatus } from '../types/domain';

// 缓存接口
interface CacheEntry {
  status: SecurityStatus | SpamhausStatus;
  timestamp: number;
}

// 缓存存储
const cache = new Map<string, CacheEntry>();

// 缓存过期时间（15分钟）
const CACHE_DURATION = 15 * 60 * 1000;

// 请求延迟时间（1-3秒）
const getRandomDelay = () => Math.floor(Math.random() * 2000) + 1000;

// 重试配置
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

/**
 * 带重试的请求函数
 */
async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  try {
    // 添加随机延迟
    await new Promise(resolve => setTimeout(resolve, getRandomDelay()));
    
    const response = await fetch(url, options);
    if (response.ok) return response;
    
    if (retries > 0) {
      console.log(`请求失败，${retries}秒后重试...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return fetchWithRetry(url, options, retries - 1);
    }
    
    throw new Error(`请求失败: ${response.status}`);
  } catch (error) {
    if (retries > 0) {
      console.log(`请求出错，${retries}秒后重试...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

/**
 * 检查缓存是否有效
 */
function isCacheValid(key: string): boolean {
  const entry = cache.get(key);
  if (!entry) return false;
  
  const now = Date.now();
  return now - entry.timestamp < CACHE_DURATION;
}

/**
 * 检查域名在 Google 透明度报告中的安全状态
 */
export const checkDomainSecurity = async (domain: string): Promise<SecurityStatus> => {
  console.log(`正在检查域名安全状态: ${domain}`);
  
  // 检查缓存
  const cacheKey = `google_${domain}`;
  if (isCacheValid(cacheKey)) {
    console.log('使用缓存的安全状态');
    return cache.get(cacheKey)!.status as SecurityStatus;
  }
  
  try {
    const response = await fetchWithRetry(
      `https://transparencyreport.google.com/safe-browsing/search?url=${domain}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        }
      }
    );

    const text = await response.text();
    let status: SecurityStatus;
    
    // 检查页面内容来判断域名状态
    if (text.includes('未发现安全问题')) {
      status = SecurityStatus.Safe;
    } else if (text.includes('发现安全问题')) {
      status = SecurityStatus.Unsafe;
    } else if (text.includes('部分安全问题')) {
      status = SecurityStatus.PartiallySafe;
    } else {
      status = SecurityStatus.Unknown;
    }
    
    // 更新缓存
    cache.set(cacheKey, {
      status,
      timestamp: Date.now()
    });
    
    return status;
  } catch (error) {
    console.error('检查域名安全状态时出错:', error);
    return SecurityStatus.Unknown;
  }
};

/**
 * 检查域名是否在 Spamhaus 黑名单中
 */
export const checkSpamhausStatus = async (domain: string): Promise<SpamhausStatus> => {
  console.log(`正在检查 Spamhaus 黑名单状态: ${domain}`);
  
  // 检查缓存
  const cacheKey = `spamhaus_${domain}`;
  if (isCacheValid(cacheKey)) {
    console.log('使用缓存的黑名单状态');
    return cache.get(cacheKey)!.status as SpamhausStatus;
  }
  
  try {
    const response = await fetchWithRetry(
      `https://check.spamhaus.org/listed/?domain=${domain}`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        }
      }
    );

    const text = await response.text();
    const status = text.includes('未列入黑名单') ? SpamhausStatus.Safe : SpamhausStatus.Blacklisted;
    
    // 更新缓存
    cache.set(cacheKey, {
      status,
      timestamp: Date.now()
    });
    
    return status;
  } catch (error) {
    console.error('检查 Spamhaus 状态时出错:', error);
    return SpamhausStatus.Safe;
  }
};