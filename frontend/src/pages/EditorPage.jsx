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
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaCopy,
  FaPlay,
  FaLightbulb,
  FaBroadcastTower, 
} from "react-icons/fa";

const getLanguageFromExtension = (filename) => {
  if (!filename) return "plaintext";
  const extension = filename.split(".").pop();
  switch (extension) {
    case "js":
      return "javascript";
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
  const [files, setFiles] = useState({});
  const [showFileInput, setShowFileInput] = useState(false);
  const [activeFileId, setActiveFileId] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAiEnabled, setIsAiEnabled] = useState(false);
  const isAiEnabledRef = useRef(isAiEnabled);

  const monacoRef = useRef(null);
  const editorRef = useRef(null);
  const [isMonacoReady, setIsMonacoReady] = useState(false);
  const providerDisposableRef = useRef(null);

  const [output, setOutput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [localStream, setLocalStream] = useState(null);
  const [audioStatus, setAudioStatus] = useState({});
  const peersRef = useRef({});
  const audioRef = useRef(null);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

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

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true, // Use simple constraint
        });

        stream.getAudioTracks().forEach((track) => {
          track.enabled = true;
          console.log(`✅ Local audio track ${track.id} enabled on startup`);
        });

        localStreamRef.current = stream;
        setLocalStream(stream);
        setAudioStatus((prev) => ({ ...prev, [socketRef.current.id]: false }));
        console.log(
          "🎤 Microphone access granted, track states:",
          stream.getAudioTracks().map((t) => ({
            id: t.id,
            enabled: t.enabled,
            muted: t.muted,
            readyState: t.readyState,
          }))
        );
      } catch (err) {
        console.error("Could not access microphone:", err);
        toast.error("Microphone access denied or not available.");
      }

      setupSocketListeners();

      socketRef.current.emit("join-room", {
        roomId,
        username: location.state?.username,
      });
    };

    const setupSocketListeners = () => {
      // socketRef.current.on("sync-filesystem", ({ files: receivedFiles }) => {
      //   if (receivedFiles) {
      //     setFiles(receivedFiles);
      //     if (!isInitialized) {
      //       setActiveFile(Object.keys(receivedFiles)[0]);
      //       setIsInitialized(true);
      //     }
      //   }
      // });

      socketRef.current.on("filesystem-updated", ({ files: receivedFiles }) => {
        setFiles(receivedFiles);
        if (!isInitialized) {
          // Find the first file to open
          const firstFile = Object.values(receivedFiles).find(
            (f) => f.type === "file"
          );
          if (firstFile) {
            setActiveFileId(firstFile.id);
          }
          setIsInitialized(true);
        }
      });

      socketRef.current.on("code-change", ({ fileId, code }) => {
        setFiles((prev) => {
          if (prev[fileId]) {
            return {
              ...prev,
              [fileId]: { ...prev[fileId], content: code },
            };
          }
          return prev;
        });
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

      // FIXED: Only update clients list, don't handle WebRTC here
      socketRef.current.on("user-joined", ({ clients, username, socketId }) => {
        console.log("📢 user-joined:", {
          username,
          socketId,
          myId: socketRef.current.id,
        });

        if (username && socketId !== socketRef.current.id) {
          toast.success(`${username} joined the room.`);
        }

        setClients(clients);
      });

      // NEW: Handle server instruction to initiate peer connection
      socketRef.current.on("initiate-peer", ({ socketId }) => {
        console.log("🔌 initiate-peer received for:", socketId);

        if (!socketId) {
          console.error("❌ socketId is undefined in initiate-peer");
          return;
        }

        if (socketRef.current.id === socketId) {
          console.log("⚠️ Skipping - trying to connect to self");
          return;
        }

        if (peersRef.current[socketId]) {
          console.log("⚠️ Peer already exists for", socketId);
          return;
        }

        if (!localStreamRef.current) {
          console.error("❌ No local stream available");
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
      });

      // Handle incoming offer from initiator
      socketRef.current.on("user-joined-signal", ({ signal, callerID }) => {
        console.log("📨 user-joined-signal from:", callerID);

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

        console.log("✅ Adding peer (NON-INITIATOR) for:", callerID);
        const peer = addPeer(signal, callerID, localStreamRef.current);

        if (peer) {
          peersRef.current[callerID] = peer;
        }
      });

      // Handle answer from receiver
      socketRef.current.on("receiving-returned-signal", ({ signal, id }) => {
        console.log("📨 receiving-returned-signal from:", id);
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
          console.log("✅ Signaling peer with answer:", id);
          peer.signal(signal);
        } catch (err) {
          console.error("❌ Error signaling peer:", id, err.message);
        }
      });

      socketRef.current.on("user-left", ({ socketId, username }) => {
        console.log("👋 User left:", username, socketId);
        toast.error(`${username} left the room.`);

        if (peersRef.current[socketId]) {
          try {
            peersRef.current[socketId].destroy();
            console.log("✅ Destroyed peer for:", socketId);
          } catch (err) {
            console.error("❌ Error destroying peer:", err);
          }
          delete peersRef.current[socketId];
        }

        const audioEl = document.getElementById(`audio-${socketId}`);
        if (audioEl) {
          audioEl.srcObject = null;
          audioEl.remove();
          console.log("✅ Removed audio element for:", socketId);
        }

        setClients((prev) =>
          prev.filter((client) => client.socketId !== socketId)
        );
      });

      socketRef.current.on("mute-status-updated", ({ socketId, isMuted }) => {
        console.log("🔇 Mute status updated:", socketId, isMuted);
        setAudioStatus((prev) => ({ ...prev, [socketId]: isMuted }));
      });
    };

    init();

    return () => {
      console.log("Component cleanup - stopping audio tracks");
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          track.stop();
          console.log("Stopped audio track on cleanup");
        });
      }

      Object.values(peersRef.current).forEach((peer) => {
        if (peer) peer.destroy();
      });

      pendingRequests.clear();

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
                const file = Object.values(filesRef.current).find(
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
    if (!files[newParentId] || files[newParentId].type !== "folder") {
      toast.error("Invalid drop target.");
      return;
    }
    socketRef.current.emit("file-move", { roomId, itemId, newParentId });
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    if (!monacoRef.current) {
      monacoRef.current = monaco;
      setIsMonacoReady(true);
    }
  };

  const handleCreateItem = (name, type, parentId) => {
    // Basic validation
    if (
      Object.values(files).some(
        (f) => f.parentId === parentId && f.name === name
      )
    ) {
      toast.error("A file or folder with this name already exists here.");
      return;
    }
    socketRef.current.emit("file-create", { roomId, name, type, parentId });
  };

  const handleDeleteItem = (itemId) => {
    socketRef.current.emit("file-delete", { roomId, itemId });
    if (activeFileId === itemId) {
      setActiveFileId(null);
    }
  };

  const handleCodeChange = (newCode) => {
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
      });
    }
  };

  const handleRunCode = async () => {
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

  const handleLivePreview = () => {
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
    console.log(`🎵 Attaching audio stream for ${socketId}`);

    const tracks = remoteStream.getAudioTracks();
    console.log(
      `Audio tracks (${tracks.length}):`,
      tracks.map((t) => ({
        id: t.id,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState,
        label: t.label,
      }))
    );

    if (tracks.length === 0) {
      console.error("❌ No audio tracks in remote stream!");
      return;
    }

    // CRITICAL FIX: Ensure tracks are enabled
    tracks.forEach((track) => {
      track.enabled = true;
      console.log(`✅ Enabled audio track ${track.id}`);
    });

    // Remove existing audio element
    const existingAudio = document.getElementById(`audio-${socketId}`);
    if (existingAudio) {
      console.log("🗑️ Removing existing audio element");
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
      console.log(`✅ Audio metadata loaded for ${socketId}`);

      // CRITICAL FIX: Explicitly play with error handling
      const playPromise = audio.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log(`🔊 Audio SUCCESSFULLY playing for ${socketId}`);
            console.log(`Audio element state:`, {
              paused: audio.paused,
              volume: audio.volume,
              muted: audio.muted,
              readyState: audio.readyState,
              currentTime: audio.currentTime,
              duration: audio.duration,
            });

            // Verify stream tracks are active
            const streamTracks = audio.srcObject.getAudioTracks();
            console.log(
              `Active stream tracks:`,
              streamTracks.map((t) => ({
                enabled: t.enabled,
                muted: t.muted,
                readyState: t.readyState,
              }))
            );
          })
          .catch((e) => {
            console.error(`❌ Audio play FAILED for ${socketId}:`, e.message);

            // FALLBACK: Try to play on user interaction
            console.log(`📢 Attempting manual play trigger for ${socketId}`);
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
    console.log(`[createPeer] 🚀 Creating INITIATOR peer for: ${userToSignal}`);

    if (!userToSignal) {
      console.error("❌ userToSignal is undefined!");
      return null;
    }

    // CRITICAL FIX: Ensure local tracks are enabled
    const audioTracks = stream.getAudioTracks();
    audioTracks.forEach((track) => {
      track.enabled = true;
      console.log(`✅ Enabled local audio track ${track.id} for transmission`);
    });

    console.log(
      `Local audio tracks (${audioTracks.length}):`,
      audioTracks.map((t) => ({
        id: t.id,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState,
      }))
    );

    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      },
    });

    peer.on("signal", (signal) => {
      console.log(`[createPeer] 📤 Sending OFFER to ${userToSignal}`);
      console.log(`Signal type:`, signal.type);
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("sending-signal", {
          userToSignal,
          callerID,
          signal,
        });
      } else {
        console.error("❌ Socket not connected!");
      }
    });

    peer.on("connect", () => {
      console.log(`[createPeer] ✅ PEER CONNECTED with ${userToSignal}`);
    });

    peer.on("error", (err) => {
      console.error(
        `[createPeer] ❌ PEER ERROR with ${userToSignal}:`,
        err.message
      );
    });

    peer.on("stream", (remoteStream) => {
      console.log(
        `[createPeer] 🎵 Received remote stream from ${userToSignal}`
      );
      attachAudioStream(userToSignal, remoteStream);
    });

    peer.on("close", () => {
      console.log(
        `[createPeer] 🔌 Peer connection closed with ${userToSignal}`
      );
    });

    return peer;
  }

  // Update addPeer function similarly:

  function addPeer(incomingSignal, callerID, stream) {
    console.log(`[addPeer] 🚀 Creating NON-INITIATOR peer for: ${callerID}`);

    if (!callerID) {
      console.error("❌ callerID is undefined!");
      return null;
    }

    // CRITICAL FIX: Ensure local tracks are enabled
    const audioTracks = stream.getAudioTracks();
    audioTracks.forEach((track) => {
      track.enabled = true;
      console.log(`✅ Enabled local audio track ${track.id} for transmission`);
    });

    console.log(
      `Local audio tracks (${audioTracks.length}):`,
      audioTracks.map((t) => ({
        id: t.id,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState,
      }))
    );

    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      },
    });

    peer.on("signal", (signal) => {
      console.log(`[addPeer] 📤 Sending ANSWER to ${callerID}`);
      console.log(`Signal type:`, signal.type);
      if (socketRef.current && socketRef.current.connected) {
        socketRef.current.emit("returning-signal", { signal, callerID });
      } else {
        console.error("❌ Socket not connected!");
      }
    });

    peer.on("connect", () => {
      console.log(`[addPeer] ✅ PEER CONNECTED with ${callerID}`);
    });

    peer.on("error", (err) => {
      console.error(`[addPeer] ❌ PEER ERROR with ${callerID}:`, err.message);
    });

    peer.on("stream", (remoteStream) => {
      console.log(`[addPeer] 🎵 Received remote stream from ${callerID}`);
      attachAudioStream(callerID, remoteStream);
    });

    peer.on("close", () => {
      console.log(`[addPeer] 🔌 Peer connection closed with ${callerID}`);
    });

    try {
      console.log(
        `[addPeer] 📥 Signaling peer with incoming OFFER from ${callerID}`
      );
      peer.signal(incomingSignal);
    } catch (err) {
      console.error("❌ Error during initial peer signal:", err.message);
      return null;
    }

    return peer;
  }

  const handleMuteToggle = (targetSocketId) => {
    if (!localStream) return;

    const myId = socketRef.current?.id;

    if (targetSocketId === myId) {
      const currentlyMuted = audioStatus[myId] || false;
      const newMutedState = !currentlyMuted;

      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !newMutedState;
      });

      setAudioStatus((prev) => ({ ...prev, [myId]: newMutedState }));

      if (socketRef.current) {
        socketRef.current.emit("mute-status-change", {
          socketId: myId,
          isMuted: newMutedState,
        });
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

  const currentFile = files[activeFileId];

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
            onClick={handleLivePreview}
            className="flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-colors bg-purple-600 hover:bg-purple-700 text-white"
            title="Open Live Preview"
          >
            <FaBroadcastTower className="text-sm" />
            <span className="text-xs">Preview</span>
          </button>
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

          <button
            onClick={handleRunCode}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 px-4 py-1.5 rounded text-sm text-white transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed"
            disabled={isLoading || !activeFileId}
          >
            <FaPlay className="text-xs" />
            <span>{isLoading ? "Running..." : "Run"}</span>
          </button>
          <ThemeToggle />

          <button
            onClick={leaveRoom}
            className="bg-red-600 hover:bg-red-700 px-4 py-1.5 rounded text-sm text-white transition-colors"
          >
            Leave
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left Sidebar - File Explorer */}
        <div className="w-64 min-w-[200px] max-w-[400px] bg-gray-50 dark:bg-[#252526] border-r border-gray-200 dark:border-[#1e1e1e] flex flex-col flex-shrink-0">
          <FileExplorer
            files={files}
            activeFileId={activeFileId}
            onSelectFile={setActiveFileId}
            onCreateItem={handleCreateItem}
            onDeleteItem={handleDeleteItem}
            onMoveItem={handleMoveItem}
          />
        </div>

        {/* Main Editor Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Tab Bar */}
          {activeFileId && currentFile && (
            <div className="bg-gray-100 dark:bg-[#252526] h-9 flex items-center px-2 border-b border-gray-200 dark:border-[#1e1e1e] flex-shrink-0">
              <div className="bg-white dark:bg-[#1e1e1e] px-3 py-1 text-xs text-gray-800 dark:text-gray-300 rounded-t">
                {currentFile?.name}
              </div>
            </div>
          )}

          {/* Editor */}
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

          {/* Output Panel */}
          <div className="h-48 min-h-[100px] bg-white dark:bg-[#1e1e1e] border-t border-gray-200 dark:border-[#1e1e1e] flex-shrink-0">
            <div className="bg-gray-100 dark:bg-[#252526] px-4 py-2 border-b border-gray-200 dark:border-[#1e1e1e]">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Output
              </h3>
            </div>
            <div className="p-4 h-[calc(100%-36px)] overflow-auto">
              <pre className="text-xs text-gray-800 dark:text-gray-300 whitespace-pre-wrap font-mono">
                {isLoading && (
                  <span className="text-yellow-500 dark:text-yellow-400">
                    Executing code...
                  </span>
                )}
                {output && (
                  <span className="text-green-600 dark:text-green-400">
                    {output}
                  </span>
                )}
                {error && (
                  <span className="text-red-600 dark:text-red-400">
                    {error}
                  </span>
                )}
                {!isLoading && !output && !error && (
                  <span className="text-gray-400 dark:text-gray-600">
                    No output yet. Run your code to see results.
                  </span>
                )}
              </pre>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Active Users */}
        <div className="w-64 min-w-[200px] max-w-[400px] bg-gray-50 dark:bg-[#252526] border-l border-gray-200 dark:border-[#1e1e1e] flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-gray-200 dark:border-[#1e1e1e] flex-shrink-0">
            <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Active Users ({clients.length})
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            {clients.map((client) => (
              <div
                key={client.socketId}
                className="flex items-center justify-between mb-3 p-2 rounded hover:bg-gray-200 dark:hover:bg-[#2d2d30] transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Avatar
                    name={client.username}
                    size="32"
                    round="6px"
                    className="flex-shrink-0"
                  />
                  <span className="text-sm text-gray-800 dark:text-gray-300 truncate">
                    {client.username}
                  </span>
                </div>
                <button
                  onClick={() => handleMuteToggle(client.socketId)}
                  className="text-gray-400 hover:text-black dark:hover:text-white transition-colors flex-shrink-0 ml-2"
                >
                  {audioStatus[client.socketId] ? (
                    <FaMicrophoneSlash className="text-red-500 dark:text-red-400" />
                  ) : (
                    <FaMicrophone className="text-green-500 dark:text-green-400" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div ref={audioRef} style={{ display: "none" }}></div>
    </div>
  );
};

export default EditorPage;
