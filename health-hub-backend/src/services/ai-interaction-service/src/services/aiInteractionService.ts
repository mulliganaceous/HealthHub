import * as dynamoose from "dynamoose";
import { Document } from "dynamoose/dist/Document";
import { Polly, Translate, S3 } from "aws-sdk";
import pkg2 from "uuid";
const { v4: uuidv4 } = pkg2;

class AIInteraction extends Document {
  id: string;
  userId: string;
  interactionType: "speechConversion";
  content: string;
  audioUrl?: string;
  createdAt: Date;
}

const AIInteractionSchema = new dynamoose.Schema({
  id: {
    type: String,
    hashKey: true,
  },
  userId: {
    type: String,
    index: {
      global: true,
      name: "UserIdIndex",
      rangeKey: "interactionType",
    },
  },
  interactionType: {
    type: String,
    enum: ["speechConversion"],
  },
  content: String,
  audioUrl: {
    type: String,
    required: false,
  },
  createdAt: Date,
});

const AIInteractionModel = dynamoose.model<AIInteraction>(
  process.env.AI_INTERACTION_TABLE!,
  AIInteractionSchema,
  {
    create: false,
  }
);

export class AIInteractionService {
  private polly: Polly;
  private translate: Translate;
  private s3: S3;

  constructor() {
    this.polly = new Polly();
    this.translate = new Translate({ region: "us-east-1" });
    this.s3 = new S3();
  }

  async create(
    data: Omit<AIInteraction, "id" | "createdAt">
  ): Promise<AIInteraction> {
    try {
      const serializedContent =
        typeof data.content === "object"
          ? JSON.stringify(data.content)
          : String(data.content);

      const newInteraction = new AIInteractionModel({
        ...data,
        content: serializedContent,
        id: uuidv4(),
        createdAt: new Date(),
      });

      await newInteraction.save();
      return newInteraction;
    } catch (error) {
      console.error("Error creating AI interaction:", error);
      throw error;
    }
  }

  async get(id: string): Promise<AIInteraction | null> {
    try {
      const interaction = await AIInteractionModel.get(id);
      return interaction || null;
    } catch (error) {
      console.error("Error getting AI interaction:", error);
      throw error;
    }
  }

  async list(
    userId?: string,
    interactionType?: AIInteraction["interactionType"]
  ): Promise<AIInteraction[]> {
    try {
      let query = AIInteractionModel.scan();

      if (userId) {
        query = query.filter("userId").eq(userId);
      }

      if (interactionType) {
        query = query.filter("interactionType").eq(interactionType);
      }

      const interactions = await query.exec();
      return interactions;
    } catch (error) {
      console.error("Error listing AI interactions:", error);
      throw error;
    }
  }

  async textToSpeech(
    text: string,
    language: string
  ): Promise<{ audioUrl: string }> {
    try {
      // First translate and synthesize the speech
      const translatedText = await this.translateText(text, language);
      const audioBuffer = await this.synthesizeSpeech(translatedText, language);

      // Generate a unique ID for the file
      const fileId = uuidv4();

      // Upload the audio file to S3
      const key = `temp-audio/${fileId}.mp3`;
      await this.s3
        .putObject({
          Bucket: process.env.S3_BUCKET!,
          Key: key,
          Body: audioBuffer,
          ContentType: "audio/mpeg",
          ACL: "public-read",
        })
        .promise();

      const audioUrl = `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;

      return { audioUrl };
    } catch (error) {
      console.error("Error in text-to-speech process:", error);
      throw new Error("Failed to process text-to-speech request");
    }
  }

  private async translateText(
    text: string,
    targetLanguage: string
  ): Promise<string> {
    try {
      const params = {
        Text: text,
        SourceLanguageCode: "auto",
        TargetLanguageCode: this.getAWSLanguageCode(targetLanguage),
      };

      const result = await this.translate.translateText(params).promise();
      return result.TranslatedText;
    } catch (error) {
      console.error("Error in translation:", error);
      throw new Error("Failed to translate text");
    }
  }

  private async synthesizeSpeech(
    text: string,
    language: string
  ): Promise<Buffer> {
    try {
      const params = {
        Text: text,
        OutputFormat: "mp3",
        VoiceId: this.getPollyVoice(language),
        LanguageCode: this.getAWSLanguageCode(language),
      };

      const result = await this.polly.synthesizeSpeech(params).promise();

      if (result.AudioStream instanceof Buffer) {
        return result.AudioStream;
      } else {
        throw new Error("AudioStream is not a Buffer");
      }
    } catch (error) {
      console.error("Error in speech synthesis:", error);
      throw new Error("Failed to synthesize speech");
    }
  }

  private getPollyVoice(language: string): string {
    switch (language) {
      case "en":
        return "Joanna";
      case "es":
        return "Penelope";
      case "pt-BR":
        return "Camila";
      default:
        return "Joanna";
    }
  }

  private getAWSLanguageCode(language: string): string {
    switch (language) {
      case "en":
        return "en-US";
      case "es":
        return "es-ES";
      case "pt-BR":
        return "pt-BR";
      default:
        return "en-US";
    }
  }

  // Utility method to delete old temp files
  private async cleanupTempAudio(key: string): Promise<void> {
    try {
      await this.s3
        .deleteObject({
          Bucket: process.env.S3_BUCKET!,
          Key: key,
        })
        .promise();
    } catch (error) {
      console.error("Error cleaning up temp audio file:", error);
      // Don't throw error as this is a cleanup operation
    }
  }
}
