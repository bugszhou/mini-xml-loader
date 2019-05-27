module.exports = function(url = '', fallback = {}) {
  if (!url || typeof url !== 'string') {
    throw new Error('path is not a string!');
  }
  const { test, use } = fallback;
  if (!test.test(url)) {
    return '';
  }
  let loaderArr = [];
  use.forEach((item) => {
    loaderArr.push(`${item.loader}?${JSON.stringify(item.options)}`);
  });
  loaderArr.push(url);
  return loaderArr.join('!')
}
