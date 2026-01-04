import * as dynamoose from "dynamoose";
import { Document } from "dynamoose/dist/Document";
import * as sdk from "microsoft-cognitiveservices-speech-sdk";
import { v4 as uuidv4 } from "uuid";

// Define the Transcription model
class Transcription extends Document {
  id: string;
  patientId: string;
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  language: string;
}

// Create the Dynamoose schema
const TranscriptionSchema = new dynamoose.Schema({
  id: {
    type: String,
    hashKey: true,
  },
  patientId: {
    type: String,
    index: {
      global: true,
      name: "PatientIdIndex",
    },
  },
  content: String,
  createdAt: Date,
  updatedAt: {
    type: Date,
    required: false,
  },
  language: {
    type: String,
    default: "en-US",
  },
});

// Create the Dynamoose model
const TranscriptionModel = dynamoose.model<Transcription>(
  process.env.TRANSCRIPTION_TABLE!,
  TranscriptionSchema,
  {
    create: false,
  }
);

export class TranscriptionService {
  private speechConfig: sdk.SpeechConfig;

  constructor() {
    this.speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY!,
      process.env.AZURE_SPEECH_REGION!
    );
  }

  async create(
    data: Omit<Transcription, "id" | "createdAt" | "updatedAt">
  ): Promise<Transcription> {
    try {
      const newTranscription = new TranscriptionModel({
        ...data,
        id: uuidv4(),
        createdAt: new Date(),
      });

      await newTranscription.save();
      return newTranscription;
    } catch (error) {
      console.error("Error creating transcription:", error);
      throw error;
    }
  }

  async get(id: string): Promise<Transcription | null> {
    try {
      const transcription = await TranscriptionModel.get(id);
      return transcription || null;
    } catch (error) {
      console.error("Error getting transcription:", error);
      throw error;
    }
  }

  async update(
    id: string,
    data: Partial<Omit<Transcription, "id" | "createdAt">>
  ): Promise<Transcription> {
    try {
      const updatedTranscription = await TranscriptionModel.update(
        { id },
        { ...data, updatedAt: new Date() }
      );
      return updatedTranscription;
    } catch (error) {
      console.error("Error updating transcription:", error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await TranscriptionModel.delete(id);
    } catch (error) {
      console.error("Error deleting transcription:", error);
      throw error;
    }
  }

  async list(filter?: Partial<Transcription>): Promise<Transcription[]> {
    try {
      let scan = TranscriptionModel.scan();

      if (filter) {
        Object.entries(filter).forEach(([key, value]) => {
          scan = scan.filter(key).eq(value);
        });
      }

      const transcriptions = await scan.exec();
      return transcriptions;
    } catch (error) {
      console.error("Error listing transcriptions:", error);
      throw error;
    }
  }

  async findByPatientId(patientId: string): Promise<Transcription[]> {
    try {
      const transcriptions = await TranscriptionModel.query("patientId")
        .eq(patientId)
        .exec();
      return transcriptions;
    } catch (error) {
      console.error("Error finding transcriptions by Patient ID:", error);
      throw error;
    }
  }

  async transcribeAudio(
    audioBuffer: Buffer,
    language: string = "en-US"
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.speechConfig.speechRecognitionLanguage = language;
      const audioConfig = sdk.AudioConfig.fromWavFileInput(audioBuffer);
      const recognizer = new sdk.SpeechRecognizer(
        this.speechConfig,
        audioConfig
      );

      let transcription = "";
      let isFinished = false;
      let lastRecognizedText = "";

      recognizer.recognizing = (s, e) => {
        console.log(`RECOGNIZING: Text=${e.result.text}`);
      };

      recognizer.recognized = (s, e) => {
        if (e.result.reason === sdk.ResultReason.RecognizedSpeech) {
          console.log(`RECOGNIZED: Text=${e.result.text}`);
          if (e.result.text.trim() !== lastRecognizedText.trim()) {
            transcription += e.result.text.trim() + "\n";
            lastRecognizedText = e.result.text;
          }
        } else if (e.result.reason === sdk.ResultReason.NoMatch) {
          console.log("NOMATCH: Speech could not be recognized.");
        }
      };

      recognizer.canceled = (s, e) => {
        console.log(`CANCELED: Reason=${e.reason}`);
        if (e.reason === sdk.CancellationReason.Error) {
          console.log(`CANCELED: ErrorCode=${e.errorCode}`);
          console.log(`CANCELED: ErrorDetails=${e.errorDetails}`);
          reject(new Error(e.errorDetails));
        }
        isFinished = true;
        recognizer.stopContinuousRecognitionAsync();
      };

      recognizer.sessionStopped = (s, e) => {
        console.log("\nSession stopped event.");
        isFinished = true;
        recognizer.stopContinuousRecognitionAsync();
      };

      recognizer.startContinuousRecognitionAsync(
        () => {
          console.log("Recognition started");
        },
        (err) => {
          console.trace("err - " + err);
          reject(err);
        }
      );

      // Set a timeout to ensure we don't exceed Lambda's execution time
      const timeoutDuration = 25000; // 25 seconds
      setTimeout(() => {
        if (!isFinished) {
          console.log("Forcing transcription to finish due to timeout");
          isFinished = true;
          recognizer.stopContinuousRecognitionAsync(
            () => {
              resolve(transcription.trim());
            },
            (err) => {
              reject(err);
            }
          );
        }
      }, timeoutDuration);

      // Check periodically if transcription is complete
      const checkInterval = setInterval(() => {
        if (isFinished) {
          clearInterval(checkInterval);
          resolve(transcription.trim());
        }
      }, 1000);
    });
  }
}
