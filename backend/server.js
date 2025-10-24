require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const path = require("path");
const fs = require("fs/promises");
const cors = require("cors");
const pdf_parse = require("pdf-parse");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: process.env.MAIN_URL,
  methods: ["GET", "POST"],
};

const io = new Server(server, { cors: corsOptions });

const PORT = process.env.PORT;
const UPLOAD_DIR = path.join(__dirname, "uploads");
const PRESENTATIONS_DIR = path.join(__dirname, "public/presentations");

fs.mkdir(UPLOAD_DIR, { recursive: true });
fs.mkdir(PRESENTATIONS_DIR, { recursive: true });

app.use(cors(corsOptions));
app.use("/public", express.static(path.join(__dirname, "public")));

const presentations = {};
/* { [id]: { ..., hostKey: String, hostFingerprint: String | null } } */

const cleanupPresentation = async (presentationId) => {
  if (presentations[presentationId]) {
    console.log(`Cleaning up presentation: ${presentationId}`);
    try {
      const relativePath = presentations[presentationId].pdf_path.substring(1);
      const pdfFilePath = path.join(__dirname, relativePath);
      await fs.unlink(pdfFilePath);
      console.log(`Successfully deleted PDF: ${pdfFilePath}`);
    } catch (err) {
      console.error(`Failed to delete PDF for ${presentationId}:`, err.message);
    }
    io.to(presentationId).emit("presentation_terminated");
    io.sockets.in(presentationId).disconnectSockets(true);
    delete presentations[presentationId];
  }
};

setInterval(async () => {
  const now = new Date();
  const ONE_HOUR_IN_MS = 60 * 60 * 1000;
  const TWELVE_HOURS_IN_MS = 12 * 60 * 60 * 1000;

  console.log("Running hourly cleanup check...");

  const presentationIds = Object.keys(presentations);

  for (const id of presentationIds) {
    const presentation = presentations[id];
    if (!presentation) continue;

    const createdAt = presentation.createdAt;
    const age = now - createdAt;

    if (age > TWELVE_HOURS_IN_MS) {
      console.log(`Cleaning up presentation ${id} (older than 12 hours)`);
      await cleanupPresentation(id);
      continue;
    }

    const room = io.sockets.adapter.rooms.get(id);
    const participantCount = room ? room.size : 0;

    if (participantCount === 0 && age > ONE_HOUR_IN_MS) {
      console.log(`Cleaning up presentation ${id} (empty for > 1 hour)`);
      await cleanupPresentation(id);
    }
  }
}, 60 * 60 * 1000);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "ファイルがありません" });

  const presentationId = uuidv4();
  const newFilePath = path.join(PRESENTATIONS_DIR, `${presentationId}.pdf`);
  const hostKey = crypto.randomBytes(16).toString("hex");

  try {
    await fs.rename(req.file.path, newFilePath);
    const dataBuffer = await fs.readFile(newFilePath);
    const pdfData = await pdf_parse(dataBuffer);

    presentations[presentationId] = {
      page_count: pdfData.numpages,
      current_page: 1,
      pdf_path: `/public/presentations/${presentationId}.pdf`,
      createdAt: new Date(),
      hostSocketId: null,
      hostKey: hostKey,
      hostFingerprint: null,
    };

    res.json({
      success: true,
      presentation_id: presentationId,
      page_count: pdfData.numpages,
      hostKey: hostKey,
    });
  } catch (error) {
    console.error("PDF processing error:", error);
    await fs.unlink(newFilePath).catch(console.error);
    res.status(500).json({ error: "PDFの処理に失敗しました" });
  }
});

io.on("connection", (socket) => {
  socket.on("join", (data) => {
    const { room, isHost, hostKey, fingerprint } = data;
    const presentation = presentations[room];

    if (!presentation) {
      return socket.emit("presentation_terminated");
    }

    if (isHost) {
      if (presentation.hostKey !== hostKey) {
        return socket.emit("auth_error", { message: "ホストキーが不正です。" });
      }
      if (presentation.hostFingerprint === null) {
        presentation.hostFingerprint = fingerprint;
        console.log(`Fingerprint registered for host of room ${room}`);
      } else if (presentation.hostFingerprint !== fingerprint) {
        return socket.emit("auth_error", {
          message: "あなたのアクセスは許可されていません。",
        });
      }
      presentation.hostSocketId = socket.id;
    }

    socket.join(room);
    socket.emit("update_page", { page: presentation.current_page });
  });

  socket.on("change_page", (data) => {
    const { room, page } = data;
    const presentation = presentations[room];
    if (presentation && presentation.hostSocketId === socket.id) {
      presentation.current_page = page;
      io.to(room).emit("update_page", { page });
    }
  });

  socket.on("terminate_presentation", (data) => {
    const { room } = data;
    const presentation = presentations[room];
    if (presentation && presentation.hostSocketId === socket.id) {
      cleanupPresentation(room);
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);

    const presentationId = Object.keys(presentations).find(
      (id) =>
        presentations[id] && presentations[id].hostSocketId === socket.id
    );

    if (presentationId) {
      console.log(
        `Host disconnected from presentation: ${presentationId}. Cleaning up.`
      );
      cleanupPresentation(presentationId);
    }
  });
});

server.listen(PORT, () => {
  console.log(`Backend server listening on *:${PORT}`);
});
