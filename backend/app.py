# app.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import asyncio
import logging
import time

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("youtube-title-fixer")

app = FastAPI(title="YouTube Title Fixer")

# Allow CORS for the Chrome extension
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, you should restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache to avoid reprocessing the same titles
title_cache = {}
# Cache TTL (24 hours)
CACHE_TTL = 86400

class TitleRequest(BaseModel):
    title: str
    model: str = "llama3:8b"  # Default to llama3:8b as it's a good balance of speed and quality

class TitleResponse(BaseModel):
    original: str
    factual: str
    processing_time: float

def create_prompt(title):
    return f"""You are a tool that transforms clickbait YouTube titles into more factual, straightforward titles.
    
Original title: "{title}"

Your task is to:
1. Remove exaggerated language, emotional manipulation, and excessive punctuation
2. Make the title accurate and descriptive of the actual content
3. Preserve the main topic but state it neutrally
4. Don't make it boring - keep it informative but engaging
5. Keep a similar length to the original title
6. Don't use quotes in the rewritten title

Reply with ONLY the rewritten factual title text without any quotes or explanations.
"""

async def generate_factual_title(title, model):
    """Call Ollama API to generate a factual title"""
    start_time = time.time()
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": model,
                    "prompt": create_prompt(title),
                    "stream": False,
                    "options": {
                        "temperature": 0.1,  # Low temperature for more factual output
                        "num_predict": 100,  # Limit token generation
                    }
                }
            )
            
            if response.status_code != 200:
                logger.error(f"Ollama API error: {response.status_code} - {response.text}")
                raise HTTPException(status_code=500, detail="Error communicating with Ollama")
                
            result = response.json()
            factual_title = result["response"].strip()
            
            # Remove any quotes if they still appear
            factual_title = factual_title.replace('"', '').replace("'", "")
            
            processing_time = time.time() - start_time
            
            return factual_title, processing_time
            
    except httpx.RequestError as e:
        logger.error(f"Error calling Ollama: {str(e)}")
        raise HTTPException(status_code=500, detail="Error connecting to Ollama. Is it running?")

@app.post("/fix-title", response_model=TitleResponse)
async def fix_title(request: TitleRequest):
    """Fix a clickbait YouTube title"""
    title = request.title.strip()
    model = request.model
    
    # Check cache first
    cache_key = f"{title}:{model}"
    if cache_key in title_cache:
        cached_result, cache_time = title_cache[cache_key]
        
        # Check if cache entry is still valid
        if time.time() - cache_time < CACHE_TTL:
            factual_title, processing_time = cached_result
            return {
                "original": title,
                "factual": factual_title,
                "processing_time": processing_time
            }
    
    # Not in cache or expired, generate new title
    factual_title, processing_time = await generate_factual_title(title, model)
    
    # Store in cache
    title_cache[cache_key] = ((factual_title, processing_time), time.time())
    
    return {
        "original": title,
        "factual": factual_title,
        "processing_time": processing_time
    }

# First, define the categories and their corresponding colors
CATEGORIES = {
    "Education & How-To": "#3498db",  # Blue
    "Entertainment & Comedy": "#e74c3c",  # Red
    "Vlogging & Lifestyle": "#9b59b6",  # Purple
    "Tech & Reviews": "#2ecc71",  # Green
    "Gaming": "#f39c12",  # Orange
    "Fitness & Health": "#1abc9c",  # Teal
    "Finance & Business": "#f1c40f",  # Yellow
    "News & Commentary": "#34495e",  # Dark Blue
    "Food & Cooking": "#27ae60",  # Dark Green
    "Art & Creativity": "#e67e22",  # Dark Orange
}

class CategoryRequest(BaseModel):
    title: str
    model: str = "llama3:8b"

class CategoryResponse(BaseModel):
    title: str
    category: str
    color: str
    processing_time: float

def create_classification_prompt(title):
    return f"""Classify this YouTube video title into EXACTLY ONE of these categories based on the likely content:

1. Education & How-To – Tutorials, explainers, study tips, DIY projects, coding lessons, science experiments.
2. Entertainment & Comedy – Skits, stand-up comedy, memes, parodies, reaction videos.
3. Vlogging & Lifestyle – Daily vlogs, travel diaries, minimalism, home organization, self-improvement.
4. Tech & Reviews – Unboxings, product reviews, comparisons, software tutorials, gadget breakdowns.
5. Gaming – Let's Plays, game reviews, walkthroughs, speedruns, game lore analysis.
6. Fitness & Health – Workouts, nutrition tips, mental health advice, yoga, biohacking.
7. Finance & Business – Investing tips, personal finance advice, side hustles, entrepreneurship insights.
8. News & Commentary – Political analysis, tech news, cultural commentary, investigative reporting.
9. Food & Cooking – Recipes, cooking techniques, food challenges, restaurant reviews.
10. Art & Creativity – Drawing tutorials, music production, filmmaking tips, crafts, photography.

YouTube title: "{title}"

Think through your reasoning. The title is the single most important signal for classification.

Reply with ONLY the category name from the provided list, exactly as written above. Do not include any explanations.
"""

@app.post("/classify-title", response_model=CategoryResponse)
async def classify_title(request: CategoryRequest):
    """Classify a YouTube video title into one of 10 predefined categories"""
    title = request.title.strip()
    model = request.model
    
    # Check cache first (optional but recommended for performance)
    cache_key = f"category_{title}:{model}"
    cached_result = title_cache.get(cache_key)
    if cached_result:
        cached_data, cache_time = cached_result
        if time.time() - cache_time < CACHE_TTL:
            return cached_data
    
    try:
        start_time = time.time()
        
        # Call Ollama to classify the title
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": model,
                    "prompt": create_classification_prompt(title),
                    "stream": False,
                    "options": {
                        "temperature": 0.1,  # Low temperature for more consistent categories
                    }
                }
            )
            
            if response.status_code != 200:
                logger.error(f"Ollama API error: {response.status_code} - {response.text}")
                raise HTTPException(status_code=500, detail="Error communicating with Ollama")
                
            result = response.json()
            category_text = result["response"].strip()
            
            # Find the best matching category (in case LLM output isn't exact)
            category = None
            for cat in CATEGORIES.keys():
                if cat.lower() in category_text.lower():
                    category = cat
                    break
            
            # If no match found, use a default
            if not category:
                # Try to match with just the main category part (before the dash)
                for cat in CATEGORIES.keys():
                    main_cat = cat.split('–')[0].strip()
                    if main_cat.lower() in category_text.lower():
                        category = cat
                        break
            
            # Still no match? Use first category as default
            if not category:
                category = list(CATEGORIES.keys())[0]
            
            color = CATEGORIES[category]
            processing_time = time.time() - start_time
            
            result = {
                "title": title,
                "category": category,
                "color": color,
                "processing_time": processing_time
            }
            
            # Store in cache
            title_cache[cache_key] = (result, time.time())
            
            return result
            
    except Exception as e:
        logger.error(f"Error classifying title: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error classifying title: {str(e)}")

@app.get("/models")
async def list_models():
    """List available Ollama models"""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get("http://localhost:11434/api/tags")
            
            if response.status_code != 200:
                logger.error(f"Ollama API error: {response.status_code} - {response.text}")
                raise HTTPException(status_code=500, detail="Error communicating with Ollama")
                
            models = response.json()
            # Extract model names and sort by name
            model_names = [model["name"] for model in models["models"]]
            recommended_models = ["llama3:8b", "phi3:mini", "mistral:7b-instruct-v0.2", "gemma:7b-instruct"]
            
            # Put recommended models first if they exist in the list
            sorted_models = [m for m in recommended_models if m in model_names]
            sorted_models += [m for m in model_names if m not in recommended_models]
            
            return {"models": sorted_models}
            
    except httpx.RequestError as e:
        logger.error(f"Error calling Ollama: {str(e)}")
        raise HTTPException(status_code=500, detail="Error connecting to Ollama. Is it running?")

@app.get("/health")
async def health_check():
    """Check if the service is healthy and Ollama is available"""
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get("http://localhost:11434/api/version")
            
            if response.status_code != 200:
                return {"status": "unhealthy", "ollama": "unavailable"}
                
            version = response.json()
            return {
                "status": "healthy",
                "ollama": {
                    "status": "available",
                    "version": version.get("version", "unknown")
                }
            }
            
    except httpx.RequestError:
        return {"status": "unhealthy", "ollama": "unavailable"}

if __name__ == "__main__":
    import uvicorn
    logger.info("Starting YouTube Title Fixer Backend")
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)