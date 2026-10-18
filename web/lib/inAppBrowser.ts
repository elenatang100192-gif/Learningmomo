/**
 * 检测是否在「内置浏览器」里（微信/微博/支付宝/抖音/QQ 等）
 *
 * 这些内置浏览器即使在 HTTPS 下也有严重的 API 限制：
 *   - 麦克风权限
 *   - 视频自动播放
 *   - Web Speech API
 *   - Service Worker
 *   - 摄像头
 *
 * 学员需要在 Safari/Chrome/Edge 中打开。
 */

export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';

  // 微信
  if (/MicroMessenger/i.test(ua)) return true;
  // 微博
  if (/Weibo/i.test(ua)) return true;
  // 支付宝
  if (/AlipayClient/i.test(ua)) return true;
  // 抖音
  if (/BytedanceWebview|Douyin/i.test(ua)) return true;
  // QQ
  if (/\bQQ\b/i.test(ua)) return true;
  // 钉钉
  if (/DingTalk/i.test(ua)) return true;
  // 飞书
  if (/Lark|Feishu/i.test(ua)) return true;
  // 企业微信
  if (/wxwork/i.test(ua)) return true;
  // 百度
  if (/baiduboxapp/i.test(ua)) return true;

  return false;
}

/**
 * 「请在浏览器中打开」提示文案 + 引导
 *
 * 不同内置浏览器引导用户「点右上角 → 在浏览器中打开」：
 *   - iOS: Safari 打开
 *   - Android: Chrome 打开
 */
export function getOpenInBrowserTip(): {
  show: boolean;
  title: string;
  steps: string[];
} {
  if (typeof navigator === 'undefined') return { show: false, title: '', steps: [] };
  if (!isInAppBrowser()) return { show: false, title: '', steps: [] };

  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  if (/MicroMessenger/i.test(ua)) {
    return {
      show: true,
      title: '请在浏览器中打开',
      steps: isIOS
        ? ['点右上角「···」', '选择「在Safari中打开」']
        : ['点右上角「···」', '选择「在浏览器中打开」'],
    };
  }

  return {
    show: true,
    title: '请在浏览器中打开',
    steps: isIOS
      ? ['点右下角「···」', '选择「在Safari中打开」']
      : ['点右上角「···」', '选择「在浏览器中打开」'],
  };
}
