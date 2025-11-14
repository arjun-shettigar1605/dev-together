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
const roomFileSystems = {};
const roomHosts = {};
// Store room file systems on the server


//generates random characters for roomID
const getRandomChars = (length) => {
  const chars = "abcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// GMeet stlyed Room ID generator (appends part 1,2,3)
const generateRoomId = () => {
  const part1 = getRandomChars(3);
  const part2 = getRandomChars(4);
  const part3 = getRandomChars(3);
  return `${part1}-${part2}-${part3}`;
};

function getAllClients(roomId) {
  const socketIds = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
  const hostId = roomHosts[roomId];
  return socketIds.map((socketId) => {
    return {
      socketId,
      username: userSocketMap[socketId],
      isHost: socketId == hostId,
    };
  });
}

// create a nested file system for web development
const createDefaultFiles = () => {
  const progRootId = uuidv4();
  const devRootId = uuidv4();
  const dbRootId = uuidv4();

  const progFileId = uuidv4();
  const devFileId1 = uuidv4();
  const devFileId2 = uuidv4();
  const devFileId3 = uuidv4();
  const dbFileId = uuidv4();

  return {
    programming: {
      files: {
        [progRootId]: {
          id: progRootId,
          name: "Programming",
          type: "folder",
          parentId: null,
          children: [progFileId],
        },
        [progFileId]: {
          id: progFileId,
          name: "main.py",
          type: "file",
          language: "python",
          content: "# Welcome to Python!\nprint('Hello, Python!')",
          parentId: progRootId,
        },
      },
      rootId: progRootId,
      defaultFileId: progFileId,
    },
    development: {
      files: {
        [devRootId]: {
          id: devRootId,
          name: "Development",
          type: "folder",
          parentId: null,
          children: [devFileId1, devFileId2, devFileId3],
        },
        [devFileId1]: {
          id: devFileId1,
          name: "index.html",
          type: "file",
          language: "html",
          content:
            '\n<h1>Hello, World!</h1>\n<script src="script.js"></script>',
          parentId: devRootId,
        },
        [devFileId2]: {
          id: devFileId2,
          name: "style.css",
          type: "file",
          language: "css",
          content: "/* CSS styles */\nh1 {\n  color: blue;\n}",
          parentId: devRootId,
        },
        [devFileId3]: {
          id: devFileId3,
          name: "script.js",
          type: "file",
          language: "javascript",
          content: "// JavaScript code\nconsole.log('Hello from script.js!');",
          parentId: devRootId,
        },
      },
      rootId: devRootId,
      defaultFileId: devFileId1,
    },
    database: {
      files: {
        [dbRootId]: {
          id: dbRootId,
          name: "Database",
          type: "folder",
          parentId: null,
          children: [dbFileId],
        },
        [dbFileId]: {
          id: dbFileId,
          name: "main.sql",
          type: "file",
          language: "sql",
          content:
            "-- SQL queries\nSELECT * FROM Customers;\n\nSELECT * FROM Products;",
          parentId: dbRootId,
        },
      },
      rootId: dbRootId,
      defaultFileId: dbFileId,
    },
  };
};


io.on("connection", (socket) => {
  console.log("A user connected, socket id:", socket.id);

  socket.on("join-room", ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    roomSocketMap[socket.id] = roomId;
    socket.join(roomId);

    if (!roomFileSystems[roomId]) {
      roomFileSystems[roomId] = createDefaultFiles();
    }

    if(!roomHosts[roomId]) {
      roomHosts[roomId] = socket.id;
      console.log(`${username} (${socket.id}) is set as host for room ${roomId}`);
    }

    // Initialize room file system if it doesn't exist
    // initializeRoomFileSystem(roomId);

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
    if (roomFileSystems[roomId] && roomFileSystems[roomId].development) {
      socket.emit("live-preview-update", { 
        files: roomFileSystems[roomId].development.files, 
      });
    }
  });

  // Handle code changes and update server state
  socket.on("code-change", ({ roomId, fileId, code, section }) => {
    if (
      roomFileSystems[roomId] &&
      roomFileSystems[roomId][section] &&
      roomFileSystems[roomId][section].files[fileId]
    ) {
      roomFileSystems[roomId][section].files[fileId].content = code;

      // Broadcast to other editors
      socket.to(roomId).emit("code-change", { fileId, code, section });

      if (section === "development") {
        io.in(roomId).emit("live-preview-update", {
          files: roomFileSystems[roomId].development.files,
        });
      }

      // // NEW: Check if it's a web file and broadcast to preview windows
      // const file = roomFileSystems[roomId][fileId];
      // if (
      //   file.name.endsWith(".html") ||
      //   file.name.endsWith(".css") ||
      //   file.name.endsWith(".js")
      // ) {
      //   io.in(roomId).emit("live-preview-update", {
      //     files: roomFileSystems[roomId],
      //   });
      // }
    }
  });

  // Handle file creation and update server state
  socket.on("file-create", ({ roomId, name, type, section, parentId, language }) => {
    if (!roomFileSystems[roomId] || !roomFileSystems[roomId][section]) return;

    const fs = roomFileSystems[roomId][section].files;

    // if (roomFileSystems[roomId] && roomFileSystems[roomId][parentId]) {
    //   const language = getLanguageFromExtension(name);
    //   const newItem = {
    //     id: uuidv4(),
    //     name,
    //     type,
    //     parentId,
    //     language: type === "file" ? language : null,
    //     content: type === "file" ? `// New file: ${name}\n` : null,
    //     children: type === "folder" ? [] : null,
    //   };

    //   // Add new item to map
    //   roomFileSystems[roomId][newItem.id] = newItem;
    //   // Add new item to parent's children array
    //   roomFileSystems[roomId][parentId].children.push(newItem.id);

    //   // Broadcast the full filesystem update
    //   io.in(roomId).emit("filesystem-updated", {
    //     files: roomFileSystems[roomId],
    //   });
    // }

    if (fs && fs[parentId]) {
      const lang = type === "file" ? getLanguageFromExtension(name) : null; // Use language from name
      const newItem = {
        id: uuidv4(),
        name,
        type,
        parentId,
        language: lang,
        content: type === "file" ? `// New file: ${name}\n` : null,
        children: type === "folder" ? [] : null,
      };

      // Add new item to map
      fs[newItem.id] = newItem;
      // Add new item to parent's children array
      fs[parentId].children.push(newItem.id);

      // Broadcast the full filesystem update
      io.in(roomId).emit("filesystem-updated", {
        files: roomFileSystems[roomId],
      });
    }
  });

  // Handle file deletion and update server state
  socket.on("file-delete", ({ roomId, itemId, section }) => {
    if (!roomFileSystems[roomId] || !roomFileSystems[roomId][section]) return;

    // if (roomFileSystems[roomId] && roomFileSystems[roomId][itemId]) {
    //   const itemToDelete = roomFileSystems[roomId][itemId];
    //   const parentId = itemToDelete.parentId;

    //   // Recursive delete function
    //   const deleteRecursive = (id) => {
    //     const item = roomFileSystems[roomId][id];
    //     if (item.type === "folder") {
    //       item.children.forEach(deleteRecursive);
    //     }
    //     delete roomFileSystems[roomId][id];
    //   };

    //   deleteRecursive(itemId);

    //   // Remove from parent's children
    //   if (parentId && roomFileSystems[roomId][parentId]) {
    //     roomFileSystems[roomId][parentId].children = roomFileSystems[roomId][
    //       parentId
    //     ].children.filter((id) => id !== itemId);
    //   }

    //   // Broadcast the full filesystem update
    //   io.in(roomId).emit("filesystem-updated", {
    //     files: roomFileSystems[roomId],
    //   });
    // }

    const fs = roomFileSystems[roomId][section].files; // Get section-specific filesystem

    if (fs && fs[itemId]) {
      const itemToDelete = fs[itemId];
      const parentId = itemToDelete.parentId;

      // Recursive delete function
      const deleteRecursive = (id) => {
        const item = fs[id];
        if (!item) return; // Item already deleted
        if (item.type === "folder") {
          // Create a copy of children array before iterating
          [...item.children].forEach(deleteRecursive);
        }
        delete fs[id];
      };

      deleteRecursive(itemId);

      // Remove from parent's children
      if (parentId && fs[parentId]) {
        fs[parentId].children = fs[parentId].children.filter(
          (id) => id !== itemId
        );
      }

      // Broadcast the full filesystem update
      io.in(roomId).emit("filesystem-updated", {
        files: roomFileSystems[roomId],
      });
    }
  });

  // NEW: Handle file drag-and-drop
  socket.on("file-move", ({ roomId, itemId, newParentId, section }) => {
    if (!roomFileSystems[roomId] || !roomFileSystems[roomId][section]) return;
    const fs = roomFileSystems[roomId][section].files;
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

      let wasHost = socket.id === roomHosts[roomId];

      // Clean up room file system if no one is left
      const remainingClients = getAllClients(roomId).filter(
        (client) => client.socketId !== socket.id
      );
      if(wasHost && remainingClients.length > 0) {
        const newHostId = remainingClients[0].socketId;
        roomHosts[roomId] = newHostId;
        console.log(`Host ${username} (${socket.id}) disconnected. New host is (${newHostId}) for room ${roomId}`);
        io.in(roomId).emit("host-changed", { newHostId });
      }
      else if (remainingClients.length === 0) {
        delete roomHosts[roomId];
        delete roomFileSystems[roomId];
        console.log(
          `Room ${roomId} empty, clean up started`
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
  const roomId = generateRoomId();
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
    case "sql":
      return "sqlite"
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
