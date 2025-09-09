import type { Meta, StoryObj } from '@storybook/svelte-vite'
import BookCard from './BookCard.svelte'
import type { Book } from '../types'

const sampleBook: Book = {
  // minimal representative fields; extend to match your Book type
  id: '1',
  title: 'Clean Architecture',
  author: 'Robert C. Martin',
  coverUrl: '',
}

const meta = {
  title: 'Components/BookCard',
  component: BookCard,
  parameters: {
    layout: 'centered',
  },
  args: {
    book: sampleBook,
    onOpen: () => {},
  },
  argTypes: {
    onOpen: { action: 'open' },
  },
} satisfies Meta<BookCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithCover: Story = {
  args: {
    book: {
      ...sampleBook,
      coverUrl: 'https://picsum.photos/200/300?random=12',
    },
  },
}

export const LongAuthorTruncation: Story = {
  args: {
    book: {
      ...sampleBook,
      author: 'A Very Long Example Author Name That Should Truncate Gracefully',
    },
  },
}
