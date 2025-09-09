/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{svelte,ts,js}', './.storybook/**/*.{ts,js,svelte}'],
  theme: { extend: {} },
  plugins: [
    // tailwindcss-animate is a standard plugin; in ESM config, import sync at top is not available,
    // but Tailwind will handle requiring it via string reference.
    require('tailwindcss-animate')
  ],
}
