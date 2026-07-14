import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { neighborIds, nodeRadius } from '../../lib/graphModel'

function useSize(ref, fallback) {
  const [size, setSize] = useState(fallback)
  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const update = () => setSize({ width: Math.max(240, element.clientWidth), height: Math.max(fallback.height, element.clientHeight) })
    update()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [fallback.height, ref])
  return size
}

function useForceLayout(graph, size, compact, resetKey) {
  const [nodes, setNodes] = useState([])
  const simulationRef = useRef(null)
  useEffect(() => {
    const cx = size.width / 2
    const cy = size.height / 2
    const radius = Math.min(size.width, size.height) * (compact ? 0.28 : 0.32)
    const prepared = graph.nodes.map((node, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(graph.nodes.length, 1) - Math.PI / 2
      return { ...node, x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius }
    })
    const center = prepared.find((node) => node.id === graph.center_id)
    if (center) {
      center.fx = cx
      center.fy = cy
    }
    const links = graph.edges.map((edge) => ({ ...edge, source: edge.source, target: edge.target }))
    const simulation = forceSimulation(prepared)
      .force('link', forceLink(links).id((node) => node.id).distance(compact ? 54 : 105).strength(0.75))
      .force('charge', forceManyBody().strength(compact ? -95 : -260))
      .force('collide', forceCollide().radius((node) => nodeRadius(node, compact) + (compact ? 8 : 15)))
      .force('center', forceCenter(cx, cy).strength(0.08))
    simulationRef.current = simulation
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced || compact) {
      simulation.tick(compact ? 90 : 140).stop()
      setNodes(prepared.map((node) => ({ ...node })))
    } else {
      simulation.on('tick', () => setNodes(prepared.map((node) => ({ ...node }))))
    }
    return () => simulation.stop()
  }, [compact, graph, resetKey, size.height, size.width])
  return { nodes, simulationRef }
}

function typeLabel(node) {
  if (node.type === 'category') return 'Danh mục'
  if (node.current) return 'Tài liệu hiện tại'
  if (node.type === 'tag') return 'Tag'
  if (node.type === 'topic') return 'Chủ đề'
  return 'Note'
}

function GraphCanvas({ graph, compact = false, selectedId, onSelect }) {
  const wrapRef = useRef(null)
  const svgRef = useRef(null)
  const dragRef = useRef(null)
  const [hoveredId, setHoveredId] = useState('')
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 })
  const [resetKey, setResetKey] = useState(0)
  const size = useSize(wrapRef, { width: compact ? 320 : 900, height: compact ? 230 : 560 })
  const { nodes, simulationRef } = useForceLayout(graph, size, compact, resetKey)
  const visible = useMemo(() => hoveredId ? neighborIds(graph, hoveredId) : null, [graph, hoveredId])
  const byId = new Map(nodes.map((node) => [node.id, node]))

  function canvasPoint(event) {
    const rect = svgRef.current.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function graphPoint(event) {
    const point = canvasPoint(event)
    return { x: (point.x - view.x) / view.scale, y: (point.y - view.y) / view.scale }
  }

  function startPan(event) {
    if (compact) return
    svgRef.current.setPointerCapture?.(event.pointerId)
    dragRef.current = { mode: 'pan', pointerId: event.pointerId, origin: canvasPoint(event), view }
  }

  function startNodeDrag(event, node) {
    event.stopPropagation()
    if (compact || node.id === graph.center_id) return
    svgRef.current.setPointerCapture?.(event.pointerId)
    const point = graphPoint(event)
    node.fx = node.x
    node.fy = node.y
    dragRef.current = { mode: 'node', pointerId: event.pointerId, node, dx: point.x - node.x, dy: point.y - node.y }
    simulationRef.current?.alphaTarget(0.25).restart()
  }

  function movePointer(event) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (drag.mode === 'pan') {
      const point = canvasPoint(event)
      setView({ ...drag.view, x: drag.view.x + point.x - drag.origin.x, y: drag.view.y + point.y - drag.origin.y })
    } else {
      const point = graphPoint(event)
      drag.node.fx = point.x - drag.dx
      drag.node.fy = point.y - drag.dy
    }
  }

  function endPointer(event) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (drag.mode === 'node') simulationRef.current?.alphaTarget(0)
    dragRef.current = null
  }

  function zoom(factor, anchor = { x: size.width / 2, y: size.height / 2 }) {
    setView((current) => {
      const scale = Math.min(2.8, Math.max(0.35, current.scale * factor))
      const gx = (anchor.x - current.x) / current.scale
      const gy = (anchor.y - current.y) / current.scale
      return { x: anchor.x - gx * scale, y: anchor.y - gy * scale, scale }
    })
  }

  function fit() {
    if (!nodes.length) return
    const xs = nodes.map((node) => node.x)
    const ys = nodes.map((node) => node.y)
    const width = Math.max(1, Math.max(...xs) - Math.min(...xs) + 100)
    const height = Math.max(1, Math.max(...ys) - Math.min(...ys) + 100)
    const scale = Math.min(1.5, Math.max(0.35, Math.min(size.width / width, size.height / height)))
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2
    setView({ x: size.width / 2 - cx * scale, y: size.height / 2 - cy * scale, scale })
  }

  function reset() {
    setView({ x: 0, y: 0, scale: 1 })
    setResetKey((value) => value + 1)
  }

  return (
    <div ref={wrapRef} className={compact ? 'local-graph compact' : 'local-graph expanded'}>
      {!compact && (
        <div className="graph-canvas-controls" role="group" aria-label="Điều khiển canvas graph">
          <button type="button" onClick={() => zoom(0.8)} aria-label="Thu nhỏ">−</button>
          <output>{Math.round(view.scale * 100)}%</output>
          <button type="button" onClick={() => zoom(1.25)} aria-label="Phóng to">+</button>
          <button type="button" onClick={fit}>Vừa khung</button>
          <button type="button" onClick={reset}>Đặt lại</button>
        </div>
      )}
      <svg
        ref={svgRef}
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="group"
        aria-label="Local graph của tài liệu"
        onPointerDown={startPan}
        onPointerMove={movePointer}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={compact ? undefined : (event) => { event.preventDefault(); zoom(event.deltaY < 0 ? 1.12 : 0.89, canvasPoint(event)) }}
      >
        <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
          <g className="local-graph-edges">
            {graph.edges.map((edge, index) => {
              const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source
              const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target
              const source = byId.get(sourceId)
              const target = byId.get(targetId)
              if (!source || !target) return null
              const dim = visible && (!visible.has(sourceId) || !visible.has(targetId))
              return <line className={dim ? 'dimmed' : ''} key={`${sourceId}-${targetId}-${index}`} x1={source.x} y1={source.y} x2={target.x} y2={target.y} />
            })}
          </g>
          <g className="local-graph-nodes">
            {nodes.map((node) => {
              const dim = visible && !visible.has(node.id)
              return (
                <g
                  key={node.id}
                  className={`local-node ${node.type} ${node.current ? 'current' : ''} ${selectedId === node.id ? 'selected' : ''} ${dim ? 'dimmed' : ''}`}
                  transform={`translate(${node.x} ${node.y})`}
                  role="button"
                  tabIndex="0"
                  aria-label={`${typeLabel(node)}: ${node.label}`}
                  onPointerDown={(event) => startNodeDrag(event, node)}
                  onPointerEnter={() => setHoveredId(node.id)}
                  onPointerLeave={() => setHoveredId('')}
                  onFocus={() => setHoveredId(node.id)}
                  onBlur={() => setHoveredId('')}
                  onClick={(event) => { event.stopPropagation(); onSelect(node.id) }}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(node.id) } }}
                >
                  <circle r={nodeRadius(node, compact)} />
                  <text y={nodeRadius(node, compact) + 15} textAnchor="middle">{node.label.length > (compact ? 16 : 28) ? `${node.label.slice(0, compact ? 14 : 26)}…` : node.label}</text>
                </g>
              )
            })}
          </g>
        </g>
      </svg>
    </div>
  )
}

function GraphDialog({ graph, depth, includeTags, onDepthChange, onTagsChange, onClose }) {
  const dialogRef = useRef(null)
  const [selectedId, setSelectedId] = useState(graph.center_id)
  const selected = graph.nodes.find((node) => node.id === selectedId)
  useEffect(() => {
    if (!graph.nodes.some((node) => node.id === selectedId)) setSelectedId(graph.center_id)
  }, [graph, selectedId])
  useEffect(() => {
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => dialog?.open && dialog.close()
  }, [])
  return createPortal(
    <dialog ref={dialogRef} className="graph-dialog" onCancel={(event) => { event.preventDefault(); onClose() }} onClose={onClose}>
      <div className="graph-dialog-shell">
        <header>
          <div><span className="panel-code">B2 / LOCAL</span><h2>Graph explorer</h2></div>
          <div className="graph-dialog-options">
            <label>Độ sâu<select value={depth} onChange={(event) => onDepthChange(Number(event.target.value))}><option value="1">1</option><option value="2">2</option></select></label>
            <label className="graph-checkbox"><input type="checkbox" checked={includeTags} onChange={(event) => onTagsChange(event.target.checked)} /> Hiện tags</label>
            <button className="icon-button" type="button" onClick={onClose} aria-label="Đóng graph">×</button>
          </div>
        </header>
        <div className="graph-explorer-body">
          <GraphCanvas graph={graph} selectedId={selectedId} onSelect={setSelectedId} />
          <aside className="graph-node-detail" aria-live="polite">
            {selected && <><span>{typeLabel(selected)}</span><h3>{selected.label}</h3><dl><div><dt>Liên kết</dt><dd>{selected.degree}</dd></div><div><dt>Trạng thái</dt><dd>{selected.exists ? 'Có trong vault' : 'Tạm thời'}</dd></div></dl>{selected.path && <code>{selected.path}</code>}{selected.open_uri && <a className="machine-button primary" href={selected.open_uri}>Mở trong Obsidian</a>}</>}
          </aside>
        </div>
      </div>
    </dialog>,
    document.body,
  )
}

export default function GraphPreview({ graph, loading, depth, includeTags, onDepthChange, onTagsChange }) {
  const [selectedId, setSelectedId] = useState(graph.center_id)
  const [open, setOpen] = useState(false)
  const openButtonRef = useRef(null)
  const selected = graph.nodes.find((node) => node.id === selectedId)
  useEffect(() => {
    if (!graph.nodes.some((node) => node.id === selectedId)) setSelectedId(graph.center_id)
  }, [graph, selectedId])

  function close() {
    setOpen(false)
    requestAnimationFrame(() => openButtonRef.current?.focus())
  }

  return (
    <div className="graph-preview-shell" aria-busy={loading}>
      {graph.warnings?.length > 0 && <div className="graph-warning" role="status">{graph.warnings[0]}</div>}
      <GraphCanvas graph={graph} compact selectedId={selectedId} onSelect={setSelectedId} />
      <div className="graph-preview-status"><span>{selected ? `${typeLabel(selected)} · ${selected.label}` : `${graph.nodes.length} nodes`}</span>{graph.truncated && <small>Đã giới hạn kết quả</small>}</div>
      <button ref={openButtonRef} className="machine-button secondary full" type="button" onClick={() => setOpen(true)}>Mở graph</button>
      {open && <GraphDialog graph={graph} depth={depth} includeTags={includeTags} onDepthChange={onDepthChange} onTagsChange={onTagsChange} onClose={close} />}
    </div>
  )
}
