import { SecurityStatus, SpamhausStatus } from '../types/domain';

// 请求延迟时间（1-3秒）
const getRandomDelay = () => Math.floor(Math.random() * 2000) + 1000;

// 重试配置
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

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
    
    // 发送请求到 Google Safe Browsing API
    console.log('发送请求到 Google Safe Browsing API，哈希前缀:', expressionHashPrefixes);
    
    const response = await fetchWithRetry(
      `${API_CONFIG.GOOGLE_SAFE_BROWSING.endpoint}?key=${API_CONFIG.GOOGLE_SAFE_BROWSING.apiKey}&hashPrefixes=${expressionHashPrefixes.join(',')}`,
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
    console.log('Google Safe Browsing API 响应:', responseData);
    
    // 处理响应
    if (responseData.matches && responseData.matches.length > 0) {
      for (const match of responseData.matches) {
        const fullHash = await generateSHA256Hash(match.threat.url);
        
        // 检查是否匹配任何表达式哈希
        if (expressionHashes.includes(fullHash)) {
          console.log('检测到不安全的域名:', domain);
          return SecurityStatus.Unsafe;
        }
      }
    }
    
    console.log('域名安全:', domain);
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
  
  try {
    // 使用 Google Safe Browsing API 检查
    const status = await checkWithGoogleSafeBrowsing(domain);
    console.log(`域名 ${domain} 的安全状态:`, status);
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
  
  try {
    console.log('发送请求到 Spamhaus...');
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
    console.log('Spamhaus 响应:', text);
    
    const status = text.includes('未列入黑名单') ? SpamhausStatus.Safe : SpamhausStatus.Blacklisted;
    console.log(`域名 ${domain} 的 Spamhaus 状态:`, status);
    
    return status;
  } catch (error) {
    console.error('检查 Spamhaus 状态时出错:', error);
    return SpamhausStatus.Unknown;
  }
};