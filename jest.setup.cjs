const { createRequire } = require('module');
global.require = createRequire(import.meta.url);
