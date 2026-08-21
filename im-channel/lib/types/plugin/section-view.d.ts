/**
 * 惰性 settings 节视图（防陈旧快照）。
 *
 * dsh-settings 的两条语义决定了消费方绝不能缓存快照值：
 *   1. commit 是「换引用」——每次变更用新的 deepFreeze 对象替换
 *      registration.resolved，scope.get() 恒返回最新 resolved；
 *   2. installSettingsSection 的 setSource 仅在注册时调用一次，之后的
 *      变更只触发 onChange（不携带新值，watcher 的 (next, prev) 参数被
 *      包装层丢弃）。
 *
 * 因此必须保留 setSource 传入的 source 活引用，所有读取统一走 read()
 * 惰性求值。曾因缓存快照出过线上事故：插件把 source() 的结果存进闭包
 * 变量，运行期加实例/存凭证/白名单改动全部读到启动时刻的空快照，
 * 路由重建永远空跑、只有重启才能恢复。回归测试见 tests/section-view.test.ts
 * （用真实 cordis + 真实 dsh-settings 驱动，复刻「commit 换引用 +
 * setSource 仅调一次」语义）。
 */
/** 惰性节视图。 */
export interface SectionView<T> {
    /** 读取节当前值：settings 挂载期间返回最新 resolved，未挂载/卸载后返回组合基线。 */
    read(): T;
    /** setSource 接收端：adopt 真实 source（活引用）；服务卸载回退时会收到 () => entry。 */
    adopt(source: () => T): void;
}
/** 创建惰性节视图；initial 为插件组合基线（settings 服务缺席时的取值）。 */
export declare function createSectionView<T>(initial: T): SectionView<T>;
