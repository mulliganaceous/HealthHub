import { APIGatewayProxyHandler } from "aws-lambda";
import { AIInteractionService } from "../services/aiInteractionService";

const aiInteractionService = new AIInteractionService();

export const create: APIGatewayProxyHandler = async (event) => {
  try {
    const data = JSON.parse(event.body!);
    const interaction = await aiInteractionService.create(data);
    return {
      statusCode: 201,
      body: JSON.stringify(interaction),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not create AI interaction" }),
    };
  }
};

export const get: APIGatewayProxyHandler = async (event) => {
  try {
    const id = event.pathParameters!.id!;
    const interaction = await aiInteractionService.get(id);
    if (!interaction) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "AI interaction not found" }),
      };
    }
    return {
      statusCode: 200,
      body: JSON.stringify(interaction),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not retrieve AI interaction" }),
    };
  }
};

export const list: APIGatewayProxyHandler = async (event) => {
  try {
    const { userId, interactionType } = event.queryStringParameters || {};
    const interactions = await aiInteractionService.list(
      userId,
      interactionType as any
    );
    return {
      statusCode: 200,
      body: JSON.stringify(interactions),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Could not list AI interactions" }),
    };
  }
};

export const virtualAssistant: APIGatewayProxyHandler = async (event) => {
  try {
    const { userId, query } = JSON.parse(event.body!);
    const response = await aiInteractionService.handleVirtualAssistant(
      query,
      userId
    );

    //@ts-ignore
    const interaction = await aiInteractionService.create({
      userId,
      interactionType: "virtualAssistant",
      content: query,
      response,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ interaction, response }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Could not process virtual assistant query",
      }),
    };
  }
};

export const textToSpeech: APIGatewayProxyHandler = async (event) => {
  try {
    const { text, language } = JSON.parse(event.body!);

    if (!text || !language) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Text and language are required" }),
      };
    }

    const result = await aiInteractionService.textToSpeech(text, language);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // If needed for CORS
      },
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error("Text-to-speech error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to convert text to speech" }),
    };
  }
};
