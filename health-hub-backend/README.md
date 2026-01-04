# HealthHub Serverless Installation and Setup Guide

This guide provides instructions for setting up and deploying the HealthHub backend services using the Serverless Framework.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Structure](#project-structure)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Deployment](#deployment)
6. [Running Locally](#running-locally)
7. [Service-Specific Notes](#service-specific-notes)

## Prerequisites

Ensure you have the following installed on your system:

- Node.js (v14 or later)
- npm (v6 or later)
- Serverless Framework CLI (v3) (`npm install -g serverless@3`)
- AWS CLI (configured with your AWS credentials)

## Project Structure

The project is structured as follows:

```
health-hub-backend/
├── .serverless/
├── node_modules/
├── src/
│   └── services/
│       ├── ai-interaction-service/
│       ├── appointment-service/
│       ├── doctor-service/
│       ├── medical-image-service/
│       ├── patient-service/
│       ├── transcription-service/
│       └── user-service/
├── .gitignore
├── package.json
├── README.md
└── serverless-compose.yml
```

Each service in the `src/services/` directory has its own `serverless.yml` configuration.

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-org/health-hub-backend.git
   cd health-hub-backend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Install dependencies for each service:
   ```bash
   for service in src/services/*; do
     (cd "$service" && npm install)
   done
   ```

## Configuration

Each service has its own `serverless.yml` file that needs to be configured with the appropriate environment variables and credentials. Here are the specific requirements for each service:

### AI Interaction Service

In the `src/services/ai-interaction-service/serverless.yml` file, add the following environment variables:

```yaml
environment:
  OPEN_AI_KEY: "sk-your-openai-key"
  ASSISTANT_ID: "your-assistant-id"
```

Make sure to replace `"sk-your-openai-key"` with your actual OpenAI API key and `"your-assistant-id"` with the pre-created OpenAI Assistant ID.

### Medical Image Service

1. Enable the Cloud Vision API in the Google Cloud Console for your project.

2. Generate a service account key (JSON) with permissions to access the Cloud Vision API.

3. Save the JSON key file as `google-credentials.json` in the `src/services/medical-image-service/` directory.

### Transcription Service

In the `src/services/transcription-service/serverless.yml` file, add the Azure Speech Service credentials:

```yaml
environment:
  AZURE_SPEECH_KEY: "your-azure-speech-key"
  AZURE_SPEECH_REGION: "your-azure-speech-region"
```

Replace `"your-azure-speech-key"` and `"your-azure-speech-region"` with your actual Azure Speech Service key and region.

## Deployment

Before deploying, ensure that all the necessary credentials and environment variables are properly set in each service's `serverless.yml` file.

To deploy all services:

```bash
npm run deploy
```

## Service-Specific Notes

### AI Interaction Service

- Uses OpenAI for natural language processing
- Integrates with text-to-speech capabilities
- Interacts with doctor and appointment data stored in DynamoDB tables

### Medical Image Service

- Utilizes Google Cloud Vision API for image analysis
- Requires proper setup of Google Cloud credentials

### Transcription Service

- Leverages Azure Speech Service for speech-to-text functionality
- Needs Azure credentials properly configured

### Other Services

- appointment-service: Manages appointment scheduling and retrieval
- doctor-service: Handles doctor-related operations
- patient-service: Manages patient information and records
- user-service: Handles user authentication and profile management

Each of these services should have their specific configurations in their respective `serverless.yml` files.

## Security Notes

- Never commit sensitive information like API keys or credential files to version control.
- For production deployments, consider using AWS Secrets Manager or Parameter Store to securely manage your credentials and API keys.
- Ensure that the `google-credentials.json` file is added to your `.gitignore` to prevent accidental commits.
- Regularly rotate your API keys and update them in your serverless configurations.
- Implement proper IAM roles and policies to restrict access to AWS resources.

Remember to keep your API keys and sensitive information secure. Use AWS Parameter Store or Secrets Manager for managing secrets in production environments.
