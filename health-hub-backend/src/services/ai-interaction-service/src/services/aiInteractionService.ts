import * as dynamoose from "dynamoose";
import { Document } from "dynamoose/dist/Document";
import { Polly, Translate, S3 } from "aws-sdk";
import axios from "axios";
import pkg2 from "uuid";
const { v4: uuidv4 } = pkg2;
import { OpenAI } from "openai";
import { AppointmentService } from "../../../appointment-service/src/services/appointmentService";
import { DoctorService } from "../../../doctor-service/src/services/doctorService";

class AIInteraction extends Document {
  id: string;
  userId: string;
  interactionType: "virtualAssistant" | "speechConversion" | "imageAnalysis";
  content: string;
  audioUrl?: string;
  response?: string;
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
    enum: ["virtualAssistant", "speechConversion", "imageAnalysis"],
  },
  content: String,
  audioUrl: {
    type: String,
    required: false,
  },
  response: {
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
  private openai: OpenAI;
  private s3: S3;
  private appointmentService: AppointmentService;
  private doctorService: DoctorService;
  private conversationContext: {
    doctorId?: string;
    dateTime?: string;
  };

  constructor() {
    this.polly = new Polly();
    this.translate = new Translate({ region: "us-east-1" });
    this.s3 = new S3();
    this.openai = new OpenAI({
      apiKey: process.env.OPEN_AI_KEY!,
    });
    this.appointmentService = new AppointmentService();
    this.doctorService = new DoctorService("useless");
    this.conversationContext = {};
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

  async handleVirtualAssistant(
    messages: Array<{ role: string; content: string }>,
    patientId: string
  ): Promise<string> {
    try {
      const tools: any = [
        {
          type: "function",
          function: {
            name: "get_available_doctors",
            description: "Get a list of available doctors",
            parameters: {
              type: "object",
              properties: {},
              required: [],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "create_appointment",
            description: "Create a new appointment",
            parameters: {
              type: "object",
              properties: {
                doctorId: { type: "string" },
                dateTime: { type: "string", format: "date-time" },
              },
              required: ["doctorId", "dateTime"],
            },
          },
        },
      ];

      const systemMessage = {
        role: "system",
        content:
          "You are an AI assistant for a healthcare application. You can answer general medical questions, provide health advice, and assist with scheduling appointments. Always prioritize patient safety and refer to professional medical advice when appropriate. When listing available doctors, always include their ID, name, specialty, and registration number. When the user confirms they want to schedule an appointment, you MUST use the create_appointment function with the doctor's ID (not registration number) and the specified time. Do not pretend to create an appointment without calling the function.",
      };

      //@ts-ignore
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [systemMessage, ...messages],
        tools: tools,
        tool_choice: "auto",
      });

      const assistantMessage = response.choices[0].message;

      if (assistantMessage.tool_calls) {
        const toolCall = assistantMessage.tool_calls[0];
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments);

        let functionResult = "";
        if (functionName === "get_available_doctors") {
          console.log("Get available doctors");
          const doctors = await this.doctorService.list();
          functionResult = `Available doctors: ${JSON.stringify(
            doctors.map((doctor) => ({
              id: doctor.id,
              name: doctor.firstName,
              specialty: doctor.specialization,
            }))
          )}`;
        } else if (functionName === "create_appointment") {
          console.log("Called create_appointment", patientId);
          console.log("Args", functionArgs);

          const { doctorId, dateTime } = functionArgs;

          if (!doctorId || !dateTime) {
            functionResult = "Insufficient information to create appointment";
          } else {
            const appointment = await this.createAppointment(
              patientId,
              doctorId,
              dateTime
            );
            functionResult = `Appointment created: ${JSON.stringify(
              appointment
            )}`;
          }
        }

        //@ts-ignore
        const finalResponse = await this.openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            systemMessage,
            ...messages,
            { role: "function", name: functionName, content: functionResult },
            {
              role: "user",
              content:
                "Please provide a friendly and informative response based on this information. If an appointment was created, confirm the details to the user.",
            },
          ],
        });

        return (
          finalResponse.choices[0].message.content ||
          "I apologize, but I'm unable to process your request at the moment."
        );
      }

      return (
        assistantMessage.content ||
        "I apologize, but I'm unable to process your request at the moment."
      );
    } catch (error) {
      console.error("Error handling virtual assistant query:", error);
      throw error;
    }
  }

  private async createAppointment(
    patientId: string,
    doctorId: string,
    dateTime: string
  ): Promise<any> {
    try {
      console.log("Service - creating appointment");
      console.log("PatientId:", patientId);
      console.log("DoctorId:", doctorId);
      console.log("DateTime:", dateTime);
      //@ts-ignore
      const appointment = await this.appointmentService.create({
        patientId,
        doctorId,
        dateTime: new Date(dateTime).toISOString(),
        status: "scheduled",
      });
      console.log("Appointment created successfully:", appointment);
      return appointment;
    } catch (error) {
      console.error("Error creating appointment:", error);
      throw error;
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

async function runThread(apiKey: string, assistantId: string, message: string) {
  const client = new OpenAI({
    apiKey: apiKey,
  });
  const maxRetries: number = 3;
  const retryDelay: number = 2;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const run = await client.beta.threads.createAndRun({
        thread: {
          messages: [{ role: "user", content: message }],
        },
        assistant_id: assistantId,
      });

      let runStatus = run.status;
      while (runStatus === "queued" || runStatus === "in_progress") {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const runLoop = await client.beta.threads.runs.retrieve(
          run.thread_id,
          run.id
        );
        console.log(runLoop.status);
        runStatus = runLoop.status;

        if (runStatus === "failed") {
          console.log(runLoop);
          throw new Error("Run failed");
        }
      }
      const messages = await client.beta.threads.messages.list(run.thread_id);
      //@ts-ignore
      return messages.data[0].content[0].text.value;
    } catch (e) {
      console.log(`Attempt ${attempt + 1} failed: ${e}`);
      if (attempt < maxRetries - 1) {
        console.log(`Retrying in ${retryDelay} seconds...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay * 1000));
      } else {
        console.log("Max retries reached. Aborting.");
        throw e;
      }
    }
  }
}
