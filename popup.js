class SKYProxy {
    constructor() {
      this.profiles = [];
      this.activeProfile = null;
      this.initUI();
      this.loadProfiles();
    }
  
    async initUI() {
      const container = document.createElement('div');
      container.className = 'container';
      container.innerHTML = `
        <div id="status" class="status"></div>
        
        <div class="header">
          <h2 style="margin:0">SKY-Proxy</h2>
          <button id="addProfileBtn" class="btn btn-primary">Add Profile</button>
        </div>
  
        <div id="proxyList" class="proxy-list"></div>
  
        <div id="profileModal" class="modal">
          <div class="modal-content">
            <h3>Add/Edit Proxy Profile</h3>
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
              <input type="text" id="bypassList" placeholder="Bypass List (comma separated)">
            </div>
            <div style="display:flex;gap:8px;margin-top:16px">
              <button id="saveProfileBtn" class="btn btn-primary">Save</button>
              <button id="cancelProfileBtn" class="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      `;
  
      document.getElementById('app').appendChild(container);
  
      // Add event listeners
      document.getElementById('addProfileBtn').addEventListener('click', () => this.showProfileModal());
      document.getElementById('saveProfileBtn').addEventListener('click', () => this.saveProfile());
      document.getElementById('cancelProfileBtn').addEventListener('click', () => this.hideProfileModal());
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
  
    async loadProfiles() {
      const { proxyProfiles = [] } = await chrome.storage.local.get('proxyProfiles');
      this.profiles = proxyProfiles;
      const { activeProfileId } = await chrome.storage.local.get('activeProfileId');
      this.activeProfile = activeProfileId;
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
            <span>${profile.name}</span>
            <span class="tag tag-${profile.config.rules.singleProxy.scheme}">
              ${profile.config.rules.singleProxy.scheme.toUpperCase()}
            </span>
          </div>
          <div class="actions">
            <button class="btn btn-secondary test-btn" data-index="${index}">Test</button>
            <button class="btn btn-secondary edit-btn" data-index="${index}">Edit</button>
            <button class="btn btn-secondary delete-btn" data-index="${index}">Delete</button>
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
      const nameInput = document.getElementById('profileName');
      const typeSelect = document.getElementById('proxyType');
      const hostInput = document.getElementById('proxyHost');
      const portInput = document.getElementById('proxyPort');
      const bypassInput = document.getElementById('bypassList');
  
      if (profile) {
        nameInput.value = profile.name;
        typeSelect.value = profile.config.rules.singleProxy.scheme;
        hostInput.value = profile.config.rules.singleProxy.host;
        portInput.value = profile.config.rules.singleProxy.port;
        bypassInput.value = profile.config.rules.bypassList.join(', ');
      } else {
        nameInput.value = '';
        typeSelect.value = 'http';
        hostInput.value = '';
        portInput.value = '';
        bypassInput.value = 'localhost, 127.0.0.1';
      }
  
      modal.style.display = 'flex';
    }
  
    hideProfileModal() {
      document.getElementById('profileModal').style.display = 'none';
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
  
      if (!name || !host || !port) {
        this.showStatus('Please fill in all required fields', true);
        return;
      }
  
      const profile = {
        name,
        config: {
          mode: "fixed_servers",
          rules: {
            singleProxy: {
              scheme: type,
              host: host,
              port: parseInt(port, 10)
            },
            bypassList
          }
        }
      };
  
      this.profiles.push(profile);
      await chrome.storage.local.set({ proxyProfiles: this.profiles });
      this.hideProfileModal();
      this.renderProxyList();
      this.showStatus('Profile saved successfully');
    }
  
    async deleteProfile(index) {
      if (confirm('Are you sure you want to delete this profile?')) {
        this.profiles.splice(index, 1);
        if (this.activeProfile === index) {
          this.activeProfile = null;
          await this.disableProxy();
        }
        await chrome.storage.local.set({ proxyProfiles: this.profiles });
        this.renderProxyList();
        this.showStatus('Profile deleted');
      }
    }
  
    editProfile(index) {
      this.showProfileModal(this.profiles[index]);
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
          this.renderProxyList();
          this.showStatus(`Activated profile: ${profile.name}`);
        } else {
          this.showStatus('Failed to activate profile', true);
        }
      } catch (error) {
        this.showStatus('Failed to activate profile', true);
      }
    }
  
    async testProfile(index) {
      const profile = this.profiles[index];
      this.showStatus('Testing connection...');
      
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'TEST_PROXY',
          config: profile.config
        });
        
        if (response.success) {
          this.showStatus(`Connection successful: ${response.ip}`);
        } else {
          this.showStatus('Connection failed', true);
        }
      } catch (error) {
        this.showStatus('Connection test failed', true);
      }
    }
  
    async disableProxy() {
      const config = { mode: "direct" };
      try {
        await chrome.runtime.sendMessage({ type: 'SET_PROXY', config });
        this.activeProfile = null;
        await chrome.storage.local.set({ activeProfileId: null });
        this.renderProxyList();
        this.showStatus('Proxy disabled');
      } catch (error) {
        this.showStatus('Failed to disable proxy', true);
      }
    }
  }
  
  // Initialize the proxy manager when the popup loads
  let proxyManager;
  document.addEventListener('DOMContentLoaded', () => {
    proxyManager = new SKYProxy();
  });