// src/pages/PreviewPage.jsx
import React, { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";

const PreviewPage = () => {
  const { roomId } = useParams();
  const socketRef = useRef(null);
  const iframeRef = useRef(null);

  useEffect(() => {
    socketRef.current = io("http://localhost:5001");

    // 1. Join the preview room
    socketRef.current.emit("join-preview-room", { roomId });

    // 2. Listen for updates
    socketRef.current.on("live-preview-update", ({ files }) => {
      if (files) {
        buildPreview(files);
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [roomId]);

  const buildPreview = (files) => {
    const fileMap = Object.values(files);

    // Find the first HTML file, or default
    const htmlFile =
      fileMap.find((f) => f.name.endsWith(".html"))?.content ||
      "<html><body>No index.html file found.</body></html>";

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

    // Construct the document
    const previewDoc = `
      <html>
        <head>
          <style>
            ${css}
          </style>
        </head>
        <body>
          ${htmlFile}
          <script>
            try {
              ${js}
            } catch (e) {
              console.error(e);
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
    <iframe
      ref={iframeRef}
      title="Live Preview"
      style={{ width: "100vw", height: "100vh", border: "none" }}
      sandbox="allow-scripts allow-same-origin"
    />
  );
};

export default PreviewPage;
