import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Inspector from './Inspector'
import MarkdownRenderer from './MarkdownRenderer'
import WorkbenchShell, { Panel, Pipeline, StatusLamp } from './WorkbenchShell'
import { EMPTY_METADATA, normalizeMetadata, pageAnchor, resolveDocument, splitDocumentByPage } from '../lib/workbench'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

const PAGE_STATUS = {
  queued: 'Chờ',
  processing: 'Đang OCR',
  done: 'Đã xong',
  error: 'Lỗi',
}

const PHASE_NOTE = {
  queued: 'Đang xếp hàng',
  processing: 'Cập nhật theo từng trang',
  organizing: 'Đang tổ chức nội dung',
  ready: 'Bản final đã sẵn sàng',
  exporting: 'Đang ghi vào vault',
  exported: 'Đã ghi vào vault',
  error: 'Quy trình bị gián đoạn',
}

export default function Stream() {
  const { jobId } = useParams()
  const [job, setJob] = useState(null)
  const [health, setHealth] = useState(null)
  const [metadata, setMetadata] = useState(EMPTY_METADATA)
  const [markdown, setMarkdown] = useState('')
  const [activePage, setActivePage] = useState(1)
  const [view, setView] = useState('markdown')
  const [connectionWarning, setConnectionWarning] = useState('')
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)
  const [exportResult, setExportResult] = useState(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const statusRef = useRef('queued')

  function applySnapshot(snapshot) {
    setJob(snapshot)
    statusRef.current = snapshot.status
    if (snapshot.metadata) setMetadata(normalizeMetadata(snapshot.metadata))
    if (snapshot.combined_markdown) setMarkdown(snapshot.combined_markdown)
    if (snapshot.export_result) setExportResult(snapshot.export_result)
    if (snapshot.error) setError(snapshot.error)
  }

  useEffect(() => {
    let cancelled = false
    let events

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
              page.error = null
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
          setMetadata(normalizeMetadata(event.metadata))
          setMarkdown(event.markdown)
        }
        if (event.type === 'job.failed') {
          next.status = 'error'
          next.error = event.error
          setError(event.error)
        }
        if (event.type === 'export.started') next.status = 'exporting'
        if (event.type === 'export.failed') {
          next.status = 'ready'
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
            if (['exported', 'error'].includes(statusRef.current)) return events.close()
            setConnectionWarning('Mất kết nối tạm thời. Đang thử đồng bộ lại từ snapshot…')
            try {
              const latest = await fetch(`${API_BASE}/api/jobs/${jobId}`).then((result) => result.json())
              if (!cancelled) applySnapshot(latest)
            } catch {
              // EventSource tự thử kết nối lại; snapshot là lớp phục hồi bổ sung.
            }
          }
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message)
      }
    }

    load()
    return () => {
      cancelled = true
      events?.close()
    }
  }, [jobId])

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(setHealth)
      .catch(() => setHealth({ offline: true }))
  }, [])

  const ready = Boolean(job && ['ready', 'exporting', 'exported'].includes(job.status))
  const documentText = useMemo(() => ready ? markdown : resolveDocument(job), [job, markdown, ready])
  const sections = useMemo(() => splitDocumentByPage(documentText, job?.pages), [documentText, job?.pages])

  function selectPage(number) {
    setActivePage(number)
    if (view === 'source') return
    if (view !== 'markdown') setView('markdown')
    requestAnimationFrame(() => document.getElementById(pageAnchor(number))?.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  }

  function updateMetadata(field, value) {
    setMetadata((current) => normalizeMetadata({ ...current, [field]: value }))
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
      setJob((current) => ({ ...current, status: 'ready' }))
    } finally {
      setExporting(false)
    }
  }

  if (!job && !error) return <LoadingScreen />
  if (!job) return <FatalScreen message={error} />

  const selectedPage = job.pages.find((page) => page.number === activePage) || job.pages[0]
  const left = (
    <>
      <Panel code="A1" title="Nguồn tài liệu" note="Chỉ đọc">
        <dl className="job-summary">
          <div><dt>Job</dt><dd title={job.job_id}>{job.job_id.slice(0, 8)}</dd></div>
          <div><dt>Trang</dt><dd>{job.total_pages}</dd></div>
          <div><dt>Tạo lúc</dt><dd>{new Date(job.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</dd></div>
        </dl>
        <Link className="machine-button secondary full" to="/">Tạo tài liệu mới</Link>
      </Panel>

      <Panel code="A2" title="Hàng đợi trang" note={`${job.processed_pages}/${job.total_pages}`} className="queue-machine-panel">
        <ol className="job-page-queue">
          {job.pages.map((page) => (
            <li key={page.number}>
              <button className={page.number === activePage ? 'job-page-row active' : 'job-page-row'} type="button" onClick={() => selectPage(page.number)} aria-current={page.number === activePage ? 'page' : undefined}>
                <span className="folio">{String(page.number).padStart(2, '0')}</span>
                <img src={`${API_BASE}/api/jobs/${jobId}/pages/${page.number}/image`} alt="" />
                <span className="queue-copy"><strong>{page.filename}</strong><small>{PAGE_STATUS[page.status]}</small></span>
                <StatusLamp tone={page.status === 'done' ? 'success' : page.status === 'error' ? 'danger' : page.status === 'processing' ? 'active' : 'idle'}>
                  <span className="visually-hidden">{PAGE_STATUS[page.status]}</span>
                </StatusLamp>
              </button>
              {page.error && <p className="page-error-copy">{page.error}</p>}
            </li>
          ))}
        </ol>
      </Panel>

      <Panel code="A3" title="Pipeline" note="5 bước"><Pipeline phase={job.status} /></Panel>
    </>
  )

  const center = (
    <Panel code="M1" title="OCR Markdown trực tiếp" note={PHASE_NOTE[job.status]} className="console-panel">
      {(connectionWarning || error) && (
        <div className={`machine-notice ${error ? 'danger' : 'warning'} console-notice`} role={error ? 'alert' : 'status'}>
          <strong>{error ? 'Cần kiểm tra' : 'Đang đồng bộ lại'}</strong><span>{error || connectionWarning}</span>
        </div>
      )}
      <div className="console-toolbar" role="toolbar" aria-label="Chế độ xem tài liệu">
        <button className={view === 'markdown' ? 'active' : ''} type="button" onClick={() => setView('markdown')}>Markdown</button>
        <button className={view === 'source' ? 'active' : ''} type="button" onClick={() => setView('source')}>Ảnh gốc</button>
        <button className={view === 'preview' ? 'active' : ''} type="button" onClick={() => setView('preview')}>Xem trước</button>
        <button className={view === 'edit' ? 'active' : ''} type="button" onClick={() => setView('edit')} disabled={!ready}>Chỉnh sửa</button>
        <button className="inspector-trigger" type="button" onClick={() => setInspectorOpen(true)}>Metadata</button>
      </div>
      <div className={`console-viewport view-${view}`}>
        {view === 'markdown' && <RawMarkdownDocument sections={sections} activePage={activePage} processing={job.status === 'processing'} />}
        {view === 'source' && (
          <figure className="source-view">
            <img src={`${API_BASE}/api/jobs/${jobId}/pages/${selectedPage.number}/image`} alt={`Ảnh gốc trang ${selectedPage.number}: ${selectedPage.filename}`} />
            <figcaption>Trang {selectedPage.number} · {selectedPage.filename}</figcaption>
          </figure>
        )}
        {view === 'preview' && <div className="preview-paper"><MarkdownRenderer markdown={documentText} /></div>}
        {view === 'edit' && <textarea className="markdown-editor" value={markdown} onChange={(event) => setMarkdown(event.target.value)} aria-label="Chỉnh sửa toàn bộ Markdown" spellCheck="false" />}
      </div>
    </Panel>
  )

  return (
    <WorkbenchShell
      health={health}
      phase={job.status}
      processedPages={job.processed_pages}
      totalPages={job.total_pages}
      left={left}
      center={center}
      right={<Inspector jobId={jobId} markdown={markdown} metadata={metadata} ready={ready} onChange={updateMetadata} onSave={saveToObsidian} saving={exporting} exportResult={exportResult} />}
      inspectorOpen={inspectorOpen}
      onInspectorClose={() => setInspectorOpen(false)}
    />
  )
}

function RawMarkdownDocument({ sections, activePage, processing }) {
  let lineNumber = 0
  return (
    <div className="raw-console" aria-label="Markdown thô có số dòng">
      {sections.map((section) => (
        <section className={`raw-page-section ${section.number === activePage ? 'active' : ''} ${processing ? 'scanning' : ''}`} id={pageAnchor(section.number)} key={section.number} tabIndex="-1">
          <div className="raw-page-label">PAGE {String(section.number).padStart(2, '0')}</div>
          {(section.text || ' ').split('\n').map((line) => {
            lineNumber += 1
            return <div className="code-line" key={`${section.number}-${lineNumber}`}><span aria-hidden="true">{String(lineNumber).padStart(3, '0')}</span><code>{line || ' '}</code></div>
          })}
        </section>
      ))}
    </div>
  )
}

function LoadingScreen() {
  return <main className="center-screen"><StatusLamp tone="active">Đang mở workstation</StatusLamp><p>Đang tải snapshot của tài liệu…</p></main>
}

function FatalScreen({ message }) {
  return <main className="center-screen"><h1>Không thể mở tài liệu</h1><p>{message}</p><Link className="machine-button primary" to="/">Quay lại upload</Link></main>
}
