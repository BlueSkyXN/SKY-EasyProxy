class ProxyManager {
    constructor() {
      this.initUI();
      this.loadSavedConfig();
      this.checkCurrentProxy();
    }
  
    async initUI() {
      const container = document.createElement('div');
      container.className = 'container';
      container.innerHTML = `
        <div id="status"></div>
        
        <div class="form-group">
          <label>
            <input type="checkbox" id="proxyEnabled"> Enable Proxy
          </label>
        </div>
  
        <div class="form-group" id="proxyForm" style="display: none;">
          <div class="form-group">
            <label>Proxy Type</label>
            <select id="proxyType">
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
              <option value="socks4">SOCKS4</option>
              <option value="socks5">SOCKS5</option>
            </select>
          </div>
  
          <div class="form-group">
            <label>Host</label>
            <input type="text" id="proxyHost" placeholder="proxy.example.com">
          </div>
  
          <div class="form-group">
            <label>Port</label>
            <input type="number" id="proxyPort" placeholder="8080">
          </div>
  
          <div class="form-group">
            <label>Bypass List</label>
            <input type="text" id="bypassList" placeholder="localhost, 127.0.0.1">
          </div>
        </div>
  
        <button id="saveButton">Save Configuration</button>
      `;
  
      document.getElementById('app').appendChild(container);
  
      // Add event listeners
      document.getElementById('proxyEnabled').addEventListener('change', this.handleProxyToggle.bind(this));
      document.getElementById('saveButton').addEventListener('click', this.saveConfig.bind(this));
    }
  
    showStatus(message, isError = false) {
      const statusDiv = document.getElementById('status');
      statusDiv.className = `status ${isError ? 'error' : 'success'}`;
      statusDiv.textContent = message;
      setTimeout(() => {
        statusDiv.textContent = '';
        statusDiv.className = 'status';
      }, 3000);
    }
  
    async loadSavedConfig() {
      const { proxyConfig } = await chrome.storage.local.get('proxyConfig');
      if (proxyConfig) {
        document.getElementById('proxyEnabled').checked = proxyConfig.mode !== 'direct';
        if (proxyConfig.mode === 'fixed_servers') {
          const proxy = proxyConfig.rules.singleProxy;
          document.getElementById('proxyType').value = proxy.scheme;
          document.getElementById('proxyHost').value = proxy.host;
          document.getElementById('proxyPort').value = proxy.port;
          document.getElementById('bypassList').value = proxyConfig.rules.bypassList.join(', ');
        }
        this.handleProxyToggle({ target: { checked: proxyConfig.mode !== 'direct' } });
      }
    }
  
    async checkCurrentProxy() {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_PROXY' });
        const config = response.config;
        if (config.value.mode === 'fixed_servers') {
          this.showStatus('Proxy is active');
        } else if (config.value.mode === 'direct') {
          this.showStatus('Direct connection (no proxy)');
        }
      } catch (error) {
        this.showStatus('Failed to get proxy status', true);
      }
    }
  
    handleProxyToggle(event) {
      const enabled = event.target.checked;
      const proxyForm = document.getElementById('proxyForm');
      proxyForm.style.display = enabled ? 'block' : 'none';
    }
  
    async saveConfig() {
      const enabled = document.getElementById('proxyEnabled').checked;
      
      if (!enabled) {
        await this.disableProxy();
        return;
      }
  
      const host = document.getElementById('proxyHost').value;
      const port = document.getElementById('proxyPort').value;
      
      if (!host || !port) {
        this.showStatus('Please fill in all required fields', true);
        return;
      }
  
      const bypassList = document.getElementById('bypassList').value
        .split(',')
        .map(item => item.trim())
        .filter(item => item);
  
      const config = {
        mode: "fixed_servers",
        rules: {
          singleProxy: {
            scheme: document.getElementById('proxyType').value,
            host: host,
            port: parseInt(port, 10)
          },
          bypassList: bypassList
        }
      };
  
      try {
        await chrome.storage.local.set({ proxyConfig: config });
        await chrome.runtime.sendMessage({ type: 'SET_PROXY', config });
        this.showStatus('Proxy configuration saved');
      } catch (error) {
        this.showStatus('Failed to save proxy configuration', true);
        console.error('Failed to save proxy configuration:', error);
      }
    }
  
    async disableProxy() {
      const config = { mode: "direct" };
      try {
        await chrome.storage.local.set({ proxyConfig: config });
        await chrome.runtime.sendMessage({ type: 'SET_PROXY', config });
        this.showStatus('Proxy disabled');
      } catch (error) {
        this.showStatus('Failed to disable proxy', true);
      }
    }
  }
  
  document.addEventListener('DOMContentLoaded', () => {
    new ProxyManager();
  });