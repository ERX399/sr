// 等待 DOM 内容加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    // --- 1. 配置与初始化 ---
    // 读取全局配置和跳转规则
    const config = window.REDIRECT_CONFIG || {}; // 全局配置
    const rulesIntermediate = window.RULES_INTERMEDIATE || {}; // 中间页跳转规则
    const rulesDirect = window.RULES_DIRECT || {}; // 直接跳转规则
    // 默认回退地址 (如果上述规则都没匹配到，就跳转到这个)
    const fallbackBase = config.fallback || "https://399520.xyz";

    // 获取当前页面的路径 (例如: /about 或 /post/123)
    const path = window.location.pathname;
    
    // 处理路径匹配 (移除末尾的斜杠，除非是根路径)
    let lookupPath = path;
    if (path.length > 1 && path.endsWith('/')) {
        lookupPath = path.slice(0, -1); // 去掉最后一个字符 '/'
    }

    // --- 2. 辅助函数 ---

    // 辅助函数：解析规则值 (支持直接字符串或包含过期时间的对象)
    function getRuleData(ruleValue) {
        if (typeof ruleValue === 'string') {
            // 如果是字符串，直接作为 URL 返回
            return { url: ruleValue };
        } else if (typeof ruleValue === 'object' && ruleValue !== null) {
            // 如果是对象，直接返回该对象 (可能包含 url 和 expired_at 字段)
            return ruleValue;
        }
        return null;
    }

    // 检查规则是否过期
    function isExpired(ruleData) {
        // 如果没有规则数据或没有过期时间字段，视为未过期
        if (!ruleData || !ruleData.expired_at) return false;
        
        try {
            const expireDate = new Date(ruleData.expired_at);
            // 如果日期无效，视为未过期
            if (isNaN(expireDate.getTime())) return false;
            
            const now = new Date();
            // 如果当前时间晚于过期时间，返回 true (已过期)
            return now > expireDate;
        } catch (e) {
            console.error("解析过期日期时出错", e);
            return false;
        }
    }

    // --- 3. 核心匹配逻辑 (查找目标 URL) ---
    
    // 初始化变量
    let target = null; // 目标 URL
    let mode = 'fallback'; // 跳转模式: direct(直接), intermediate(中间页), fallback(回退)
    let ruleData = null; // 存储匹配到的规则数据

    // 1. 检查直接跳转规则 (优先级最高)
    if (rulesDirect[lookupPath]) {
        ruleData = getRuleData(rulesDirect[lookupPath]);
        // 如果规则存在且未过期
        if (ruleData && !isExpired(ruleData)) {
            target = ruleData.url;
            mode = 'direct'; // 设置为直接跳转模式
        }
    } 
    
    // 2. 检查中间页跳转规则 (优先级次之)
    // 注意：这里用了 !target，意味着如果上面 Direct 命中了，这里就不会执行
    if (!target && rulesIntermediate[lookupPath]) {
        ruleData = getRuleData(rulesIntermediate[lookupPath]);
        if (ruleData && !isExpired(ruleData)) {
            target = ruleData.url;
            mode = 'intermediate'; // 设置为中间页模式
        }
    }
    
    // 3. 如果仍然没有找到目标，使用默认回退地址
    if (!target) {
        let base = fallbackBase;
        // 拼接逻辑：确保 base 和 path 之间只有一个斜杠
        if (base.endsWith('/') && path.startsWith('/')) {
            base = base.slice(0, -1); // 去掉 base 末尾的 /
        } else if (!base.endsWith('/') && !path.startsWith('/')) {
            base = base + '/'; // 给 base 加上 /
        }
        target = base + path;
        mode = 'fallback'; 
    }

    // --- 4. URL 构建与安全检查 ---

    // URL 构建逻辑
    // 将当前 URL 的参数 (?a=1) 和锚点 (#top) 传递给目标 URL
    const search = window.location.search; // 例如: ?ref=source
    const hash = window.location.hash; // 例如: #section-2
    let finalUrl = target; // 最终要跳转的完整 URL

    try {
        // 使用 URL API 解析目标 URL
        const url = new URL(target);
        // 获取当前页面的参数
        const currentParams = new URLSearchParams(search);
        // 将当前页面的参数全部添加到目标 URL 中
        currentParams.forEach((value, key) => {
            url.searchParams.set(key, value);
        });
        // 如果有锚点，也加上
        if (hash) {
            url.hash = hash;
        }
        // 转换为字符串
        finalUrl = url.toString();
    } catch (e) {
        console.error("URL 构建失败", e);
        // 如果构建失败，使用简单的字符串拼接
        finalUrl = target + search + hash;
    }

    // 安全检查：防止 XSS (例如 javascript: 协议)
    // 只允许 http 和 https 协议
    try {
        // 解析最终 URL
        const checkUrl = new URL(finalUrl, window.location.origin);
        // 如果协议不是 http: 或 https:，视为不安全
        if (checkUrl.protocol !== 'http:' && checkUrl.protocol !== 'https:') {
            console.error("拦截了潜在的不安全跳转:", finalUrl);
            // 降级到安全页面或显示错误
            finalUrl = "https://399520.xyz/404"; 
            // 如果页面上有显示 URL 的元素，更新其文本
            if (document.getElementById('url-display')) {
                document.getElementById('url-display').textContent = "已阻止不安全的 URL";
            }
            // 强制阻断跳转
            target = null;
        }
    } catch (e) {
        // 如果无法解析 URL，也视为不安全
        console.error("URL 检查失败:", e);
    }

    // --- 5. 执行跳转或显示页面 ---

    // 执行逻辑
    if (mode === 'direct') {
        // 直接跳转模式
        // 显示 Loading... 提示 (如果有对应的元素)
        const urlDisplay = document.getElementById('url-display');
        if (urlDisplay) urlDisplay.textContent = "正在跳转到 " + finalUrl;
        
        // 确保是安全协议才跳转 (双重保险)
        if (target !== null) {
            // window.location.replace 会替换当前历史记录，用户无法通过后退按钮返回
            window.location.replace(finalUrl);
        }
    } else {
        // 中间页模式 (intermediate)
        // 更新 UI，显示一个包含跳转链接的卡片页面
        const urlDisplay = document.getElementById('url-display');
        const redirectLink = document.getElementById('redirect-link');
        const card = document.querySelector('.card');

        // 显示卡片 (如果有 hidden 类的话，这里可以移除)
        if (card) card.style.display = 'block';

        // 显示目标 URL
        if (urlDisplay) {
            urlDisplay.textContent = finalUrl;
        }

        // 设置跳转链接
        if (redirectLink) {
            // 确保是安全协议才设置 href
            if (target !== null) {
                redirectLink.href = finalUrl;
            } else {
                // 如果是不安全的链接，移除 href 并置灰
                redirectLink.removeAttribute('href');
                redirectLink.style.pointerEvents = 'none'; // 禁用点击
                redirectLink.style.opacity = '0.5'; // 半透明显示
                redirectLink.textContent = "不安全的链接";
            }
        }
    }
});
