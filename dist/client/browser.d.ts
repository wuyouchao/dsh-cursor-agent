/** 认证链接只允许官方 HTTPS 域，不允许凭据和自定义端口。 */
export declare function safeLoginUrl(value: string | undefined): string | undefined;
/** 剪贴板缺失、同步拒绝和异步拒绝都转为用户可见反馈。 */
export declare function copyLoginUrl(url: string, clipboard?: Pick<Clipboard, "writeText"> | undefined): Promise<string>;
//# sourceMappingURL=browser.d.ts.map