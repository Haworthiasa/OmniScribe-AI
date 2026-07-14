import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { describe, expect, test, vi } from 'vitest'
import { buildMetadataGraph } from '../../lib/graphModel'
import GraphPreview from './GraphPreview'

const graph = buildMetadataGraph({ title: 'Demo', category: 'Học tập', topics: ['Vật lý'], tags: ['ocr'] })

describe('GraphPreview', () => {
  test('ghim category ở center và chọn node từ preview', async () => {
    render(<GraphPreview graph={graph} loading={false} depth={1} includeTags onDepthChange={() => {}} onTagsChange={() => {}} />)
    const category = await screen.findByRole('button', { name: 'Danh mục: Học tập' })
    await waitFor(() => expect(category.getAttribute('transform')).toContain('120'))
    await userEvent.click(screen.getByRole('button', { name: 'Chủ đề: Vật lý' }))
    expect(screen.getByText('Chủ đề · Vật lý')).toBeInTheDocument()
  })

  test('hover làm mờ node không liên quan', async () => {
    render(<GraphPreview graph={graph} loading={false} depth={1} includeTags onDepthChange={() => {}} onTagsChange={() => {}} />)
    const category = await screen.findByRole('button', { name: 'Danh mục: Học tập' })
    fireEvent.pointerEnter(category)
    expect(screen.getByRole('button', { name: 'Chủ đề: Vật lý' })).toHaveClass('dimmed')
  })

  test('dialog đổi depth/tags, đóng Escape và trả focus', async () => {
    const onDepthChange = vi.fn()
    const onTagsChange = vi.fn()
    render(<GraphPreview graph={graph} loading={false} depth={1} includeTags onDepthChange={onDepthChange} onTagsChange={onTagsChange} />)
    const open = screen.getByRole('button', { name: 'Mở graph' })
    await userEvent.click(open)
    const dialog = screen.getByRole('dialog')
    await userEvent.selectOptions(screen.getByLabelText('Độ sâu'), '2')
    await userEvent.click(screen.getByLabelText('Hiện tags'))
    expect(onDepthChange).toHaveBeenCalledWith(2)
    expect(onTagsChange).toHaveBeenCalledWith(false)
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(open).toHaveFocus())
  })

  test('dialog vẫn mở khi component chạy trong React StrictMode', async () => {
    render(
      <StrictMode>
        <GraphPreview graph={graph} loading={false} depth={1} includeTags onDepthChange={() => {}} onTagsChange={() => {}} />
      </StrictMode>,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Mở graph' }))

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
  })
})
