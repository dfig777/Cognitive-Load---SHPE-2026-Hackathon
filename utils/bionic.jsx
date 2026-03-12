/**
 * Bionic Reading: bolds the first half (rounded up) of each word.
 * Returns an array of React elements (spans).
 */
export function bionicify(text) {
  if (!text) return []
  return text.split(' ').map((word, i) => {
    const cut = Math.ceil(word.length / 2)
    return (
      <span key={i}>
        <b>{word.slice(0, cut)}</b>{word.slice(cut)}{' '}
      </span>
    )
  })
}