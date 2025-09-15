import type { Meta, StoryObj } from '@storybook/svelte-vite'
import LandingPage from './LandingPage.svelte'

const meta = {
  title: 'Pages/LandingPage',
  component: LandingPage,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<LandingPage>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}
