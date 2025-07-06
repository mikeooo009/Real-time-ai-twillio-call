require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const twilio = require("twilio");
const ModelClient = require("@azure-rest/ai-inference").default;
const { isUnexpected } = require("@azure-rest/ai-inference");
const { AzureKeyCredential } = require("@azure/core-auth");

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));

const token = process.env["GITHUB_TOKEN"];
const endpoint = "https://models.github.ai/inference";
const model = "openai/gpt-4.1";

// Initialize AI client
const aiClient = ModelClient(endpoint, new AzureKeyCredential(token));

// Handle incoming call
app.post("/voice", async (req, res) => {
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say("Welcome to the AI demo. Please say something after the beep.");
  twiml.record({
    action: "/transcribe",
    transcribe: true,
    transcribeCallback: "/transcribed",
    maxLength: 10,
    trim: "trim-silence"
  });
  res.type("text/xml");
  res.send(twiml.toString());
});

// Handle transcription result
app.post("/transcribed", async (req, res) => {
  const userText = req.body.TranscriptionText;

  if (!userText) {
    return res.send("<Response><Say>Sorry, I didn’t catch that.</Say></Response>");
  }

  try {
    const aiResponse = await aiClient.path("/chat/completions").post({
      body: {
        messages: [
          { role: "system", content: "" },
          { role: "user", content: userText }
        ],
        temperature: 1,
        top_p: 1,
        model
      }
    });

    if (isUnexpected(aiResponse)) {
      throw aiResponse.body.error;
    }

    const aiText = aiResponse.body.choices[0].message.content;

    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say(aiText); // You can also use <Play> with a TTS mp3
    res.type("text/xml");
    res.send(twiml.toString());

  } catch (err) {
    console.error("AI error:", err);
    res.send("<Response><Say>Sorry, I had an error processing your request.</Say></Response>");
  } 
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
