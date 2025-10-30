const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { Mistral } = require("@mistralai/mistralai");
require("dotenv").config();

const { v4: uuidv4 } = require("uuid");
const { runCodeInContainer } = require("./dockerManager");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5001;

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

const mistralApiKey = process.env.MISTRAL_API_KEY;
if (!mistralApiKey) {
  console.error("MISTRAL_API_KEY is not set. Please update your .env file.");
  process.exit(1);
}
const mistralClient = new Mistral(mistralApiKey);
const mistralModel = "codestral-latest"; // Use the Codestral model

app.use(cors());
app.use(express.json());

const userSocketMap = {};
const roomSocketMap = {};
// Store room file systems on the server
const roomFileSystems = {};

function getAllClients(roomId) {
  const socketIds = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
  return socketIds.map((socketId) => {
    return {
      socketId,
      username: userSocketMap[socketId],
    };
  });
}

// create a nested file system for web development
function initializeRoomFileSystem(roomId) {
  if (!roomFileSystems[roomId]) {
    const rootId = uuidv4();
    const htmlId = uuidv4();
    const cssId = uuidv4();
    const jsId = uuidv4();
    const pyId = uuidv4();

    roomFileSystems[roomId] = {
      [rootId]: {
        id: rootId,
        name: "root",
        type: "folder",
        parentId: null,
        children: [htmlId, cssId, jsId, pyId],
      },
      [htmlId]: {
        id: htmlId,
        name: "index.html",
        type: "file",
        language: "html",
        content: `<h1>Hello, CollabCode!</h1>
<p>Your HTML, CSS, and JavaScript are all linked up.</p>
<div class="content">
</div>
`,
        parentId: rootId,
      },
      [cssId]: {
        id: cssId,
        name: "style.css",
        type: "file",
        language: "css",
        content: `body {
  font-family: sans-serif;
  background-color: #f4f4f4;
  color: #333;
}
.content {
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}`,
        parentId: rootId,
      },
      [jsId]: {
        id: jsId,
        name: "script.js",
        type: "file",
        language: "javascript",
        content: `console.log("Welcome to the live preview!");
// Your JavaScript code goes here
`,
        parentId: rootId,
      },
      [pyId]: {
        id: pyId,
        name: "main.py",
        type: "file",
        language: "python",
        content: `def main():
    print("Hello from Python!")

if __name__ == "__main__":
    main()
`,
        parentId: rootId,
      },
    };
  }
}

io.on("connection", (socket) => {
  console.log("A user connected, socket id:", socket.id);

  socket.on("join-room", ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    roomSocketMap[socket.id] = roomId;
    socket.join(roomId);

    // Initialize room file system if it doesn't exist
    initializeRoomFileSystem(roomId);

    const clients = getAllClients(roomId);

    // Send current file state to the new user immediately
    socket.emit("filesystem-updated", {
      files: roomFileSystems[roomId],
    });

    // Get all existing users in the room (excluding the new user)
    const existingClients = clients.filter((c) => c.socketId !== socket.id);

    console.log(`${username} (${socket.id}) joined room ${roomId}`);
    console.log(
      `Existing clients in room:`,
      existingClients.map((c) => c.socketId)
    );

    // Tell all users (including new user) about the updated client list
    io.in(roomId).emit("user-joined", {
      clients,
      username,
      socketId: socket.id,
    });

    // CRITICAL: Tell ONLY existing users to initiate WebRTC connections to the new user
    existingClients.forEach((client) => {
      console.log(
        `Telling ${client.socketId} to initiate peer with ${socket.id}`
      );
      io.to(client.socketId).emit("initiate-peer", {
        socketId: socket.id,
      });
    });
  });

  // Handle preview window joining
  socket.on("join-preview-room", ({ roomId }) => {
    socket.join(roomId);
    console.log(`Preview window joined room ${roomId}`);
    // Send initial content
    if (roomFileSystems[roomId]) {
      socket.emit("live-preview-update", { files: roomFileSystems[roomId] });
    }
  });

  // Handle code changes and update server state
  socket.on("code-change", ({ roomId, fileId, code }) => {
    if (roomFileSystems[roomId] && roomFileSystems[roomId][fileId]) {
      roomFileSystems[roomId][fileId].content = code;

      // Broadcast to other editors
      socket.to(roomId).emit("code-change", { fileId, code });

      // NEW: Check if it's a web file and broadcast to preview windows
      const file = roomFileSystems[roomId][fileId];
      if (
        file.name.endsWith(".html") ||
        file.name.endsWith(".css") ||
        file.name.endsWith(".js")
      ) {
        io.in(roomId).emit("live-preview-update", {
          files: roomFileSystems[roomId],
        });
      }
    }
  });

  // Handle file creation and update server state
  socket.on("file-create", ({ roomId, name, type, parentId }) => {
    if (roomFileSystems[roomId] && roomFileSystems[roomId][parentId]) {
      const language = getLanguageFromExtension(name);
      const newItem = {
        id: uuidv4(),
        name,
        type,
        parentId,
        language: type === "file" ? language : null,
        content: type === "file" ? `// New file: ${name}\n` : null,
        children: type === "folder" ? [] : null,
      };

      // Add new item to map
      roomFileSystems[roomId][newItem.id] = newItem;
      // Add new item to parent's children array
      roomFileSystems[roomId][parentId].children.push(newItem.id);

      // Broadcast the full filesystem update
      io.in(roomId).emit("filesystem-updated", {
        files: roomFileSystems[roomId],
      });
    }
  });

  // Handle file deletion and update server state
  socket.on("file-delete", ({ roomId, itemId }) => {
    if (roomFileSystems[roomId] && roomFileSystems[roomId][itemId]) {
      const itemToDelete = roomFileSystems[roomId][itemId];
      const parentId = itemToDelete.parentId;

      // Recursive delete function
      const deleteRecursive = (id) => {
        const item = roomFileSystems[roomId][id];
        if (item.type === "folder") {
          item.children.forEach(deleteRecursive);
        }
        delete roomFileSystems[roomId][id];
      };

      deleteRecursive(itemId);

      // Remove from parent's children
      if (parentId && roomFileSystems[roomId][parentId]) {
        roomFileSystems[roomId][parentId].children = roomFileSystems[roomId][
          parentId
        ].children.filter((id) => id !== itemId);
      }

      // Broadcast the full filesystem update
      io.in(roomId).emit("filesystem-updated", {
        files: roomFileSystems[roomId],
      });
    }
  });

  // NEW: Handle file drag-and-drop
  socket.on("file-move", ({ roomId, itemId, newParentId }) => {
    const fs = roomFileSystems[roomId];
    if (
      !fs ||
      !fs[itemId] ||
      !fs[newParentId] ||
      fs[newParentId].type !== "folder"
    ) {
      console.warn("Invalid file move operation: Invalid IDs");
      return;
    }

    const item = fs[itemId];
    const oldParentId = item.parentId;

    // Check if moving to the same parent
    if (oldParentId === newParentId) {
      console.log("Item already in target folder.");
      return;
    }

    let currentParentId = newParentId;
    while (currentParentId) {
      if (currentParentId === itemId) {
        console.warn("Cannot move folder into its own child.");
        return;
      }
      const parentNode = fs[currentParentId];
      currentParentId = parentNode ? parentNode.parentId : null;
    }

    // Remove from old parent's children array
    if (oldParentId && fs[oldParentId]) {
      fs[oldParentId].children = fs[oldParentId].children.filter(
        (id) => id !== itemId
      );
    }

    // Add to new parent's children array
    fs[newParentId].children.push(itemId);

    // Update item's parentId
    item.parentId = newParentId;

    // Broadcast the full filesystem update
    io.in(roomId).emit("filesystem-updated", {
      files: roomFileSystems[roomId],
    });
  });

  //WebRTC signaling for audio chat
  socket.on("sending-signal", (payload) => {
    io.to(payload.userToSignal).emit("user-joined-signal", {
      signal: payload.signal,
      callerID: payload.callerID,
    });
  });

  socket.on("returning-signal", (payload) => {
    io.to(payload.callerID).emit("receiving-returned-signal", {
      signal: payload.signal,
      id: socket.id,
    });
  });

  socket.on("mute-status-change", ({ socketId, isMuted }) => {
    const roomId = roomSocketMap[socket.id];
    if (roomId) {
      socket.to(roomId).emit("mute-status-updated", { socketId, isMuted });
    }
  });

  socket.on("get-suggestion", async (payload) => {
    const { codeContext, codeAfter, currentLine, language, requestId } =
      payload;

    if (!codeContext) {
      return socket.emit("suggestion-result", { suggestion: "", requestId });
    }

    try {
      const limitedContext = codeContext.slice(-2000);
      const limitedAfter = (codeAfter || "").slice(0, 500);

      // Correct way to call Mistral API
      const result = await mistralClient.chat.complete({
        model: mistralModel,
        messages: [
          {
            role: "system",
            content: `You are an expert ${language} code completion assistant.
Complete the code. Provide ONLY the code snippet that should be inserted.
Do not explain. Do not use markdown.
Match the indentation of the current line: "${
              currentLine.match(/^\s*/)?.[0] || ""
            }"
Do not repeat code that is already in the suffix (the 'code after' part).`,
          },
          {
            role: "user",
            content: `[PREFIX]${limitedContext}[SUFFIX]${limitedAfter}[MIDDLE]`,
          },
        ],
        maxTokens: 64,
        temperature: 0.0,
      });

      let suggestion = result.choices[0].message.content.trim();

      // Post-processing cleanup
      if (currentLine && currentLine.trim()) {
        const tokens = currentLine.trim().split(/[\s\(\)\[\]\{\}]/);
        const lastToken = tokens.filter(Boolean).pop() || "";
        if (lastToken && suggestion.startsWith(lastToken)) {
          suggestion = suggestion.substring(lastToken.length);
        }
      }

      if (limitedAfter && limitedAfter.trim() && suggestion.trim()) {
        const afterFirstChar = limitedAfter.trim()[0];
        const completionLastChar =
          suggestion.trim()[suggestion.trim().length - 1];
        if (
          afterFirstChar === completionLastChar &&
          [")", "}", "]", ";"].includes(afterFirstChar)
        ) {
          suggestion = suggestion.trim().slice(0, -1);
        }
      }

      socket.emit("suggestion-result", {
        suggestion: suggestion,
        requestId,
      });
    } catch (error) {
      console.error("Codestral API Error:", error.message);
      socket.emit("suggestion-result", { suggestion: "", requestId });
    }
  });

  socket.on("disconnecting", () => {
    const roomId = roomSocketMap[socket.id];
    if (roomId) {
      const username = userSocketMap[socket.id];
      socket.to(roomId).emit("user-left", {
        socketId: socket.id,
        username,
      });

      // Clean up room file system if no one is left
      const remainingClients = getAllClients(roomId).filter(
        (client) => client.socketId !== socket.id
      );
      if (remainingClients.length === 0) {
        delete roomFileSystems[roomId];
        console.log(
          `Room ${roomId} file system cleaned up - no users remaining`
        );
      }

      socket.leave(roomId);
      delete userSocketMap[socket.id];
      delete roomSocketMap[socket.id];
      console.log(`${username} left room ${roomId}`);
    }
  });
});

app.get("/api/create-room", (req, res) => {
  const roomId = uuidv4();
  console.log(`New room created with ID: ${roomId}`);
  res.status(200).json({ roomId });
});

app.post("/api/execute", async (req, res) => {
  const { language = "python", code } = req.body;

  console.log(`Received execution request for ${language}`);

  if (!code) {
    return res.status(400).json({ error: "Code is required." });
  }

  const nonExecutable = [
    "html",
    "css",
    "json",
    "markdown",
    "plaintext",
    "md",
    "txt",
    "env",
    undefined, // Handle missing language
    null,
  ];

  if (nonExecutable.includes(language)) {
    return res.status(400).json({
      error:
        language === "html" || language === "css"
          ? "HTML/CSS is not executable. Use the Live Preview."
          : `File type '${language || "unknown"}' is not executable.`,
    });
  }

  try {
    console.log("Starting code execution...");
    const output = await runCodeInContainer(language, code);
    console.log("Execution successful, sending response");
    res.status(200).json({ output });
  } catch (error) {
    res
      .status(500)
      .json({ error: error.message || "An error occurred during execution." });
  }
});

app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "Server is running" });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const getLanguageFromExtension = (filename) => {
  if (!filename) return "plaintext";
  const extension = filename.split(".").pop();
  if (filename === ".env") return "env";

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
    case "rb":
      return "ruby";
    case "dart":
      return "dart";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "txt":
      return "plaintext";
    case "go":
      return "go";
    case "php":
      return "php";
    case "rs":
      return "rust";
    case "swift":
      return "swift";
    case "ts":
      return "typescript";
    default:
      return "plaintext";
  }
};

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
