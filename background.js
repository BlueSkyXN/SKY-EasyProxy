const setProxy = async (config) => {
    try {
      await chrome.proxy.settings.set({
        value: config,
        scope: 'regular'
      });
      return { success: true };
    } catch (error) {
      console.error('Failed to set proxy:', error);
      return { success: false, error: error.message };
    }
  };
  
  const testConnection = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return { success: true, ip: data.ip };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SET_PROXY') {
      setProxy(request.config).then(sendResponse);
      return true;
    }
    
    if (request.type === 'TEST_PROXY') {
      testConnection().then(sendResponse);
      return true;
    }
  });