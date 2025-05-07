import { SecurityStatus, SpamhausStatus, DomainCheckResult } from '../types/domain';

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

// 威胁类型描述
const THREAT_TYPE_DESCRIPTIONS: Record<string, string> = {
  MALWARE: '恶意软件',
  SOCIAL_ENGINEERING: '社交工程',
  UNWANTED_SOFTWARE: '不需要的软件',
  POTENTIALLY_HARMFUL_APPLICATION: '潜在有害应用'
};

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
 * 检查域名安全状态
 * @param domain 要检查的域名
 * @returns 域名检查结果
 */
export const checkWithGoogleSafeBrowsing = async (domain: string): Promise<DomainCheckResult> => {
  if (!API_CONFIG.GOOGLE_SAFE_BROWSING.apiKey) {
    throw new Error('未配置 Google Safe Browsing API 密钥');
  }

  try {
    // 构建请求体
    const requestBody = {
      client: {
        clientId: 'domain-monitor',
        clientVersion: '1.0.0'
      },
      threatInfo: {
        threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
        platformTypes: ['ANY_PLATFORM'],
        threatEntryTypes: ['URL'],
        threatEntries: [
          { url: `http://${domain}` },
          { url: `https://${domain}` }
        ]
      }
    };

    // 发送请求
    const response = await fetch(`${API_CONFIG.GOOGLE_SAFE_BROWSING.endpoint}?key=${API_CONFIG.GOOGLE_SAFE_BROWSING.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    // 检查是否发现威胁
    if (data.matches) {
      const threats = data.matches.map((match: any) => ({
        type: match.threatType,
        description: THREAT_TYPE_DESCRIPTIONS[match.threatType] || match.threatType,
        url: match.threat.url
      }));

      console.log('发现威胁:', threats);

      // 如果所有 URL 都不安全，则标记为不安全
      if (threats.length === 2) {
        return {
          domain,
          securityStatus: SecurityStatus.Unsafe,
          spamhausStatus: SpamhausStatus.Unknown,
          checkTime: Date.now()
        };
      }

      // 如果只有部分 URL 不安全，则标记为部分安全
      return {
        domain,
        securityStatus: SecurityStatus.PartiallySafe,
        spamhausStatus: SpamhausStatus.Unknown,
        checkTime: Date.now()
      };
    }

    // 没有发现威胁，标记为安全
    return {
      domain,
      securityStatus: SecurityStatus.Safe,
      spamhausStatus: SpamhausStatus.Unknown,
      checkTime: Date.now()
    };
  } catch (error) {
    console.error('检查域名安全状态时出错:', error);
    throw error;
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