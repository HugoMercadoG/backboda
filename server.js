const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { google } = require("googleapis");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// === Configuración Google Drive usando variable de entorno ===
const SCOPES = ["https://www.googleapis.com/auth/drive.file"];

if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  console.error("❌ Error: No se encontró la variable de entorno GOOGLE_SERVICE_ACCOUNT_JSON");
  process.exit(1);
}

let credentials;
try {
  credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
} catch (err) {
  console.error("❌ Error al parsear GOOGLE_SERVICE_ACCOUNT_JSON:", err.message);
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: SCOPES
});

const drive = google.drive({ version: "v3", auth });

// === ID de la carpeta principal en Drive ===
const PARENT_FOLDER_ID = "1a-zvmr8zmUK2KM1M7G1ouIiANscHPFeh";

// === Ruta para subir archivos ===
app.post("/upload", upload.array("files"), async (req, res) => {
  try {
    const familyName = req.body.familyName?.trim();
    if (!familyName) {
      return res.status(400).json({ status: "error", message: "El nombre de la familia es obligatorio." });
    }

    // Buscar o crear subcarpeta por familia
    const folders = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and name='${familyName}' and '${PARENT_FOLDER_ID}' in parents`,
      fields: "files(id, name)"
    });

    let folderId;
    if (folders.data.files.length > 0) {
      folderId = folders.data.files[0].id;
    } else {
      const folder = await drive.files.create({
        requestBody: {
          name: familyName,
          mimeType: "application/vnd.google-apps.folder",
          parents: [PARENT_FOLDER_ID]
        },
        fields: "id"
      });
      folderId = folder.data.id;
    }

    // Subir archivos
    const uploaded = [];
    for (const file of req.files) {
      const driveFile = await drive.files.create({
        requestBody: {
          name: file.originalname,
          parents: [folderId]
        },
        media: {
          mimeType: file.mimetype,
          body: Buffer.from(file.buffer)
        },
        fields: "id, name, webViewLink"
      });
      uploaded.push({ name: driveFile.data.name, url: driveFile.data.webViewLink });
    }

    res.json({ status: "ok", message: "Fotos subidas correctamente 🎉", uploaded });

  } catch (err) {
    console.error("❌ Error al subir archivos:", err);
    res.status(500).json({ status: "error", message: err.message });
  }
});

// === Servidor ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en http://localhost:${PORT}`));
