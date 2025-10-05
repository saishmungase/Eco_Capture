import os
import re
import uuid
import requests
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import io
from PIL import Image
import torch
import torchvision.transforms as transforms
from torchvision import models
from torchvision.models import MobileNet_V2_Weights, ResNet50_Weights
import torch.nn.functional as F
from dotenv import load_dotenv

app = FastAPI()
load_dotenv()
gemini = os.getenv("GEMINI-API")
yt = os.getenv("YT-API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Download ImageNet labels (used to turn index -> human label)
LABELS_URL = "https://raw.githubusercontent.com/pytorch/hub/master/imagenet_classes.txt"
labels = requests.get(LABELS_URL).text.splitlines()

# Choose model: MobileNet (fast) or ResNet (accurate)
MODEL_NAME = "mobilenet_v2"
if MODEL_NAME == "mobilenet_v2":
    weights = MobileNet_V2_Weights.DEFAULT
    model = models.mobilenet_v2(weights=weights)
    preprocess = weights.transforms()
else:
    weights = ResNet50_Weights.DEFAULT
    model = models.resnet50(weights=weights)
    preprocess = weights.transforms()

model.eval()

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', gemini)
YOUTUBE_API_KEY = os.environ.get('YOUTUBE_API_KEY', yt)  # Add your YouTube API key

def search_youtube(query, max_results=3):
    """Search YouTube using YouTube Data API v3"""
    try:
        url = f"https://www.googleapis.com/youtube/v3/search"
        params = {
            'part': 'snippet',
            'type': 'video',
            'maxResults': max_results,
            'q': query,
            'key': YOUTUBE_API_KEY
        }
        
        print(f"🎥 Searching YouTube for: {query}")
        
        response = requests.get(url, params=params, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            if 'items' not in data or len(data['items']) == 0:
                print(f"⚠️ No YouTube videos found for: {query}")
                return []
            
            video_urls = []
            for item in data['items']:
                video_id = item['id']['videoId']
                video_url = f"https://www.youtube.com/watch?v={video_id}"
                video_urls.append(video_url)
            
            print(f"✅ Found {len(video_urls)} YouTube videos")
            return video_urls
        else:
            print(f"❌ YouTube API Error: {response.status_code} - {response.text}")
            return []
            
    except Exception as e:
        print(f"❌ Error searching YouTube: {str(e)}")
        return []

def extract_google_maps_links(text):
    """Extract all Google Maps links from text"""
    patterns = [
        r'https?://(?:www\.)?google\.com/maps[^\s\)\]<>\*]+',
        r'https?://maps\.google\.com[^\s\)\]<>\*]+',
        r'https?://goo\.gl/maps/[\w-]+',
    ]
    
    maps_links = []
    for pattern in patterns:
        matches = re.findall(pattern, text)
        maps_links.extend(matches)
    
    seen = set()
    unique_links = []
    for link in maps_links:
        if link not in seen:
            seen.add(link)
            unique_links.append(link)
    
    return unique_links

def get_top_3_locations(place_name):
    search_query = place_name.replace(' ', '+')
    return [
        f"https://www.google.com/maps/search/{search_query}+near+Viman+Nagar+Pune",
        f"https://www.google.com/maps/search/{search_query}+near+Pune",
        f"https://www.google.com/maps/search/{search_query}+recycling+center"
    ]


def clean_description(text, maps_links):
    """Clean and format the description text"""
    # Remove all Maps URLs
    for link in maps_links:
        text = text.replace(link, '')
    
    # Remove markdown formatting
    text = re.sub(r'\*\*\*', '', text)  # Remove triple asterisks
    text = re.sub(r'\*\*', '', text)    # Remove double asterisks (bold)
    text = re.sub(r'\*', '', text)      # Remove single asterisks
    text = re.sub(r'#{1,6}\s', '', text)  # Remove markdown headers (#, ##, etc.)
    text = re.sub(r'`{1,3}', '', text)  # Remove code blocks
    
    # Remove numbered lists if they're empty or just markers
    text = re.sub(r'\n\s*\d+\.\s*\n', '\n', text)
    text = re.sub(r'\n\s*\d+\.\s*$', '', text)
    
    # Clean up extra whitespace and newlines
    text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)  # Max 2 newlines
    text = re.sub(r'[ \t]+', ' ', text)  # Multiple spaces to single space
    
    # Remove list markers at start of lines
    text = re.sub(r'\n\s*[-•]\s*', '\n', text)
    
    # Final cleanup
    text = text.strip()
    
    # If description starts with "Okay, here's" or similar, clean it up
    text = re.sub(r'^(?:Okay|Ok|Sure|Alright),?\s+(?:here\'s|here is)\s+(?:the\s+)?(?:information\s+)?(?:about\s+)?(?:recycling\s+)?', '', text, flags=re.IGNORECASE)
    
    return text

def query_gemini(object_name):
    """Query Gemini API for recycling information"""
    try:
        # Ask only for recyclability status and description
        prompt = f"""Please provide information about "{object_name}":

1. First, state clearly if {object_name} is recyclable or not. Start with "Recyclable: Yes" or "Recyclable: No"

2. Then write 2-3 sentences explaining how to recycle it properly (if recyclable) or how to dispose of it properly (if not recyclable).

Please provide a clear and concise response."""

        url = f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={GEMINI_API_KEY}'
        
        payload = {
            "contents": [{
                "parts": [{
                    "text": prompt
                }]
            }]
        }
        
        headers = {'Content-Type': 'application/json'}
        
        
        response = requests.post(url, json=payload, headers=headers, timeout=20)
        
        if response.status_code == 200:
            data = response.json()
            
            if 'candidates' not in data or len(data['candidates']) == 0:
                print(f"❌ No candidates in response")
                return None
                
            bot_response = data['candidates'][0]['content']['parts'][0]['text']
            
            # Clean description (no maps links to remove now)
            description = bot_response.strip()
            
            # Remove "Recyclable: Yes/No" prefix from description if present
            description = re.sub(r'^Recyclable:\s*(Yes|No)\s*', '', description, flags=re.IGNORECASE).strip()
            
            # Search YouTube separately using YouTube API
            youtube_query = f"how to recycle {object_name}"
            youtube_links = search_youtube(youtube_query, max_results=3)
            
            # Generate fallback YouTube URLs if API fails
            if len(youtube_links) < 3:
                search_query = object_name.replace(' ', '+')
                fallback_youtube = [
                    f"https://www.youtube.com/results?search_query=how+to+recycle+{search_query}",
                    f"https://www.youtube.com/results?search_query={search_query}+recycling+tutorial",
                    f"https://www.youtube.com/results?search_query=recycle+{search_query}+at+home"
                ]
                youtube_links.extend(fallback_youtube[:(3 - len(youtube_links))])
            
            # Generate Maps URLs (not from Gemini)
            search_query = object_name.replace(' ', '+')
            maps_links = [
                f"https://www.google.com/maps/search/recycling+centers+near+me",
                f"https://www.google.com/maps/search/{search_query}+recycling+center+near+me"
            ]
            maps_links = get_top_3_locations((object_name + " disposable place near me" ))
            # Determine recyclability from Gemini response

            print("======== Map Links ========")
            for link in maps_links:
                print(link)
            bot_response_lower = bot_response.lower()
            if "recyclable: yes" in bot_response_lower or bot_response_lower.startswith("yes"):
                recyclable = "yes"
            elif "recyclable: no" in bot_response_lower or bot_response_lower.startswith("no") or "not recyclable" in bot_response_lower:
                recyclable = "no"
            else:
                # Fallback: check if recyclable mentioned in description
                description_lower = description.lower()
                recyclable = "yes" if ("recyclable" in description_lower or "can be recycled" in description_lower) and "not recyclable" not in description_lower else "no"
            
            return {
                'description': description,
                'youtube_links': youtube_links[:3],
                'maps_links': maps_links[:2],
                'recyclable': recyclable
            }
        else:
            print(f"❌ Gemini API Error: {response.status_code} - {response.text}")
            return create_fallback_data(object_name)
            
    except Exception as e:
        print(f"❌ Error querying Gemini: {str(e)}")
        import traceback
        traceback.print_exc()
        return create_fallback_data(object_name)

def create_fallback_data(object_name):
    """Create fallback data when Gemini fails"""
    search_query = object_name.replace(' ', '+')
    
    # Try to get YouTube videos even if Gemini fails
    youtube_links = search_youtube(f"how to recycle {object_name}", max_results=3)
    
    if len(youtube_links) < 3:
        fallback_youtube = [
            f"https://www.youtube.com/results?search_query=how+to+recycle+{search_query}",
            f"https://www.youtube.com/results?search_query={search_query}+disposal+guide",
            f"https://www.youtube.com/results?search_query={search_query}+recycling+tips"
        ]
        youtube_links.extend(fallback_youtube[:(3 - len(youtube_links))])
    
    return {
        'description': f"This is a {object_name}. Please check with your local recycling center for proper disposal instructions.",
        'youtube_links': youtube_links[:3],
        'maps_links': [
            f"https://www.google.com/maps/search/recycling+centers+near+me",
            f"https://www.google.com/maps/search/{search_query}+recycling+near+me"
        ],
        'recyclable': 'unknown'
    }

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        img = Image.open(io.BytesIO(contents)).convert("RGB")
        x = preprocess(img).unsqueeze(0)
        
        with torch.no_grad():
            out = model(x)[0]
            probs = F.softmax(out, dim=0)
            topk = torch.topk(probs, k=5)
        
        predictions = [
            {"object": labels[idx], "probability": float(prob)} 
            for idx, prob in zip(topk.indices.tolist(), topk.values.tolist())
        ]
        
        top_prediction = predictions[0]
        top_object = top_prediction['object']
        top_probability = top_prediction['probability']
        
        print(f"\n🔍 Top prediction: {top_object} ({top_probability*100:.2f}%)")
        
        gemini_result = query_gemini(top_object)
        
        response_data = {
            "id": str(uuid.uuid4()),
            "product": top_object,
            "recyclable": gemini_result['recyclable'],
            "description": gemini_result['description'],
            "probability": top_probability,
            "other_predictions": predictions[1:],
            "yt": gemini_result['youtube_links'],
            "maps": gemini_result['maps_links']
        }
        
        print(f"✅ Response sent for: {top_object}\n")
        
        return JSONResponse(content=response_data)
        
    except Exception as e:
        print(f"❌ Error in predict endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={'error': str(e)})

class UpdateRequest(BaseModel):
    id: str
    product: str

@app.post("/update")
async def update_product(request: UpdateRequest):
    try:
        print(f"\n🔄 Update request for: {request.product}")
        
        gemini_result = query_gemini(request.product)
        print(gemini_result)
        response_data = {
            "id": request.id,
            "product": request.product,
            "recyclable": gemini_result['recyclable'],
            "description": gemini_result['description'],
            "probability": 1.0,
            "other_predictions": [],
            "yt": gemini_result['youtube_links'],
            "maps": gemini_result['maps_links']
        }
        
        print(f"✅ Update response sent for: {request.product}\n")
        
        return JSONResponse(content=response_data)
        
    except Exception as e:
        print(f"❌ Error in update endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        return JSONResponse(status_code=500, content={'error': str(e)})

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)