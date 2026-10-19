(function (root, factory) {
  const helpers = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = helpers;
  } else {
    Object.assign(root, helpers);
  }
})(globalThis, function () {
  function completePairAndAppendBlank(pairs, index) {
    const pair = pairs[index];
    if (
      index !== pairs.length - 1
      || !pair
      || !pair.sourceText.trim()
      || !pair.targetText.trim()
    ) {
      return false;
    }

    pairs.push({ sourceText: '', targetText: '' });
    return true;
  }

  function getDefaultLanguageIds(languages) {
    const source = languages.find((language) => language.name === 'Polski') || languages[0];
    if (!source) {
      return { sourceLanguageId: '', targetLanguageId: '' };
    }

    const target = languages.find((language) => language.id !== source.id) || source;
    return {
      sourceLanguageId: source.id,
      targetLanguageId: target.id,
    };
  }

  function hasDistinctLanguageIds(sourceLanguageId, targetLanguageId) {
    return Boolean(sourceLanguageId && targetLanguageId && sourceLanguageId !== targetLanguageId);
  }

  return {
    completePairAndAppendBlank,
    getDefaultLanguageIds,
    hasDistinctLanguageIds,
  };
});
