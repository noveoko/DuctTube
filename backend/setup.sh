#!/bin/bash

echo "Setting up YouTube Title Fixer with Ollama"

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    echo "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Pull the Ollama model in advance
echo "Pulling Llama3 8B model (this may take a while)..."
docker run --rm -v ollama_data:/root/.ollama ollama/ollama pull llama3:8b

# Start the services
echo "Starting services..."
docker-compose up -d

echo "Waiting for services to start..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "youtube-title-fixer.*Up"; then
    echo "YouTube Title Fixer is running!"
    echo "API is available at: http://localhost:8000"
    echo "API docs available at: http://localhost:8000/docs"
else
    echo "There was an issue starting the services. Please check the logs with:"
    echo "docker-compose logs"
    exit 1
fi

echo ""
echo "To use with the YouTube Focus Chrome extension:"
echo "1. Open the extension popup"
echo "2. Check 'Use Ollama for advanced de-clickbaiting'"
echo "3. Set Ollama endpoint to 'http://localhost:8000'"
echo "4. Select 'llama3:8b' as the model"
echo "5. Save settings"
echo ""
echo "To stop the services:"
echo "docker-compose down"