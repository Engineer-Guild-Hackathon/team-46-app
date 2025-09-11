import type { Meta, StoryObj } from '@storybook/svelte-vite'
import MainPage from './MainPage.svelte'

const meta = {
  title: 'Pages/MainPage',
  component: MainPage,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<MainPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
