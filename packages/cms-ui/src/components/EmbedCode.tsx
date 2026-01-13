import { useState } from 'react'

interface EmbedCodeProps {
  pollId: string;
}

function EmbedCode({ pollId }: EmbedCodeProps) {
  const [copied, setCopied] = useState(false);
  const [width, setWidth] = useState('100%');
  const [height, setHeight] = useState('400');

  // Use relative URL for embed - in production this would be the full URL
  const embedUrl = `/embed/${pollId}`;
  
  const iframeCode = `<iframe
  src="${embedUrl}"
  width="${width}"
  height="${height}"
  frameborder="0"
  title="Poll"
  style="border: none; max-width: 100%;">
</iframe>`;

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(iframeCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  return (
    <div>
      <h3 className="card-title" style={{ marginBottom: '16px' }}>Embed Code</h3>
      
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="embed-width">Width</label>
          <input
            type="text"
            id="embed-width"
            className="form-input"
            value={width}
            onChange={(e) => setWidth(e.target.value)}
            style={{ width: '100px' }}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label" htmlFor="embed-height">Height</label>
          <input
            type="text"
            id="embed-height"
            className="form-input"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
            style={{ width: '100px' }}
          />
        </div>
      </div>

      <div className="embed-code">
        <pre>{iframeCode}</pre>
        <button
          className="btn btn-secondary btn-sm copy-btn"
          onClick={copyToClipboard}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      <h4 style={{ marginTop: '24px', marginBottom: '12px' }}>Preview</h4>
      <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
        <iframe
          src={embedUrl}
          width={width}
          height={height}
          frameBorder="0"
          title="Poll Preview"
          style={{ border: 'none', maxWidth: '100%', display: 'block' }}
        />
      </div>
    </div>
  );
}

export default EmbedCode;
