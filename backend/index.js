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

// Initialize default file system for a room
function initializeRoomFileSystem(roomId) {
  if (!roomFileSystems[roomId]) {
    roomFileSystems[roomId] = {
      "main.py": {
        name: "main.py",
        language: "python",
        content: "# Welcome! Start coding in Python.",
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
    socket.emit("sync-filesystem", {
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

  // Handle code changes and update server state
  socket.on("code-change", ({ roomId, file, code }) => {
    if (roomFileSystems[roomId] && roomFileSystems[roomId][file]) {
      roomFileSystems[roomId][file].content = code;
    }
    socket.to(roomId).emit("code-change", { file, code });
  });

  // Handle file creation and update server state
  socket.on("file-created", ({ roomId, file }) => {
    if (roomFileSystems[roomId]) {
      roomFileSystems[roomId][file.name] = file;
    }
    socket.to(roomId).emit("file-created", { file });
  });

  // Handle file deletion and update server state
  socket.on("file-deleted", ({ roomId, fileName }) => {
    if (roomFileSystems[roomId]) {
      delete roomFileSystems[roomId][fileName];
    }
    socket.to(roomId).emit("file-deleted", { fileName });
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

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
