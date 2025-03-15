import BypassRules from './bypass-rules.js';

class SKYProxy {
  constructor() {
    this.profiles = [];
    this.activeProfile = null;
    this.editingIndex = null;
    this.proxyState = {
      isEnabled: false,
      lastError: null
    };
    this.initUI();
    this.initListeners();
    this.loadProfiles();
    this.syncStateWithBackground();
  }

  async initUI() {
    const container = document.createElement('div');
    container.className = 'container';
    container.innerHTML = `
      <div class="header">
        <h2 style="margin:0">SKY-Proxy</h2>
        <div style="display:flex;gap:12px;align-items:center">
          <label class="switch">
            <input type="checkbox" id="globalProxySwitch">
            <span class="slider"></span>
          </label>
          <button id="addProfileBtn" class="btn btn-primary">Add Profile</button>
        </div>
      </div>

      <div id="proxyList" class="proxy-list"></div>
      
      <div id="statusBar" class="status-bar"></div>

      <div id="profileModal" class="modal">
        <div class="modal-content">
          <h3 id="modalTitle">Add Proxy Profile</h3>
          <div class="form-group">
            <input type="text" id="profileName" placeholder="Profile Name">
          </div>
          <div class="form-group">
            <select id="proxyType">
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
              <option value="socks4">SOCKS4</option>
              <option value="socks5">SOCKS5</option>
            </select>
          </div>
          <div class="form-group">
            <input type="text" id="proxyHost" placeholder="Host">
          </div>
          <div class="form-group">
            <input type="number" id="proxyPort" placeholder="Port">
          </div>
          <div class="form-group">
            <label>Bypass Rules:</label>
            <div class="bypass-templates">
              <button class="template-btn" data-template="minimal">Minimal</button>
              <button class="template-btn" data-template="basic">Basic</button>
              <button class="template-btn" data-template="development">Development</button>
              <button class="template-btn" data-template="china">China</button>
            </div>
            <input type="text" id="bypassList" placeholder="Enter bypass rules (comma separated)">
            <div class="bypass-help">
              Supports: IP addresses, CIDR notation, domains with wildcards. Example: localhost, 127.0.0.1, *.example.com
            </div>
            <div id="bypassValidation" class="bypass-validation"></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:16px">
            <button id="saveProfileBtn" class="btn btn-primary">Save</button>
            <button id="cancelProfileBtn" class="btn btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('app').appendChild(container);
  }

  async initListeners() {
    document.getElementById('addProfileBtn').addEventListener('click', () => this.showProfileModal());
    document.getElementById('saveProfileBtn').addEventListener('click', () => this.saveProfile());
    document.getElementById('cancelProfileBtn').addEventListener('click', () => this.hideProfileModal());
    
    // 添加ESC键关闭modal的支持
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideProfileModal();
      }
    });
    
    const globalSwitch = document.getElementById('globalProxySwitch');
    globalSwitch.addEventListener('change', async (e) => {
      if (e.target.checked) {
        if (this.activeProfile !== null) {
          const profile = this.profiles[this.activeProfile];
          await this.activateProfile(this.activeProfile);
        } else if (this.profiles.length > 0) {
          await this.activateProfile(0);
        } else {
          e.target.checked = false;
          this.showStatus('No proxy profile available', true);
        }
      } else {
        await this.disableProxy();
      }
    });

    // 添加规则模板和验证监听器
    this.initBypassListeners();
  }

  initBypassListeners() {
    // 模板按钮点击事件
    document.querySelector('.bypass-templates').addEventListener('click', (e) => {
      if (e.target.classList.contains('template-btn')) {
        const templateName = e.target.dataset.template;
        const rules = BypassRules.getTemplate(templateName);
        if (rules) {
          document.getElementById('bypassList').value = BypassRules.formatRules(rules);
          this.validateBypassRules();
        }
      }
    });

    // 规则输入实时验证
    const bypassInput = document.getElementById('bypassList');
    bypassInput.addEventListener('input', () => {
      this.validateBypassRules();
    });
  }

  validateBypassRules() {
    const input = document.getElementById('bypassList').value;
    const validationDiv = document.getElementById('bypassValidation');
    
    // 使用BypassRules类解析规则
    const { valid, invalid } = BypassRules.parseRules(input);
    
    // 更新验证UI
    validationDiv.innerHTML = '';

    if (valid.length > 0) {
      const validHtml = valid.map(({rule, type}) => `
        <span class="rule-tag ${type}">${rule}</span>
      `).join('');
      validationDiv.innerHTML += `<div class="valid-rules">${validHtml}</div>`;
    }

    if (invalid.length > 0) {
      const invalidHtml = invalid.map(({rule, error}) => `
        <div class="invalid-rule">❌ ${rule} (${error})</div>
      `).join('');
      validationDiv.innerHTML += `<div class="error-list">${invalidHtml}</div>`;
    }
  }

  showStatus(message, isError = false) {
    const statusBar = document.getElementById('statusBar');
    statusBar.textContent = message;
    statusBar.className = `status-bar show ${isError ? 'error' : 'success'}`;
    
    // 3秒后自动隐藏状态栏
    setTimeout(() => {
      statusBar.className = 'status-bar';
    }, 3000);
    
    // 对于错误状态，同时记录到控制台
    if (isError) {
      console.error(`[SKY-Proxy] ${message}`);
    }
  }

  async syncStateWithBackground() {
    try {
      // 获取后台保存的代理状态
      const response = await chrome.runtime.sendMessage({ 
        type: 'GET_PROXY_STATE'
      });
      
      if (response && response.activeProfile !== undefined) {
        this.activeProfile = response.activeProfile;
        document.getElementById('globalProxySwitch').checked = this.activeProfile !== null;
        this.renderProxyList();
      }
    } catch (error) {
      console.warn('Failed to sync state with background:', error);
    }
  }

  async loadProfiles() {
    try {
      const { proxyProfiles = [] } = await chrome.storage.local.get('proxyProfiles');
      this.profiles = proxyProfiles;
      const { activeProfileId } = await chrome.storage.local.get('activeProfileId');
      this.activeProfile = activeProfileId;

      const globalSwitch = document.getElementById('globalProxySwitch');
      globalSwitch.checked = this.activeProfile !== null;

      this.renderProxyList();
    } catch (error) {
      console.error('Failed to load profiles:', error);
      this.showStatus('Failed to load profiles', true);
    }
  }

  renderProxyList() {
    const proxyList = document.getElementById('proxyList');
    proxyList.innerHTML = '';

    if (this.profiles.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.className = 'empty-message';
      emptyMessage.textContent = 'No proxy profiles yet. Click "Add Profile" to create one.';
      emptyMessage.style.textAlign = 'center';
      emptyMessage.style.padding = '20px';
      emptyMessage.style.color = '#666';
      proxyList.appendChild(emptyMessage);
      return;
    }

    this.profiles.forEach((profile, index) => {
      const item = document.createElement('div');
      item.className = `proxy-item ${this.activeProfile === index ? 'active' : ''}`;
      
      item.innerHTML = `
        <div class="profile-info">
          <span>${profile.name || profile.config.rules.singleProxy.host}</span>
          <span class="tag tag-${profile.config.rules.singleProxy.scheme}">
            ${profile.config.rules.singleProxy.scheme.toUpperCase()}
          </span>
        </div>
        <div class="actions">
          <button class="btn test-btn" data-index="${index}">Test</button>
          <button class="btn edit-btn" data-index="${index}">Edit</button>
          <button class="btn delete-btn" data-index="${index}">Delete</button>
        </div>
      `;

      // Add event listeners for buttons
      const testBtn = item.querySelector('.test-btn');
      const editBtn = item.querySelector('.edit-btn');
      const deleteBtn = item.querySelector('.delete-btn');

      testBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.testProfile(index);
      });

      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editProfile(index);
      });

      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteProfile(index);
      });

      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('btn')) {
          this.activateProfile(index);
        }
      });

      proxyList.appendChild(item);
    });
  }

  showProfileModal(profile = null) {
    const modal = document.getElementById('profileModal');
    const modalTitle = document.getElementById('modalTitle');
    const nameInput = document.getElementById('profileName');
    const typeSelect = document.getElementById('proxyType');
    const hostInput = document.getElementById('proxyHost');
    const portInput = document.getElementById('proxyPort');
    const bypassInput = document.getElementById('bypassList');

    // 更新modal标题
    modalTitle.textContent = profile ? 'Edit Proxy Profile' : 'Add Proxy Profile';

    if (profile) {
      nameInput.value = profile.name || '';
      typeSelect.value = profile.config.rules.singleProxy.scheme;
      hostInput.value = profile.config.rules.singleProxy.host;
      portInput.value = profile.config.rules.singleProxy.port;
      bypassInput.value = profile.config.rules.bypassList.join(', ');
    } else {
      nameInput.value = '';
      typeSelect.value = 'http';
      hostInput.value = '';
      portInput.value = '';
      bypassInput.value = BypassRules.formatRules(BypassRules.getTemplate('basic'));
    }

    this.validateBypassRules();
    modal.style.display = 'flex';
  }

  hideProfileModal() {
    document.getElementById('profileModal').style.display = 'none';
    this.editingIndex = null;  // 关闭modal时重置编辑索引
  }

  async saveProfile() {
    const name = document.getElementById('profileName').value;
    const type = document.getElementById('proxyType').value;
    const host = document.getElementById('proxyHost').value;
    const port = document.getElementById('proxyPort').value;
    const bypassText = document.getElementById('bypassList').value;
    
    // 使用BypassRules类解析规则
    const { valid, invalid } = BypassRules.parseRules(bypassText);
    const bypassList = valid.map(item => item.rule);

    if (!host || !port) {
      this.showStatus('Please fill in host and port', true);
      return;
    }

    // 验证端口范围
    const portNum = parseInt(port, 10);
    if (portNum < 1 || portNum > 65535) {
      this.showStatus('Port must be between 1 and 65535', true);
      return;
    }

    // 验证绕过规则
    if (invalid.length > 0) {
      const invalidRulesList = invalid.map(item => item.rule).join(', ');
      this.showStatus(`Invalid bypass rules: ${invalidRulesList}`, true);
      return;
    }

    const profile = {
      name: name || host,
      config: {
        mode: "fixed_servers",
        rules: {
          singleProxy: {
            scheme: type,
            host: host,
            port: portNum
          },
          bypassList
        }
      }
    };

    try {
      // 处理编辑模式
      if (this.editingIndex !== null) {
        this.profiles[this.editingIndex] = profile;
        this.editingIndex = null;  // 重置编辑索引
      } else {
        this.profiles.push(profile);
      }
    
      await chrome.storage.local.set({ proxyProfiles: this.profiles });
      
      // 通知后台配置已更新
      await chrome.runtime.sendMessage({ 
        type: 'PROFILES_UPDATED', 
        profiles: this.profiles 
      });
      
      this.hideProfileModal();
      this.renderProxyList();
      this.showStatus('Profile saved successfully');
    } catch (error) {
      console.error('Failed to save profile:', error);
      this.showStatus('Failed to save profile', true);
    }
  }

  async editProfile(index) {
    this.editingIndex = index;
    this.showProfileModal(this.profiles[index]);
  }

  async deleteProfile(index) {
    try {
      // 直接删除配置，无需确认
      if (this.activeProfile === index) {
        await this.disableProxy();
      } else if (this.activeProfile > index) {
        this.activeProfile--;
      }
      
      this.profiles.splice(index, 1);
      await chrome.storage.local.set({ proxyProfiles: this.profiles });
      
      // 通知后台配置已更新
      await chrome.runtime.sendMessage({ 
        type: 'PROFILES_UPDATED', 
        profiles: this.profiles 
      });
      
      this.renderProxyList();
      this.showStatus('Profile deleted');
    } catch (error) {
      console.error('Failed to delete profile:', error);
      this.showStatus('Failed to delete profile', true);
    }
  }

  async activateProfile(index) {
    const profile = this.profiles[index];
    try {
      this.showStatus('Activating proxy...');
      const response = await chrome.runtime.sendMessage({ 
        type: 'SET_PROXY', 
        config: profile.config 
      });
      
      if (response.success) {
        this.activeProfile = index;
        await chrome.storage.local.set({ activeProfileId: index });
        document.getElementById('globalProxySwitch').checked = true;
        this.renderProxyList();
        this.showStatus(`✓ Activated: ${profile.name}`);
      } else {
        this.showStatus(`✗ Failed to activate profile: ${response.error || 'Unknown error'}`, true);
      }
    } catch (error) {
      console.error('Activation error:', error);
      this.showStatus('✗ Failed to activate profile', true);
    }
  }

  async testProfile(index) {
    const profile = this.profiles[index];
    this.showStatus('Testing connection...');
    
    let originalConfig = null;
    let originalProfileIndex = this.activeProfile;
    
    try {
      // 保存当前配置
      originalConfig = await chrome.proxy.settings.get({});
      
      // 临时设置要测试的代理
      const setupResponse = await chrome.runtime.sendMessage({ 
        type: 'SET_PROXY', 
        config: profile.config 
      });
      
      if (!setupResponse.success) {
        throw new Error('Failed to set test proxy: ' + (setupResponse.error || 'Unknown error'));
      }
      
      // 测试连接
      const testResponse = await chrome.runtime.sendMessage({
        type: 'TEST_PROXY'
      });
      
      // 恢复原始配置
      await this.restoreOriginalConfig(originalConfig, originalProfileIndex);
      
      if (testResponse.success) {
        this.showStatus(`✓ Test successful: ${testResponse.ip}`);
      } else {
        this.showStatus(`✗ Test failed: ${testResponse.error || 'Connection error'}`, true);
      }
    } catch (error) {
      console.error('Test error:', error);
      this.showStatus(`✗ Test failed: ${error.message}`, true);
      
      // 确保恢复原始配置
      await this.restoreOriginalConfig(originalConfig, originalProfileIndex);
    }
  }
  
  async restoreOriginalConfig(originalConfig, originalProfileIndex) {
    try {
      if (originalProfileIndex !== null) {
        const activeProfile = this.profiles[originalProfileIndex];
        await chrome.runtime.sendMessage({ 
          type: 'SET_PROXY', 
          config: activeProfile.config 
        });
      } else {
        await chrome.runtime.sendMessage({ 
          type: 'SET_PROXY', 
          config: { mode: "direct" } 
        });
      }
      return true;
    } catch (error) {
      console.error('Failed to restore original config:', error);
      this.showStatus('⚠️ Failed to restore original proxy configuration. Please check your settings.', true);
      return false;
    }
  }

  async disableProxy() {
    const config = { mode: "direct" };
    try {
      const response = await chrome.runtime.sendMessage({ type: 'SET_PROXY', config });
      
      if (response.success) {
        this.activeProfile = null;
        await chrome.storage.local.set({ activeProfileId: null });
        document.getElementById('globalProxySwitch').checked = false;
        this.renderProxyList();
        this.showStatus('✓ Proxy disabled');
      } else {
        this.showStatus(`✗ Failed to disable proxy: ${response.error || 'Unknown error'}`, true);
      }
    } catch (error) {
      console.error('Disable error:', error);
      this.showStatus('✗ Failed to disable proxy', true);
    }
  }
}
  
// Initialize the proxy manager when the popup loads
document.addEventListener('DOMContentLoaded', () => {
  new SKYProxy();
});