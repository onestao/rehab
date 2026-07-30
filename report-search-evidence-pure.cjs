/* global require, module, __dirname */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const moduleBox = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'search-evidence-schema-pure.js'), 'utf8'), { module: moduleBox, exports: moduleBox.exports, URL }, { filename: 'search-evidence-schema-pure.js' });
module.exports = moduleBox.exports;
