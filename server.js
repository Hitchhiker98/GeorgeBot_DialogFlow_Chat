const config = require("./config/keys");
const projectId = config.googleProjectID;
const port = process.env.PORT || 3000;

const languageCode = config.dialogFlowSessionLanguageCode;
let encoding = "AUDIO_ENCODING_LINEAR_16";

const singleUtterance = false;
const interimResults = false;
const sampleRateHertz = 16000;
const speechContexts = [
  {
    phrases: ["mail", "email"],
    boost: 20.0,
  },
];

console.log(projectId);

// ----------------------

// load all the libraries for the server
const socketIo = require("socket.io");
const path = require("path");
const fs = require("fs");
const http = require("http");
const cors = require("cors");
const express = require("express");
const ss = require("socket.io-stream");
// load all the libraries for the Dialogflow part
// const uuid = require("uuid");
const util = require("util");
const { Transform, pipeline } = require("stream");
const pump = util.promisify(pipeline);
const dialogflow = require("dialogflow").v2beta1;

// set some server variables
const app = express();
var server;
var sessionId, sessionClient, sessionPath, request;
var speechClient,
  requestSTT,
  ttsClient,
  requestTTS,
  mediaTranslationClient,
  requestMedia;

/**
 * Setup Express Server with CORS and SocketIO
 */
function setupServer() {
  // setup Express
  app.use(cors());
  app.use(express.static("public"));
  // app.get('/', function(req, res) {
  //   res.sendFile(path.join(__dirname + '/Test_copy'+'.html'));
  // });
  server = http.createServer(app);
  io = socketIo(server);
  server.listen(port, () => {
    console.log("Running server on port %s", port);
  });

  // Listener, once the client connect to the server socket
  io.on("connect", (client) => {
    console.log(`Client connected [id=${client.id}]`);
    client.emit("server_setup", `Server connected [id=${client.id}]`);

    // when the client sends 'message' events
    // when using simple audio input
    client.on("message", async function (data) {
      // we get the dataURL which was sent from the client
      console.log("data - 72", data.audio.dataURL);
      const dataURL = data.audio.dataURL.split(",").pop();
      // we will convert it to a Buffer
      let fileBuffer = Buffer.from(dataURL, "base64");
      // run the simple detectIntent() function
      const results = await detectIntent(fileBuffer);
      client.emit("results", results);
    });

    // when the client sends 'message-transcribe' events
    // when using simple audio input
    client.on("message-transcribe", async function (data) {
      // we get the dataURL which was sent from the client
      const dataURL = data.audio.dataURL.split(",").pop();
      // we will convert it to a Buffer
      let fileBuffer = Buffer.from(dataURL, "base64");
      // run the simple transcribeAudio() function
      const results = await transcribeAudio(fileBuffer);
      client.emit("results", results);
    });
    // when the client sends 'text-message' events
    // when using text input
    client.on("textMessage",  async function (data) {
      console.log('Iaminbackend')
      console.log(data)
      const request = {
        session: sessionPath,
        queryInput: {
          text: {
            // The query to send to the dialogflow agent
            text: data,
            // The language used by the client (en-US)
            languageCode: languageCode,
          },
        },
      };
      // Send request and log result
      const results = await sessionClient.detectIntent(request);
      results[0].queryResult.text = true;
      client.emit("results", results);
      console.log(results)
    });
    
  });
}

/**
 * Setup Dialogflow Integration
 */
function setupDialogflow() {
  // Dialogflow will need a session Id
  sessionId = config.dialogFlowSessionID;
  // Dialogflow will need a DF Session Client
  // So each DF session is unique
  sessionClient = new dialogflow.SessionsClient();
  // Create a session path from the Session client,
  // which is a combination of the projectId and sessionId.
  sessionPath = sessionClient.sessionPath(projectId, sessionId);

  // Create the initial request object
  // When streaming, this is the first call you will
  // make, a request without the audio stream
  // which prepares Dialogflow in receiving audio
  // with a certain sampleRateHerz, encoding and languageCode
  // this needs to be in line with the audio settings
  // that are set in the client
  request = {
    session: sessionPath,
    queryInput: {
      audioConfig: {
        sampleRateHertz: sampleRateHertz,
        encoding: encoding,
        languageCode: languageCode,
        speechContexts: speechContexts,
      },
      singleUtterance: singleUtterance,
    },
  };
}

/*
 * Dialogflow Detect Intent based on Audio
 * @param audio file buffer
 * @param cb Callback function to execute with results
 */
async function detectIntent(audio) {
  request.inputAudio = audio;
  console.log("request-150", request);
  const responses = await sessionClient.detectIntent(request);
  console.log("response - 143", responses);
  return responses;
}

setupDialogflow();
setupServer();

console.log("SERVER UP")