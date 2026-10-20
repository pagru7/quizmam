(function (root, factory) {
  const helpers = factory();

  if (typeof module === 'object' && module.exports) {
    module.exports = helpers;
  } else {
    Object.assign(root, helpers);
  }
})(globalThis, function () {
  function flipCard(isFlipped, onReveal) {
    const nextFlipped = !isFlipped;
    if (nextFlipped) {
      onReveal();
    }
    return nextFlipped;
  }

  function shouldFlipCardFromKey(event) {
    if (event.repeat) return false;

    return event.code === 'Space'
      || event.key === ' '
      || event.key === 'Space'
      || event.key === 'Spacebar';
  }

  return { flipCard, shouldFlipCardFromKey };
});
