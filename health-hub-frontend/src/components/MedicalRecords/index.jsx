import React, { useState, useEffect } from "react";
import { transcriptionService, aiInteractionService } from "../../services/api";

const MedicalRecords = ({ userId }) => {
  const [transcriptions, setTranscriptions] = useState([]);
  const [aiSpeech, setAiSpeech] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [transcriptionsResponse, aiSpeechResponse] = await Promise.all([
          transcriptionService.getTranscriptions({ patientId: userId }),
          aiInteractionService.getAIInteractions({
            params: {
              userId,
              interactionType: "speechConversion",
            },
          }),
        ]);
        setTranscriptions(transcriptionsResponse.data);
        setAiSpeech(aiSpeechResponse.data);
      } catch (error) {
        console.error("Error fetching medical records:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Medical Records</h2>

      {/* AI Speech Section */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-2">AI Speech Conversions</h3>
        {aiSpeech.length > 0 ? (
          <ul className="space-y-4">
            {aiSpeech.map((speech) => (
              <li key={speech.id} className="border-b pb-4">
                <div className="flex justify-between items-start">
                  <p className="text-sm text-gray-600">
                    Date: {new Date(speech.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="mt-2">
                  <p className="font-medium text-gray-700">Original Text:</p>
                  <p className="mt-1 text-gray-600">{speech.content}</p>
                </div>
                {speech.audioUrl && (
                  <div className="mt-2">
                    <audio controls src={speech.audioUrl}>
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600">No AI speech conversions available</p>
        )}
      </div>

      {/* Transcriptions Section */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-2">Transcriptions</h3>
        {transcriptions.length > 0 ? (
          <ul className="space-y-4">
            {transcriptions.map((transcription) => (
              <li key={transcription.id} className="border-b pb-2">
                <p className="text-sm text-gray-600">
                  Date: {new Date(transcription.createdAt).toLocaleString()}
                </p>
                <p
                  className="mt-1"
                  dangerouslySetInnerHTML={{
                    __html: transcription.content,
                  }}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600">No transcriptions available</p>
        )}
      </div>
    </div>
  );
};

export default MedicalRecords;
