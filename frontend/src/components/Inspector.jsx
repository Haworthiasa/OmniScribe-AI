import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { buildMetadataGraph } from '../lib/graphModel'
import { EMPTY_METADATA, limitPrimaryTags } from '../lib/workbench'
import { Panel } from './WorkbenchShell'

const GraphPreview = lazy(() => import('./graph/GraphPreview'))
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

function listValue(values) {
  return Array.isArray(values) ? values.join(', ') : ''
}

function parseList(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

function preference(key, fallback) {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : JSON.parse(value)
  } catch {
    return fallback
  }
}

export function KnowledgeGraph({ jobId, markdown, metadata, ready }) {
  const [depth, setDepthState] = useState(() => preference('omniscribe.graph.depth', 1))
  const [includeTags, setIncludeTagsState] = useState(() => preference('omniscribe.graph.tags', true))
  const [graph, setGraph] = useState(() => buildMetadataGraph(ready ? metadata : {}))
  const [loading, setLoading] = useState(false)
  const requestId = useRef(0)

  function setDepth(value) {
    setDepthState(value)
    localStorage.setItem('omniscribe.graph.depth', JSON.stringify(value))
  }

  function setIncludeTags(value) {
    setIncludeTagsState(value)
    localStorage.setItem('omniscribe.graph.tags', JSON.stringify(value))
  }

  useEffect(() => {
    const fallback = buildMetadataGraph(ready ? metadata : {}, includeTags)
    if (!ready || !jobId) {
      setGraph(fallback)
      return undefined
    }
    const controller = new AbortController()
    const currentRequest = ++requestId.current
    const timeout = setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(`${API_BASE}/api/jobs/${jobId}/graph-preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({ markdown, metadata, depth, include_tags: includeTags }),
        })
        const result = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(result.detail || 'Không thể đọc graph trong vault.')
        if (currentRequest === requestId.current) setGraph(result)
      } catch (error) {
        if (error.name !== 'AbortError' && currentRequest === requestId.current) {
          setGraph({ ...fallback, vault_available: false, warnings: [error.message] })
        }
      } finally {
        if (currentRequest === requestId.current) setLoading(false)
      }
    }, 400)
    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [depth, includeTags, jobId, markdown, metadata, ready])

  if (!graph.nodes.length) {
    return (
      <div className="graph-empty">
        <span aria-hidden="true">◇—◇</span>
        <strong>Chưa có dữ liệu liên kết</strong>
        <p>Graph sẽ lấy danh mục làm trọng tâm, rồi kết nối tài liệu với notes, chủ đề và tối đa 3 tags.</p>
      </div>
    )
  }
  return (
    <Suspense fallback={<div className="graph-loading" role="status">Đang nạp graph engine…</div>}>
      <GraphPreview
        graph={graph}
        loading={loading}
        depth={depth}
        includeTags={includeTags}
        onDepthChange={setDepth}
        onTagsChange={setIncludeTags}
      />
    </Suspense>
  )
}

export default function Inspector({
  jobId,
  markdown = '',
  metadata = EMPTY_METADATA,
  ready = false,
  onChange = () => {},
  onSave,
  saving = false,
  exportResult,
}) {
  return (
    <>
      <Panel code="B1" title="Metadata" note={ready ? 'Có thể sửa' : 'Chờ document.ready'} className="metadata-panel">
        <fieldset disabled={!ready} className={!ready ? 'metadata-fields is-disabled' : 'metadata-fields'}>
          <legend className="visually-hidden">Metadata tài liệu</legend>
          <label>Tiêu đề<input value={metadata.title} onChange={(event) => onChange('title', event.target.value)} placeholder="Chưa có tiêu đề" /></label>
          <label>Tóm tắt<textarea rows="3" value={metadata.summary} onChange={(event) => onChange('summary', event.target.value)} placeholder="Chưa có tóm tắt" /></label>
          <div className="field-pair">
            <label>Loại<input value={metadata.document_type} onChange={(event) => onChange('document_type', event.target.value)} /></label>
            <label>Danh mục<input value={metadata.category} onChange={(event) => onChange('category', event.target.value)} placeholder="Chưa phân loại" /></label>
          </div>
          <label>Tags<input value={listValue(metadata.tags)} onChange={(event) => onChange('tags', limitPrimaryTags(parseList(event.target.value)))} placeholder="ôn-tập, vật-lý, ghi-chú" /><small className="field-hint">Tối đa 3 tags chủ đạo.</small></label>
          <label>Chủ đề<input value={listValue(metadata.topics)} onChange={(event) => onChange('topics', parseList(event.target.value))} placeholder="Vật lý, Năng lượng" /></label>
        </fieldset>
      </Panel>

      <Panel code="B2" title="Graph preview" note="Local graph" className="graph-panel">
        <KnowledgeGraph jobId={jobId} markdown={markdown} metadata={metadata} ready={ready} />
      </Panel>

      <Panel code="B3" title="Obsidian" note={exportResult ? 'Đã lưu' : 'Xuất bản ghi'} className="save-panel">
        {exportResult ? (
          <div className="export-result" role="status">
            <span aria-hidden="true">✓</span>
            <div><strong>Đã lưu vào vault</strong><small>{exportResult.note_path}</small></div>
            {exportResult.open_uri && <a className="machine-button primary" href={exportResult.open_uri}>Mở trong Obsidian</a>}
            {exportResult.demo_vault && <p>Đây là demo vault trong thư mục backend.</p>}
          </div>
        ) : (
          <>
            <p className="save-copy">Kiểm tra Markdown và metadata trước khi ghi bản note cùng ảnh nguồn vào vault.</p>
            <button className="machine-button primary" type="button" onClick={onSave} disabled={!ready || saving || !metadata.title.trim()}>
              {saving ? 'Đang lưu…' : 'Lưu vào Obsidian'}
            </button>
          </>
        )}
      </Panel>
    </>
  )
}
