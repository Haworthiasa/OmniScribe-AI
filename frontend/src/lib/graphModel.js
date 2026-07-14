function slug(value, fallback) {
  return String(value || fallback).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || fallback
}

export function buildMetadataGraph(metadata = {}, includeTags = true) {
  const category = String(metadata.category || '').trim()
  const title = String(metadata.title || '').trim()
  const topics = [...new Set((metadata.topics || []).map(String).map((item) => item.trim()).filter(Boolean))]
  const tags = includeTags ? [...new Set((metadata.tags || []).slice(0, 3).map(String).map((item) => item.trim()).filter(Boolean))] : []
  if (!category && !title && !topics.length && !tags.length) {
    return { center_id: '', nodes: [], edges: [], truncated: false, vault_available: true, warnings: [] }
  }
  const centerId = `category:${slug(category, 'chua-phan-loai')}`
  const currentId = 'current:metadata'
  const nodes = [
    { id: centerId, label: category || 'Chưa phân loại', type: 'category', degree: 1, exists: false, current: false },
    { id: currentId, label: title || 'Tài liệu hiện tại', type: 'document', degree: 1 + topics.length + tags.length, exists: false, current: true },
  ]
  const edges = [{ source: centerId, target: currentId, type: 'category' }]
  for (const topic of topics) {
    const id = `topic:${slug(topic, 'topic')}`
    nodes.push({ id, label: topic, type: 'topic', degree: 1, exists: false, current: false })
    edges.push({ source: currentId, target: id, type: 'topic' })
  }
  for (const tag of tags) {
    const id = `tag:${slug(tag, 'tag')}`
    nodes.push({ id, label: tag, type: 'tag', degree: 1, exists: false, current: false })
    edges.push({ source: currentId, target: id, type: 'tag' })
  }
  return { center_id: centerId, nodes, edges, truncated: false, vault_available: true, warnings: [] }
}

export function nodeRadius(node, compact = false) {
  const base = node.type === 'category' ? 18 : node.current ? 14 : node.type === 'tag' ? 7 : 10
  const radius = base + Math.sqrt(Math.max(0, node.degree || 0)) * 1.8
  return Math.min(compact ? 20 : 28, Math.max(compact ? 7 : 9, radius))
}

export function neighborIds(graph, nodeId) {
  const result = new Set([nodeId])
  for (const edge of graph.edges) {
    const source = typeof edge.source === 'object' ? edge.source.id : edge.source
    const target = typeof edge.target === 'object' ? edge.target.id : edge.target
    if (source === nodeId) result.add(target)
    if (target === nodeId) result.add(source)
  }
  return result
}
