/* eslint-env node */
import { CustomProjectConfig } from 'lost-pixel'

export const config: CustomProjectConfig = {
  pageShots: {
    pages: [{ path: '/', name: 'landing' }],
    baseUrl: 'http://172.17.0.1:3000',
  },
  lostPixelProjectId: 'cmfathyb41at0qokfg183b1kv',
  apiKey: process.env.LOST_PIXEL_API_KEY,
}
