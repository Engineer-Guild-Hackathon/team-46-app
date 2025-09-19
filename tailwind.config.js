/* eslint-env node */
import animate from "tailwindcss-animate";
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{svelte,ts,js}",
    "./.storybook/**/*.{ts,js,svelte}",
  ],
  theme: { extend: {} },
  plugins: [animate],
};
