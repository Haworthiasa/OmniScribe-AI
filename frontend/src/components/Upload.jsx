import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

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
  const inputRef = useRef(null)
  const itemsRef = useRef([])
  const navigate = useNavigate()

  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(setHealth)
      .catch(() => setHealth({ offline: true }))
  }, [])

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => () => itemsRef.current.forEach((item) => URL.revokeObjectURL(item.preview)), [])

  function addFiles(fileList) {
    const incoming = Array.from(fileList)
    const invalid = incoming.find((file) => !isAcceptedImage(file))
    if (invalid) {
      setError(`${invalid.name} không phải ảnh JPG hoặc PNG.`)
      return
    }
    const tooLarge = incoming.find((file) => file.size > MAX_BYTES)
    if (tooLarge) {
      setError(`${tooLarge.name} vượt quá giới hạn 10 MB.`)
      return
    }
    if (items.length + incoming.length > MAX_FILES) {
      setError(`Mỗi lần chỉ xử lý tối đa ${MAX_FILES} ảnh.`)
      return
    }
    setItems((current) => [...current, ...incoming.map(makeFileItem)])
    setError('')
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

  return (
    <main className="capture-shell">
      <AppHeader health={health} />

      <section className="capture-hero" aria-labelledby="capture-title">
        <div className="hero-copy">
          <p className="eyebrow">Từ nét bút đến knowledge graph</p>
          <h1 id="capture-title">Đưa ghi chú viết tay<br />vào đúng hệ thống.</h1>
          <p className="hero-description">
            Chụp tài liệu, kiểm tra bản số hóa, rồi lưu thành Markdown có liên kết trong Obsidian.
          </p>
        </div>

        <div className="process-key" aria-label="Quy trình gồm bốn bước">
          {['Upload', 'OCR', 'Organize', 'Save'].map((step, index) => (
            <div className={index === 0 ? 'process-step active' : 'process-step'} key={step}>
              <span>{String(index + 1).padStart(2, '0')}</span>{step}
            </div>
          ))}
        </div>
      </section>

      {health?.demo_mode && (
        <div className="notice info" role="status">
          <span>Demo mode</span>
          App đang dùng kết quả OCR mô phỏng. Thêm API key vào <code>backend/.env</code> để xử lý ảnh thật.
        </div>
      )}
      {health?.offline && (
        <div className="notice danger" role="alert">
          Backend chưa kết nối. Hãy chạy FastAPI tại cổng 8000.
        </div>
      )}

      <section className="upload-workbench">
        <div
          className={`drop-zone ${items.length ? 'has-files' : ''}`}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            addFiles(event.dataTransfer.files)
          }}
        >
          <input
            ref={inputRef}
            className="visually-hidden"
            type="file"
            multiple
            accept="image/jpeg,image/png"
            onChange={(event) => addFiles(event.target.files)}
          />
          <div className="drop-mark" aria-hidden="true">
            <span className="corner top-left" /><span className="corner top-right" />
            <span className="corner bottom-left" /><span className="corner bottom-right" />
            <svg viewBox="0 0 48 48"><path d="M12 35h24M24 33V10m0 0-8 8m8-8 8 8" /></svg>
          </div>
          <h2>{items.length ? 'Thêm trang khác' : 'Kéo ảnh ghi chú vào đây'}</h2>
          <p>JPG hoặc PNG · tối đa 8 ảnh · 10 MB/ảnh</p>
          <button className="secondary-button" type="button" onClick={() => inputRef.current?.click()}>
            Chọn ảnh từ máy
          </button>
        </div>

        <div className="queue-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Page queue</p>
              <h2>{items.length ? `${items.length} trang đã chọn` : 'Chưa có trang nào'}</h2>
            </div>
            {items.length > 1 && <span className="utility-note">Kéo thẻ để đổi thứ tự</span>}
          </div>

          {items.length ? (
            <ol className="thumbnail-list">
              {items.map((item, index) => (
                <li
                  className={draggingId === item.id ? 'thumbnail-card dragging' : 'thumbnail-card'}
                  key={item.id}
                  draggable
                  onDragStart={() => setDraggingId(item.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => dropOn(item.id)}
                  onDragEnd={() => setDraggingId(null)}
                >
                  <span className="page-index">{String(index + 1).padStart(2, '0')}</span>
                  <img src={item.preview} alt={`Xem trước trang ${index + 1}`} />
                  <div className="thumbnail-meta">
                    <strong>{item.file.name}</strong>
                    <span>{(item.file.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                  <div className="thumbnail-actions">
                    <button type="button" onClick={() => moveItem(item.id, -1)} disabled={index === 0} aria-label="Đưa trang lên">↑</button>
                    <button type="button" onClick={() => moveItem(item.id, 1)} disabled={index === items.length - 1} aria-label="Đưa trang xuống">↓</button>
                    <button type="button" className="remove" onClick={() => removeItem(item.id)} aria-label="Xóa trang">×</button>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty-queue">
              <span>01</span>
              Trang đầu tiên sẽ xuất hiện ở đây để bạn kiểm tra và sắp xếp.
            </div>
          )}

          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary-button" type="button" disabled={!items.length || uploading || health?.offline} onClick={startDigitizing}>
            {uploading ? <><span className="button-spinner" />Đang tải ảnh</> : `Bắt đầu số hóa${items.length ? ` ${items.length} trang` : ''}`}
          </button>
        </div>
      </section>
    </main>
  )
}

export function AppHeader({ health }) {
  const statusLabel = !health ? 'Đang kết nối' : health.offline ? 'Backend offline' : health.demo_mode ? 'Demo workspace' : 'API ready'
  return (
    <header className="app-header">
      <a className="wordmark" href="/" aria-label="OmniScribe AI — trang chủ">
        <span className="wordmark-glyph" aria-hidden="true">O</span>
        <span>OmniScribe <b>AI</b></span>
      </a>
      <div className="system-status">
        <span className={`status-dot ${health?.offline ? 'offline' : !health ? 'pending' : ''}`} />
        {statusLabel}
      </div>
    </header>
  )
}
