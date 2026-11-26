// src/version.js — single runtime source for the version string.
// Kept separate from package.json so bundled/npm-installed copies behave the same.
const VERSION = '1.0.14';
module.exports = { VERSION, version: VERSION };
