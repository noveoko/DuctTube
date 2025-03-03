# YouTube Title Fixer Backend

This is a Python backend service that uses Ollama to transform clickbait YouTube titles into more factual, straightforward ones. It's designed to be used with the YouTube Focus Chrome extension.

## Features

- FastAPI server with async processing for better performance
- Uses Ollama for high-quality title transformations
- Caching to avoid reprocessing the same titles
- Configurable model selection (llama3:8b recommended for speed/quality balance)
- Docker support for easy deployment

## Requirements

- Python 3.8+
- Ollama installed locally (or running in Docker)
- A compatible Ollama model (llama3:8b recommended)

## Quick Start

### Using Python directly

1. Install the required packages:
   ```bash
   pip install -r requirements.txt
   ```

2. Make sure Ollama is running and has the models downloaded:
   ```bash
   ollama pull llama3:8b
   ```

3. Start the server:
   ```bash
   python app.py
   ```

The server will be available at http://localhost:8000.

### Using Docker

1. Make sure Docker and Docker Compose are installed.

2. Run the setup script:
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

This will:
- Pull the necessary Docker images
- Download the Llama3:8b model
- Start the Ollama server and the YouTube Title Fixer backend

## API Endpoints

- `POST /fix-title`: Transform a clickbait title to a factual one
- `GET /models`: List available Ollama models
- `GET /health`: Check if the service and Ollama are available

## Integration with YouTube Focus Extension

1. In the extension popup, check "Use Ollama for advanced de-clickbaiting"
2. Set Ollama endpoint to "http://localhost:8000"
3. Select a model (e.g., "llama3:8b")
4. Save settings

Now the extension will send YouTube titles to your local backend for processing.

## Model Recommendations

- **llama3:8b**: Best balance of speed and quality
- **phi3:mini**: Fast with good results
- **mistral:7b-instruct-v0.2**: Good quality
- **gemma:7b-instruct**: Good quality

## Sample Request

```bash
curl -X POST http://localhost:8000/fix-title \
  -H "Content-Type: application/json" \
  -d '{"title": "YOU WON'T BELIEVE What Happened When I Tried THIS INSANE Life Hack!!!", "model": "llama3:8b"}'
```

Response:
```json
{
  "original": "YOU WON'T BELIEVE What Happened When I Tried THIS INSANE Life Hack!!!",
  "factual": "Testing a Popular DIY Life Hack: My Results and Experience",
  "processing_time": 0.8765
}
```

## Performance Considerations

- The first request may be slow as the model loads into memory
- Subsequent requests will be faster due to both model caching and title caching
- For production use with many users, consider using a more powerful machine

## Troubleshooting

- If you get connection errors, make sure Ollama is running
- For "model not found" errors, download the model with `ollama pull <model-name>`
- Check the logs for detailed error messages