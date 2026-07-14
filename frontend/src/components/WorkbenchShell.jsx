import { Link } from 'react-router-dom'

const PHASE_LABELS = {
  queued: 'Đang xếp hàng',
  processing: 'GLM OCR đang chạy',
  organizing: 'Đang tổ chức nội dung',
  ready: 'Sẵn sàng kiểm tra',
  exporting: 'Đang lưu Obsidian',
  exported: 'Đã lưu Obsidian',
  error: 'Cần kiểm tra',
  upload: 'Chưa bắt đầu',
}

export function Panel({ code, title, note, children, className = '', as: Element = 'section' }) {
  return (
    <Element className={`machine-panel ${className}`.trim()}>
      <header className="panel-bar">
        <span className="panel-code">{code}</span>
        <h2>{title}</h2>
        {note && <span className="panel-note">{note}</span>}
      </header>
      <div className="panel-body">{children}</div>
    </Element>
  )
}

export function StatusLamp({ tone = 'idle', children }) {
  return <span className={`status-lamp ${tone}`}><i aria-hidden="true" />{children}</span>
}

export default function WorkbenchShell({
  health,
  phase = 'upload',
  processedPages = 0,
  totalPages = 0,
  left,
  center,
  right,
  inspectorOpen = false,
  onInspectorClose,
}) {
  const backendTone = health?.offline ? 'danger' : health ? (health.demo_mode ? 'warning' : 'success') : 'idle'
  const backendLabel = health?.offline ? 'Backend offline' : health ? (health.demo_mode ? 'Chế độ demo' : 'Backend sẵn sàng') : 'Đang kết nối'
  const progress = totalPages ? Math.round((processedPages / totalPages) * 100) : 0

  return (
    <main className="workbench-shell">
      <header className="machine-header">
        <Link className="machine-wordmark" to="/" aria-label="OmniScribe AI — trang chủ">
          <span className="wordmark-registration" aria-hidden="true">OS</span>
          <span>OMNISCRIBE <b>AI</b></span>
          <small>Proofing workstation</small>
        </Link>
        <div className="machine-readouts" aria-label="Trạng thái hệ thống">
          <StatusLamp tone={backendTone}>{backendLabel}</StatusLamp>
          <span className="header-readout"><small>Pha</small>{PHASE_LABELS[phase] || phase}</span>
          <span className="header-readout"><small>Trang</small>{processedPages}/{totalPages}</span>
          <span className="header-progress" aria-label={`Tiến độ ${progress}%`}>
            <i style={{ width: `${progress}%` }} />
            <b>{progress}%</b>
          </span>
        </div>
      </header>

      <div className="workbench-grid">
        <aside className="workbench-left" aria-label="Nguồn và quy trình">{left}</aside>
        <section className="workbench-center" aria-label="Bản OCR Markdown">{center}</section>
        <aside className={`workbench-right ${inspectorOpen ? 'is-open' : ''}`} aria-label="Metadata và knowledge graph">
          <button className="drawer-close icon-button" type="button" onClick={onInspectorClose} aria-label="Đóng bảng metadata">×</button>
          {right}
        </aside>
        {inspectorOpen && <button className="drawer-scrim" type="button" onClick={onInspectorClose} aria-label="Đóng bảng metadata" />}
      </div>
    </main>
  )
}

export function Pipeline({ phase = 'upload' }) {
  const steps = [
    ['Nhận trang', ['processing', 'organizing', 'ready', 'exporting', 'exported']],
    ['GLM OCR', ['organizing', 'ready', 'exporting', 'exported']],
    ['Tổ chức nội dung', ['ready', 'exporting', 'exported']],
    ['Kiểm tra bản nháp', ['exporting', 'exported']],
    ['Lưu Obsidian', ['exported']],
  ]
  const activeByPhase = { upload: 0, queued: 0, processing: 1, organizing: 2, ready: 3, exporting: 4, exported: 5, error: -1 }
  const active = activeByPhase[phase] ?? 0
  return (
    <ol className="pipeline-list">
      {steps.map(([label, completePhases], index) => {
        const done = completePhases.includes(phase)
        const current = index === active
        return (
          <li className={done ? 'done' : current ? 'current' : phase === 'error' ? 'failed' : ''} key={label}>
            <span aria-hidden="true">{done ? '✓' : String(index + 1).padStart(2, '0')}</span>
            <div><strong>{label}</strong><small>{done ? 'Hoàn tất' : current ? 'Đang ở bước này' : phase === 'error' ? 'Bị gián đoạn' : 'Chờ'}</small></div>
          </li>
        )
      })}
    </ol>
  )
}
