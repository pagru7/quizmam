(function (root, factory) {
  const getManualPracticeDisplayText = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = { getManualPracticeDisplayText };
  } else {
    root.getManualPracticeDisplayText = getManualPracticeDisplayText;
  }
})(globalThis, function () {
  return function getManualPracticeDisplayText(promptText, manualResult, expectedText) {
    return manualResult ? manualResult.expectedText || expectedText : promptText;
  };
});
