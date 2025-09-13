import type { Preview } from '@storybook/svelte'
import '../src/app.css'

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    backgrounds: { disable: true },
    layout: 'fullscreen',
  },
}

export default preview
