// QA dev/preview server: the project's own vite config, with a private
// dependency cache (node_modules is a symlink to the main checkout, whose
// dev server on 5178 shares node_modules/.vite) and the QA port 5180.
import base from '../vite.config.js';

export default {
  ...base,
  cacheDir: '.qa-vite-cache',
  server: { ...base.server, port: 5180, strictPort: true },
  preview: { ...base.preview, port: 5180, strictPort: true },
};
