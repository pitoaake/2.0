import { SecurityStatus, SpamhausStatus } from '../types/domain';

// 缓存接口
interface CacheEntry {
  status: SecurityStatus | SpamhausStatus;
  timestamp: number;
  expiration?: number;
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

// 检测源配置
const SECURITY_CHECK_SOURCES = {
  VIRUSTOTAL: {
    enabled: true,
    apiKey: process.env.VIRUSTOTAL_API_KEY,
    endpoint: 'https://www.virustotal.com/vtapi/v2/url/report'
  },
  URLSCAN: {
    enabled: true,
    apiKey: process.env.URLSCAN_API_KEY,
    endpoint: 'https://urlscan.io/api/v1/search/'
  }
};

// API 配置
const API_CONFIG = {
  GOOGLE_SAFE_BROWSING: {
    apiKey: 'AIzaSyAwcApluz37f7q9F5yavmn3e1jcrF9eg2A',
    endpoint: 'https://safebrowsing.googleapis.com/v5/hashes:search'
  }
};

interface SafeBrowsingResponse {
  matches?: Array<{
    threatType: string;
    threat: {
      url: string;
    };
    cacheDuration: string;
  }>;
}

// 本地缓存
const localCache = new Map<string, CacheEntry>();

// 生成 URL 表达式列表
function generateUrlExpressions(url: string): string[] {
  const expressions: string[] = [];
  const urlObj = new URL(url);
  
  // 添加主机名
  expressions.push(urlObj.hostname);
  
  // 添加路径前缀
  const pathParts = urlObj.pathname.split('/').filter(Boolean);
  let currentPath = '';
  for (const part of pathParts) {
    currentPath += '/' + part;
    expressions.push(urlObj.hostname + currentPath);
  }
  
  return expressions;
}

// 生成 SHA256 哈希
async function generateSHA256Hash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 获取哈希前缀（前4个字节）
function getHashPrefix(hash: string): string {
  return hash.slice(0, 8);
}

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
 * 使用 VirusTotal 检查域名
 */
async function checkWithVirusTotal(domain: string): Promise<SecurityStatus> {
  if (!SECURITY_CHECK_SOURCES.VIRUSTOTAL.enabled || !SECURITY_CHECK_SOURCES.VIRUSTOTAL.apiKey) {
    return SecurityStatus.Unknown;
  }

  try {
    const response = await fetchWithRetry(
      `${SECURITY_CHECK_SOURCES.VIRUSTOTAL.endpoint}?apikey=${SECURITY_CHECK_SOURCES.VIRUSTOTAL.apiKey}&resource=${domain}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();
    if (data.positives > 0) {
      return SecurityStatus.Unsafe;
    }
    return SecurityStatus.Safe;
  } catch (error) {
    console.error('VirusTotal 检查失败:', error);
    return SecurityStatus.Unknown;
  }
}

/**
 * 使用 URLScan.io 检查域名
 */
async function checkWithURLScan(domain: string): Promise<SecurityStatus> {
  if (!SECURITY_CHECK_SOURCES.URLSCAN.enabled || !SECURITY_CHECK_SOURCES.URLSCAN.apiKey) {
    return SecurityStatus.Unknown;
  }

  try {
    const response = await fetchWithRetry(
      `${SECURITY_CHECK_SOURCES.URLSCAN.endpoint}?q=domain:${domain}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'API-Key': SECURITY_CHECK_SOURCES.URLSCAN.apiKey
        }
      }
    );

    const data = await response.json();
    if (data.results && data.results.length > 0) {
      const latestScan = data.results[0];
      if (latestScan.verdicts && latestScan.verdicts.overall && latestScan.verdicts.overall.malicious) {
        return SecurityStatus.Unsafe;
      }
    }
    return SecurityStatus.Safe;
  } catch (error) {
    console.error('URLScan 检查失败:', error);
    return SecurityStatus.Unknown;
  }
}

/**
 * 使用 Google Safe Browsing API 检查域名
 */
async function checkWithGoogleSafeBrowsing(domain: string): Promise<SecurityStatus> {
  try {
    // 生成 URL 表达式列表
    const urls = [
      `http://${domain}`,
      `https://${domain}`,
      `http://www.${domain}`,
      `https://www.${domain}`
    ];
    
    const expressions = urls.flatMap(url => generateUrlExpressions(url));
    const expressionHashes = await Promise.all(expressions.map(expr => generateSHA256Hash(expr)));
    const expressionHashPrefixes = expressionHashes.map(hash => getHashPrefix(hash));
    
    // 检查本地缓存
    for (const hash of expressionHashes) {
      const cacheKey = `hash_${hash}`;
      const cachedEntry = localCache.get(cacheKey);
      
      if (cachedEntry) {
        if (cachedEntry.expiration && Date.now() > cachedEntry.expiration) {
          localCache.delete(cacheKey);
        } else {
          return cachedEntry.status as SecurityStatus;
        }
      }
    }
    
    // 检查哈希前缀缓存
    const hashPrefixesToCheck = [];
    for (const prefix of expressionHashPrefixes) {
      const cacheKey = `prefix_${prefix}`;
      const cachedEntry = localCache.get(cacheKey);
      
      if (cachedEntry) {
        if (cachedEntry.expiration && Date.now() > cachedEntry.expiration) {
          localCache.delete(cacheKey);
          hashPrefixesToCheck.push(prefix);
        } else {
          const matchingHash = expressionHashes.find(hash => getHashPrefix(hash) === prefix);
          if (matchingHash && cachedEntry.status === SecurityStatus.Unsafe) {
            return SecurityStatus.Unsafe;
          }
        }
      } else {
        hashPrefixesToCheck.push(prefix);
      }
    }
    
    // 发送请求到 Google Safe Browsing API
    if (hashPrefixesToCheck.length > 0) {
      const response = await fetchWithRetry(
        `${API_CONFIG.GOOGLE_SAFE_BROWSING.endpoint}?key=${API_CONFIG.GOOGLE_SAFE_BROWSING.apiKey}&hashPrefixes=${hashPrefixesToCheck.join(',')}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status !== 200) {
        console.error('Google Safe Browsing API 返回错误状态:', response.status);
        return SecurityStatus.Unknown;
      }

      const responseData = await response.json() as SafeBrowsingResponse;
      
      // 处理响应
      if (responseData.matches) {
        for (const match of responseData.matches) {
          const fullHash = await generateSHA256Hash(match.threat.url);
          const cacheKey = `hash_${fullHash}`;
          
          // 更新缓存
          localCache.set(cacheKey, {
            status: SecurityStatus.Unsafe,
            timestamp: Date.now(),
            expiration: Date.now() + 30 * 60 * 1000 // 30分钟过期
          });
          
          // 检查是否匹配任何表达式哈希
          if (expressionHashes.includes(fullHash)) {
            return SecurityStatus.Unsafe;
          }
        }
      }
    }
    
    return SecurityStatus.Safe;
  } catch (error) {
    console.error('Google Safe Browsing 检查失败:', error);
    return SecurityStatus.Unknown;
  }
}

/**
 * 检查域名在 Google 透明度报告中的安全状态
 */
export const checkDomainSecurity = async (domain: string): Promise<SecurityStatus> => {
  console.log(`正在检查域名安全状态: ${domain}`);
  
  // 检查缓存
  const cacheKey = `security_${domain}`;
  if (isCacheValid(cacheKey)) {
    console.log('使用缓存的安全状态');
    return cache.get(cacheKey)!.status as SecurityStatus;
  }
  
  try {
    // 使用 Google Safe Browsing API 检查
    const status = await checkWithGoogleSafeBrowsing(domain);
    
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