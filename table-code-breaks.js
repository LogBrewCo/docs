// A long code value in a table may break between its words, never inside one: before a slash,
// a dot, an underscore, or an opening brace, and between the words of a camelCase name. A
// placeholder in braces, such as {issue_id}, stays whole, and an opening quote stays with the
// character after it. A <wbr> adds no character, so a copied value,
// a search, and a screen reader read the value unchanged. The page renders its content again
// after load and on each page change, so new tables are watched for.
(() => {
  const OPENING_QUOTE = /((?<=^|\s)"\S)/;
  const BETWEEN_WORDS = /(?:(?<=[^/._{])(?=[/._{])|(?<=[a-z0-9])(?=[A-Z]))(?![^{}]*\})/;
  let pending = false;

  const withBreaks = (text) =>
    text.split(OPENING_QUOTE).flatMap((part, i) => {
      if (i % 2) {
        const kept = document.createElement("span");
        kept.style.whiteSpace = "nowrap";
        kept.textContent = part;
        return [kept];
      }
      return part.split(BETWEEN_WORDS).flatMap((word, j) => (j ? [document.createElement("wbr"), word] : [word]));
    });

  const addBreaks = () => {
    pending = false;
    for (const code of document.querySelectorAll("#content-area table code:not([data-word-breaks])")) {
      code.dataset.wordBreaks = "";
      const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
      const texts = [];
      for (let node = walker.nextNode(); node; node = walker.nextNode()) texts.push(node);
      for (const node of texts) {
        const parts = withBreaks(node.data).filter((part) => part !== "");
        if (parts.length > 1) node.replaceWith(...parts);
      }
    }
  };

  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(addBreaks);
  }).observe(document.body, { childList: true, subtree: true });
  addBreaks();
})();
