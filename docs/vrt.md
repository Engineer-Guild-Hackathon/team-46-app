# Visual Regression Testing (Lost Pixel)

Commands:

- Run against live Storybook (start Storybook first): `npm run vrt`
- CI-style static run: `npm run vrt:ci` (builds Storybook then runs Lost Pixel)

Config: `lost-pixel.config.ts` uses storybookShots at http://localhost:6006.

Notes:

- Ensure Storybook is running for `vrt`.
- Thresholds are strict (0); adjust in `lost-pixel.config.ts` if needed.
