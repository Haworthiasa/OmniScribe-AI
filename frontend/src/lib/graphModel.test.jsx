import { describe, expect, test } from 'vitest'
import { buildMetadataGraph, neighborIds, nodeRadius } from './graphModel'

describe('graph model', () => {
  test('giữ category làm center và giới hạn tags', () => {
    const graph = buildMetadataGraph({ title: 'Demo', category: 'Học tập', topics: ['Vật lý'], tags: ['a', 'b', 'c', 'd'] })
    expect(graph.nodes[0].id).toBe(graph.center_id)
    expect(graph.nodes.filter((node) => node.type === 'tag')).toHaveLength(3)
    expect(graph.edges[0]).toMatchObject({ source: graph.center_id, type: 'category' })
  })

  test('node degree cao lớn hơn nhưng bị giới hạn', () => {
    expect(nodeRadius({ type: 'note', degree: 9 })).toBeGreaterThan(nodeRadius({ type: 'note', degree: 1 }))
    expect(nodeRadius({ type: 'note', degree: 10000 })).toBe(28)
  })

  test('tìm đúng neighborhood cho hover', () => {
    const graph = buildMetadataGraph({ title: 'Demo', category: 'Test', topics: ['A'], tags: ['B'] })
    const neighbors = neighborIds(graph, 'current:metadata')
    expect(neighbors).toContain(graph.center_id)
    expect(neighbors).toContain('topic:a')
  })
})
