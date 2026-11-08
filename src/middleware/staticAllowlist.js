const path = require('path');
const express = require('express');

/**
 * express.static limited to files with the given extensions. Anything else
 * (HTML, JSON, dotfiles, directory listings) falls through to the 404 handler.
 *
 * @param {string} root Folder to serve.
 * @param {string[]} extensions Lower-case extensions with the dot, e.g. ['.png'].
 */
const serveStaticAllowlist = (root, extensions) => {
  const allowed = new Set(extensions);
  const serve = express.static(root, { index: false, dotfiles: 'ignore', redirect: false });

  return (req, res, next) => {
    const extension = path.extname(req.path).toLowerCase();
    if (!allowed.has(extension)) {
      return next();
    }
    return serve(req, res, next);
  };
};

module.exports = { serveStaticAllowlist };
