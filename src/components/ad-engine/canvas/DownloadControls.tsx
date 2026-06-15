import type { ExportFormat } from '../../../types'

interface Props {
  exportFormat: ExportFormat
  isExporting: boolean
  exportProgress: number
  disabled: boolean
  onExportFormatChange: (format: ExportFormat) => void
  onExport: (format: ExportFormat) => void
}

export function DownloadControls({
  exportFormat,
  isExporting,
  exportProgress,
  disabled,
  onExportFormatChange,
  onExport,
}: Props) {
  return (
    <div className="canvas-download-group">
      <select
        className="canvas-format-select"
        value={exportFormat}
        onChange={e => onExportFormatChange(e.target.value as ExportFormat)}
        disabled={disabled || isExporting}
        aria-label="Download format"
      >
        <option value="webm">WebM</option>
        <option value="mp4">MP4</option>
      </select>

      <button
        className="tl-btn export canvas-download-btn"
        onClick={() => onExport(exportFormat)}
        disabled={disabled || isExporting}
        style={{ position: 'relative', overflow: 'hidden' }}
      >
        {isExporting && (
          <span
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--green)',
              opacity: 0.18,
              transformOrigin: 'left',
              transform: `scaleX(${exportProgress})`,
              transition: 'transform 0.2s linear',
            }}
          />
        )}
        <span style={{ position: 'relative' }}>
          {isExporting ? `⬇ Downloading… ${Math.round(exportProgress * 100)}%` : '⬇ Download'}
        </span>
      </button>
    </div>
  )
}
