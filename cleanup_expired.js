
const fs = require('fs');
const path = require('path');

// 文件路径
const INTERMEDIATE_RULES_PATH = path.join(__dirname, 'js/rules_intermediate.js');
const DIRECT_RULES_PATH = path.join(__dirname, 'js/rules_direct.js');

// 辅助函数：解析规则文件
function parseRules(filePath) {
    if (!fs.existsSync(filePath)) return null;
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const jsonStart = content.indexOf('{');
    const jsonEnd = content.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1) return null;
    
    const jsonStr = content.substring(jsonStart, jsonEnd + 1);
    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error(`解析 ${filePath} 错误:`, e);
        return null;
    }
}

// 辅助函数：写入规则文件
function writeRules(filePath, varName, rules) {
    const newJsonStr = JSON.stringify(rules, null, 4);
    const newContent = `window.${varName} = ${newJsonStr};\n`;
    fs.writeFileSync(filePath, newContent, 'utf-8');
}

// 辅助函数：清理过期规则
function cleanExpiredRules(filePath, varName) {
    const rules = parseRules(filePath);
    if (!rules) return false;

    const now = new Date();
    let hasChanges = false;
    const newRules = {};

    for (const [key, value] of Object.entries(rules)) {
        if (value.expired_at) {
            const expireDate = new Date(value.expired_at);
            // 如果日期有效且已过期
            if (!isNaN(expireDate.getTime()) && now > expireDate) {
                console.log(`删除过期规则: ${key} (过期时间 ${value.expired_at})`);
                hasChanges = true;
                continue; // 跳过此条目，即删除
            }
        }
        // 保留未过期或无过期时间的规则
        newRules[key] = value;
    }

    if (hasChanges) {
        writeRules(filePath, varName, newRules);
        console.log(`更新了 ${filePath}`);
    } else {
        console.log(`在 ${filePath} 中未找到过期规则`);
    }
    
    return hasChanges;
}

// 执行清理
console.log("开始清理检查...");
const changedIntermediate = cleanExpiredRules(INTERMEDIATE_RULES_PATH, 'RULES_INTERMEDIATE');
const changedDirect = cleanExpiredRules(DIRECT_RULES_PATH, 'RULES_DIRECT');

if (changedIntermediate || changedDirect) {
    console.log("清理完成，有变更");
    // 退出码 0 表示成功，外部脚本可以根据是否有输出来判断是否需要提交，或者总是提交
} else {
    console.log("清理完成，无变更");
}
