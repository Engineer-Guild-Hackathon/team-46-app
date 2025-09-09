import type { Meta, StoryObj } from '@storybook/svelte'
import BookPage from './BookPage.svelte'

const meta = {
  title: 'Pages/BookPage',
  component: BookPage,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    bookId: {
      control: { type: 'text' },
      description: 'ID of the book to display',
    },
  },
  args: {
    bookId: '1',
  },
} satisfies Meta<BookPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Book2: Story = {
  args: { bookId: '2' },
}

export const NotFound: Story = {
  args: { bookId: 'nope' },
}
