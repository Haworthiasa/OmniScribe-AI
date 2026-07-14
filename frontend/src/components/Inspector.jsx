import { buildKnowledgeGraph, EMPTY_METADATA } from '../lib/workbench'
import { Panel } from './WorkbenchShell'

function listValue(values) {
  return Array.isArray(values) ? values.join(', ') : ''
}

function parseList(value) {
  return value.split(',').map((item) => item.trim()).filter(Boolean)
}

export function KnowledgeGraph({ metadata, ready }) {
  const graph = buildKnowledgeGraph(ready ? metadata : {})
  if (!graph.nodes.length) {
    return (
      <div className="graph-empty">
        <span aria-hidden="true">◇—◇</span>
        <strong>Chưa có dữ liệu liên kết</strong>
        <p>Graph sẽ được dựng từ tiêu đề, chủ đề và tags sau khi tài liệu sẵn sàng.</p>
      </div>
    )
  }
  const byId = new Map(graph.nodes.map((node) => [node.id, node]))
  return (
    <div className="graph-wrap">
      <svg className="knowledge-graph" viewBox="0 0 320 220" role="img" aria-labelledby="graph-title graph-desc">
        <title id="graph-title">Knowledge graph của tài liệu</title>
        <desc id="graph-desc">Tiêu đề ở trung tâm, nối trực tiếp tới các chủ đề và tags.</desc>
        <g className="graph-edges">
          {graph.edges.map((edge) => {
            const from = byId.get(edge.from)
            const to = byId.get(edge.to)
            return <line key={`${edge.from}-${edge.to}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
          })}
        </g>
        <g className="graph-nodes">
          {graph.nodes.map((node) => (
            <g className={`graph-node ${node.type}`} key={node.id} transform={`translate(${node.x} ${node.y})`}>
              <circle r={node.type === 'title' ? 24 : node.type === 'topic' ? 14 : 10} />
              <text y={node.type === 'title' ? 36 : 25} textAnchor="middle">{node.label.length > 18 ? `${node.label.slice(0, 16)}…` : node.label}</text>
            </g>
          ))}
        </g>
      </svg>
      <div className="visually-hidden">
        <p>Tiêu đề: {metadata.title}</p>
        <p>Chủ đề: {graph.topics.join(', ') || 'Không có'}</p>
        <p>Tags: {graph.tags.join(', ') || 'Không có'}</p>
      </div>
      <div className="graph-key" aria-hidden="true"><span>● Tiêu đề</span><span>● Chủ đề</span><span>● Tag</span></div>
    </div>
  )
}

export default function Inspector({
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
          <label>Tags<input value={listValue(metadata.tags)} onChange={(event) => onChange('tags', parseList(event.target.value))} placeholder="ôn-tập, vật-lý" /></label>
          <label>Chủ đề<input value={listValue(metadata.topics)} onChange={(event) => onChange('topics', parseList(event.target.value))} placeholder="Vật lý, Năng lượng" /></label>
        </fieldset>
      </Panel>

      <Panel code="B2" title="Graph preview" note="Suy ra cục bộ" className="graph-panel">
        <KnowledgeGraph metadata={metadata} ready={ready} />
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
