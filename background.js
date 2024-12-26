const setProxy = async (config) => {
    try {
      await chrome.proxy.settings.set({
        value: config,
        scope: 'regular'
      });
      return true;
    } catch (error) {
      console.error('Failed to set proxy:', error);
      return false;
    }
  };
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SET_PROXY') {
      setProxy(request.config).then(success => {
        sendResponse({ success });
      });
      return true;
    }
    
    if (request.type === 'TEST_PROXY') {
      fetch('https://api.ipify.org?format=json', {
        mode: 'no-cors'
      })
      .then(response => response.json())
      .then(data => {
        sendResponse({ success: true, ip: data.ip });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;
    }
  });