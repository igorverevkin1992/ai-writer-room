
# ✍️ Virtual Writers Room v2.0

A professional-grade desktop tool for fiction writers, powered by Google Gemini AI. This application features a multi-agent system to help you plan, write, and maintain continuity in your stories.

## 🚀 Features

- **Project Bible**: Manage story summaries, characters, and locations in one place.
- **AI Agents**:
  - **Planner**: Generates detailed beat sheets from rough ideas.
  - **Writer**: Drafts vivid prose based on your plans.
  - **Continuity**: Checks your scenes against the Project Bible for inconsistencies.
  - **Editor**: Refines style and dialogue based on your instructions.
  - **Visualizer**: Creates concept art using Gemini 2.5 Flash Image.
- **Read Aloud**: Integrated TTS to hear your prose as it's written.
- **Docker Ready**: Easy setup with containerization.

## 🛠 Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/virtual-writers-room.git
   cd virtual-writers-room
   ```

2. **Configure API Key**:
   Create a `.env` file in the root directory:
   ```env
   VITE_GEMINI_API_KEY=your_api_key_here
   ```

3. **Run with Docker**:
   ```bash
   docker-compose up --build
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

## 📦 Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **AI**: @google/genai (Gemini 3 Flash & 2.5 Flash Image)
- **Environment**: Vite + Docker
