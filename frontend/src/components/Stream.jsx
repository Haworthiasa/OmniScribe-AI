import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import MarkdownRenderer from './MarkdownRenderer'
import { AppHeader } from './Upload'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const EMPTY_META = { title: '', summary: '', document_type: 'notes', category: '', tags: [], topics: [] }

export default function Stream() {
  const { jobId } = useParams()
  const [job, setJob] = useState(null)
  const [health, setHealth] = useState(null)
  const [metadata, setMetadata] = useState(EMPTY_META)
  const [markdown, setMarkdown] = useState('')
  const [activePage, setActivePage] = useState(1)
  const [view, setView] = useState('source')
  const [connectionWarning, setConnectionWarning] = useState('')
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportResult, setExportResult] = useState(null)
  const statusRef = useRef('queued')

  function applySnapshot(snapshot) {
    setJob(snapshot)
    statusRef.current = snapshot.status
    if (snapshot.metadata) setMetadata(snapshot.metadata)
    if (snapshot.combined_markdown) {
      setMarkdown(snapshot.combined_markdown)
      if (snapshot.status === 'ready') setView('preview')
    }
    if (snapshot.export_result) setExportResult(snapshot.export_result)
    if (snapshot.error) setError(snapshot.error)
  }

  useEffect(() => {
    let cancelled = false
    let events

    async function load() {
      try {
        const response = await fetch(`${API_BASE}/api/jobs/${jobId}`)
        if (!response.ok) throw new Error('Không tìm thấy phiên xử lý này.')
        const snapshot = await response.json()
        if (!cancelled) applySnapshot(snapshot)

        if (!['exported', 'error'].includes(snapshot.status)) {
          events = new EventSource(`${API_BASE}/api/jobs/${jobId}/events?after=${snapshot.last_event_id || 0}`)
          events.onopen = () => setConnectionWarning('')
          events.onmessage = (message) => handleEvent(JSON.parse(message.data))
          events.onerror = async () => {
            if (['exported', 'error'].includes(statusRef.current)) {
              events.close()
              return
            }
            setConnectionWarning('Mất kết nối tạm thời. Đang thử kết nối lại…')
            try {
              const latest = await fetch(`${API_BASE}/api/jobs/${jobId}`).then((result) => result.json())
              if (!cancelled) applySnapshot(latest)
            } catch {
              // EventSource will retry automatically.
            }
          }
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message)
      }
    }

    function handleEvent(event) {
      setJob((current) => {
        if (!current) return current
        const next = { ...current, pages: current.pages.map((page) => ({ ...page })) }
        if (event.type.startsWith('page.')) {
          const page = next.pages.find((item) => item.number === event.page)
          if (page) {
            if (event.type === 'page.ocr_started') page.status = 'processing'
            if (event.type === 'page.ocr_completed') {
              page.status = 'done'
              page.markdown = event.markdown
            }
            if (event.type === 'page.ocr_failed') {
              page.status = 'error'
              page.error = event.error
            }
          }
          next.processed_pages = event.processed_pages ?? next.processed_pages
          next.status = 'processing'
        }
        if (event.type === 'document.organizing') next.status = 'organizing'
        if (event.type === 'document.ready') {
          next.status = 'ready'
          next.metadata = event.metadata
          next.combined_markdown = event.markdown
          setMetadata(event.metadata)
          setMarkdown(event.markdown)
          setView('preview')
        }
        if (event.type === 'job.failed') {
          next.status = 'error'
          next.error = event.error
          setError(event.error)
        }
        if (event.type === 'export.completed') {
          next.status = 'exported'
          next.export_result = event.result
          setExportResult(event.result)
        }
        statusRef.current = next.status
        return next
      })
    }

    load()
    return () => {
      cancelled = true
      events?.close()
    }
  }, [jobId])

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((response) => response.json())
      .then(setHealth)
      .catch(() => setHealth({ offline: true }))
  }, [])

  const progress = useMemo(() => {
    if (!job?.total_pages) return 0
    if (['organizing', 'ready', 'exporting', 'exported'].includes(job.status)) return 100
    return Math.round((job.processed_pages / job.total_pages) * 82)
  }, [job])

  function updateMetadata(field, value) {
    setMetadata((current) => ({ ...current, [field]: value }))
  }

  async function saveToObsidian() {
    setExporting(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE}/api/jobs/${jobId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markdown, metadata }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.detail || 'Không thể lưu tài liệu.')
      setExportResult(result)
      statusRef.current = 'exported'
      setJob((current) => ({ ...current, status: 'exported', export_result: result }))
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setExporting(false)
    }
  }

  if (!job && !error) return <LoadingScreen />
  if (!job) return <FatalScreen message={error} />

  const ready = ['ready', 'exported'].includes(job.status)
  const selectedPage = job.pages.find((page) => page.number === activePage) || job.pages[0]

  return (
    <main className="workspace-shell">
      <AppHeader health={health} />
      <PipelineHeader job={job} progress={progress} />

      {connectionWarning && <div className="notice info compact" role="status">{connectionWarning}</div>}
      {error && <div className="notice danger compact" role="alert">{error}</div>}

      <section className="document-workspace">
        <aside className="page-rail" aria-label="Danh sách trang">
          <div className="rail-heading">
            <span>Pages</span><b>{job.pages.length}</b>
          </div>
          {job.pages.map((page) => (
            <button
              className={page.number === activePage ? 'page-tile active' : 'page-tile'}
              key={page.number}
              type="button"
              onClick={() => { setActivePage(page.number); setView('source') }}
            >
              <img src={`${API_BASE}/api/jobs/${jobId}/pages/${page.number}/image`} alt="" />
              <span>Trang {String(page.number).padStart(2, '0')}</span>
              <i className={`page-state ${page.status}`} aria-label={page.status} />
            </button>
          ))}
          <Link className="new-document-link" to="/">+ Tài liệu mới</Link>
        </aside>

        <section className="document-stage">
          <div className="stage-toolbar">
            <div className="view-switch" role="group" aria-label="Chế độ xem">
              <button className={view === 'source' ? 'active' : ''} onClick={() => setView('source')} type="button">Ảnh gốc</button>
              <button className={view === 'preview' ? 'active' : ''} onClick={() => setView('preview')} type="button">Markdown</button>
              {ready && <button className={view === 'edit' ? 'active' : ''} onClick={() => setView('edit')} type="button">Chỉnh sửa</button>}
            </div>
            <span className="stage-counter">Trang {activePage} / {job.total_pages}</span>
          </div>

          <div className={`stage-canvas ${view}`}>
            {view === 'source' && (
              <img className="source-document" src={`${API_BASE}/api/jobs/${jobId}/pages/${selectedPage.number}/image`} alt={`Ảnh gốc trang ${selectedPage.number}`} />
            )}
            {view === 'preview' && (
              <div className="markdown-paper">
                {selectedPage.markdown ? <MarkdownRenderer markdown={selectedPage.markdown} /> : ready ? <MarkdownRenderer markdown={markdown} /> : <ScanningPlaceholder />}
              </div>
            )}
            {view === 'edit' && (
              <textarea className="markdown-editor" value={markdown} onChange={(event) => setMarkdown(event.target.value)} aria-label="Nội dung Markdown" spellCheck="false" />
            )}
            {job.status === 'processing' && <div className="scan-seam" aria-hidden="true" />}
          </div>
        </section>

        <aside className="inspector">
          <div className="inspector-section pipeline-section">
            <p className="eyebrow">Pipeline</p>
            <StageList status={job.status} />
          </div>

          <div className="inspector-section metadata-section">
            <div className="section-title-row"><p className="eyebrow">Metadata</p>{ready && <span className="ready-label">Có thể sửa</span>}</div>
            <label>Tiêu đề<input value={metadata.title} disabled={!ready} onChange={(event) => updateMetadata('title', event.target.value)} /></label>
            <label>Tóm tắt<textarea rows="3" value={metadata.summary} disabled={!ready} onChange={(event) => updateMetadata('summary', event.target.value)} /></label>
            <div className="field-pair">
              <label>Loại<input value={metadata.document_type} disabled={!ready} onChange={(event) => updateMetadata('document_type', event.target.value)} /></label>
              <label>Danh mục<input value={metadata.category} disabled={!ready} onChange={(event) => updateMetadata('category', event.target.value)} /></label>
            </div>
            <label>Tags<input value={metadata.tags.join(', ')} disabled={!ready} onChange={(event) => updateMetadata('tags', event.target.value.split(',').map((value) => value.trim()).filter(Boolean))} placeholder="toán, ghi-chú" /></label>
            <label>Chủ đề liên kết<input value={metadata.topics.join(', ')} disabled={!ready} onChange={(event) => updateMetadata('topics', event.target.value.split(',').map((value) => value.trim()).filter(Boolean))} placeholder="Học tập, Toán học" /></label>
          </div>

          <div className="inspector-footer">
            {exportResult ? (
              <div className="export-success">
                <span className="success-mark">✓</span>
                <div><strong>Đã lưu vào vault</strong><small>{exportResult.note_path}</small></div>
                <a className="primary-button" href={exportResult.open_uri}>Mở trong Obsidian</a>
                {exportResult.demo_vault && <p>Đây là demo vault trong thư mục backend.</p>}
              </div>
            ) : (
              <button className="primary-button" type="button" onClick={saveToObsidian} disabled={!ready || exporting || !metadata.title.trim()}>
                {exporting ? <><span className="button-spinner" />Đang lưu</> : 'Lưu vào Obsidian'}
              </button>
            )}
          </div>
        </aside>
      </section>
    </main>
  )
}

function PipelineHeader({ job, progress }) {
  const statusText = {
    queued: 'Đang xếp hàng', processing: 'Đang đọc từng trang', organizing: 'Đang tổ chức nội dung',
    ready: 'Sẵn sàng kiểm tra', exporting: 'Đang ghi vào vault', exported: 'Đã hoàn tất', error: 'Cần kiểm tra',
  }[job.status]
  return (
    <div className="pipeline-header">
      <div><p className="eyebrow">Document job</p><h1>{statusText}</h1></div>
      <div className="progress-block">
        <div className="progress-copy"><span>{job.processed_pages} / {job.total_pages} trang</span><b>{progress}%</b></div>
        <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
      </div>
    </div>
  )
}

function StageList({ status }) {
  const order = ['processing', 'organizing', 'ready', 'exported']
  const current = status === 'exporting' ? 3 : Math.max(0, order.indexOf(status))
  const complete = status === 'exported'
  return (
    <ol className="stage-list">
      {['Đọc tài liệu', 'Tổ chức nội dung', 'Kiểm tra bản nháp', 'Lưu vào vault'].map((label, index) => (
        <li className={complete || index < current ? 'done' : index === current ? 'current' : ''} key={label}>
          <span>{complete || index < current ? '✓' : index + 1}</span><div><strong>{label}</strong><small>{complete || index < current ? 'Hoàn tất' : index === current ? 'Đang ở bước này' : 'Chờ'}</small></div>
        </li>
      ))}
    </ol>
  )
}

function ScanningPlaceholder() {
  return <div className="scanning-placeholder"><span /><span /><span /><p>Nội dung trang sẽ xuất hiện khi OCR hoàn tất.</p></div>
}

function LoadingScreen() {
  return <main className="center-screen"><span className="large-spinner" /><p>Đang mở bàn scan…</p></main>
}

function FatalScreen({ message }) {
  return <main className="center-screen"><h1>Không thể mở tài liệu</h1><p>{message}</p><Link className="primary-button" to="/">Quay lại upload</Link></main>
}
