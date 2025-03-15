let currentState = {
  activeProfile: null,
  proxyConfig: { mode: "direct" }
};

const setProxy = async (config) => {
  try {
    await chrome.proxy.settings.set({
      value: config,
      scope: 'regular'
    });
    // 更新当前状态
    currentState.proxyConfig = config;
    return { success: true };
  } catch (error) {
    console.error('Failed to set proxy:', error);
    return { success: false, error: error.message };
  }
};

const testConnection = async () => {
  try {
    // 设置超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
    
    const response = await fetch('https://api.ipify.org?format=json', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    const data = await response.json();
    return { success: true, ip: data.ip };
  } catch (error) {
    let errorMsg = 'Connection failed';
    if (error.name === 'AbortError') {
      errorMsg = 'Connection timed out';
    } else if (error.message) {
      errorMsg = error.message;
    }
    return { success: false, error: errorMsg };
  }
};

// 初始化时从存储中恢复状态
chrome.runtime.onStartup.addListener(async () => {
  try {
    const { activeProfileId } = await chrome.storage.local.get('activeProfileId');
    const { proxyProfiles = [] } = await chrome.storage.local.get('proxyProfiles');
    
    if (activeProfileId !== null && proxyProfiles[activeProfileId]) {
      currentState.activeProfile = activeProfileId;
      
      // 恢复代理设置
      await setProxy(proxyProfiles[activeProfileId].config);
      console.log('Proxy state restored on startup');
    }
  } catch (error) {
    console.error('Failed to restore proxy state:', error);
  }
});

// Service Worker激活时
chrome.runtime.onInstalled.addListener(async () => {
  await restoreProxyState();
});

// 处理Service Worker唤醒
async function restoreProxyState() {
  try {
    // 从存储中读取代理状态
    const { activeProfileId } = await chrome.storage.local.get('activeProfileId');
    const { proxyProfiles = [] } = await chrome.storage.local.get('proxyProfiles');
    
    if (activeProfileId !== null && proxyProfiles[activeProfileId]) {
      currentState.activeProfile = activeProfileId;
      await setProxy(proxyProfiles[activeProfileId].config);
      console.log('Proxy state restored');
    }
  } catch (error) {
    console.error('Failed to restore proxy state:', error);
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'SET_PROXY') {
    setProxy(request.config).then(sendResponse);
    return true;
  }
  
  if (request.type === 'TEST_PROXY') {
    testConnection().then(sendResponse);
    return true;
  }
  
  if (request.type === 'GET_PROXY_STATE') {
    sendResponse({ 
      activeProfile: currentState.activeProfile,
      proxyConfig: currentState.proxyConfig
    });
    return true;
  }
  
  if (request.type === 'PROFILES_UPDATED') {
    // 更新内部状态
    if (request.profiles) {
      console.log('Profiles updated in background service worker');
    }
    sendResponse({ success: true });
    return true;
  }
});