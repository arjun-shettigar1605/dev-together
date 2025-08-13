import React, { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import Editor from "@monaco-editor/react";
import axios from "axios";
import Client from "../components/Client";
import toast, { Toaster } from "react-hot-toast";
import { debounce } from "lodash";
import Peer from "simple-peer";

const getLanguageFromExtension = (filename) => {
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

const EditorPage = () => {
  const socketRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { roomId } = useParams();
  const fileRef = useRef(null);
  const localStreamRef = useRef(null);
  const filesRef = useRef({}); // ADD THIS LINE - This was missing!

  const [clients, setClients] = useState([]);
  const [files, setFiles] = useState({});
  const [activeFile, setActiveFile] = useState(null);
  const [showFileInput, setShowFileInput] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);

  const [output, setOutput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [localStream, setLocalStream] = useState(null);
  const [audioStatus, setAudioStatus] = useState({}); // { socketId: isMuted }
  const peersRef = useRef({}); // Using an object keyed by socketId
  const audioRef = useRef(null); // To hold the audio elements

  useEffect(() => {
    // Keep the ref updated with the latest files state
    filesRef.current = files;
  }, [files]);

  //Second main useeffect
  useEffect(() => {
    const init = async () => {
      // --- 1. ESTABLISH SOCKET CONNECTION ---
      socketRef.current = io("http://localhost:5001");
      socketRef.current.on("connect_error", (err) => handleErrors(err));
      socketRef.current.on("connect_failed", (err) => handleErrors(err));
      function handleErrors(e) {
        console.log("socket error", e);
        toast.error("Socket connection failed, try again later.");
        navigate("/");
      }

      // --- 2. GET MICROPHONE ACCESS ---
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });
        localStreamRef.current = stream; // Store stream in ref
        setLocalStream(stream);
        // Initialize audio status as unmuted (false means not muted)
        setAudioStatus((prev) => ({ ...prev, [socketRef.current.id]: false }));
      } catch (err) {
        console.error("Could not access microphone:", err);
        toast.error("Microphone access denied or not available.");
      }

      // --- 3. SETUP ALL EVENT LISTENERS ---
      setupSocketListeners();

      // --- 4. JOIN ROOM ---
      socketRef.current.emit("join-room", {
        roomId,
        username: location.state?.username,
      });
    };

    const setupSocketListeners = () => {
      // --- FILE SYSTEM LISTENERS ---
      socketRef.current.on("sync-filesystem", ({ files: receivedFiles }) => {
        if (receivedFiles) {
          setFiles(receivedFiles);
          if (!isInitialized) {
            setActiveFile(Object.keys(receivedFiles)[0]);
            setIsInitialized(true);
          }
        }
      });
      socketRef.current.on("file-created", ({ file }) => {
        setFiles((prev) => ({ ...prev, [file.name]: file }));
        toast.success(`File "${file.name}" was created.`);
      });
      socketRef.current.on("file-deleted", ({ fileName }) => {
        setFiles((prevFiles) => {
          const newFiles = { ...prevFiles };
          delete newFiles[fileName];
          setActiveFile((currentActive) =>
            currentActive === fileName
              ? Object.keys(newFiles)[0] || null
              : currentActive
          );
          return newFiles;
        });
        toast.error(`File "${fileName}" was deleted.`);
      });
      socketRef.current.on("code-change", ({ file, code }) => {
        setFiles((prev) => ({
          ...prev,
          [file]: { ...prev[file], content: code },
        }));
      });

      // --- COLLABORATION AND WEBRTC LISTENERS ---
      socketRef.current.on("user-joined", ({ clients, username, socketId }) => {
        if (username) toast.success(`${username} joined the room.`);
        setClients(clients);

        // Existing clients create a peer to signal the new user
        if (socketRef.current.id !== socketId && localStreamRef.current) {
          const peer = createPeer(
            socketId,
            socketRef.current.id,
            localStreamRef.current
          );
          peersRef.current[socketId] = peer;
        }
      });
      socketRef.current.on("user-joined-signal", ({ signal, callerID }) => {
        // New user receives signal and adds the existing peer
        if (localStreamRef.current) {
          const peer = addPeer(signal, callerID, localStreamRef.current);
          peersRef.current[callerID] = peer;
        }
      });
      socketRef.current.on("receiving-returned-signal", ({ signal, id }) => {
        const peer = peersRef.current[id];
        if (peer) {
          peer.signal(signal);
        }
      });
      socketRef.current.on("user-left", ({ socketId, username }) => {
        toast.error(`${username} left the room.`);
        if (peersRef.current[socketId]) {
          peersRef.current[socketId].destroy();
          delete peersRef.current[socketId];
        }
        const audioEl = document.getElementById(`audio-${socketId}`);
        if (audioEl) audioEl.remove();
        setClients((prev) =>
          prev.filter((client) => client.socketId !== socketId)
        );
      });
      socketRef.current.on("mute-status-updated", ({ socketId, isMuted }) => {
        setAudioStatus((prev) => ({ ...prev, [socketId]: isMuted }));
      });
    };

    init();

    // --- CLEANUP FUNCTION ---
    return () => {
      console.log("Component cleanup - stopping audio tracks");
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          track.stop();
          console.log("Stopped audio track on cleanup");
        });
      }

      // Cleanup peers
      Object.values(peersRef.current).forEach((peer) => {
        if (peer) peer.destroy();
      });

      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current.off();
      }
    };
  }, [roomId, location.state?.username, navigate, isInitialized]); // Added isInitialized to dependencies

  useEffect(() => {
    // This function is defined outside the main effect to be accessible
    const fetchCompletions = async (model, position) => {
      const code = model.getValue();
      const codeUntilCursor = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      try {
        const response = await axios.post(
          "http://localhost:5001/api/completion",
          {
            codeContext: code, // Send the whole code for better context
            language: files[activeFile]?.language || "plaintext",
          }
        );

        if (response.data.completion) {
          return [
            {
              label: response.data.completion,
              kind: window.monaco?.languages?.CompletionItemKind?.Snippet || 1,
              insertText: response.data.completion,
              range: new window.monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column
              ),
            },
          ];
        }
      } catch (error) {
        console.error("AI Completion Error:", error);
      }
      return [];
    };

    // Debounce the fetch function to avoid spamming the API
    const debouncedFetch = debounce(fetchCompletions, 500);

    if (window.monaco) {
      const provider = window.monaco.languages.registerCompletionItemProvider(
        "python",
        {
          // Register for all languages later
          provideCompletionItems: async (model, position) => {
            const suggestions = await debouncedFetch(model, position);
            return { suggestions: suggestions };
          },
        }
      );

      // You can register for multiple languages
      // monaco.languages.registerCompletionItemProvider('javascript', ...);

      return () => provider.dispose(); // Cleanup on unmount
    }
  }, [activeFile, files]); //rerunning whenever activeFile or files change

  const handleCreateFile = (e) => {
    if (e.key === "Enter" && newFileName.trim()) {
      if (files[newFileName]) {
        toast.error("A file with this name already exists.");
        return;
      }

      const language = getLanguageFromExtension(newFileName);
      const boilerplateContent =
        boilerplates[language] || "// Start writing your code here.";

      const newFile = {
        name: newFileName,
        language: language,
        content: boilerplateContent,
      };

      setFiles((prev) => ({ ...prev, [newFileName]: newFile }));
      setActiveFile(newFileName);
      socketRef.current.emit("file-created", { roomId, file: newFile });
      setNewFileName("");
      setShowFileInput(false);
    }
  };

  const handleDeleteFile = (fileName) => {
    if (!window.confirm(`Are you sure you want to delete ${fileName}?`)) return;

    socketRef.current.emit("file-deleted", { roomId, fileName });

    const newFiles = { ...files };
    delete newFiles[fileName];
    setFiles(newFiles);

    if (activeFile === fileName) {
      const remainingFiles = Object.keys(newFiles);
      setActiveFile(remainingFiles[0] || null);
    }
  };

  const handleCodeChange = (newCode) => {
    if (activeFile && files[activeFile]) {
      setFiles((prevFiles) => ({
        ...prevFiles,
        [activeFile]: { ...prevFiles[activeFile], content: newCode },
      }));

      socketRef.current.emit("code-change", {
        roomId,
        file: activeFile,
        code: newCode,
      });
    }
  };

  const handleRunCode = async () => {
    const currentFile = files[activeFile];
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

  // --- Helper functions for WebRTC ---
  function createPeer(userToSignal, callerID, stream) {
    // Use the stream passed as an argument
    const peer = new Peer({ initiator: true, trickle: false, stream });
    // ... rest of the function is the same
    peer.on("signal", (signal) => {
      socketRef.current.emit("sending-signal", {
        userToSignal,
        callerID,
        signal,
      });
    });
    peer.on("stream", (remoteStream) => {
      const audio = document.createElement("audio");
      audio.id = `audio-${userToSignal}`;
      audio.srcObject = remoteStream;
      audio.play().catch(console.error);
      if (audioRef.current) {
        audioRef.current.appendChild(audio);
      }
    });
    return peer;
  }

  function addPeer(incomingSignal, callerID, stream) {
    // Use the stream passed as an argument
    const peer = new Peer({ initiator: false, trickle: false, stream });
    // ... rest of the function is the same
    peer.on("signal", (signal) => {
      socketRef.current.emit("returning-signal", { signal, callerID });
    });
    peer.on("stream", (remoteStream) => {
      const audio = document.createElement("audio");
      audio.id = `audio-${callerID}`;
      audio.srcObject = remoteStream;
      audio.play().catch(console.error);
      if (audioRef.current) {
        audioRef.current.appendChild(audio);
      }
    });
    peer.signal(incomingSignal);
    return peer;
  }

  const handleMuteToggle = (targetSocketId) => {
    console.log("Mute toggle clicked for:", targetSocketId);
    console.log("Current audio status:", audioStatus);

    if (!localStream) {
      console.log("No local stream available");
      return;
    }

    const myId = socketRef.current?.id;
    console.log("My socket ID:", myId);

    if (targetSocketId === myId) {
      const currentlyMuted = audioStatus[myId] || false;
      const newMutedState = !currentlyMuted;

      console.log(
        "Currently muted:",
        currentlyMuted,
        "New state:",
        newMutedState
      );

      // Toggle the actual audio track
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !newMutedState; // enabled is opposite of muted
        console.log("Audio track enabled set to:", track.enabled);
      });

      // Update local state
      setAudioStatus((prev) => {
        const newStatus = { ...prev, [myId]: newMutedState };
        console.log("New audio status:", newStatus);
        return newStatus;
      });

      // Notify other users
      if (socketRef.current) {
        socketRef.current.emit("mute-status-change", {
          socketId: myId,
          isMuted: newMutedState,
        });
      }
    }
  };

  const leaveRoom = () => {
    // Stop all audio tracks to eliminate hissing sound
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log("Stopped audio track on leave");
      });
    }

    // Cleanup peers
    Object.values(peersRef.current).forEach((peer) => {
      if (peer) peer.destroy();
    });

    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    navigate("/");
  };

  if (!location.state?.username) {
    navigate("/");
    return null;
  }

  const currentFile = files[activeFile];

  return (
    <div className="flex h-screen bg-gray-900 text-white font-sans">
      <Toaster position="top-right" />

      {/* LEFT SIDEBAR: Files and Users */}
      <div className="w-1/5 bg-gray-800 p-4 border-r border-gray-700 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Files</h2>
          <button
            onClick={() => setShowFileInput(!showFileInput)}
            className="text-gray-400 hover:text-white text-xl font-bold"
          >
            +
          </button>
        </div>

        {showFileInput && (
          <input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={handleCreateFile}
            placeholder="filename.ext"
            className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded-md mb-4 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
        )}

        <div className="flex-grow overflow-y-auto">
          {Object.values(files).map((file) => (
            <div
              key={file.name}
              onClick={() => setActiveFile(file.name)}
              className={`flex justify-between items-center px-2 py-1.5 rounded-md cursor-pointer text-sm mb-1 ${
                activeFile === file.name ? "bg-blue-600" : "hover:bg-gray-700"
              }`}
            >
              <span>{file.name}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteFile(file.name);
                }}
                className="text-gray-400 hover:text-red-500 text-xs"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <hr className="my-4 border-gray-600" />
        <h2 className="font-bold text-lg mb-4">Users</h2>
        <div className="flex-grow">
          {clients.map((client) => (
            <Client
              key={client.socketId}
              username={client.username}
              socketId={client.socketId}
              onMuteToggle={handleMuteToggle}
              isMuted={audioStatus[client.socketId] || false}
            />
          ))}
        </div>

        <div ref={audioRef} style={{ display: "none" }}></div>

        <button
          onClick={leaveRoom}
          className="mt-4 bg-red-600 text-white py-2 rounded-md hover:bg-red-700 transition duration-200"
        >
          Leave Room
        </button>
      </div>

      {/* MAIN PANEL: Editor and Output */}
      <div className="flex flex-col w-4/5">
        <div className="bg-gray-800 p-2 flex items-center justify-between border-b border-gray-700">
          <span className="text-sm font-medium px-2">
            {currentFile?.name || "No file selected"}
          </span>
          <button
            onClick={handleRunCode}
            className="bg-green-600 px-4 py-1 rounded text-sm hover:bg-green-700 disabled:bg-gray-500"
            disabled={isLoading || !activeFile}
          >
            {isLoading ? "Running..." : "Run"}
          </button>
        </div>

        <div className="flex-grow bg-gray-900">
          {activeFile && currentFile ? (
            <Editor
              height="100%"
              theme="vs-dark"
              language={currentFile.language}
              value={currentFile.content}
              onChange={handleCodeChange}
              path={currentFile.name}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              {Object.keys(files).length === 0
                ? "Loading files..."
                : "Select a file to start editing or create a new one."}
            </div>
          )}
        </div>

        <div className="h-1/4 bg-gray-950 p-4 overflow-auto border-t border-gray-700">
          <h3 className="font-semibold text-lg mb-2">Output:</h3>
          <pre className="text-gray-300 whitespace-pre-wrap">
            {isLoading && "Executing code..."}
            {output && <span className="text-green-400">{output}</span>}
            {error && <span className="text-red-400">{error}</span>}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default EditorPage;
