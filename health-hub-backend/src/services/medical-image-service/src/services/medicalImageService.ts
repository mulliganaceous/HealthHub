import * as dynamoose from "dynamoose";
import { Document } from "dynamoose/dist/Document";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { S3 } from "aws-sdk";
import pkg2 from "uuid";
const { v4: uuidv4 } = pkg2;
// Define the MedicalImage model
class MedicalImage extends Document {
  id: string;
  patientId: string;
  imageUrl: string;
  imageType: string;
  uploadedAt: Date;
  analysisResults?: {
    condition: string;
    confidence: number;
  };
  createdAt: Date;
  updatedAt?: Date;
}

// Create the Dynamoose schema
const MedicalImageSchema = new dynamoose.Schema(
  {
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
    imageUrl: String,
    imageType: String,
    uploadedAt: Date,
    analysisResults: Array,
    createdAt: Date,
    updatedAt: {
      type: Date,
      required: false,
    },
  },

  {
    saveUnknown: ["analysisResults.**"],
  }
);

// Create the Dynamoose model
const MedicalImageModel = dynamoose.model<MedicalImage>(
  process.env.MEDICAL_IMAGE_TABLE!,
  MedicalImageSchema,
  {
    create: false,
  }
);

export class MedicalImageService {
  private imageClient: ImageAnnotatorClient;
  private s3: S3;

  constructor() {
    const credentials = {
      client_email: process.env.GOOGLE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      project_id: process.env.GOOGLE_PROJECT_ID,
    };
    this.imageClient = new ImageAnnotatorClient({
      credentials: credentials,
      projectId: credentials.project_id,
    });
    this.s3 = new S3();
  }

  async upload(data: {
    patientId: string;
    imageType: string;
    imageBuffer: Buffer;
  }): Promise<MedicalImage> {
    try {
      const { patientId, imageType, imageBuffer } = data;
      const id = uuidv4();
      const key = `${patientId}/${id}`;
      await this.s3
        .putObject({
          Bucket: process.env.S3_BUCKET!,
          Key: key,
          Body: imageBuffer,
          ContentType: imageType,
          ACL: "public-read",
        })
        .promise();
      const imageUrl = `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;
      const newImage = new MedicalImageModel({
        id,
        patientId,
        imageUrl,
        imageType,
        uploadedAt: new Date(),
        createdAt: new Date(),
      });
      await newImage.save();
      return newImage;
    } catch (error) {
      console.error("Error uploading medical image:", error);
      throw error;
    }
  }

  async get(id: string): Promise<MedicalImage | null> {
    try {
      const image = await MedicalImageModel.get(id);
      return image || null;
    } catch (error) {
      console.error("Error getting medical image:", error);
      throw error;
    }
  }

  async update(
    id: string,
    data: Partial<
      Omit<MedicalImage, "id" | "createdAt" | "imageUrl" | "uploadedAt">
    >
  ): Promise<MedicalImage> {
    try {
      const updatedImage = await MedicalImageModel.update(
        { id },
        { ...data, updatedAt: new Date() }
      );
      return updatedImage;
    } catch (error) {
      console.error("Error updating medical image:", error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const image = await this.get(id);
      if (image) {
        const key = image.imageUrl.split(".com/")[1];
        await this.s3
          .deleteObject({
            Bucket: process.env.S3_BUCKET!,
            Key: key,
          })
          .promise();
      }
      await MedicalImageModel.delete(id);
    } catch (error) {
      console.error("Error deleting medical image:", error);
      throw error;
    }
  }

  async list(filter?: Partial<MedicalImage>): Promise<MedicalImage[]> {
    try {
      let scan = MedicalImageModel.scan();

      if (filter) {
        Object.entries(filter).forEach(([key, value]) => {
          scan = scan.filter(key).eq(value);
        });
      }

      const images = await scan.exec();
      return images;
    } catch (error) {
      console.error("Error listing medical images:", error);
      throw error;
    }
  }

  async findByPatientId(patientId: string): Promise<MedicalImage[]> {
    try {
      const images = await MedicalImageModel.query("patientId")
        .eq(patientId)
        .exec();
      return images;
    } catch (error) {
      console.error("Error finding medical images by Patient ID:", error);
      throw error;
    }
  }

  async analyzeImage(id: string): Promise<MedicalImage> {
    try {
      const image = await this.get(id);
      if (!image) {
        throw new Error("Image not found");
      }

      const [result] = await this.imageClient.labelDetection(image.imageUrl);
      const labels = result.labelAnnotations;

      if (labels && labels.length > 0) {
        const topLabels: any = labels
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .map((label) => ({
            description: label.description,
            confidence: label.score ? (label.score * 100).toFixed(2) : 0,
          }));
        const updatedImage = await this.update(id, {
          analysisResults: topLabels,
        });

        return {
          //@ts-ignore
          detectedConditions: true,
          conditions: topLabels,
        };
      } else {
        return {
          //@ts-ignore
          detectedConditions: true,
          message: "No conditions detected",
        };
      }
    } catch (error) {
      console.error("Error analyzing medical image:", error);
      throw new Error("Failed to analyze image");
    }
  }
}
