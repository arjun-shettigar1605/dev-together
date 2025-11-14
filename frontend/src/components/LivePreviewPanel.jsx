// src/components/LivePreviewPanel.jsx
import React, { useRef, useEffect } from "react";

const LivePreviewPanel = ({ files }) => {
  const iframeRef = useRef(null);

  useEffect(() => {
    if (files && iframeRef.current) {
      buildPreview(files);
    }
  }, [files]);

  const buildPreview = (filesObj) => {
    const fileMap = Object.values(filesObj);

    // Find the HTML file (index.html or first .html file)
    const htmlFile =
      fileMap.find((f) => f.name === "index.html")?.content ||
      fileMap.find((f) => f.name.endsWith(".html"))?.content ||
      "<html><body><h1>No HTML file found</h1><p>Create an index.html file to see the preview.</p></body></html>";

    // Combine all CSS files
    const css = fileMap
      .filter((f) => f.name.endsWith(".css"))
      .map((f) => f.content)
      .join("\n");

    // Combine all JS files
    const js = fileMap
      .filter((f) => f.name.endsWith(".js"))
      .map((f) => f.content)
      .join("\n");

    // Construct the preview document
    const previewDoc = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              margin: 0;
              padding: 0;
            }
            ${css}
          </style>
        </head>
        <body>
          ${htmlFile}
          <script>
            try {
              ${js}
            } catch (e) {
              console.error('Script error:', e);
              document.body.innerHTML += '<div style="color: red; padding: 10px; background: #fee; border: 1px solid red; margin: 10px;">Error: ' + e.message + '</div>';
            }
          </script>
        </body>
      </html>
    `;

    // Update the iframe
    if (iframeRef.current) {
      iframeRef.current.srcdoc = previewDoc;
    }
  };

  return (
    <div className="w-full h-full bg-white dark:bg-gray-900">
      <iframe
        ref={iframeRef}
        title="Live Preview"
        className="w-full h-full border-0"
        sandbox="allow-scripts allow-same-origin allow-modals"
      />
    </div>
  );
};

export default LivePreviewPanel;
