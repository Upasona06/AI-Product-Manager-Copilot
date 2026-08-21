import React, { useState } from 'react';

/**
 * Parses inline formatting: **bold**, *italic*, `code`, and [links](url).
 */
const renderInline = (text) => {
  if (!text) return null;

  // Split by inline code first: `code`
  const codeParts = text.split(/`([^`]+)`/g);
  return codeParts.map((codePart, codeIdx) => {
    // If odd index, this was inside backticks: inline code
    if (codeIdx % 2 !== 0) {
      return (
        <code
          key={`code-${codeIdx}`}
          style={{
            background: 'rgba(124, 58, 237, 0.12)',
            color: 'var(--accent-primary)',
            padding: '0.15rem 0.4rem',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '0.85em',
            border: '1px solid rgba(124, 58, 237, 0.25)'
          }}
        >
          {codePart}
        </code>
      );
    }

    // Now split by bold: **bold**
    const boldParts = codePart.split(/\*\*([^*]+)\*\*/g);
    return boldParts.map((boldPart, boldIdx) => {
      const isBold = boldIdx % 2 !== 0;

      // Inside each bold/non-bold chunk, split by italic: *italic*
      const subParts = boldPart.split(/\*([^*]+)\*/g);
      const renderedItalic = subParts.map((subPart, subIdx) => {
        if (subIdx % 2 !== 0) {
          return (
            <em key={`em-${subIdx}`} style={{ fontStyle: 'italic', color: 'inherit' }}>
              {subPart}
            </em>
          );
        }
        return subPart;
      });

      if (isBold) {
        return (
          <strong
            key={`bold-${boldIdx}`}
            style={{
              fontWeight: 700,
              color: 'inherit',
              letterSpacing: '0.01em'
            }}
          >
            {renderedItalic}
          </strong>
        );
      }

      return <React.Fragment key={`span-${boldIdx}`}>{renderedItalic}</React.Fragment>;
    });
  });
};

/**
 * Parses and renders complete Markdown text into a clean, modern HTML document.
 */
const MarkdownRenderer = ({ content, title, className = '', isChat = false, hideToolbar = false }) => {
  const [viewMode, setViewMode] = useState('formatted'); // 'formatted' | 'raw'

  if (!content) return null;

  // Split into raw lines
  const lines = content.split('\n');

  const renderedElements = [];
  let currentList = null; // { type: 'ul' | 'ol', items: [] }
  let currentTable = null; // { headers: [], rows: [] }
  let inCodeBlock = false;
  let codeBlockLines = [];
  let codeBlockLang = '';

  const flushList = () => {
    if (currentList) {
      if (currentList.type === 'ul') {
        renderedElements.push(
          <ul
            key={`list-${renderedElements.length}`}
            style={{
              margin: '0.5rem 0 1rem 1.25rem',
              paddingLeft: '0.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              color: 'inherit'
            }}
          >
            {currentList.items.map((item, i) => (
              <li key={i} style={{ lineHeight: '1.6', listStyleType: item.isCheckbox ? 'none' : 'disc' }}>
                {item.content}
              </li>
            ))}
          </ul>
        );
      } else {
        renderedElements.push(
          <ol
            key={`list-${renderedElements.length}`}
            style={{
              margin: '0.5rem 0 1rem 1.5rem',
              paddingLeft: '0.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
              color: 'inherit'
            }}
          >
            {currentList.items.map((item, i) => (
              <li key={i} style={{ lineHeight: '1.6' }}>
                {item.content}
              </li>
            ))}
          </ol>
        );
      }
      currentList = null;
    }
  };

  const flushTable = () => {
    if (currentTable) {
      renderedElements.push(
        <div
          key={`table-wrap-${renderedElements.length}`}
          style={{
            overflowX: 'auto',
            margin: '1.25rem 0',
            borderRadius: '8px',
            border: '1px solid var(--glass-border)',
            background: 'var(--glass-bg)'
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            {currentTable.headers.length > 0 && (
              <thead>
                <tr style={{ background: 'rgba(124, 58, 237, 0.1)', borderBottom: '1px solid var(--glass-border)' }}>
                  {currentTable.headers.map((h, i) => (
                    <th key={i} style={{ padding: '0.75rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {renderInline(h.trim())}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {currentTable.rows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  style={{
                    borderBottom: '1px solid var(--glass-border)',
                    background: rIdx % 2 === 0 ? 'transparent' : 'var(--glass-bg)'
                  }}
                >
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} style={{ padding: '0.65rem 1rem', color: 'var(--text-secondary)' }}>
                      {renderInline(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      currentTable = null;
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // 1. Code Block Delimiters
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        // Close code block
        flushList();
        flushTable();
        renderedElements.push(
          <div
            key={`code-block-${renderedElements.length}`}
            style={{
              margin: '0.75rem 0',
              padding: '0.9rem 1.15rem',
              borderRadius: '8px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--glass-border)',
              overflowX: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              lineHeight: '1.5',
              color: 'var(--text-primary)'
            }}
          >
            {codeBlockLines.join('\n')}
          </div>
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        // Open code block
        flushList();
        flushTable();
        inCodeBlock = true;
        codeBlockLang = trimmed.replace('```', '').trim();
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      return;
    }

    // 2. Horizontal Rules
    if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
      flushList();
      flushTable();
      renderedElements.push(
        <hr
          key={`hr-${renderedElements.length}`}
          style={{
            borderColor: 'var(--glass-border)',
            margin: '1.5rem 0',
            opacity: 0.6
          }}
        />
      );
      return;
    }

    // 3. Table Rows
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      flushList();
      const cells = trimmed.slice(1, -1).split('|');
      
      // Check if this is a separator row like | --- | --- |
      const isSeparator = cells.every(c => c.trim().match(/^:?-+:?$/));
      if (isSeparator) {
        return; // Ignore formatting line
      }

      if (!currentTable) {
        currentTable = { headers: cells, rows: [] };
      } else {
        currentTable.rows.push(cells);
      }
      return;
    } else {
      flushTable();
    }

    // 4. Headings
    if (trimmed.startsWith('# ') || trimmed.startsWith('## ') || trimmed.startsWith('### ') || trimmed.startsWith('#### ')) {
      flushList();
      
      if (trimmed.startsWith('# ')) {
        const titleText = trimmed.replace(/^#\s+/, '');
        renderedElements.push(
          <div
            key={`h1-${renderedElements.length}`}
            style={{
              marginTop: idx === 0 ? '0' : '1.25rem',
              marginBottom: '1rem',
              paddingBottom: '0.5rem',
              borderBottom: '2px solid rgba(124, 58, 237, 0.3)'
            }}
          >
            <h1
              style={{
                fontSize: isChat ? '1.25rem' : '1.5rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
                lineHeight: 1.3
              }}
            >
              📄 {renderInline(titleText)}
            </h1>
          </div>
        );
        return;
      }

      if (trimmed.startsWith('## ')) {
        const h2Text = trimmed.replace(/^##\s+/, '');
        renderedElements.push(
          <div
            key={`h2-${renderedElements.length}`}
            style={{
              marginTop: '1.25rem',
              marginBottom: '0.6rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <h2
              style={{
                fontSize: isChat ? '1.05rem' : '1.2rem',
                fontWeight: 600,
                color: 'var(--accent-primary)',
                letterSpacing: '-0.01em',
                borderLeft: '3px solid var(--accent-primary)',
                paddingLeft: '0.5rem',
                margin: 0
              }}
            >
              {renderInline(h2Text)}
            </h2>
          </div>
        );
        return;
      }

      if (trimmed.startsWith('### ')) {
        const h3Text = trimmed.replace(/^###\s+/, '');
        renderedElements.push(
          <h3
            key={`h3-${renderedElements.length}`}
            style={{
              fontSize: isChat ? '0.95rem' : '1.05rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginTop: '1rem',
              marginBottom: '0.4rem'
            }}
          >
            🔹 {renderInline(h3Text)}
          </h3>
        );
        return;
      }

      if (trimmed.startsWith('#### ')) {
        const h4Text = trimmed.replace(/^####\s+/, '');
        renderedElements.push(
          <h4
            key={`h4-${renderedElements.length}`}
            style={{
              fontSize: '0.9rem',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginTop: '0.75rem',
              marginBottom: '0.35rem'
            }}
          >
            {renderInline(h4Text)}
          </h4>
        );
        return;
      }
    }

    // 5. Checklist Items: - [ ] or - [x]
    const checklistMatch = trimmed.match(/^-\s+\[([ xX])\]\s+(.*)$/);
    if (checklistMatch) {
      const isChecked = checklistMatch[1].toLowerCase() === 'x';
      const itemText = checklistMatch[2];
      
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }

      currentList.items.push({
        isCheckbox: true,
        content: (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', margin: '0.2rem 0' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '18px',
                height: '18px',
                borderRadius: '4px',
                background: isChecked ? 'rgba(16, 185, 129, 0.2)' : 'var(--glass-bg)',
                border: isChecked ? '1px solid #10b981' : '1px solid var(--glass-border)',
                color: isChecked ? '#10b981' : 'transparent',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                flexShrink: 0,
                marginTop: '2px'
              }}
            >
              {isChecked ? '✓' : ''}
            </span>
            <span style={{ color: isChecked ? 'var(--text-secondary)' : 'inherit', textDecoration: isChecked ? 'line-through' : 'none' }}>
              {renderInline(itemText)}
            </span>
          </div>
        )
      });
      return;
    }

    // 6. Bullet List Items: * or -
    const bulletMatch = trimmed.match(/^([*\-+])\s+(.*)$/);
    if (bulletMatch && !trimmed.startsWith('---')) {
      const itemText = bulletMatch[2];
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push({
        isCheckbox: false,
        content: renderInline(itemText)
      });
      return;
    }

    // 7. Numbered List Items: 1. 2. etc.
    const numListMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (numListMatch) {
      const itemText = numListMatch[2];
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push({
        isCheckbox: false,
        content: renderInline(itemText)
      });
      return;
    }

    // 8. Blockquotes: > quote
    if (trimmed.startsWith('>')) {
      flushList();
      const quoteText = trimmed.replace(/^>\s*/, '');
      renderedElements.push(
        <div
          key={`quote-${renderedElements.length}`}
          style={{
            margin: '0.65rem 0',
            padding: '0.5rem 0.85rem',
            borderLeft: '3px solid var(--accent-primary)',
            background: 'rgba(124, 58, 237, 0.08)',
            borderRadius: '0 6px 6px 0',
            color: 'var(--text-secondary)',
            fontStyle: 'italic',
            fontSize: '0.9rem'
          }}
        >
          {renderInline(quoteText)}
        </div>
      );
      return;
    }

    // 9. Standard Paragraph or Blank Line
    flushList();

    if (!trimmed) {
      // Empty line spacing
      renderedElements.push(<div key={`space-${idx}`} style={{ height: '0.4rem' }} />);
      return;
    }

    // Regular paragraph
    renderedElements.push(
      <p
        key={`p-${renderedElements.length}`}
        style={{
          margin: '0.35rem 0',
          lineHeight: '1.65',
          color: 'inherit',
          fontSize: '0.92rem'
        }}
      >
        {renderInline(trimmed)}
      </p>
    );
  });

  // Final flushes
  flushList();
  flushTable();

  // If in chat mode or hideToolbar is requested, render directly without the outer container and tabs
  if (isChat || hideToolbar) {
    return (
      <div className={`markdown-chat-body ${className}`} style={{ color: 'inherit', lineHeight: '1.6' }}>
        {renderedElements}
      </div>
    );
  }

  return (
    <div className={`rich-markdown-container ${className}`} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top Format Switcher Tabs */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '0.75rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid var(--glass-border)'
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            background: 'var(--glass-bg)',
            borderRadius: '6px',
            padding: '2px',
            border: '1px solid var(--glass-border)'
          }}
        >
          <button
            type="button"
            onClick={() => setViewMode('formatted')}
            style={{
              padding: '0.3rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: viewMode === 'formatted' ? 'var(--accent-primary)' : 'transparent',
              color: viewMode === 'formatted' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            🎨 Document Preview
          </button>
          <button
            type="button"
            onClick={() => setViewMode('raw')}
            style={{
              padding: '0.3rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: viewMode === 'raw' ? 'var(--accent-primary)' : 'transparent',
              color: viewMode === 'raw' ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.2s'
            }}
          >
            📄 Raw Markdown
          </button>
        </div>
      </div>

      {/* Content Body */}
      {viewMode === 'formatted' ? (
        <div
          className="markdown-formatted-body"
          style={{
            flex: 1,
            background: 'var(--glass-premium-bg)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            padding: '1.5rem 1.75rem',
            overflowY: 'auto',
            maxHeight: '680px',
            color: 'var(--text-primary)'
          }}
        >
          {renderedElements}
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            padding: '1.25rem',
            overflowY: 'auto',
            maxHeight: '680px',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            fontSize: '0.85rem',
            lineHeight: '1.5',
            color: 'var(--text-primary)'
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
};

export default MarkdownRenderer;
