require("dotenv").config();
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const { Dropbox } = require("dropbox");

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// === Configuración de Dropbox ===
const DROPBOX_TOKEN = process.env.DROPBOX_TOKEN;

if (!DROPBOX_TOKEN) {
  console.error("❌ ERROR: No existe la variable DROPBOX_TOKEN en .env");
  process.exit(1);
}

const dbx = new Dropbox({ accessToken: DROPBOX_TOKEN });

// === Ruta para subir archivos ===
app.post("/upload", upload.array("files"), async (req, res) => {
  console.log("📥 /upload llamada. Archivos recibidos:", req.files.length);

  try {
    const familyName = req.body.familyName?.trim();
    console.log("👪 Nombre de la familia:", familyName);

    if (!familyName) {
      return res.status(400).json({
        status: "error",
        message: "El nombre de la familia es obligatorio."
      });
    }

    // Carpeta principal para cada familia
    const folderPath = `/${familyName}`;
    console.log("📁 Usando carpeta:", folderPath);

    // Crear carpeta si no existe
    try {
      await dbx.filesCreateFolderV2({ path: folderPath });
      console.log("🆕 Carpeta creada en Dropbox.");
    } catch (e) {
      console.log("📁 Carpeta ya existía, continuando...");
    }

    const uploaded = [];

    // Subir archivos
    for (const file of req.files) {
      const filePath = `${folderPath}/${file.originalname}`;
      console.log("⬆️ Subiendo archivo:", filePath);

      const uploadRes = await dbx.filesUpload({
        path: filePath,
        contents: file.buffer,
        mode: "overwrite"
      });

      // Crear enlace compartido
      const shared = await dbx.sharingCreateSharedLinkWithSettings({
        path: uploadRes.result.path_display
      });

      uploaded.push({
        name: file.originalname,
        url: shared.result.url.replace("?dl=0", "?dl=1") // descarga directa
      });

      console.log("✅ Archivo subido:", file.originalname);
    }

    res.json({
      status: "ok",
      message: "Fotos subidas correctamente 🎉",
      uploaded
    });

  } catch (err) {
    console.error("❌ Error al subir archivos:", err);
    res.status(500).json({
      status: "error",
      message: err.message
    });
  }
});

// === Servidor ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`)
);
