import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { google } from 'googleapis';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Lazy-init Gemini
let genAI: GoogleGenAI | null = null;
const getGenAI = () => {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined");
    }
    genAI = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return genAI;
};

// API: AI Assistant - Chat
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    const ai = getGenAI();
    
    const systemPrompt = `
      You are the School Protocol Intelligence Assistant. 
      Your goal is to help teachers and school admins manage their workload.
      
      When a user asks you to DRAFT a notice, message, or announcement:
      1. Write a professional and polite draft.
      2. Format the message clearly.
      3. CRITICAL: At the end of your response, if you have provided a draft that can be scheduled, 
         include a JSON block exactly like this (and nothing else in that block):
         \`\`\`json
         { "action": "draft_notice", "content": "THE_DRAFT_CONTENT_HERE" }
         \`\`\`
      4. Make sure the content in the JSON block is the final version of the draft you created.
         Ensure the "content" string is properly escaped for a JSON string (e.g., escape newlines as \\n).
      
      Example: "I have drafted the notice for the parent-teacher meeting. Here it is: [Message content] \`\`\`json { "action": "draft_notice", "content": "Notice: Parent-Teacher Meeting...\\nDate:..." } \`\`\`"
    `;

    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: systemPrompt
      },
      history: history.map((m: any) => ({
        role: m.role,
        parts: m.parts
      }))
    });

    try {
      const result = await chat.sendMessage({ message });
      res.json({ text: result.text });
    } catch (apiErr: any) {
      if (apiErr.status === 503 || apiErr.message?.includes('503') || apiErr.message?.includes('high demand')) {
        res.status(503).json({ 
          error: "The AI service is currently experiencing high demand. Please wait a few moments and try your request again.",
          status: "high_demand"
        });
      } else {
        throw apiErr;
      }
    }
  } catch (error: any) {
    console.error("AI Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// API: AI Assistant - Analyze Attendance (New)
app.post("/api/ai/analyze-attendance", async (req, res) => {
  try {
    const { data } = req.body;
    const ai = getGenAI();
    
    const promptString = `
      You are a school admin assistant. Analyze this attendance data:
      ${JSON.stringify(data)}
      
      Provide a brief summary focusing on:
      1. Overall attendance percentage.
      2. Mention any concerning roll numbers (if absent).
      3. Suggest a message to send to the staff group.
      Keep it professional and concise.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: promptString }] }]
    });

    res.json({ text: response.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// API: WhatsApp - Send (Twilio Cancelled - Log/Simulate only)
app.post("/api/whatsapp/send", async (req, res) => {
  try {
    const { to, message } = req.body;
    
    console.log(`[WhatsApp Sandbox Logger] Message queued for delivery to: ${to}`);
    console.log(`[WhatsApp Sandbox Logger] Message Content:\n"""\n${message}\n"""`);
    
    return res.json({ 
      sid: "SM_simulated_" + Math.random().toString(36).substring(2, 10), 
      simulated: true,
      message: "Twilio/WhatsApp is cancelled. Message was successfully routed to standard container console log." 
    });
  } catch (error: any) {
    console.error("WhatsApp Send Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// API: Sheets - Append
app.post("/api/sheets/append", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(' ')[1];
    
    const { spreadsheetId, range, values } = req.body;
    
    const authClient = new google.auth.OAuth2();
    authClient.setCredentials({ access_token: token });
    
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: { values }
    });
    
    res.json(response.data);
  } catch (error: any) {
    console.error("Sheets Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// API: Docs - Create
app.post("/api/docs/create", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(' ')[1];
    
    const { title, content } = req.body;
    
    const authClient = new google.auth.OAuth2();
    authClient.setCredentials({ access_token: token });
    
    const docs = google.docs({ version: 'v1', auth: authClient });
    
    // 1. Create a blank document
    const createRes = await docs.documents.create({
      requestBody: { title }
    });
    
    const documentId = createRes.data.documentId;
    
    // 2. Insert content if exists
    if (content && documentId) {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [
            {
              insertText: {
                text: content,
                location: {
                  index: 1
                }
              }
            }
          ]
        }
      });
    }
    
    res.json({ 
      documentId, 
      title, 
      url: `https://docs.google.com/document/d/${documentId}/edit` 
    });
  } catch (error: any) {
    console.error("Docs Create Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// API: Docs - List
app.get("/api/docs/list", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.split(' ')[1];
    
    const authClient = new google.auth.OAuth2();
    authClient.setCredentials({ access_token: token });
    
    const drive = google.drive({ version: 'v3', auth: authClient });
    
    const response = await drive.files.list({
      q: "mimeType = 'application/vnd.google-apps.document' and trashed = false",
      pageSize: 15,
      fields: "files(id, name, createdTime, webViewLink)",
      orderBy: "modifiedTime desc"
    });
    
    res.json(response.data.files || []);
  } catch (error: any) {
    console.error("Drive list Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// API: Sheets - Apps Script Proxy
app.post("/api/sheets/apps-script-sync", async (req, res) => {
  try {
    const { url, payload } = req.body;
    if (!url) {
      return res.status(400).json({ error: "Google Apps Script Web App URL is required" });
    }
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    let text = "";
    try {
      text = await response.text();
    } catch (_) {}
    
    if (!response.ok) {
      return res.status(response.status).json({ error: `Apps Script error: ${response.status}`, details: text });
    }
    
    res.json({ success: true, details: text });
  } catch (error: any) {
    console.error("Apps Script Proxy Endpoint Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// API: ImgBB Proxy Image Upload
app.post("/api/upload-image", async (req, res) => {
  try {
    const { image } = req.body;
    const apiKey = process.env.IMGBB_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        error: "IMGBB_API_KEY is not defined. Please add 'IMGBB_API_KEY' in your AI Studio secrets environment setup."
      });
    }

    if (!image) {
      return res.status(400).json({ error: "No base64 image data provided." });
    }

    // Strip metadata prefix if exists (e.g. "data:image/jpeg;base64,")
    let base64Body = image;
    if (image.includes(",")) {
      base64Body = image.split(",")[1];
    }

    const formData = new URLSearchParams();
    formData.append("image", base64Body);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    const data = await response.json() as any;

    if (!response.ok || !data.success) {
      console.error("ImgBB api error response:", data);
      return res.status(response.status || 500).json({
        error: data?.error?.message || "Failed uploading to ImgBB."
      });
    }

    res.json({
      success: true,
      url: data.data.url,
      display_url: data.data.display_url,
      delete_url: data.data.delete_url
    });
  } catch (error: any) {
    console.error("Server API ImgBB Upload Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Vite middleware for development
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

setupVite().then(() => {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
});
