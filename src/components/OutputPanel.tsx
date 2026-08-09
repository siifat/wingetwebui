import { Check, Clipboard, Download, FileCode2, SquareTerminal } from 'lucide-react'
import { useState } from 'react'
import { type GeneratedArtifacts } from '../types/domain'

type OutputKind = 'command' | 'powershell' | 'batch'

const outputTabs: Array<{ id: OutputKind; label: string; extension?: string }> = [
  { id: 'command', label: 'Command' },
  { id: 'powershell', label: 'PowerShell', extension: '.ps1' },
  { id: 'batch', label: 'Batch', extension: '.bat' },
]

interface OutputPanelProps {
  artifacts: GeneratedArtifacts
  selectedCount: number
  onFeedback: (message: string, tone?: 'success' | 'error' | 'info') => void
}

function downloadText(contents: string, filename: string, mimeType: string) {
  const blob = new Blob([contents], { type: `${mimeType};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function OutputPanel({ artifacts, selectedCount, onFeedback }: OutputPanelProps) {
  const [activeOutput, setActiveOutput] = useState<OutputKind>('command')
  const [copied, setCopied] = useState(false)
  const output = artifacts[activeOutput]

  const handleCopy = async () => {
    if (!output) return
    try {
      await navigator.clipboard.writeText(output)
      setCopied(true)
      onFeedback('Copied to clipboard', 'success')
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      onFeedback('Could not access the clipboard. Select the text and copy it manually.', 'error')
    }
  }

  const handleDownload = () => {
    if (!output || activeOutput === 'command') return
    const isPowerShell = activeOutput === 'powershell'
    downloadText(
      output,
      isPowerShell ? 'winget-install.ps1' : 'winget-install.bat',
      isPowerShell ? 'text/x-powershell' : 'application/x-bat',
    )
    onFeedback(`${isPowerShell ? 'PowerShell' : 'Batch'} script downloaded`, 'success')
  }

  return (
    <section className="plan-section output-section" aria-labelledby="output-title">
      <div className="section-heading output-heading">
        <div>
          <span className="section-step">04</span>
          <div>
            <h2 id="output-title">Ready to install</h2>
            <p>
              {selectedCount > 0
                ? 'Updates live as your plan changes'
                : 'Add apps to generate output'}
            </p>
          </div>
        </div>
        {selectedCount > 0 && (
          <span className="live-indicator">
            <i /> Live
          </span>
        )}
      </div>

      <div className="output-tabs" role="tablist" aria-label="Generated output">
        {outputTabs.map((tab) => (
          <button
            key={tab.id}
            id={`output-tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={activeOutput === tab.id}
            aria-controls="output-preview"
            data-active={activeOutput === tab.id}
            onClick={() => {
              setActiveOutput(tab.id)
              setCopied(false)
            }}
          >
            {tab.label}
            {tab.extension && <small>{tab.extension}</small>}
          </button>
        ))}
      </div>

      <div
        className="output-preview"
        id="output-preview"
        role="tabpanel"
        aria-labelledby={`output-tab-${activeOutput}`}
        tabIndex={0}
      >
        <div className="output-preview__topbar">
          <span>
            {activeOutput === 'command' ? <SquareTerminal size={14} /> : <FileCode2 size={14} />}
            {activeOutput === 'command'
              ? 'Windows Terminal'
              : activeOutput === 'powershell'
                ? 'winget-install.ps1'
                : 'winget-install.bat'}
          </span>
          <button
            className="copy-button"
            type="button"
            onClick={handleCopy}
            disabled={!output}
            aria-label={`Copy generated ${activeOutput}`}
          >
            {copied ? <Check size={14} /> : <Clipboard size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
        {output ? (
          <pre>
            <code>{output}</code>
          </pre>
        ) : (
          <div className="output-empty">
            <SquareTerminal size={20} />
            <span>Your generated {activeOutput} will appear here.</span>
          </div>
        )}
      </div>

      {activeOutput !== 'command' && (
        <button
          className="button button--primary button--full download-script-button"
          type="button"
          disabled={!output}
          onClick={handleDownload}
        >
          <Download size={16} /> Download {activeOutput === 'powershell' ? 'PowerShell' : 'Batch'}{' '}
          script
        </button>
      )}
      {selectedCount > 0 && (
        <p className="safety-note">
          Review the generated output before running it. WingetWebUI never executes commands.
        </p>
      )}
    </section>
  )
}
