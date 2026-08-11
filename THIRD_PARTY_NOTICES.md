# Third-Party Package Notices

第三方套件致謝與授權說明

This project uses the open-source packages listed below. The versions shown are the
versions resolved in the current `package-lock.json` / installed dependency tree.
The tables cover packages declared directly in `package.json`; transitive packages
remain tracked by `package-lock.json` and retain their own upstream notices.

## Runtime and application dependencies

| Package | Resolved version | Use in this project | License | Upstream |
| --- | ---: | --- | --- | --- |
| `dexie` | 3.2.7 | IndexedDB persistence | Apache-2.0 | [Dexie.js](https://github.com/dfahlander/Dexie.js) |
| `dexie-react-hooks` | 1.1.7 | React hooks for Dexie queries | Apache-2.0 | [Dexie.js](https://github.com/dexie/Dexie.js) |
| `formidable` | 3.5.4 | Multipart form parsing in the API | MIT | [formidable](https://github.com/node-formidable/formidable) |
| `fuse.js` | 7.1.0 | Fuzzy search and matching | Apache-2.0 | [Fuse.js](https://github.com/krisk/Fuse) |
| `html-to-image` | 1.11.13 | Converting rendered UI to images | MIT | [html-to-image](https://github.com/bubkoo/html-to-image) |
| `hyphenation.en-us` | 0.2.1 | English hyphenation patterns for Hypher | Not declared in package metadata | [npm package](https://www.npmjs.com/package/hyphenation.en-us) |
| `hypher` | 0.2.5 | English word hyphenation engine | BSD-3-Clause | [Hypher](https://github.com/bramstein/Hypher) |
| `lucide-react` | 0.344.0 | Interface icons | ISC | [Lucide](https://github.com/lucide-icons/lucide) |
| `peerjs` | 1.5.5 | Peer-to-peer multiplayer transport | MIT | [PeerJS](https://github.com/peers/peerjs) |
| `qrcode.react` | 4.2.0 | QR code rendering for room links | ISC | [qrcode.react](https://github.com/zpao/qrcode.react) |
| `react` | 18.3.1 | UI rendering | MIT | [React](https://github.com/facebook/react) |
| `react-dom` | 18.3.1 | React DOM integration | MIT | [React](https://github.com/facebook/react) |

## Development, build, and test dependencies

| Package | Resolved version | Use in this project | License | Upstream |
| --- | ---: | --- | --- | --- |
| `@testing-library/jest-dom` | 6.9.1 | DOM assertions | MIT | [jest-dom](https://github.com/testing-library/jest-dom) |
| `@testing-library/react` | 14.3.1 | React component testing | MIT | [React Testing Library](https://github.com/testing-library/react-testing-library) |
| `@testing-library/user-event` | 14.6.1 | User interaction testing | MIT | [user-event](https://github.com/testing-library/user-event) |
| `@types/react` | 18.3.28 | React TypeScript declarations | MIT | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| `@types/react-dom` | 18.3.7 | React DOM TypeScript declarations | MIT | [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped) |
| `@vitejs/plugin-react` | 4.7.0 | React support for Vite | MIT | [vite-plugin-react](https://github.com/vitejs/vite-plugin-react) |
| `autoprefixer` | 10.4.24 | CSS vendor-prefix processing | MIT | [Autoprefixer](https://github.com/postcss/autoprefixer) |
| `jsdom` | 24.1.3 | Browser-like test environment | MIT | [jsdom](https://github.com/jsdom/jsdom) |
| `opencc-js` | 1.3.1 | Traditional/Simplified Chinese conversion in data tooling | MIT | [opencc-js](https://github.com/nk2028/opencc-js) |
| `postcss` | 8.5.6 | CSS transformation pipeline | MIT | [PostCSS](https://github.com/postcss/postcss) |
| `tailwindcss` | 3.4.19 | Utility-first CSS build tooling | MIT | [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) |
| `typescript` | 5.9.3 | Type checking and compilation | Apache-2.0 | [TypeScript](https://github.com/microsoft/TypeScript) |
| `vite` | 5.4.21 | Frontend development server and bundler | MIT | [Vite](https://github.com/vitejs/vite) |
| `vitest` | 1.6.1 | Test runner | MIT | [Vitest](https://github.com/vitest-dev/vitest) |
| `xlsx` | 0.18.5 | BGG spreadsheet data tooling | Apache-2.0 | [SheetJS](https://github.com/SheetJS/sheetjs) |

## License handling notes

- MIT, ISC, and BSD-3-Clause packages require their copyright and permission
  notices to remain with redistributed copies or substantial portions.
- Apache-2.0 packages require the license, copyright notices, and applicable
  `NOTICE` information to be preserved.
- The installed `hyphenation.en-us@0.2.1` package does not declare a license in
  its package metadata. It is listed explicitly here so that this unresolved
  upstream licensing detail is not hidden. Confirm the upstream terms before
  distributing a production bundle that contains its pattern data.
- This file is an attribution index, not a replacement for the license text
  shipped by each package. The authoritative license files are retained in the
  npm packages under `node_modules` during development, and the dependency
  graph is recorded in `package-lock.json`.

When adding or upgrading a dependency, update this file in the same change with
the resolved version, purpose, license, and upstream source.
