import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Inspector from './Inspector'
import WorkbenchShell, { Panel, Pipeline, StatusLamp } from './WorkbenchShell'
import { EMPTY_METADATA } from '../lib/workbench'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const MAX_FILES = 8
const MAX_BYTES = 10 * 1024 * 1024
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png'])

function isAcceptedImage(file) {
  return ACCEPTED_TYPES.has(file.type) || /\.(jpe?g|png)$/i.test(file.name)
}

function makeFileItem(file) {
  return {
    id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
    file,
    preview: URL.createObjectURL(file),
  }
}

export default function Upload() {
  const [items, setItems] = useState([])
  const [health, setHealth] = useState(null)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [draggingId, setDraggingId] = useState(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const inputRef = useRef(null)
  const itemsRef = useRef([])
  const navigate = useNavigate()

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(setHealth)
      .catch(() => setHealth({ offline: true }))
  }, [])

  useEffect(() => { itemsRef.current = items }, [items])
  useEffect(() => () => itemsRef.current.forEach((item) => URL.revokeObjectURL(item.preview)), [])

  function addFiles(fileList) {
    const incoming = Array.from(fileList)
    const invalid = incoming.find((file) => !isAcceptedImage(file))
    if (invalid) return setError(`${invalid.name} không phải ảnh JPG hoặc PNG.`)
    const tooLarge = incoming.find((file) => file.size > MAX_BYTES)
    if (tooLarge) return setError(`${tooLarge.name} vượt quá giới hạn 10 MB.`)
    if (items.length + incoming.length > MAX_FILES) return setError(`Mỗi lần chỉ xử lý tối đa ${MAX_FILES} ảnh.`)
    setItems((current) => [...current, ...incoming.map(makeFileItem)])
    setError('')
    if (inputRef.current) inputRef.current.value = ''
  }

  function removeItem(id) {
    setItems((current) => {
      const removed = current.find((item) => item.id === id)
      if (removed) URL.revokeObjectURL(removed.preview)
      return current.filter((item) => item.id !== id)
    })
  }

  function moveItem(id, direction) {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
      return next
    })
  }

  function dropOn(targetId) {
    if (!draggingId || draggingId === targetId) return
    setItems((current) => {
      const sourceIndex = current.findIndex((item) => item.id === draggingId)
      const targetIndex = current.findIndex((item) => item.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0) return current
      const next = [...current]
      const [moved] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, moved)
      return next
    })
    setDraggingId(null)
  }

  async function startDigitizing() {
    if (!items.length || uploading) return
    setUploading(true)
    setError('')
    const formData = new FormData()
    items.forEach(({ file }) => formData.append('files', file, file.name))
    try {
      const response = await fetch(`${API_BASE}/api/jobs`, { method: 'POST', body: formData })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.detail || 'Không thể bắt đầu số hóa.')
      navigate(`/jobs/${data.job_id}`)
    } catch (requestError) {
      setError(requestError.message)
      setUploading(false)
    }
  }

  const left = (
    <>
      <Panel code="A1" title="Nguồn tài liệu" note={`${items.length}/${MAX_FILES} ảnh`}>
        {health?.demo_mode && <div className="machine-notice warning" role="status"><strong>Demo mode</strong><span>OCR dùng dữ liệu mô phỏng.</span></div>}
        {health?.offline && <div className="machine-notice danger" role="alert"><strong>Backend offline</strong><span>Chạy FastAPI tại cổng 8000 rồi thử lại.</span></div>}
        <div
          className="compact-dropzone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files) }}
        >
          <input ref={inputRef} className="visually-hidden" type="file" multiple accept="image/jpeg,image/png" onChange={(event) => addFiles(event.target.files)} />
          <span className="registration-mark" aria-hidden="true">⌜ + ⌟</span>
          <strong>{items.length ? 'Thêm trang nguồn' : 'Đưa ảnh vào bàn kiểm bản'}</strong>
          <small>JPG/PNG · tối đa 8 ảnh · 10 MB/ảnh</small>
          <button className="machine-button secondary" type="button" onClick={() => inputRef.current?.click()}>Chọn ảnh</button>
        </div>
        {error && <div className="machine-notice danger" role="alert"><strong>Không thể thêm ảnh</strong><span>{error}</span></div>}
      </Panel>

      <Panel code="A2" title="Hàng đợi trang" note={items.length ? 'Kéo hoặc dùng nút mũi tên' : 'Trống'} className="queue-machine-panel">
        {items.length ? (
          <ol className="upload-queue">
            {items.map((item, index) => (
              <li
                className={draggingId === item.id ? 'queue-row dragging' : 'queue-row'}
                draggable
                key={item.id}
                onDragStart={() => setDraggingId(item.id)}
                onDragEnd={() => setDraggingId(null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropOn(item.id)}
              >
                <span className="folio">{String(index + 1).padStart(2, '0')}</span>
                <img src={item.preview} alt={`Xem trước trang ${index + 1}: ${item.file.name}`} />
                <span className="queue-copy" title={item.file.name}><strong>{item.file.name}</strong><small>{(item.file.size / 1024 / 1024).toFixed(1)} MB · Chờ tải</small></span>
                <span className="queue-actions">
                  <button className="icon-button" type="button" onClick={() => moveItem(item.id, -1)} disabled={index === 0} aria-label={`Đưa ${item.file.name} lên`}>↑</button>
                  <button className="icon-button" type="button" onClick={() => moveItem(item.id, 1)} disabled={index === items.length - 1} aria-label={`Đưa ${item.file.name} xuống`}>↓</button>
                  <button className="icon-button danger" type="button" onClick={() => removeItem(item.id)} aria-label={`Xóa ${item.file.name}`}>×</button>
                </span>
              </li>
            ))}
          </ol>
        ) : <div className="queue-empty"><span>00</span><p>Trang được chọn sẽ xuất hiện ở đây theo đúng thứ tự ghép Markdown.</p></div>}
        <button className="machine-button primary" type="button" onClick={startDigitizing} disabled={!items.length || uploading || health?.offline}>
          {uploading ? 'Đang tải ảnh…' : `Bắt đầu số hóa${items.length ? ` · ${items.length} trang` : ''}`}
        </button>
      </Panel>

      <Panel code="A3" title="Pipeline" note="5 bước"><Pipeline phase="upload" /></Panel>
    </>
  )

  const center = (
    <Panel code="M1" title="OCR Markdown trực tiếp" note="Chờ trang nguồn" className="console-panel">
      <div className="console-toolbar" role="toolbar" aria-label="Chế độ xem tài liệu">
        <button className="active" type="button">Markdown</button>
        <button type="button" disabled>Ảnh gốc</button>
        <button type="button" disabled>Xem trước</button>
        <button type="button" disabled>Chỉnh sửa</button>
        <button className="inspector-trigger" type="button" onClick={() => setInspectorOpen(true)}>Metadata</button>
      </div>
      <div className="raw-console empty-console">
        <div className="console-ruler" aria-hidden="true"><span>001</span><span>002</span><span>003</span><span>004</span></div>
        <div className="console-empty-copy">
          <StatusLamp tone="idle">Console chưa hoạt động</StatusLamp>
          <h1>Markdown sẽ xuất hiện theo từng trang.</h1>
          <p>Chọn ảnh ở cột nguồn. Mỗi trang hoàn tất sẽ được đặt đúng vị trí, kể cả khi OCR trả kết quả lệch thứ tự.</p>
        </div>
      </div>
    </Panel>
  )

  return (
    <WorkbenchShell
      health={health}
      phase="upload"
      totalPages={items.length}
      left={left}
      center={center}
      right={<Inspector metadata={EMPTY_METADATA} />}
      inspectorOpen={inspectorOpen}
      onInspectorClose={() => setInspectorOpen(false)}
    />
  )
}
