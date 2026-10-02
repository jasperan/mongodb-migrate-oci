const LIST_ITEM = /^\s*(?:([-*•])|(\d+)[.)])\s+(.*)$/
const BOLD = /\*\*([^*\n]+)\*\*/g

// **bold** is the only inline markup. Everything else renders as the text it is:
// the answer is model output, so it is only ever placed in the tree as React
// text nodes and never parsed as HTML.
function renderInline(text) {
  const parts = []
  let last = 0
  for (const match of text.matchAll(BOLD)) {
    parts.push(text.slice(last, match.index))
    parts.push(<strong key={match.index}>{match[1]}</strong>)
    last = match.index + match[0].length
  }
  parts.push(text.slice(last))
  return parts
}

/** Splits an answer into paragraph and list blocks. */
export function parseAnswer(text) {
  const blocks = []
  let current = null

  for (const line of String(text || '').split('\n')) {
    if (!line.trim()) {
      current = null
      continue
    }
    const item = line.match(LIST_ITEM)
    if (item) {
      const ordered = Boolean(item[2])
      if (current?.type !== 'list' || current.ordered !== ordered) {
        current = { type: 'list', ordered, items: [] }
        blocks.push(current)
      }
      current.items.push(item[3])
    } else if (current?.type === 'paragraph') {
      current.lines.push(line.trim())
    } else {
      current = { type: 'paragraph', lines: [line.trim()] }
      blocks.push(current)
    }
  }
  return blocks
}

/** Paragraphs, "- " / "1. " lists and **bold** - nothing else. */
export function FormattedAnswer({ text }) {
  return (
    <div className="space-y-2">
      {parseAnswer(text).map((block, index) => {
        if (block.type === 'paragraph') {
          return <p key={index}>{renderInline(block.lines.join(' '))}</p>
        }
        const List = block.ordered ? 'ol' : 'ul'
        return (
          <List key={index} className={block.ordered ? 'list-decimal space-y-1 pl-5' : 'list-disc space-y-1 pl-5'}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>{renderInline(item)}</li>
            ))}
          </List>
        )
      })}
    </div>
  )
}
