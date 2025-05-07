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
    endpoint: 'https://safebrowsing.googleapis.com/v4/threatMatches:find'
  }
};

interface SafeBrowsingResponse {
  matches?: Array<{
    threatType: string;
    platformType: string;
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
    // 准备要检查的 URL 列表
    const urls = [
      `http://${domain}`,
      `https://${domain}`,
      `http://www.${domain}`,
      `https://www.${domain}`
    ];
    
    // 准备请求体
    const requestBody = {
      client: {
        clientId: "domain-security-checker",
        clientVersion: "1.0.0"
      },
      threatInfo: {
        threatTypes: [
          "MALWARE",
          "SOCIAL_ENGINEERING",
          "UNWANTED_SOFTWARE",
          "POTENTIALLY_HARMFUL_APPLICATION"
        ],
        platformTypes: ["ANY_PLATFORM"],
        threatEntryTypes: ["URL"],
        threatEntries: urls.map(url => ({ url }))
      }
    };
    
    console.log('发送请求到 Google Safe Browsing API:', requestBody);
    
    const response = await fetchWithRetry(
      `${API_CONFIG.GOOGLE_SAFE_BROWSING.endpoint}?key=${API_CONFIG.GOOGLE_SAFE_BROWSING.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      }
    );

    if (response.status === 200) {
      const responseData = await response.json() as SafeBrowsingResponse;
      console.log('Google Safe Browsing API 响应:', responseData);
      
      if (responseData.matches && responseData.matches.length > 0) {
        // 检查威胁类型
        const threatTypes = responseData.matches.map(match => match.threatType);
        console.log('检测到的威胁类型:', threatTypes);
        
        // 如果所有URL都有威胁，则标记为不安全
        if (responseData.matches.length === urls.length) {
          console.log('所有URL都检测到威胁，标记为不安全');
          return SecurityStatus.Unsafe;
        }
        
        // 如果部分URL有威胁，则标记为部分不安全
        console.log('部分URL检测到威胁，标记为部分不安全');
        return SecurityStatus.PartiallySafe;
      }
    } else if (response.status === 204) {
      // 204 表示没有匹配的威胁
      console.log('域名安全: 未检测到任何威胁');
      return SecurityStatus.Safe;
    } else {
      console.error('Google Safe Browsing API 返回错误状态:', response.status);
      return SecurityStatus.Unknown;
    }
    
    // 如果没有匹配的威胁，返回安全状态
    console.log('域名安全: 未检测到任何威胁');
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