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

  // HTML转义函数防止XSS
  escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // 输入验证函数
  validateHost(host) {
    if (typeof host !== 'string') return '';
    // 移除危险字符，只保留合法的主机名字符
    const sanitized = host.replace(/[^a-zA-Z0-9.-]/g, '');
    // 验证基本格式（域名或IP）
    if (!/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/.test(sanitized)) {
      return '';
    }
    return sanitized;
  }

  validatePort(port) {
    // 转换为数字并验证范围
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return '';
    }
    return portNum.toString();
  }

  validateScheme(scheme) {
    const validSchemes = ['http', 'https', 'socks4', 'socks5'];
    return validSchemes.includes(scheme) ? scheme : 'http';
  }

  // 验证和清理profile数据
  sanitizeProfile(profile) {
    if (!profile || typeof profile !== 'object') return null;
    
    try {
      const sanitized = {
        name: this.escapeHtml(profile.name || ''),
        config: {
          mode: "fixed_servers",
          rules: {
            singleProxy: {
              scheme: this.validateScheme(profile.config?.rules?.singleProxy?.scheme),
              host: this.validateHost(profile.config?.rules?.singleProxy?.host),
              port: parseInt(this.validatePort(profile.config?.rules?.singleProxy?.port), 10)
            },
            bypassList: Array.isArray(profile.config?.rules?.bypassList) 
              ? profile.config.rules.bypassList.filter(rule => this.isValidRule(rule))
              : []
          }
        }
      };

      // 验证必要字段
      if (!sanitized.config.rules.singleProxy.host || !sanitized.config.rules.singleProxy.port) {
        return null;
      }

      return sanitized;
    } catch (error) {
      console.error('Error sanitizing profile:', error);
      return null;
    }
  }

  // 安全设置activeProfile并同步到storage
  async setActiveProfile(index) {
    this.activeProfile = index;
    await chrome.storage.local.set({ activeProfileId: index });
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
        <span class="rule-tag ${type}">${this.escapeHtml(rule)}</span>
      `).join('');
      validationDiv.innerHTML += `<div class="valid-rules">${validHtml}</div>`;
    }

    if (invalidRules.length > 0) {
      const invalidHtml = invalidRules.map(rule => `
        <div class="invalid-rule">❌ ${this.escapeHtml(rule)}</div>
      `).join('');
      validationDiv.innerHTML += `<div class="error-list">${invalidHtml}</div>`;
    }
  }

  isValidRule(rule) {
    // CIDR
    if (rule.includes('/')) {
      const [ip, prefix] = rule.split('/');
      const prefixNum = parseInt(prefix);
      return this.isValidIP(ip) && prefixNum >= 0 && prefixNum <= (this.isIPv6(ip) ? 128 : 32);
    }

    // 其他规则类型
    return this.isValidIP(rule) || this.isValidDomain(rule);
  }

  isValidIP(ip) {
    return this.isValidIPv4(ip) || this.isValidIPv6(ip);
  }

  isValidIPv4(rule) {
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(rule)) return false;
    return rule.split('.').every(num => {
      const n = parseInt(num);
      return n >= 0 && n <= 255;
    });
  }

  isValidIPv6(rule) {
    if (!rule.includes(':') && !/^\[.*\]$/.test(rule)) return false;
    const ipv6 = rule.replace(/^\[|\]$/g, '');
    const parts = ipv6.split(':');
    return parts.length >= 2 && parts.length <= 8 &&
           parts.every(part => !part || /^[0-9a-fA-F]{1,4}$/.test(part));
  }

  isIPv6(ip) {
    return ip.includes(':') || /^\[.*\]$/.test(ip);
  }

  isValidDomain(rule) {
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
    
    // 验证和清理所有加载的配置
    this.profiles = proxyProfiles
      .map(profile => this.sanitizeProfile(profile))
      .filter(profile => profile !== null);
    
    // 如果有配置被清理掉，保存清理后的配置
    if (this.profiles.length !== proxyProfiles.length) {
      console.warn(`Removed ${proxyProfiles.length - this.profiles.length} corrupted profiles`);
      await chrome.storage.local.set({ proxyProfiles: this.profiles });
    }
    
    const { activeProfileId } = await chrome.storage.local.get('activeProfileId');
    
    // 验证activeProfileId是否有效
    if (activeProfileId !== null && (activeProfileId < 0 || activeProfileId >= this.profiles.length)) {
      console.warn('Invalid activeProfileId detected, resetting to null');
      await this.setActiveProfile(null);
    } else {
      this.activeProfile = activeProfileId;
    }

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
          <span>${this.escapeHtml(profile.name || profile.config.rules.singleProxy.host)}</span>
          <span class="tag tag-${this.escapeHtml(profile.config.rules.singleProxy.scheme)}">
            ${this.escapeHtml(profile.config.rules.singleProxy.scheme.toUpperCase())}
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
      // 验证和清理profile数据
      const sanitizedProfile = this.sanitizeProfile(profile);
      
      if (sanitizedProfile) {
        nameInput.value = sanitizedProfile.name;
        typeSelect.value = sanitizedProfile.config.rules.singleProxy.scheme;
        hostInput.value = sanitizedProfile.config.rules.singleProxy.host;
        portInput.value = sanitizedProfile.config.rules.singleProxy.port.toString();
        bypassInput.value = sanitizedProfile.config.rules.bypassList.join(', ');
      } else {
        // 如果profile数据无效，显示错误并使用默认值
        console.warn('Invalid profile data detected, using defaults');
        this.showStatus('⚠️ Profile data was corrupted, using default values', true);
        nameInput.value = 'Corrupted Profile';
        typeSelect.value = 'http';
        hostInput.value = '';
        portInput.value = '';
        bypassInput.value = this.defaultBypassRules.basic.join(', ');
      }
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

    // 验证和清理输入
    const validatedHost = this.validateHost(host);
    const validatedPort = this.validatePort(port);
    const validatedScheme = this.validateScheme(type);

    if (!validatedHost || !validatedPort) {
      this.showStatus('Please provide valid host and port', true);
      return;
    }

    // 验证绕过规则
    const invalidRules = bypassList.filter(rule => !this.isValidRule(rule));
    if (invalidRules.length > 0) {
      this.showStatus(`Invalid bypass rules: ${invalidRules.map(rule => this.escapeHtml(rule)).join(', ')}`, true);
      return;
    }

    const profile = {
      name: this.escapeHtml(name || validatedHost),
      config: {
        mode: "fixed_servers",
        rules: {
          singleProxy: {
            scheme: validatedScheme,
            host: validatedHost,
            port: parseInt(validatedPort, 10)
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
        // 关键修复：使用安全方法同步activeProfile变更
        await this.setActiveProfile(this.activeProfile - 1);
      }
      
      this.profiles.splice(index, 1);
      
      // 边缘情况检查：如果删除后activeProfile超出范围，重置为null
      if (this.activeProfile !== null && this.activeProfile >= this.profiles.length) {
        console.warn('ActiveProfile index out of range after deletion, resetting to null');
        await this.setActiveProfile(null);
        await this.disableProxy();
      }
      
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
          await this.setActiveProfile(index);
          document.getElementById('globalProxySwitch').checked = true;
          this.renderProxyList();
          this.showStatus(`✓ Activated: ${this.escapeHtml(profile.name)}`);
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
      
      // 防止并发测试
      if (this.isTesting) {
        this.showStatus('✗ Another test is already in progress', true);
        return;
      }
      
      this.isTesting = true;
      let originalConfig = null;
      
      try {
        // 保存当前实际代理配置
        const currentProxySettings = await chrome.proxy.settings.get({});
        originalConfig = currentProxySettings.value;
        
        // 临时设置要测试的代理
        await chrome.runtime.sendMessage({ 
          type: 'SET_PROXY', 
          config: profile.config 
        });
        
        // 测试连接
        const response = await chrome.runtime.sendMessage({
          type: 'TEST_PROXY'
        });
        
        // 始终恢复到保存的原始配置
        await this.restoreOriginalConfig(originalConfig);
        
        if (response.success) {
          this.showStatus(`✓ Test successful: ${this.escapeHtml(response.ip)}`);
        } else {
          this.showStatus('✗ Test failed', true);
        }
      } catch (error) {
        console.error('Test error:', error);
        this.showStatus('✗ Test failed', true);
        
        // 确保在异常情况下也恢复原始配置
        if (originalConfig !== null) {
          try {
            await this.restoreOriginalConfig(originalConfig);
          } catch (restoreError) {
            console.error('Failed to restore original config:', restoreError);
            this.showStatus('✗ Failed to restore proxy settings', true);
          }
        }
      } finally {
        this.isTesting = false;
      }
    }

    async restoreOriginalConfig(originalConfig) {
      if (!originalConfig) {
        // 如果原配置为空或无效，设置为直连模式
        await chrome.runtime.sendMessage({ 
          type: 'SET_PROXY', 
          config: { mode: "direct" } 
        });
      } else {
        // 恢复原始配置
        await chrome.runtime.sendMessage({ 
          type: 'SET_PROXY', 
          config: originalConfig 
        });
      }
    }
  
    async disableProxy() {
      const config = { mode: "direct" };
      try {
        await chrome.runtime.sendMessage({ type: 'SET_PROXY', config });
        await this.setActiveProfile(null);
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