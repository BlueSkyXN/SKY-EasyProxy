// bypass-rules.js

class BypassRules {
    // 基础模板规则
    static templates = {
        minimal: ['localhost', '127.0.0.1'],
        basic: ['localhost', '127.0.0.1', '[::1]', '*.localhost', '*.local'],
        development: [
            'localhost', '127.0.0.1', '[::1]',
            '*.localhost', '*.local', '*.test',
            '*.development', '192.168.0.0/16'
        ],
        china: [
            'localhost', '127.0.0.1', '[::1]',
            '*.cn', '*.com.cn', '*.edu.cn', '*.gov.cn',
            '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'
        ]
    };

    // 验证IPv4地址
    static isValidIPv4(ip) {
        if (!ip) return false;
        const parts = ip.split('.');
        if (parts.length !== 4) return false;
        return parts.every(part => {
            const num = Number(part);
            return num >= 0 && num <= 255 && part === num.toString();
        });
    }

    // 验证IPv6地址
    static isValidIPv6(ip) {
        try {
            // 去除方括号
            ip = ip.replace(/^\[|\]$/g, '');
            // 简单的IPv6格式验证
            const parts = ip.split(':');
            return parts.length >= 2 && parts.length <= 8 &&
                   parts.every(part => !part || /^[0-9a-fA-F]{1,4}$/.test(part));
        } catch (e) {
            return false;
        }
    }

    // 验证CIDR
    static isValidCIDR(cidr) {
        try {
            const [ip, prefix] = cidr.split('/');
            if (!this.isValidIPv4(ip)) return false;
            const prefixNum = parseInt(prefix);
            return prefixNum >= 0 && prefixNum <= 32;
        } catch (e) {
            return false;
        }
    }

    // 验证域名
    static isValidDomain(domain) {
        // 处理通配符域名
        if (domain.startsWith('*.')) {
            domain = domain.slice(2);
        }
        const domainRegex = /^[a-zA-Z0-9][-a-zA-Z0-9]*(\.[a-zA-Z0-9][-a-zA-Z0-9]*)*$/;
        return domainRegex.test(domain);
    }

    // 验证单个规则
    static validateRule(rule) {
        if (!rule) return { valid: false, error: '规则不能为空' };
        
        rule = rule.trim();

        // IPv4 CIDR
        if (rule.includes('/')) {
            return {
                valid: this.isValidCIDR(rule),
                error: '无效的CIDR格式',
                type: 'cidr'
            };
        }

        // IPv6
        if (rule.includes(':') || rule.startsWith('[')) {
            return {
                valid: this.isValidIPv6(rule),
                error: '无效的IPv6地址',
                type: 'ipv6'
            };
        }

        // IPv4
        if (/^(\d{1,3}\.){3}\d{1,3}$/.test(rule)) {
            return {
                valid: this.isValidIPv4(rule),
                error: '无效的IPv4地址',
                type: 'ipv4'
            };
        }

        // 域名（包括通配符）
        return {
            valid: this.isValidDomain(rule.replace(/^\*\./, '')),
            error: '无效的域名格式',
            type: 'domain'
        };
    }

    // 解析规则列表
    static parseRules(input) {
        if (!input) return { valid: [], invalid: [] };
        
        const rules = input.split(',').map(r => r.trim()).filter(r => r);
        const valid = [];
        const invalid = [];

        rules.forEach(rule => {
            const result = this.validateRule(rule);
            if (result.valid) {
                valid.push({ rule, type: result.type });
            } else {
                invalid.push({ rule, error: result.error });
            }
        });

        return { valid, invalid };
    }

    // 获取模板规则
    static getTemplate(name) {
        return this.templates[name] || this.templates.basic;
    }

    // 格式化规则列表为字符串
    static formatRules(rules) {
        if (!Array.isArray(rules)) return '';
        return rules.join(', ');
    }
}

export default BypassRules;