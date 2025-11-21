import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Monitor, MonitorOff, Send, Play, Loader2, Camera, Trash2, Image, Languages, Globe, AlertCircle, RefreshCw, Volume2, VolumeX } from 'lucide-react'
import './App.css';

const API_BASE_URL = window.location.origin;

// Supported languages for translation
const SUPPORTED_LANGUAGES = {
  'en': 'English',
  'ja': 'Japanese',
  'es': 'Spanish',
  'zh': 'Chinese',
  'fr': 'French',
  'it': 'Italian',
  'ko': 'Korean',
  'ar': 'Arabic',
  'hi': 'Hindi',
  'ru': 'Russian',
  'id': 'Indonesian',
  'pt': 'Portuguese'
};

// Language codes for Speech Synthesis
const SPEECH_LANGUAGE_CODES = {
  'en': 'en-US',
  'ja': 'ja-JP',
  'es': 'es-ES',
  'zh': 'zh-CN',
  'fr': 'fr-FR',
  'it': 'it-IT',
  'ko': 'ko-KR',
  'ar': 'ar-SA',
  'hi': 'hi-IN',
  'ru': 'ru-RU',
  'id': 'id-ID',
  'pt': 'pt-BR'
};

// Custom components for ReactMarkdown to handle styling
const MarkdownComponents = {
  p: ({ children }) => <p className="mb-2">{children}</p>,
  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="ml-2">{children}</li>,
  h1: ({ children }) => <h1 className="text-lg font-bold mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-base font-bold mb-2">{children}</h2>,
  h3: ({ children }) => <h3 className="text-sm font-bold mb-1">{children}</h3>,
  code: ({ children, inline }) => 
    inline ? 
      <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">{children}</code> :
      <pre className="bg-gray-100 p-2 rounded text-sm font-mono overflow-x-auto mb-2"><code>{children}</code></pre>,
  blockquote: ({ children }) => <blockquote className="border-l-4 border-gray-300 pl-4 italic mb-2">{children}</blockquote>
};

function App() {
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [lastError, setLastError] = useState(null);
  
  // Translation states
  const [translationEnabled, setTranslationEnabled] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('ja');
  const [translations, setTranslations] = useState([]);
  const [isTranslating, setIsTranslating] = useState(false);
  
  // Speech synthesis states
  const [speechEnabled, setSpeechEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  
  const messagesEndRef = useRef(null);
  const translationsEndRef = useRef(null);
  const textareaRef = useRef(null);
  const speechSynthRef = useRef(null);
  const lastTranslationIdRef = useRef(null);

  // Initialize speech synthesis
  useEffect(() => {
    if ('speechSynthesis' in window) {
      setSpeechSupported(true);
      speechSynthRef.current = window.speechSynthesis;
      
      // Load available voices
      const loadVoices = () => {
        const voices = speechSynthRef.current.getVoices();
        setAvailableVoices(voices);
      };
      
      loadVoices();
      speechSynthRef.current.onvoiceschanged = loadVoices;
      
      // Cleanup on unmount
      return () => {
        if (speechSynthRef.current) {
          speechSynthRef.current.cancel();
        }
      };
    }
  }, []);

  // Monitor translations for speech synthesis
  useEffect(() => {
    if (speechEnabled && translationEnabled && translations.length > 0) {
      const latestTranslation = translations[translations.length - 1];
      
      // Only speak if this is a new translation
      if (latestTranslation.id !== lastTranslationIdRef.current) {
        lastTranslationIdRef.current = latestTranslation.id;
        speakText(latestTranslation.translated, selectedLanguage);
      }
    }
  }, [translations, speechEnabled, translationEnabled, selectedLanguage]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const scrollTranslationsToBottom = () => {
    translationsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    scrollTranslationsToBottom();
  }, [translations]);

  const speakText = (text, languageCode) => {
    if (!speechSupported || !speechSynthRef.current || !text.trim()) {
      return;
    }

    // Cancel any ongoing speech
    speechSynthRef.current.cancel();

    // Clean text for speech (remove markdown and special characters)
    const cleanText = text
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold markdown
      .replace(/\*([^*]+)\*/g, '$1')     // Remove italic markdown
      .replace(/`([^`]+)`/g, '$1')       // Remove code markdown
      .replace(/#{1,6}\s/g, '')          // Remove headers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links, keep text
      .replace(/\n+/g, ' ')              // Replace newlines with spaces
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Set language
    const speechLangCode = SPEECH_LANGUAGE_CODES[languageCode] || 'en-US';
    utterance.lang = speechLangCode;
    
    // Find appropriate voice for the language
    const preferredVoice = availableVoices.find(voice => 
      voice.lang.startsWith(speechLangCode.split('-')[0])
    );
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }
    
    // Set speech parameters for faster reading
    utterance.rate = 1.3;  // Slightly faster than normal
    utterance.pitch = 1.0;
    utterance.volume = 0.8;
    
    // Event handlers
    utterance.onstart = () => {
      setIsSpeaking(true);
    };
    
    utterance.onend = () => {
      setIsSpeaking(false);
    };
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event.error);
      setIsSpeaking(false);
    };
    
    // Speak the text
    speechSynthRef.current.speak(utterance);
  };

  const toggleSpeech = () => {
    if (speechEnabled && isSpeaking) {
      // Stop current speech
      speechSynthRef.current?.cancel();
      setIsSpeaking(false);
    }
    setSpeechEnabled(!speechEnabled);
  };

  const startSession = () => {
    setSessionActive(true);
    setMessages([]);
    setTranslations([]);
    setCapturedImage(null);
    setLastError(null);
    lastTranslationIdRef.current = null;
  };

  const clearContext = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/gemini/clear-context`, {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        setMessages([]);
        setTranslations([]);
        setSessionId('');
        setCapturedImage(null);
        setLastError(null);
        lastTranslationIdRef.current = null;
        
        // Stop any ongoing speech
        if (speechSynthRef.current) {
          speechSynthRef.current.cancel();
          setIsSpeaking(false);
        }
      }
    } catch (error) {
      console.error('Error clearing context:', error);
      setLastError('Failed to clear context');
    }
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });
      
      setScreenStream(stream);
      setIsScreenSharing(true);
      
      // Handle stream end
      stream.getVideoTracks()[0].onended = () => {
        setIsScreenSharing(false);
        setScreenStream(null);
        setCapturedImage(null);
      };
    } catch (error) {
      console.error('Error starting screen share:', error);
      setLastError('Failed to start screen sharing. Please make sure you grant permission.');
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
      setCapturedImage(null);
    }
  };

  const captureScreen = async () => {
    if (!screenStream) {
      setLastError('Please start screen sharing first');
      return null;
    }

    try {
      const video = document.createElement('video');
      video.srcObject = screenStream;
      video.play();

      return new Promise((resolve) => {
        video.onloadedmetadata = () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0);
          
          canvas.toBlob((blob) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const base64data = reader.result.split(',')[1];
              resolve(base64data);
            };
            reader.readAsDataURL(blob);
          }, 'image/jpeg', 0.8);
        };
      });
    } catch (error) {
      console.error('Error capturing screen:', error);
      setLastError('Failed to capture screen');
      return null;
    }
  };

  const handleCaptureClick = async () => {
    if (!isScreenSharing) {
      setLastError('Please start screen sharing first');
      return;
    }

    const imageData = await captureScreen();
    if (imageData) {
      setCapturedImage(imageData);
      setLastError(null);
    }
  };

  const translateText = async (text, conversationContext) => {
    if (!translationEnabled || !text.trim()) {
      return;
    }

    setIsTranslating(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/translation/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          text: text,
          target_language: selectedLanguage,
          conversation_context: conversationContext
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          const newTranslation = {
            id: Date.now(),
            original: result.original_text,
            translated: result.translated_text,
            language: result.language_name,
            timestamp: new Date().toLocaleTimeString()
          };
          
          setTranslations(prev => [...prev, newTranslation]);
        }
      } else {
        console.error('Translation failed:', response.statusText);
      }
    } catch (error) {
      console.error('Error translating text:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  const sendMessage = async () => {
    if ((!inputText.trim() && !capturedImage) || isLoading) return;

    setIsLoading(true);
    setLastError(null);

    const userMessage = inputText.trim() || '[Screen capture shared]';
    const displayMessage = capturedImage && inputText.trim() 
      ? `${inputText.trim()} [with screen capture]` 
      : userMessage;

    // Add user message to chat
    const newUserMessage = {
      id: Date.now(),
      role: 'user',
      content: displayMessage,
      timestamp: new Date().toLocaleTimeString(),
      hasImage: !!capturedImage
    };

    setMessages(prev => [...prev, newUserMessage]);
    const currentInputText = inputText.trim();
    const currentCapturedImage = capturedImage;
    setInputText('');
    setCapturedImage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/gemini/chat-with-context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          text: currentInputText,
          image: currentCapturedImage
        })
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          const aiMessage = {
            id: Date.now() + 1,
            role: 'assistant',
            content: result.response,
            timestamp: new Date().toLocaleTimeString()
          };

          setMessages(prev => [...prev, aiMessage]);
          setSessionId(result.session_id);

          // Trigger translation for AI response
          if (translationEnabled) {
            // Get recent conversation context for translation
            const recentMessages = [...messages, newUserMessage].slice(-6); // Last 3 exchanges
            await translateText(result.response, recentMessages);
          }
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } else {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      let errorMessage = error.message;
      let isRetryable = false;
      
      // Handle specific error types
      if (error.message.includes('503')) {
        errorMessage = 'AI service is temporarily unavailable. This usually resolves quickly.';
        isRetryable = true;
      } else if (error.message.includes('429')) {
        errorMessage = 'Rate limit exceeded. Please wait a moment before trying again.';
        isRetryable = true;
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again.';
        isRetryable = true;
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Network connection failed. Please check your internet connection.';
        isRetryable = true;
      }
      
      const errorMessageObj = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `Error: ${errorMessage}`,
        timestamp: new Date().toLocaleTimeString(),
        isError: true,
        isRetryable: isRetryable
      };
      
      setMessages(prev => [...prev, errorMessageObj]);
      setLastError(errorMessage);
      
      // Restore input if it was an error
      if (isRetryable) {
        setInputText(currentInputText);
        setCapturedImage(currentCapturedImage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const retryLastMessage = () => {
    // Remove the last error message and retry
    setMessages(prev => {
      const newMessages = [...prev];
      if (newMessages.length > 0 && newMessages[newMessages.length - 1].isError) {
        newMessages.pop();
      }
      return newMessages;
    });
    
    sendMessage();
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const toggleTranslation = () => {
    setTranslationEnabled(!translationEnabled);
    if (!translationEnabled) {
      setTranslations([]); // Clear translations when enabling
      lastTranslationIdRef.current = null;
    } else {
      // Stop speech when disabling translation
      if (speechSynthRef.current) {
        speechSynthRef.current.cancel();
        setIsSpeaking(false);
      }
    }
  };

  const clearTranslations = () => {
    setTranslations([]);
    lastTranslationIdRef.current = null;
    
    // Stop any ongoing speech
    if (speechSynthRef.current) {
      speechSynthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const removeCapturedImage = () => {
    setCapturedImage(null);
  };

  const dismissError = () => {
    setLastError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Error Banner */}
        {lastError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle size={16} className="text-red-600" />
              <span className="text-sm text-red-800">{lastError}</span>
            </div>
            <Button
              onClick={dismissError}
              size="sm"
              variant="ghost"
              className="text-red-600 hover:bg-red-100"
            >
              ×
            </Button>
          </div>
        )}

        {/* Header */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center text-indigo-800">
              Talk-Screen-AI
            </CardTitle>
            <p className="text-center text-gray-600 mb-4">
              AI Assistant with Context-Aware Chat and Screen Sharing
            </p>
          </CardHeader>
          <CardContent>
            {!sessionActive ? (
              <div className="text-center">
                <div className="inline-block bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm mb-4">
                  Ready to start session
                </div>
                <div>
                  <Button
                    onClick={startSession}
                    className="bg-indigo-600 hover:bg-indigo-700 flex items-center space-x-2"
                  >
                    <Play size={20} />
                    <span>Start AI Session</span>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-center items-center space-x-4">
                  <div className="inline-block bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                    AI Session Active
                  </div>
                  {sessionId && (
                    <div className="inline-block bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                      Session: {sessionId.split('_')[1]}
                    </div>
                  )}
                </div>
                
                <div className="flex justify-center space-x-4">
                  {!isScreenSharing ? (
                    <Button
                      onClick={startScreenShare}
                      className="bg-green-600 hover:bg-green-700 flex items-center space-x-2"
                    >
                      <Monitor size={20} />
                      <span>Share Screen with AI</span>
                    </Button>
                  ) : (
                    <Button
                      onClick={stopScreenShare}
                      variant="destructive"
                      className="flex items-center space-x-2"
                    >
                      <MonitorOff size={20} />
                      <span>Stop Screen Sharing</span>
                    </Button>
                  )}
                  
                  <Button
                    onClick={clearContext}
                    variant="outline"
                    className="flex items-center space-x-2"
                  >
                    <Trash2 size={16} />
                    <span>Clear Context</span>
                  </Button>
                </div>

                {isScreenSharing && (
                  <div className="text-center text-green-600 text-sm">
                    Screen sharing active - Use capture button to take screenshots
                  </div>
                )}

                {/* Captured Image Preview */}
                {capturedImage && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Image size={16} className="text-green-600" />
                        <span className="text-sm font-medium text-green-800">Screen captured!</span>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          onClick={removeCapturedImage}
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-green-600 mt-1">
                      💡 Add your question or comment about the image, then click Send
                    </p>
                  </div>
                )}

                {/* Input Area */}
                <div className="relative">
                  <div className="flex space-x-2">
                    <div className="flex-1 relative">
                      <label htmlFor="message-input" className="sr-only">
                        Type a message to the AI
                      </label>
                      <textarea
                        id="message-input"
                        name="message"
                        ref={textareaRef}
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type a message to the AI... (Press Enter to send)"
                        className="w-full px-3 py-2 pr-20 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        rows="2"
                        disabled={isLoading}
                        autoComplete="off"
                      />
                      {isScreenSharing && (
                        <Button
                          onClick={handleCaptureClick}
                          size="sm"
                          variant="outline"
                          className="absolute right-2 top-2 flex items-center space-x-1"
                          disabled={isLoading}
                          type="button"
                        >
                          <Camera size={16} />
                          <span className="hidden sm:inline">Capture</span>
                        </Button>
                      )}
                    </div>
                    <Button 
                      onClick={sendMessage} 
                      className="flex items-center space-x-2"
                      disabled={isLoading || (!inputText.trim() && !capturedImage)}
                      type="button"
                    >
                      {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                      <span>Send</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Main Content Area */}
        {sessionActive && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chat Window */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Conversation with AI</span>
                  {messages.length > 0 && (
                    <span className="text-sm font-normal text-gray-500">
                      {messages.length} messages
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-96 overflow-y-auto space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <p>No messages yet. Start a conversation with the AI!</p>
                      <p className="text-sm mt-2">💡 Share your screen and use the capture button to ask about what you see!</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`p-3 rounded-lg ${
                          message.role === 'user'
                            ? 'bg-indigo-100 ml-8'
                            : message.isError
                            ? 'bg-red-100 mr-8'
                            : 'bg-gray-100 mr-8'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-sm">
                              {message.role === 'user' ? 'You' : 'AI Assistant'}
                            </span>
                            {message.hasImage && (
                              <Image size={14} className="text-blue-600" />
                            )}
                            {message.isError && (
                              <AlertCircle size={14} className="text-red-600" />
                            )}
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-500">{message.timestamp}</span>
                            {message.isError && message.isRetryable && (
                              <Button
                                onClick={retryLastMessage}
                                size="sm"
                                variant="ghost"
                                className="text-blue-600 hover:bg-blue-50 p-1"
                                disabled={isLoading}
                                type="button"
                              >
                                <RefreshCw size={12} />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="text-sm">
                          {message.role === 'assistant' && !message.isError ? (
                            <ReactMarkdown components={MarkdownComponents}>
                              {message.content}
                            </ReactMarkdown>
                          ) : (
                            <div className="whitespace-pre-wrap">{message.content}</div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {isLoading && (
                    <div className="flex justify-center items-center py-4">
                      <Loader2 className="animate-spin mr-2" size={20} />
                      <span className="text-gray-500">AI is thinking...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </CardContent>
            </Card>

            {/* Translation Window */}
            <Card>
              <CardHeader>
                <CardTitle className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <Languages size={20} />
                    <span>Live Translation</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      onClick={toggleTranslation}
                      size="sm"
                      variant={translationEnabled ? "default" : "outline"}
                      className={`${
                        translationEnabled
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'text-gray-600'
                      }`}
                      type="button"
                    >
                      {translationEnabled ? '🟢 ON' : '⚪ OFF'}
                    </Button>
                    
                    {/* Speech Toggle Button */}
                    {speechSupported && (
                      <Button
                        onClick={toggleSpeech}
                        size="sm"
                        variant={speechEnabled ? "default" : "outline"}
                        className={`${
                          speechEnabled
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'text-gray-600'
                        } ${!translationEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={!translationEnabled}
                        type="button"
                        title={translationEnabled ? 'Toggle speech synthesis' : 'Enable translation first'}
                      >
                        {speechEnabled ? (
                          <>
                            {isSpeaking ? <Volume2 size={16} className="animate-pulse" /> : <Volume2 size={16} />}
                            <span className="ml-1">🔊</span>
                          </>
                        ) : (
                          <>
                            <VolumeX size={16} />
                            <span className="ml-1">🔇</span>
                          </>
                        )}
                      </Button>
                    )}
                    
                    {translations.length > 0 && (
                      <Button
                        onClick={clearTranslations}
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-300 hover:bg-red-50"
                        type="button"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </CardTitle>
                
                <div className="flex items-center space-x-3">
                  <label htmlFor="language-select" className="text-sm font-medium text-gray-700 flex items-center space-x-1">
                    <Globe size={16} />
                    <span>Target Language:</span>
                  </label>
                  <select
                    id="language-select"
                    name="targetLanguage"
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="border border-gray-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    disabled={!translationEnabled}
                  >
                    {Object.entries(SUPPORTED_LANGUAGES).map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </select>
                  {isTranslating && (
                    <div className="flex items-center space-x-1 text-sm text-blue-600">
                      <Loader2 size={14} className="animate-spin" />
                      <span>Translating...</span>
                    </div>
                  )}
                  {isSpeaking && (
                    <div className="flex items-center space-x-1 text-sm text-green-600">
                      <Volume2 size={14} className="animate-pulse" />
                      <span>Speaking...</span>
                    </div>
                  )}
                </div>
                
                {/* Speech Status */}
                {speechSupported && speechEnabled && (
                  <div className="text-xs text-gray-600 mt-1">
                    🎵 Speech synthesis enabled - New translations will be read aloud
                  </div>
                )}
                {!speechSupported && (
                  <div className="text-xs text-red-600 mt-1">
                    ⚠️ Speech synthesis not supported in this browser
                  </div>
                )}
              </CardHeader>
              
              <CardContent>
                <div className="h-96 overflow-y-auto space-y-3">
                  {!translationEnabled ? (
                    <div className="text-center text-gray-500 py-8">
                      <Languages size={48} className="mx-auto mb-4 text-gray-300" />
                      <p>Translation is disabled</p>
                      <p className="text-sm mt-2">Enable translation to see AI responses in your selected language</p>
                    </div>
                  ) : translations.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <Globe size={48} className="mx-auto mb-4 text-gray-300" />
                      <p>No translations yet</p>
                      <p className="text-sm mt-2">AI responses will be automatically translated to {SUPPORTED_LANGUAGES[selectedLanguage]}</p>
                      {speechEnabled && (
                        <p className="text-xs text-blue-600 mt-1">🎵 Speech synthesis is enabled</p>
                      )}
                    </div>
                  ) : (
                    translations.map((translation) => (
                      <div key={translation.id} className="border border-gray-200 rounded-lg p-3 bg-gradient-to-r from-blue-50 to-indigo-50">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-medium text-indigo-600 flex items-center space-x-1">
                            <Languages size={12} />
                            <span>Translated to {translation.language}</span>
                            {speechEnabled && translation.id === translations[translations.length - 1]?.id && (
                              <Volume2 size={12} className="text-green-600" />
                            )}
                          </span>
                          <span className="text-xs text-gray-500">{translation.timestamp}</span>
                        </div>
                        <div className="text-sm text-gray-800 mb-2 font-medium">
                          <ReactMarkdown components={MarkdownComponents}>
                            {translation.translated}
                          </ReactMarkdown>
                        </div>
                        <div className="text-xs text-gray-500 border-t pt-2">
                          <strong>Original:</strong> {translation.original}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={translationsEndRef} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

