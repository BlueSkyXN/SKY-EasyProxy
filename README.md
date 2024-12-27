# SKY-EasyProxy

一款面向 Chrome Manifest V3 设计的快捷代理控制插件，提供简洁美观的界面和完整的代理管理功能。本插件专注于代理控制，需要用户自行准备代理服务器。

[![License](https://img.shields.io/github/license/BlueSkyXN/SKY-EasyProxy)](https://github.com/BlueSkyXN/SKY-EasyProxy/blob/main/LICENSE)

## 特性

- 💡 完全支持 Chrome MFv3，无需担心 MFv2 淘汰问题
- 🚀 支持多种代理协议：HTTP、HTTPS、SOCKS4、SOCKS5
- 📋 多代理配置管理，一键切换不同代理
- 🔄 快速测试代理连通性
- 🌐 支持自定义代理绕过规则
- 🎨 现代化界面设计，操作简单直观
- 🔒 安全性好，不收集任何用户数据

## 安装说明

### 手动安装（开发版）

1. 下载本仓库代码/发布包的打包版

2. 打开 Chrome 浏览器，进入扩展程序页面
   - 在地址栏输入：`chrome://extensions/`
   - 或者通过菜单：更多工具 -> 扩展程序

3. 开启开发者模式（右上角开关）

4. 点击"加载已解压的扩展程序"，选择项目文件夹。后续不可删除，否则插件就没了。

## 使用指南

### 基本操作

1. **添加代理配置**
   - 点击"Add Profile"按钮
   - 填写配置信息：
     - Profile Name: 配置名称（比如1080）
     - Proxy Type: 代理类型（HTTP/HTTPS/SOCKS4/SOCKS5）
     - Host: 代理服务器地址（比如127.0.0.1）
     - Port: 代理服务器端口（比如1080）
     - Bypass List: 代理绕过规则（可选）

2. **切换代理**
   - 点击配置列表中的代理条目即可激活
   - 使用顶部开关可以快速开启/关闭代理

3. **测试代理**
   - 点击代理条目中的"Test"按钮
   - 系统会自动检测代理连通性
   - 测试成功会显示当前 IP 地址

4. **编辑/删除代理**
   - 使用配置条目中的"Edit"或"Delete"按钮
   - 编辑配置时支持修改所有参数
   - 删除操作无需确认，请谨慎操作

## 技术说明

### 开发相关

- 基于 Chrome Extensions Manifest V3
- 使用原生 JavaScript，无需额外依赖
- 采用 Chrome Storage API 存储配置
- 支持 Chrome Proxy API 进行代理控制

## FAQ

Q: 为什么选择开发新的代理管理插件？  
A: 随着 Chrome 弃用 Manifest V2，许多现有的代理管理插件将无法使用。本插件采用 MV3 开发，确保长期可用性。

Q: 配置数据保存在哪里？  
A: 所有配置数据使用 Chrome Storage API 本地保存，不会上传到任何服务器。