import React, { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import Editor from "@monaco-editor/react";
import axios from "axios";
import Avatar from "react-avatar";
import toast, { Toaster } from "react-hot-toast";
import { debounce } from "lodash";
import Peer from "simple-peer";
import { v4 as uuidv4 } from "uuid";
import { useTheme } from "../contexts/ThemeContext";
import ThemeToggle from "../components/ThemeToggle";
import FileExplorer from "../components/FileExplorer";
import DatabaseSchemaExplorer from "../components/DatabaseSchemaExplorer";
import DatabaseFileViewer from "../components/DatabaseFileViewer";
import SqlOutputTable from "../components/SqlOutputTable";
import LivePreviewPanel from "../components/LivePreviewPanel";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaCopy,
  FaPlay,
  FaLightbulb,
  FaBroadcastTower,
  FaCrown,
  FaWindowMaximize,
  FaCode,
  FaDatabase,
  FaExpand,
} from "react-icons/fa";

const getLanguageFromExtension = (filename) => {
  if (!filename) return "plaintext";
  const extension = filename.split(".").pop();
  switch (extension) {
    case "js":
      return "javascript";
    case "sql":
      return "sql";
    case "py":
      return "python";
    case "java":
      return "java";
    case "cpp":
      return "cpp";
    case "c":
      return "c";
    case "html":
      return "html";
    case "css":
      return "css";
    default:
      return "plaintext";
  }
};

const boilerplates = {
  python:
    '# Your Python code goes here\n\ndef main():\n\tprint("Hello, Python!")\n\nif __name__ == "__main__":\n\tmain()',
  javascript:
    '// Your JavaScript code goes here\n\nfunction greet() {\n\tconsole.log("Hello, JavaScript!");\n}\n\ngreet();',
  java: 'public class Main {\n\tpublic static void main(String[] args) {\n\t\tSystem.out.println("Hello, Java!");\n\t}\n}',
  cpp: '#include <iostream>\n\nint main() {\n\tstd::cout << "Hello, C++!" << std::endl;\n\treturn 0;\n}',
  c: '#include <stdio.h>\n\nint main() {\n\tprintf("Hello, World!\\n");\n\treturn 0;\n}',
  plaintext: "Your text goes here.",
};

const pendingRequests = new Map();

const EditorPage = () => {
  const { theme, toggleTheme } = useTheme();

  const socketRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams();
  const fileRef = useRef(null);
  const localStreamRef = useRef(null);
  const filesRef = useRef({});
  const previewWindowRef = useRef(null);

  const [clients, setClients] = useState([]);
  const [programmingFiles, setProgrammingFiles] = useState({});
  const [developmentFiles, setDevelopmentFiles] = useState({});
  const [databaseFiles, setDatabaseFiles] = useState({});

  const [activeProgrammingFileId, setActiveProgrammingFileId] = useState(null);
  const [activeDevelopmentFileId, setActiveDevelopmentFileId] = useState(null);
  const [activeDatabaseFileId, setActiveDatabaseFileId] = useState(null);

  const [showFileInput, setShowFileInput] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const isAiEnabledRef = useRef(isAiEnabled);

  const monacoRef = useRef(null);
  const editorRef = useRef(null);
  const [isMonacoReady, setIsMonacoReady] = useState(false);
  const providerDisposableRef = useRef(null);
  const [viewMode, setViewMode] = useState("code"); // 'code' or 'preview'

  const [activeSection, setActiveSection] = useState("programming"); // 'programming' or 'database' or 'development'
  const [output, setOutput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [localStream, setLocalStream] = useState(null);
  const [audioStatus, setAudioStatus] = useState({});
  const peersRef = useRef({});
  const audioRef = useRef(null);

  const [showMicPrompt, setShowMicPrompt] = useState(true);

  const stateAccessors = {
    programming: {
      files: programmingFiles,
      setFiles: setProgrammingFiles,
      activeFileId: activeProgrammingFileId,
      setActiveFileId: setActiveProgrammingFileId,
    },
    development: {
      files: developmentFiles,
      setFiles: setDevelopmentFiles,
      activeFileId: activeDevelopmentFileId,
      setActiveFileId: setActiveDevelopmentFileId,
    },
    database: {
      files: databaseFiles,
      setFiles: setDatabaseFiles,
      activeFileId: activeDatabaseFileId,
      setActiveFileId: setActiveDatabaseFileId,
    },
  };

  const allFilesRef = useRef({});
  useEffect(() => {
    allFilesRef.current = {
      ...programmingFiles,
      ...developmentFiles,
      ...databaseFiles,
    };
  }, [programmingFiles, developmentFiles, databaseFiles]);

  // const getCurrentFiles = () => stateAccessors[activeSection].files;
  // const getCurrentActiveFileId = () =>
  //   stateAccessors[activeSection].activeFileId;
  // const getCurrentFileContent = () => {
  //   const files = getCurrentFiles();
  //   const activeFileId = getCurrentActiveFileId();
  //   return files[activeFileId]?.content || "";
  // };

  useEffect(() => {
    const initializeAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        // Start with muted audio
        stream.getAudioTracks().forEach((track) => {
          track.enabled = false; // Start muted
        });

        localStreamRef.current = stream;
        setLocalStream(stream);

        // Set initial mute status
        setAudioStatus((prev) => ({
          ...prev,
          [socketRef.current.id]: true,
        }));
      } catch (err) {
        console.error("❌ Could not initialize audio:", err);
        setAudioStatus((prev) => ({
          ...prev,
          [socketRef.current.id]: true,
        }));
        toast.error("Microphone access denied. Audio chat disabled.");
      }
    };

    initializeAudio();
  }, []);

  // useEffect(() => {
  //   filesRef.current = files;
  // }, [files]);

  // enables audio on demand
  const enableAudio = async () => {
    if (localStreamRef.current) {
      // Enable existing tracks
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = true;
      });
    } else {
      // Get new stream if doesn't exist
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
      } catch (err) {
        console.error("❌ Could not access microphone:", err);
        toast.error("Could not access microphone. Please check permissions.");
        return;
      }
    }

    // Update status and notify others
    setAudioStatus((prev) => ({ ...prev, [socketRef.current.id]: false }));
    socketRef.current.emit("mute-status-change", {
      socketId: socketRef.current.id,
      isMuted: false,
    });
    toast.success("Microphone enabled!");
  };

  useEffect(() => {
    const init = async () => {
      socketRef.current = io("http://localhost:5001");
      socketRef.current.on("connect_error", (err) => handleErrors(err));
      socketRef.current.on("connect_failed", (err) => handleErrors(err));
      function handleErrors(e) {
        console.log("socket error", e);
        toast.error("Socket connection failed, try again later.");
        navigate("/");
      }

      setupSocketListeners();

      socketRef.current.emit("join-room", {
        roomId,
        username: location.state?.username,
      });
    };

    const setupSocketListeners = () => {
      // Set initial mute state for self (true = muted)
      socketRef.current.on("connect", () => {
        setAudioStatus((prev) => ({ ...prev, [socketRef.current.id]: true }));
      });

      socketRef.current.on("filesystem-updated", ({ files: receivedFiles }) => {
        if (receivedFiles.programming) {
          setProgrammingFiles(receivedFiles.programming.files);
        }
        if (receivedFiles.development) {
          setDevelopmentFiles(receivedFiles.development.files);
        }
        if (receivedFiles.database) {
          setDatabaseFiles(receivedFiles.database.files);
        }
        if (!isInitialized) {
          if (receivedFiles.programming) {
            setActiveProgrammingFileId(receivedFiles.programming.defaultFileId);
          }
          if (receivedFiles.development) {
            setActiveDevelopmentFileId(receivedFiles.development.defaultFileId);
          }
          if (receivedFiles.database) {
            setActiveDatabaseFileId(receivedFiles.database.defaultFileId);
          }
          setIsInitialized(true);
        }
      });

      socketRef.current.on("code-change", ({ fileId, code, section }) => {
        const { setFiles } = stateAccessors[section];
        if (setFiles) {
          setFiles((prev) => {
            if (prev[fileId]) {
              return {
                ...prev,
                [fileId]: { ...prev[fileId], content: code },
              };
            }
            return prev;
          });
        }
      });

      socketRef.current.on("suggestion-result", ({ suggestion, requestId }) => {
        const pending = pendingRequests.get(requestId);
        if (pending && suggestion) {
          pending.resolve({
            items: [
              {
                insertText: suggestion,
                range: {
                  startLineNumber: pending.position.lineNumber,
                  startColumn: pending.position.column,
                  endLineNumber: pending.position.lineNumber,
                  endColumn: pending.position.column,
                },
              },
            ],
          });
          pendingRequests.delete(requestId);
        } else if (pending) {
          pending.resolve({ items: [] });
          pendingRequests.delete(requestId);
        }
      });

      // Only update clients list, don't handle WebRTC here
      socketRef.current.on("user-joined", ({ clients, username, socketId }) => {
        console.log("Received clients list:", clients);

        if (username && socketId !== socketRef.current.id) {
          toast.success(`${username} joined the room.`);
        }

        setClients(clients);
      });

      // Handle server instruction to initiate peer connection
      socketRef.current.on("initiate-peer", ({ socketId }) => {
        if (!socketId || socketRef.current.id === socketId) {
          return;
        }

        if (peersRef.current[socketId]) {
          return;
        }

        // Wait briefly for stream to be available if needed
        const attemptConnection = () => {
          if (!localStreamRef.current) {
            setTimeout(attemptConnection, 100);
            return;
          }

          console.log("✅ Creating peer (INITIATOR) for:", socketId);
          const peer = createPeer(
            socketId,
            socketRef.current.id,
            localStreamRef.current
          );

          if (peer) {
            peersRef.current[socketId] = peer;
          }
        };

        attemptConnection();
      });

      // for host changes
      socketRef.current.on("host-changed", ({ newHostId }) => {
        let newHostUsername = ""; // Variable to store the username

        setClients((prevClients) => {
          // Find the new host from the *previous* state (before mapping)
          const newHost = prevClients.find((c) => c.socketId === newHostId);
          if (newHost) {
            newHostUsername = newHost.username;
          }

          // Return the new state
          return prevClients.map((client) => ({
            ...client,
            isHost: client.socketId === newHostId,
          }));
        });

        // Show toast *after* the state update has been queued
        if (newHostUsername) {
          toast.success(`${newHostUsername} is now the host.`);
        }
      });

      // Handle incoming offer from initiator
      socketRef.current.on("user-joined-signal", ({ signal, callerID }) => {
        if (!callerID) {
          console.error("❌ callerID is undefined");
          return;
        }

        if (peersRef.current[callerID]) {
          console.warn("⚠️ Peer already exists for", callerID, "- skipping");
          return;
        }

        if (!localStreamRef.current) {
          console.error("❌ No local stream available");
          return;
        }
        const peer = addPeer(signal, callerID, localStreamRef.current);

        if (peer) {
          peersRef.current[callerID] = peer;
        }
      });

      // Handle answer from receiver
      socketRef.current.on("receiving-returned-signal", ({ signal, id }) => {
        const peer = peersRef.current[id];

        if (!peer) {
          console.warn("⚠️ Peer doesn't exist for:", id);
          return;
        }

        if (peer.destroyed) {
          console.warn("⚠️ Peer is destroyed for:", id);
          return;
        }

        try {
          peer.signal(signal);
        } catch (err) {
          console.error("❌ Error signaling peer:", id, err.message);
        }
      });

      socketRef.current.on("user-left", ({ socketId, username }) => {
        toast.error(`${username} left the room.`);

        if (peersRef.current[socketId]) {
          try {
            peersRef.current[socketId].destroy();
          } catch (err) {
            console.error("❌ Error destroying peer:", err);
          }
          delete peersRef.current[socketId];
        }

        const audioEl = document.getElementById(`audio-${socketId}`);
        if (audioEl) {
          audioEl.srcObject = null;
          audioEl.remove();
        }

        setClients((prev) =>
          prev.filter((client) => client.socketId !== socketId)
        );
      });

      socketRef.current.on("mute-status-updated", ({ socketId, isMuted }) => {
        setAudioStatus((prev) => ({ ...prev, [socketId]: isMuted }));
      });
    };

    init();

    return () => {
      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
        localStreamRef.current = null;
      }

      // Destroy all peers
      Object.values(peersRef.current).forEach((peer) => {
        if (peer) peer.destroy();
      });
      peersRef.current = {};

      // Clear pending requests
      pendingRequests.clear();

      // Disconnect socket
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current.off();
      }
    };
  }, [roomId, location.state?.username, navigate, isInitialized]);

  useEffect(() => {
    isAiEnabledRef.current = isAiEnabled;
  }, [isAiEnabled]);

  useEffect(() => {
    if (!isMonacoReady || !monacoRef.current) return;

    if (providerDisposableRef.current) {
      providerDisposableRef.current.dispose();
      providerDisposableRef.current = null;
    }

    const provider =
      monacoRef.current.languages.registerInlineCompletionsProvider(
        { pattern: "**/*" },
        {
          provideInlineCompletions: async (model, position, context, token) => {
            if (!isAiEnabledRef.current) {
              return { items: [] };
            }

            const currentLine = model.getLineContent(position.lineNumber);
            const currentLinePrefix = currentLine.substring(
              0,
              position.column - 1
            );

            if (
              currentLinePrefix.trim().length === 0 &&
              context.triggerKind === 0
            ) {
              return { items: [] };
            }

            const requestId = uuidv4();

            try {
              const result = await new Promise((resolve, reject) => {
                if (token.isCancellationRequested) {
                  resolve({ items: [] });
                  return;
                }

                pendingRequests.set(requestId, { resolve, position });

                const fullCode = model.getValue();

                const file = Object.values(allFilesRef.current).find(
                  (f) => f.id === model.uri.path.substring(1)
                );
                const language = file
                  ? file.language
                  : getLanguageFromExtension(model.uri.path);
                const offset = model.getOffsetAt(position);
                const codeBeforeCursor = fullCode.substring(0, offset);
                const codeAfterCursor = fullCode.substring(offset);

                socketRef.current.emit("get-suggestion", {
                  codeContext: codeBeforeCursor,
                  codeAfter: codeAfterCursor,
                  currentLine: currentLinePrefix,
                  language: language,
                  requestId: requestId,
                });

                const timeout = setTimeout(() => {
                  if (pendingRequests.has(requestId)) {
                    pendingRequests.delete(requestId);
                    resolve({ items: [] });
                  }
                }, 2000);

                token.onCancellationRequested(() => {
                  if (pendingRequests.has(requestId)) {
                    pendingRequests.delete(requestId);
                  }
                  clearTimeout(timeout);
                  resolve({ items: [] });
                });
              });

              return result;
            } catch (error) {
              console.debug("Inline completion request cancelled or failed");
              return { items: [] };
            }
          },
          freeInlineCompletions: (completions) => {},
        }
      );

    providerDisposableRef.current = provider;

    return () => {
      if (providerDisposableRef.current) {
        providerDisposableRef.current.dispose();
        providerDisposableRef.current = null;
      }
      pendingRequests.clear();
    };
  }, [isMonacoReady]);

  const handleMoveItem = (itemId, newParentId) => {
    // Basic validation to prevent dragging into thin air if state is weird
    const { files } = stateAccessors[activeSection];
    if (!files[newParentId] || files[newParentId].type !== "folder") {
      toast.error("Invalid drop target.");
      return;
    }
    socketRef.current.emit("file-move", {
      roomId,
      itemId,
      newParentId,
      section: activeSection,
    });
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    if (!monacoRef.current) {
      monacoRef.current = monaco;
      setIsMonacoReady(true);
    }
  };

  const handleCreateItem = (name, type, parentId) => {
    const { files } = stateAccessors[activeSection];
    // Basic validation
    if (
      Object.values(files).some(
        (f) => f.parentId === parentId && f.name === name
      )
    ) {
      toast.error("A file or folder with this name already exists here.");
      return;
    }
    socketRef.current.emit("file-create", {
      roomId,
      name,
      type,
      parentId,
      section: activeSection,
    }); // Send section
  };

  const handleDeleteItem = (itemId) => {
    const { activeFileId, setActiveFileId } = stateAccessors[activeSection];
    socketRef.current.emit("file-delete", {
      roomId,
      itemId,
      section: activeSection,
    }); // Send section
    if (activeFileId === itemId) {
      setActiveFileId(null);
    }
  };

  const handleCodeChange = (newCode) => {
    const { files, activeFileId, setFiles } = stateAccessors[activeSection];
    if (activeFileId && files[activeFileId]) {
      // Optimistic local update
      setFiles((prevFiles) => ({
        ...prevFiles,
        [activeFileId]: { ...prevFiles[activeFileId], content: newCode },
      }));

      socketRef.current.emit("code-change", {
        roomId,
        fileId: activeFileId,
        code: newCode,
        section: activeSection,
      });
    }
  };

  const handleRunCode = async () => {
    const { files, activeFileId } = stateAccessors[activeSection];
    const currentFile = files[activeFileId];
    if (!currentFile) return;

    setIsLoading(true);
    setOutput("");
    setError("");

    try {
      const response = await axios.post("http://localhost:5001/api/execute", {
        language: currentFile.language,
        code: currentFile.content,
      });
      setOutput(response.data.output);
    } catch (err) {
      const errorMessage = err.response ? err.response.data.error : err.message;
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFullscreenPreview = () => {
    const previewUrl = `/preview/${roomId}`;
    if (!previewWindowRef.current || previewWindowRef.current.closed) {
      previewWindowRef.current = window.open(
        previewUrl,
        "collab-preview",
        "width=800,height=600"
      );
    } else {
      previewWindowRef.current.focus();
    }
  };

  function attachAudioStream(socketId, remoteStream) {
    const tracks = remoteStream.getAudioTracks();

    if (tracks.length === 0) {
      console.error("❌ No audio tracks in remote stream!");
      return;
    }

    // CRITICAL FIX: Ensure tracks are enabled
    tracks.forEach((track) => {
      track.enabled = true;
    });

    // Remove existing audio element
    const existingAudio = document.getElementById(`audio-${socketId}`);
    if (existingAudio) {
      existingAudio.pause();
      existingAudio.srcObject = null;
      existingAudio.remove();
    }

    // Create new audio element
    const audio = document.createElement("audio");
    audio.id = `audio-${socketId}`;
    audio.autoplay = true;
    audio.playsInline = true; // CRITICAL for mobile
    audio.volume = 1.0;
    audio.muted = false; // CRITICAL: Ensure not muted

    if (typeof audio.setSinkId === "function") {
      audio.setSinkId("default").catch((err) => {
        console.warn("Could not set audio sink:", err);
      });
    }

    // Set srcObject BEFORE adding to DOM
    audio.srcObject = remoteStream;

    // Add comprehensive event listeners
    audio.onloadedmetadata = () => {
      // CRITICAL FIX: Explicitly play with error handling
      const playPromise = audio.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Verify stream tracks are active
            const streamTracks = audio.srcObject.getAudioTracks();
          })
          .catch((e) => {
            console.error(`❌ Audio play FAILED for ${socketId}:`, e.message);

            // FALLBACK: Try to play on user interaction
            document.addEventListener(
              "click",
              () => {
                audio
                  .play()
                  .then(() =>
                    console.log(`✅ Manual play succeeded for ${socketId}`)
                  )
                  .catch((err) =>
                    console.error(`❌ Manual play also failed:`, err)
                  );
              },
              { once: true }
            );
          });
      }
    };

    audio.onplay = () => {
      console.log(`🎵 onplay event fired for ${socketId}`);
    };

    audio.onpause = () => {
      console.log(`⏸️ onpause event fired for ${socketId}`);
    };

    audio.onerror = (e) => {
      console.error(`❌ Audio element error for ${socketId}:`, e);
      console.error(`Error details:`, {
        error: audio.error,
        code: audio.error?.code,
        message: audio.error?.message,
      });
    };

    audio.onstalled = () => {
      console.warn(`⚠️ Audio stalled for ${socketId}`);
    };

    audio.onwaiting = () => {
      console.warn(`⏳ Audio waiting for ${socketId}`);
    };

    audio.oncanplay = () => {
      console.log(`✅ Audio can play for ${socketId}`);
    };

    if (audioRef.current) {
      audioRef.current.appendChild(audio);
      console.log(`✅ Audio element appended to container for ${socketId}`);
    } else {
      console.error("❌ audioRef.current is null!");
    }
  }

  function createPeer(userToSignal, callerID, stream) {
    console.log(`[createPeer] Creating peer for: ${userToSignal}`);

    if (!userToSignal || !stream) {
      console.error("❌ Missing userToSignal or stream");
      return null;
    }

    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream, // Ensure stream is passed
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      },
    });

    peer.on("signal", (signal) => {
      console.log(`[createPeer] Sending offer to ${userToSignal}`);
      if (socketRef.current?.connected) {
        socketRef.current.emit("sending-signal", {
          userToSignal,
          callerID,
          signal,
        });
      }
    });

    peer.on("connect", () => {
      console.log(`[createPeer] ✅ Peer connected with ${userToSignal}`);
    });

    peer.on("stream", (remoteStream) => {
      console.log(
        `[createPeer] 🎵 Received remote stream from ${userToSignal}`
      );
      attachAudioStream(userToSignal, remoteStream);
    });

    peer.on("error", (err) => {
      console.error(`[createPeer] Peer error with ${userToSignal}:`, err);
    });

    peer.on("close", () => {
      console.log(`[createPeer] Peer connection closed with ${userToSignal}`);
      delete peersRef.current[userToSignal];
    });

    return peer;
  }

  // Update addPeer function similarly:

  function addPeer(incomingSignal, callerID, stream) {
    console.log(`[addPeer] Creating peer for: ${callerID}`);

    if (!callerID || !stream) {
      console.error("❌ Missing callerID or stream");
      return null;
    }

    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream, // Ensure stream is passed
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      },
    });

    peer.on("signal", (signal) => {
      console.log(`[addPeer] Sending answer to ${callerID}`);
      if (socketRef.current?.connected) {
        socketRef.current.emit("returning-signal", { signal, callerID });
      }
    });

    peer.on("connect", () => {
      console.log(`[addPeer] ✅ Peer connected with ${callerID}`);
    });

    peer.on("stream", (remoteStream) => {
      console.log(`[addPeer] 🎵 Received remote stream from ${callerID}`);
      attachAudioStream(callerID, remoteStream);
    });

    peer.on("error", (err) => {
      console.error(`[addPeer] Peer error with ${callerID}:`, err);
    });

    peer.on("close", () => {
      delete peersRef.current[callerID];
    });

    try {
      peer.signal(incomingSignal);
    } catch (err) {
      console.error("❌ Error during initial peer signal:", err);
      return null;
    }

    return peer;
  }

  const handleMuteToggle = (targetSocketId) => {
    const myId = socketRef.current?.id;
    if (!myId) return;

    if (targetSocketId === myId) {
      const currentlyMuted = audioStatus[myId] !== false; // Default to true if undefined

      if (currentlyMuted) {
        // Unmute - enable audio
        enableAudio();
      } else {
        // Mute - disable audio
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach((track) => {
            track.enabled = false;
          });
          setAudioStatus((prev) => ({ ...prev, [myId]: true }));
          socketRef.current.emit("mute-status-change", {
            socketId: myId,
            isMuted: true,
          });
          toast.success("Microphone muted");
        }
      }
    }
  };

  const leaveRoom = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
    }

    Object.values(peersRef.current).forEach((peer) => {
      if (peer) peer.destroy();
    });

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    navigate("/join");
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    toast.success("Room ID copied to clipboard!");
  };

  if (!location.state?.username) {
    navigate("/");
    return null;
  }

  const { files, activeFileId } = stateAccessors[activeSection];
  const currentFile = files[activeFileId];

  const SectionTab = ({ icon: Icon, label, isActive, onClick }) => (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center justify-center gap-1 py-2 text-xs font-medium rounded-md transition-colors ${
        isActive
          ? "bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-300"
          : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
      }`}
      title={label}
    >
      <Icon className="text-lg" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-[#1e1e1e] text-gray-900 dark:text-white font-sans">
      <Toaster position="top-right" />

      {/* Top Navigation Bar */}
      <div className="bg-[#fffef0] dark:bg-[#1a1815] h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-[#1e1e1e] flex-shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex-shrink-0">
            <img
              src={theme === "dark" ? "/LogoDark.png" : "/LogoLight.png"}
              alt="CollabCode"
              className="h-10 w-auto"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-[#1e1e1e] px-3 py-1.5 rounded min-w-0">
            <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
              Room:
            </span>
            <span className="text-xs text-green-500 dark:text-green-400 font-mono truncate">
              {roomId}
            </span>
            <button
              onClick={copyRoomId}
              className="text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors flex-shrink-0"
              title="Copy Room ID"
            >
              <FaCopy className="text-xs" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setIsAiEnabled(!isAiEnabled)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors ${
              isAiEnabled
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-[#2d2d30] dark:hover:bg-[#3e3e42] dark:text-gray-300"
            }`}
            title="Toggle AI Suggestions"
          >
            <FaLightbulb className="text-sm" />
            <span className="text-xs">AI</span>
          </button>

          {(activeSection === "database" ||
            activeSection === "programming") && (
            <button
              onClick={handleRunCode}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-4 py-1.5 rounded text-sm text-white transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
              disabled={isLoading || !activeFileId}
            >
              <FaPlay className="text-xs" />
              <span>{isLoading ? "Running..." : "Run"}</span>
            </button>
          )}
          <ThemeToggle />

          <button
            onClick={leaveRoom}
            className="bg-red-600 hover:bg-red-700 px-4 py-1.5 rounded text-sm text-white transition-colors"
          >
            Leave
          </button>
        </div>
      </div>

      <PanelGroup
        direction="horizontal"
        className="flex flex-1 overflow-hidden min-h-0"
      >
        {/* Left Sidebar - File Explorer */}
        <Panel
          defaultSize={20}
          minSize={15}
          maxSize={30}
          className="min-w-[200px] max-w-[500px] bg-gray-50 dark:bg-[#252526] border-r border-gray-200 dark:border-[#1e1e1e] flex flex-col flex-shrink-0"
        >
          <div className="p-2 border-b border-gray-200 dark:border-[#1e1e1e] flex-shrink-0">
            <div className="flex items-center justify-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-900/50 rounded-lg">
              <SectionTab
                icon={FaCode}
                label="Programming"
                isActive={activeSection === "programming"}
                onClick={() => setActiveSection("programming")}
              />
              <SectionTab
                icon={FaWindowMaximize}
                label="Development"
                isActive={activeSection === "development"}
                onClick={() => setActiveSection("development")}
              />
              <SectionTab
                icon={FaDatabase}
                label="Database"
                isActive={activeSection === "database"}
                onClick={() => setActiveSection("database")}
              />
            </div>
          </div>

          {(activeSection === "programming" ||
            activeSection === "development") && (
            <FileExplorer
              files={files}
              activeFileId={activeFileId}
              onSelectFile={stateAccessors[activeSection].setActiveFileId}
              onCreateItem={handleCreateItem}
              onDeleteItem={handleDeleteItem}
              onMoveItem={handleMoveItem}
              activeSection={activeSection}
            />
          )}
          {activeSection === "database" && (
            <>
              <div className="flex-1 min-h-0 overflow-hidden">
                <DatabaseFileViewer
                  files={files}
                  activeFileId={activeFileId}
                  onSelectFile={stateAccessors[activeSection].setActiveFileId} // CRITICAL FIX
                />
              </div>
              <div className="border-t border-gray-200 dark:border-[#1e1e1e] flex-shrink-0 max-h-[40vh] overflow-hidden">
                <DatabaseSchemaExplorer />
              </div>
            </>
          )}
        </Panel>

        {/* Left Resize Handle */}
        <PanelResizeHandle />

        {/* Main Editor Area (Center) */}
        <Panel
          defaultSize={60}
          minSize={30}
          className="flex-1 flex flex-col min-w-0"
        >
          {/* === CONDITIONAL RENDERING START === */}
          {activeSection === "development" ? (
            /* --- DEVELOPMENT VIEW (No Output Panel) --- */
            <div className="flex flex-col h-full">
              {/* 1. New Tab Bar (Code/Preview/Fullscreen) */}
              <div className="bg-gray-100 dark:bg-[#252526] h-9 flex items-center justify-between px-2 border-b border-gray-200 dark:border-[#1e1e1e] flex-shrink-0">
                {/* Left side: Code/Preview Toggles */}
                <div className="flex items-center">
                  <button
                    onClick={() => setViewMode("code")}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-t ${
                      viewMode === "code"
                        ? "bg-white dark:bg-[#1e1e1e] text-gray-800 dark:text-gray-300"
                        : "text-gray-500 hover:text-gray-800 dark:hover:text-white"
                    }`}
                  >
                    <FaCode />
                    <span>Code</span>
                  </button>
                  <button
                    onClick={() => setViewMode("preview")}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded-t ${
                      viewMode === "preview"
                        ? "bg-white dark:bg-[#1e1e1e] text-gray-800 dark:text-gray-300"
                        : "text-gray-500 hover:text-gray-800 dark:hover:text-white"
                    }`}
                  >
                    <FaBroadcastTower />
                    <span>Preview</span>
                  </button>
                </div>

                {/* Right side: File Name & Fullscreen Button */}
                <div className="flex items-center gap-3">
                  {activeFileId && currentFile && (
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {currentFile?.name}
                    </span>
                  )}
                  <button
                    onClick={handleFullscreenPreview}
                    className="text-gray-500 hover:text-gray-800 dark:hover:text-white"
                    title="Open Preview in New Window"
                  >
                    <FaExpand />
                  </button>
                </div>
              </div>

              {/* 2. Editor or Preview Panel */}
              <div className="flex-1 bg-white dark:bg-[#1e1e1e] min-h-0">
                {/* SHOW CODE EDITOR */}
                {viewMode === "code" && (
                  <>
                    {activeFileId && currentFile ? (
                      <Editor
                        height="100%"
                        theme={theme === "dark" ? "vs-dark" : "light"}
                        language={currentFile.language}
                        value={currentFile.content}
                        onChange={handleCodeChange}
                        path={currentFile.id}
                        onMount={handleEditorDidMount}
                        options={{
                          fontSize: 14,
                          minimap: { enabled: false },
                          scrollBeyondLastLine: false,
                          automaticLayout: true,
                          suggest: {
                            preview: true,
                          },
                          inlineSuggest: {
                            enabled: true,
                          },
                        }}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                        {Object.keys(files).length === 0
                          ? "Loading files..."
                          : "Select a file to start editing or create a new one"}
                      </div>
                    )}
                  </>
                )}

                {/* SHOW PREVIEW */}
                {viewMode === "preview" && (
                  <LivePreviewPanel files={developmentFiles} />
                )}
              </div>
            </div>
          ) : (
            /* --- PROGRAMMING & DB VIEW (With Output Panel) --- */
            <PanelGroup direction="vertical">
              {/* Editor Panel (Original) */}
              <Panel
                defaultSize={70}
                minSize={30}
                className="flex flex-col min-h-0"
              >
                {/* Tab Bar (Original) */}
                {activeFileId && currentFile && (
                  <div className="bg-gray-100 dark:bg-[#252526] h-9 flex items-center px-2 border-b border-gray-200 dark:border-[#1e1e1e] flex-shrink-0">
                    <div className="bg-white dark:bg-[#1e1e1e] px-3 py-1 text-xs text-gray-800 dark:text-gray-300 rounded-t">
                      {currentFile?.name}
                    </div>
                  </div>
                )}

                {/* Editor (Original) */}
                <div className="flex-1 bg-white dark:bg-[#1e1e1e] min-h-0">
                  {activeFileId && currentFile ? (
                    <Editor
                      height="100%"
                      theme={theme === "dark" ? "vs-dark" : "light"}
                      language={currentFile.language}
                      value={currentFile.content}
                      onChange={handleCodeChange}
                      path={currentFile.id}
                      onMount={handleEditorDidMount}
                      options={{
                        fontSize: 14,
                        minimap: { enabled: false },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        suggest: {
                          preview: true,
                        },
                        inlineSuggest: {
                          enabled: true,
                        },
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                      {Object.keys(files).length === 0
                        ? "Loading files..."
                        : "Select a file to start editing or create a new one"}
                    </div>
                  )}
                </div>
              </Panel>

              {/* Bottom Resize Handle (Original) */}
              <PanelResizeHandle />

              {/* Output Panel (Original) */}
              <Panel
                defaultSize={30}
                minSize={15}
                maxSize={50}
                className="min-h-[100px] bg-white dark:bg-[#1e1e1e] border-t border-gray-200 dark:border-[#1e1e1e] flex flex-col flex-shrink-0"
              >
                <div className="bg-gray-100 dark:bg-[#252526] px-4 py-2 border-b border-gray-200 dark:border-[#1e1e1e]">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Output
                  </h3>
                </div>
                <div className="flex-1 p-4 h-[calc(100%-36px)] overflow-auto">
                  <div className="text-xs text-gray-800 dark:text-gray-300 font-mono">
                    {isLoading && (
                      <div className="text-yellow-500 dark:text-yellow-400">
                        Executing code...
                      </div>
                    )}

                    {error && (
                      <div className="text-red-600 dark:text-red-400">
                        {error}
                      </div>
                    )}

                    {/* Only render output once via the section-specific branches below */}
                    {!isLoading &&
                      !error &&
                      output &&
                      activeSection === "database" && (
                        <SqlOutputTable data={output} />
                      )}

                    {!isLoading &&
                      !error &&
                      output &&
                      activeSection !== "database" && (
                        <pre className="text-green-600 dark:text-green-400 whitespace-pre-wrap">
                          {output}
                        </pre>
                      )}

                    {!isLoading && !output && !error && (
                      <div className="text-gray-400 dark:text-gray-600">
                        No output yet. Run your code to see results.
                      </div>
                    )}
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          )}
          {/* === CONDITIONAL RENDERING END === */}
        </Panel>  

        {/* Right Resize Handle */}
        <PanelResizeHandle />

        {/* Right Sidebar - Active Users */}
        <Panel
          defaultSize={20}
          minSize={15}
          maxSize={30}
          className="min-w-[200px] max-w-[500px] bg-gray-50 dark:bg-[#252526] border-l border-gray-200 dark:border-[#1e1e1e] flex flex-col flex-shrink-0"
        >
          <div className="p-3 border-b border-gray-200 dark:border-[#1e1e1e] flex-shrink-0">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Active Users ({clients.length})
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 min-h-0 space-y-3">
            {clients.map((client) => {
              const isMuted =
                audioStatus[client.socketId] === undefined ||
                audioStatus[client.socketId] === true;
              const isMe = client.socketId === socketRef.current?.id;

              return (
                <div
                  key={client.socketId}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-white dark:bg-[#2d2d30] shadow-sm border border-gray-200 dark:border-transparent"
                >
                  {/* Avatar with Mute Overlay */}
                  <div className="relative flex-shrink-0">
                    <Avatar name={client.username} size="40" round="8px" />
                    {isMe && ( // Only show mute toggle for the current user
                      <button
                        onClick={() => handleMuteToggle(client.socketId)}
                        className="absolute -bottom-1 -right-1 flex items-center justify-center w-5 h-5 bg-white dark:bg-gray-600 rounded-full border dark:border-gray-500 cursor-pointer"
                        title={isMuted ? "Unmute" : "Mute"}
                      >
                        {isMuted ? (
                          <FaMicrophoneSlash className="text-red-500 text-xs" />
                        ) : (
                          <FaMicrophone className="text-green-500 text-xs" />
                        )}
                      </button>
                    )}
                    {!isMe && ( // Show status for other users
                      <div className="absolute -bottom-1 -right-1 flex items-center justify-center w-5 h-5 bg-white dark:bg-gray-600 rounded-full border dark:border-gray-500">
                        {isMuted ? (
                          <FaMicrophoneSlash className="text-red-500 text-xs" />
                        ) : (
                          <FaMicrophone className="text-green-500 text-xs" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Name and Status */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {client.username} {isMe ? "(You)" : ""}
                      </span>
                      {client.isHost && (
                        <FaCrown
                          className="text-yellow-500 flex-shrink-0"
                          title="Room Host"
                        />
                      )}
                    </div>
                    {/* "LIVE" indicator */}
                    {!isMuted ? (
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full pulse-green"></span>
                        <span className="text-xs font-medium text-green-500">
                          LIVE
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Muted
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </PanelGroup>

      <div ref={audioRef} style={{ display: "none" }}></div>
    </div>
  );
};

export default EditorPage;
