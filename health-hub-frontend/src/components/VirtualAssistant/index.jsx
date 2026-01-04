import React, { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { aiInteractionService } from "../../services/api";

const VirtualAssistant = ({ userId }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const normalizeAIResponse = (text) => {
    // Function to convert markdown-style bold to HTML bold
    const convertBoldToHtml = (str) => {
      return str.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    };

    // Check if the response contains a list of doctors
    if (text.includes("doctors available for scheduling")) {
      const lines = text.split("\n");
      let html = "<p>" + convertBoldToHtml(lines[0]) + "</p>"; // Opening sentence
      html += "<ul>";

      let currentDoctor = null;
      lines.slice(1).forEach((line) => {
        line = convertBoldToHtml(line);
        if (line.includes("<strong>Dr.")) {
          if (currentDoctor) {
            html += "</ul></li>";
          }
          currentDoctor = line.replace(/<\/?strong>/g, "").trim();
          html += `<li>${line}<ul>`;
        } else if (line.trim().startsWith("-")) {
          const [key, value] = line.split(":").map((s) => s.trim());
          html += `<li>${key}: ${value}</li>`;
        }
      });

      if (currentDoctor) {
        html += "</ul></li>";
      }
      html += "</ul>";

      // Add closing paragraph if exists
      const closingParagraph = lines.slice(-1)[0];
      if (
        !closingParagraph.includes("Dr.") &&
        !closingParagraph.startsWith("-")
      ) {
        html += "<p>" + convertBoldToHtml(closingParagraph) + "</p>";
      }

      return { __html: html };
    }

    // If no special formatting is needed, return the text with bold conversion and line breaks
    return { __html: convertBoldToHtml(text).replace(/\n/g, "<br>") };
  };

  const handleSendMessage = async () => {
    if (input.trim()) {
      const userMessage = { text: input, sender: "user" };
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setInput("");
      setIsTyping(true);

      try {
        const response = await aiInteractionService.virtualAssistant(
          updatedMessages.map((msg) => ({
            role: msg.sender === "user" ? "user" : "assistant",
            content: msg.text,
          })),
          userId
        );
        setIsTyping(false);
        const assistantMessage = {
          text: response.data.response,
          sender: "assistant",
          html: normalizeAIResponse(response.data.response),
        };
        setMessages((prevMessages) => [...prevMessages, assistantMessage]);
      } catch (error) {
        console.error("Error getting virtual assistant response:", error);
        setIsTyping(false);
        setMessages((prevMessages) => [
          ...prevMessages,
          {
            text: "Sorry, I encountered an error. Please try again.",
            sender: "assistant",
          },
        ]);
      }
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-800">Virtual Assistant</h2>
      <div className="bg-white p-4 rounded-lg shadow flex flex-col h-[calc(100vh-200px)]">
        <div className="flex-grow overflow-y-auto mb-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex items-start space-x-2 ${
                message.sender === "user" ? "justify-end" : ""
              }`}
            >
              <div
                className={`${
                  message.sender === "user" ? "bg-blue-100" : "bg-gray-100"
                } rounded-lg p-3 max-w-[80%]`}
              >
                {message.html ? (
                  <div dangerouslySetInnerHTML={message.html} />
                ) : (
                  <p>{message.text}</p>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex items-start space-x-2">
              <div className="bg-gray-100 rounded-lg p-3">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="flex space-x-2">
          <input
            type="text"
            className="flex-grow p-2 border rounded"
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
          />
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded flex items-center"
            onClick={handleSendMessage}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default VirtualAssistant;
