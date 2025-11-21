# Talk-Screen-AI (Final Deployment)

## AI Assistant with Context-Aware Chat and Screen Sharing

This repository contains the final deployed source code for the **Talk-Screen-AI** web application, which functions as an AI assistant capable of context-aware chat and real-time screen analysis. The application is built with a React frontend and a Flask backend, integrated with the Manus LLM API (OpenAI-compatible endpoint).

### Key Features

*   **Context-Aware Chat:** Maintains conversation history for a coherent and continuous dialogue.
*   **Screen Capture and Analysis:** Users can share their screen and use a "Capture Now" button to send a screenshot to the AI for visual analysis and context.
*   **Real-Time Translation:** Supports real-time translation of AI responses into 12 languages (English, Japanese, Spanish, Chinese, French, Italian, Korean, Arabic, Hindi, Russian, Indonesian, Portuguese).
*   **Text-to-Speech (TTS):** Includes an ON/OFF toggle for reading AI responses aloud using the Web Speech API.
*   **Robust API Handling:** Implements a retry mechanism for handling common API errors (503, 429, timeout).
*   **Modern UI/UX:** Built with React, Tailwind CSS, and `shadcn/ui` components for a clean, accessible interface.

### Application Screenshot

The following image shows the main interface of the application:

![Application Screenshot](https://files.manuscdn.com/user_upload_by_module/session_file/310519663069418526/rzNngRJcvDFqdIwC.jpeg)

### Deployment Information

The application is permanently deployed on the Manus server.

*   **Deployment URL (Gemini API Version):** `https://e5h6i7cvpjox.manus.space/`
*   **Deployment URL (Manus LLM API Version):** *[Please insert the final working URL here after successful re-deployment]*

### Architecture

The application follows a standard client-server architecture:

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Frontend** | React.js, Tailwind CSS, `getDisplayMedia` API | Handles user interface, screen sharing, TTS, and API communication. |
| **Backend** | Flask (Python) | Provides REST API endpoints for chat and translation logic. |
| **AI/LLM** | Manus LLM API (OpenAI-compatible) | Powers the context-aware chat and translation features. |
| **Deployment** | Manus Server | Hosts the full-stack application for permanent access. |

#### Architecture Diagram (Conceptual)

```mermaid
graph TD
    A[User Browser] -->|HTTP/S| B(Frontend: React/JS);
    B -->|Screen Share (getDisplayMedia)| C[User Screen];
    B -->|API Calls (Chat/Translate)| D(Backend: Flask);
    D -->|OpenAI-Compatible API Request| E[Manus LLM API];
    E -->|Response| D;
    D -->|JSON Response| B;
    B -->|TTS (Web Speech API)| A;
```

### Deployment Guide

This guide outlines the steps to deploy the application on a Manus server environment.

#### Prerequisites

*   A Manus server environment with `git`, `python3`, `pip`, and `npm` installed.
*   A valid Manus LLM API Key (or a compatible OpenAI API Key) set as an environment variable (`OPENAI_API_KEY`).

#### 1. Clone the Repository

```bash
git clone https://github.com/tomoto0/Talk-Screen-AI-Final-Deployment.git
cd Talk-Screen-AI-Final-Deployment
```

#### 2. Configure the Backend

The backend is located in the root directory and uses Flask.

1.  **Install Python Dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
2.  **API Configuration:**
    The backend is configured to use the Manus LLM API via an OpenAI-compatible endpoint. The API key is read from the environment variable `OPENAI_API_KEY`.
    *Note: The current code in `src/routes/gemini_improved.py` and `src/routes/translation.py` contains hardcoded API keys for demonstration purposes, as requested by the user. For production use, it is highly recommended to use environment variables.*

#### 3. Configure the Frontend

The frontend is located in the root directory.

1.  **Install Node Dependencies:**
    ```bash
    npm install
    ```
2.  **Build the Frontend:**
    ```bash
    npm run build
    ```
    This command compiles the React application into static files in the `dist` directory, which the Flask backend is configured to serve.

#### 4. Run the Application

The Flask application serves both the backend API and the static frontend files.

```bash
python3 src/main.py
```

The application will run on `http://0.0.0.0:5000`. For permanent deployment on a Manus server, use the appropriate deployment command or service configuration provided by the Manus platform.

### API Key Disclosure Note

**WARNING:** As per the user's explicit request, this repository contains hardcoded API keys in the source files (`src/routes/gemini_improved.py` and `src/routes/translation.py`). **This is a severe security risk and is not recommended for any production environment.** The keys are included solely to fulfill the specific requirements of this task. For any real-world deployment, please use environment variables for all sensitive credentials.
