const setProxy = async (config) => {
    try {
      await chrome.proxy.settings.set({
        value: config,
        scope: 'regular'
      });
    } catch (error) {
      console.error('Failed to set proxy:', error);
    }
  };
  
  const getCurrentProxy = async () => {
    return await chrome.proxy.settings.get({});
  };
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SET_PROXY') {
      setProxy(request.config).then(() => {
        sendResponse({ success: true });
      });
      return true;
    }
    
    if (request.type === 'GET_PROXY') {
      getCurrentProxy().then((config) => {
        sendResponse({ config });
      });
      return true;
    }
  });
  