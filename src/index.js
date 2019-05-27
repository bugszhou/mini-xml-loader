'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
const path = require('path'),
  isUrl = require('is-url'),
  minify = require('html-minifier').minify,
  loaderUtils = require("loader-utils"),
  fallbackFn = require('./utils/index');

function miniXmlLoader(source) {
  const importReg = /<[(filter|import|include|wxs|import\-sjs)][\s\S]*?src=[\"|\']([^\"]*)[\"|\'][\s\S]*?>/gi,
    varInputReg = /\{\{[\s\S]*?\}\}/gi;
  let result = [],
    miniJs = [],
    importArr = [];
  while (result = importReg.exec(source)) {
    let pathurl = result[1];
    if (pathurl.search(varInputReg) < 0 && !isUrl(pathurl)) {
      if (/\.(js)$/.test(pathurl)) {
        miniJs.push(pathurl);
      } else {
        importArr.push(pathurl);
      }
    }
  }

  const options = loaderUtils.getOptions(this) || {};

  const context = options.context || this.rootContext;

  const url = loaderUtils.interpolateName(this, path.join(getRequireDir(this.resourcePath), options.filename), {
    context,
    source,
    regExp: options.regExp,
  });

  let outputPath = url;

  if (options.outputPath) {
    if (typeof options.outputPath === 'function') {
      outputPath = options.outputPath(url, this.resourcePath, context);
    } else {
      outputPath = path.posix.join(options.outputPath, url);
    }
  }

  if (typeof options.emitFile === 'undefined' || options.emitFile) {
    this.emitFile(outputPath, options.minimize ? setXmlMinify(source) : source);
  }
  let miniJsStr = '';
  if (miniJs.length && options.fallback) {
    const { urls } = getRequire(this.resourcePath, miniJs);
    miniJsStr = urls.map((url) => {
      return `require('${fallbackFn(url, options.fallback)}');`;
    }).join('');
  }
  return getRequire(this.resourcePath, importArr).str + miniJsStr;
};

function getRequire(resourcePath, importArr = []) {
  const fileDir = path.dirname(resourcePath),
    srcName = path.relative(process.cwd(), fileDir).split(path.sep)[0] || 'src',
    srcDir = path.resolve(process.cwd(), srcName);

  let str = '',
    urls = [],
    urlCache = {};
  importArr.forEach(importUrl => {
    let isRootUrl = importUrl.indexOf('\/') === 0,
      sourceUrl = path.join(srcDir, importUrl);
    if (!isRootUrl) {
      sourceUrl = path.resolve(fileDir, importUrl);
    }
    if (!urlCache[sourceUrl]) {
      const relativeUrl = `./${path.relative(fileDir, sourceUrl).split(path.sep).join('/')}`;
      urls.push(relativeUrl);
      str += `require('${relativeUrl}');`;
      urlCache[sourceUrl] = true;
    }
  });
  urlCache = {};
  return {
    str,
    urls,
  };
}

function getRequireDir(resourcePath) {
  const fileDir = path.dirname(resourcePath),
    srcName = path.relative(process.cwd(), fileDir).split(path.sep)[0] || 'src',
    srcDir = path.resolve(process.cwd(), srcName);

  return path.relative(srcDir, fileDir);
}

/**
 * xml minifier
 */
function setXmlMinify(content = '') {
  return minify(content, {
    keepClosingSlash: true,
    removeComments: true,
    collapseWhitespace: true,
    collapseInlineTagWhitespace: true,
    sortAttributes: true,
    caseSensitive: true,
  });
}

exports.default = miniXmlLoader;
