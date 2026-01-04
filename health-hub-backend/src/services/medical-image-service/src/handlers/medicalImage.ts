import { APIGatewayProxyHandler } from "aws-lambda";
import { MedicalImageService } from "../services/medicalImageService";

const medicalImageService = new MedicalImageService();

export const upload: APIGatewayProxyHandler = async (event) => {
  try {
    const { patientId, imageType, imageData } = JSON.parse(event.body!);
    const imageBuffer = Buffer.from(imageData, "base64");
    const image = await medicalImageService.upload({
      patientId,
      imageType,
      imageBuffer,
    });
    return {
      statusCode: 201,
      body: JSON.stringify(image),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not upload medical image" }),
    };
  }
};

export const get: APIGatewayProxyHandler = async (event) => {
  try {
    const id = event.pathParameters!.id!;
    const image = await medicalImageService.get(id);
    if (!image) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Medical image not found" }),
      };
    }
    return {
      statusCode: 200,
      body: JSON.stringify(image),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not retrieve medical image" }),
    };
  }
};

export const update: APIGatewayProxyHandler = async (event) => {
  try {
    const id = event.pathParameters!.id!;
    const data = JSON.parse(event.body!);
    const image = await medicalImageService.update(id, data);
    return {
      statusCode: 200,
      body: JSON.stringify(image),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not update medical image" }),
    };
  }
};

export const del: APIGatewayProxyHandler = async (event) => {
  try {
    const id = event.pathParameters!.id!;
    await medicalImageService.delete(id);
    return {
      statusCode: 204,
      body: "",
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not delete medical image" }),
    };
  }
};

export const list: APIGatewayProxyHandler = async (event) => {
  try {
    const { patientId } = event.queryStringParameters || {};
    let images;

    if (patientId) {
      images = await medicalImageService.findByPatientId(patientId);
    } else {
      images = await medicalImageService.list();
    }

    return {
      statusCode: 200,
      body: JSON.stringify(images),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not list medical images" }),
    };
  }
};

export const analyze: APIGatewayProxyHandler = async (event) => {
  try {
    const id = event.pathParameters!.id!;
    const analyzedImage = await medicalImageService.analyzeImage(id);
    return {
      statusCode: 200,
      body: JSON.stringify(analyzedImage),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error }),
    };
  }
};
