import React, { useState, useEffect } from "react";
import { aiInteractionService } from "../../services/api";

const MedicalRecords = ({ userId }) => {
  const [aiInteractions, setAiInteractions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // Updated to use the list endpoint with query parameters
        const [aiInteractionsResponse] = await Promise.all([
          aiInteractionService.getAIInteractions({
            params: {
              userId,
              interactionType: "speechConversion",
            },
          }),
        ]);

        setAiInteractions(aiInteractionsResponse.data);
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

  const renderAudioPlayer = (audioUrl) => {
    if (!audioUrl) return null;
    return (
      <audio className="mt-2" controls>
        <source src={audioUrl} type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Medical Records</h2>
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-2">AI Speech Interactions</h3>
        {aiInteractions.length > 0 ? (
          <ul className="space-y-4">
            {aiInteractions.map((interaction) => (
              <li key={interaction.id} className="border-b pb-4">
                <div className="flex justify-between items-start">
                  <p className="text-sm text-gray-600">
                    Date: {new Date(interaction.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="mt-2">
                  <p className="font-medium text-gray-700">Original Text:</p>
                  <p className="mt-1 text-gray-600">{interaction.content}</p>
                </div>
                {interaction && (
                  <div className="mt-2">
                    {renderAudioPlayer(interaction.audioUrl)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-600">No AI speech interactions available</p>
        )}
      </div>
    </div>
  );
};

export default MedicalRecords;
