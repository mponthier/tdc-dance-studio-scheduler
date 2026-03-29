import { useState, useMemo } from 'react'
import { marked } from 'marked'
import readmeRaw from '../../../README.md?raw'
import userGuideRaw from '../../../USER-GUIDE.md?raw'
import './DocsPage.css'

const TABS = [
  { id: 'readme',    label: 'README',     raw: readmeRaw    },
  { id: 'userguide', label: 'User Guide', raw: userGuideRaw },
]

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState('readme')
  const tab = TABS.find((t) => t.id === activeTab)
  const html = useMemo(() => marked.parse(tab.raw), [tab])

  return (
    <div className="docs-page">
      <div className="docs-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`docs-tab${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <button className="docs-print-btn" onClick={() => window.print()} title="Print">
          🖨 Print
        </button>
      </div>
      <div
        className="docs-body markdown-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}
