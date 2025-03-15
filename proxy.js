class SKYProxy {
  constructor() {
    this.profiles = [];
    this.activeProfile = null;
    this.editingIndex = null;  // 添加编辑索引tracking
    this.defaultBypassRules = {
      basic: [
        'localhost', '127.0.0.1', '[::1]', '*.localhost'
      ],
      development: [
        'localhost', '127.0.0.1', '[::1]',
        '*.localhost', '*.local', '*.test',
        '192.168.0.0/16'
      ],
      china: [
        'localhost', '127.0.0.1', '[::1]',
        '*.cn', '*.com.cn', '*.edu.cn', '*.gov.cn',
        '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'
      ]
    };
    this.initUI();
    this.initListeners();
    this.loadProfiles();
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
        const rules = this.defaultBypassRules[templateName];
        if (rules) {
          document.getElementById('bypassList').value = rules.join(', ');
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
    const rules = input.split(',').map(r => r.trim()).filter(r => r);
    
    const validRules = [];
    const invalidRules = [];

    rules.forEach(rule => {
      if (this.isValidRule(rule)) {
        validRules.push(this.getRuleType(rule));
      } else {
        invalidRules.push(rule);
      }
    });

    // 更新验证UI
    validationDiv.innerHTML = '';

    if (validRules.length > 0) {
      const validHtml = validRules.map(({rule, type}) => `
        <span class="rule-tag ${type}">${rule}</span>
      `).join('');
      validationDiv.innerHTML += `<div class="valid-rules">${validHtml}</div>`;
    }

    if (invalidRules.length > 0) {
      const invalidHtml = invalidRules.map(rule => `
        <div class="invalid-rule">❌ ${rule}</div>
      `).join('');
      validationDiv.innerHTML += `<div class="error-list">${invalidHtml}</div>`;
    }
  }

  isValidRule(rule) {
    // IPv4
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(rule)) {
      return rule.split('.').every(num => {
        const n = parseInt(num);
        return n >= 0 && n <= 255;
      });
    }

    // IPv6
    if (rule.includes(':') || /^\[.*\]$/.test(rule)) {
      const ipv6 = rule.replace(/^\[|\]$/g, '');
      const parts = ipv6.split(':');
      return parts.length >= 2 && parts.length <= 8 &&
             parts.every(part => !part || /^[0-9a-fA-F]{1,4}$/.test(part));
    }

    // CIDR
    if (rule.includes('/')) {
      const [ip, prefix] = rule.split('/');
      const prefixNum = parseInt(prefix);
      return this.isValidRule(ip) && prefixNum >= 0 && prefixNum <= 32;
    }

    // Domain (包括通配符)
    return /^(\*\.)?[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)*$/.test(rule);
  }

  getRuleType(rule) {
    if (rule.includes('/')) return { rule, type: 'cidr' };
    if (rule.includes(':') || /^\[.*\]$/.test(rule)) return { rule, type: 'ipv6' };
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(rule)) return { rule, type: 'ipv4' };
    return { rule, type: 'domain' };
  }

  showStatus(message, isError = false) {
    const statusBar = document.getElementById('statusBar');
    statusBar.textContent = message;
    statusBar.className = `status-bar show ${isError ? 'error' : 'success'}`;
    
    // 3秒后自动隐藏状态栏
    setTimeout(() => {
      statusBar.className = 'status-bar';
    }, 3000);
  }

  async loadProfiles() {
    const { proxyProfiles = [] } = await chrome.storage.local.get('proxyProfiles');
    this.profiles = proxyProfiles;
    const { activeProfileId } = await chrome.storage.local.get('activeProfileId');
    this.activeProfile = activeProfileId;

    const globalSwitch = document.getElementById('globalProxySwitch');
    globalSwitch.checked = this.activeProfile !== null;

    this.renderProxyList();
  }

  renderProxyList() {
    const proxyList = document.getElementById('proxyList');
    proxyList.innerHTML = '';

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
      bypassInput.value = this.defaultBypassRules.basic.join(', ');
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
    const bypassList = document.getElementById('bypassList').value
      .split(',')
      .map(item => item.trim())
      .filter(item => item);

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
    const invalidRules = bypassList.filter(rule => !this.isValidRule(rule));
    if (invalidRules.length > 0) {
      this.showStatus(`Invalid bypass rules: ${invalidRules.join(', ')}`, true);
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

    // 处理编辑模式
    if (this.editingIndex !== null) {
      this.profiles[this.editingIndex] = profile;
      this.editingIndex = null;  // 重置编辑索引
      } else {
        this.profiles.push(profile);
      }
  
      await chrome.storage.local.set({ proxyProfiles: this.profiles });
      this.hideProfileModal();
      this.renderProxyList();
      this.showStatus('Profile saved successfully');
    }
  
    async editProfile(index) {
      this.editingIndex = index;
      this.showProfileModal(this.profiles[index]);
    }
  
    async deleteProfile(index) {
      // 直接删除配置，无需确认
      if (this.activeProfile === index) {
        await this.disableProxy();
      } else if (this.activeProfile > index) {
        this.activeProfile--;
      }
      
      this.profiles.splice(index, 1);
      await chrome.storage.local.set({ proxyProfiles: this.profiles });
      
      this.renderProxyList();
      this.showStatus('Profile deleted');
    }
  
    async activateProfile(index) {
      const profile = this.profiles[index];
      try {
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
          this.showStatus('✗ Failed to activate profile', true);
        }
      } catch (error) {
        console.error('Activation error:', error);
        this.showStatus('✗ Failed to activate profile', true);
      }
    }
  
    async testProfile(index) {
      const profile = this.profiles[index];
      this.showStatus('Testing connection...');
      
      try {
        // 保存当前配置
        const currentConfig = await chrome.proxy.settings.get({});
        
        // 临时设置要测试的代理
        await chrome.runtime.sendMessage({ 
          type: 'SET_PROXY', 
          config: profile.config 
        });
        
        // 测试连接
        const response = await chrome.runtime.sendMessage({
          type: 'TEST_PROXY'
        });
        
        // 恢复原始配置
        if (this.activeProfile !== null) {
          const activeProfile = this.profiles[this.activeProfile];
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
        
        if (response.success) {
          this.showStatus(`✓ Test successful: ${response.ip}`);
        } else {
          this.showStatus('✗ Test failed', true);
        }
      } catch (error) {
        console.error('Test error:', error);
        this.showStatus('✗ Test failed', true);
        
        // 确保恢复原始配置
        if (this.activeProfile !== null) {
          const activeProfile = this.profiles[this.activeProfile];
          await chrome.runtime.sendMessage({ 
            type: 'SET_PROXY', 
            config: activeProfile.config 
          });
        }
      }
    }
  
    async disableProxy() {
      const config = { mode: "direct" };
      try {
        await chrome.runtime.sendMessage({ type: 'SET_PROXY', config });
        this.activeProfile = null;
        await chrome.storage.local.set({ activeProfileId: null });
        document.getElementById('globalProxySwitch').checked = false;
        this.renderProxyList();
        this.showStatus('✓ Proxy disabled');
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