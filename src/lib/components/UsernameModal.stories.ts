import type { Meta, StoryObj } from '@storybook/svelte'
import UsernameModal from './UsernameModal.svelte'

const meta: Meta<UsernameModal> = {
  title: 'Auth/UsernameModal',
  component: UsernameModal,
  parameters: {
    a11y: { disable: false },
  },
  args: {},
}

export default meta

type Story = StoryObj<UsernameModal>

export const Default: Story = {
  render: () => ({
    Component: UsernameModal,
    props: {},
  }),
}

export const PrefilledInvalid: Story = {
  render: () => ({ Component: UsernameModal, props: {} }),
}
