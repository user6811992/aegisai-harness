// src/version.js — single runtime source for the version string.
// Kept separate from package.json so bundled/npm-installed copies behave the same.
const VERSION = '0.90.0';
module.exports = { VERSION, version: VERSION };
