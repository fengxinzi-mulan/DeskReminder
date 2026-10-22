import { Droplet, HeartPulse, Lock, MonitorSmartphone } from "lucide-react";

export function AboutPanel(props: { version: string }) {
  return (
    <div className="space-y-5">
      <section className="card overflow-hidden">
        <div
          className="relative px-7 py-8"
          style={{
            background:
              "radial-gradient(120% 160% at 0% 0%, var(--accent-soft), transparent 55%), linear-gradient(135deg, var(--card) 0%, var(--card-2) 100%)",
          }}
        >
          <div className="flex items-center gap-4">
            <div className="brand-icon flex h-14 w-14 items-center justify-center rounded-2xl">
              <Droplet className="h-7 w-7" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">桌面提醒</h2>
              <p className="hint mt-1">DeskReminder · {props.version}</p>
            </div>
          </div>
          <p className="mt-5 max-w-xl text-[13px] leading-6" style={{ color: "var(--muted)" }}>
            一个专注桌面健康的轻量提醒工具。到点用顶部卡片提醒喝水、起立活动，
            支持完全自定义的提醒类型和定时规则。
          </p>
        </div>
        <div className="grid grid-cols-3 gap-px" style={{ background: "var(--border)" }}>
          {[
            { icon: HeartPulse, title: "健康节奏", text: "喝水与起立分开排期" },
            { icon: MonitorSmartphone, title: "双平台", text: "Windows / macOS" },
            { icon: Lock, title: "纯本地", text: "不联网、不上传数据" },
          ].map((item) => (
            <div
              key={item.title}
              className="px-5 py-5"
              style={{ background: "var(--card)" }}
            >
              <item.icon className="h-4 w-4" style={{ color: "var(--accent)" }} />
              <div className="mt-2 text-[13px] font-semibold">{item.title}</div>
              <div className="hint mt-0.5">{item.text}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-header">
          <h2 className="text-[15px] font-semibold">行为说明</h2>
        </div>
        <div className="card-body space-y-3 text-[13px] leading-6" style={{ color: "var(--muted)" }}>
          <p>· 提醒只在屏幕解锁、系统未睡眠时弹出；锁屏期间到点会在解锁后的下一次检查补发。</p>
          <p>· 睡眠或休眠恢复后不会补发错过的提醒，而是直接重排下一次。</p>
          <p>· 多个提醒同时到期时依次展示，不会叠在一起。</p>
          <p>· 单次提醒到点只弹一次；开启「提醒后删除」时，弹窗关闭后会自动从设置中移除。</p>
          <p>· 设置修改会自动保存；非法值会就地提示且不会写入配置。</p>
          <p>· 技术栈：Tauri 2 + React 19 + Rust，使用系统 WebView，不附带浏览器内核。</p>
        </div>
      </section>
    </div>
  );
}
