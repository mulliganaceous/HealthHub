import React, { useState } from "react";
import { Home, VolumeX, FileText, Image } from "lucide-react";
import DoctorDashboard from "../DoctorDashboard";
import AISpeech from "../AiSpeech";
import Transcription from "../Transcription";
import ImageAnalysis from "../ImageAnalysis";
import { MenuItem } from "../SharedComponents";

const DoctorView = ({ userRole }) => {
  const [activeTab, setActiveTab] = useState("dashboard");

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <DoctorDashboard />;
      case "speech":
        return <AISpeech />;
      case "transcription":
        return <Transcription />;
      case "image":
        return <ImageAnalysis />;
      default:
        return <DoctorDashboard />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <nav className="w-64 bg-white shadow-lg p-4">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-blue-600">HealthHub</h1>
          <p className="text-sm text-gray-600">Logged in as: {userRole}</p>
        </div>
        <div className="space-y-2">
          <MenuItem
            icon={Home}
            label="Dashboard"
            active={activeTab === "dashboard"}
            onClick={() => setActiveTab("dashboard")}
          />
          <MenuItem
            icon={VolumeX}
            label="AI Speech"
            active={activeTab === "speech"}
            onClick={() => setActiveTab("speech")}
          />
          <MenuItem
            icon={FileText}
            label="Transcription"
            active={activeTab === "transcription"}
            onClick={() => setActiveTab("transcription")}
          />
          <MenuItem
            icon={Image}
            label="Image Analysis"
            active={activeTab === "image"}
            onClick={() => setActiveTab("image")}
          />
        </div>
      </nav>
      <main className="flex-grow p-6 overflow-y-auto">{renderContent()}</main>
    </div>
  );
};

export default DoctorView;
