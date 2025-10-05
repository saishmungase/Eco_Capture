import os
import re
import requests
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import io
from PIL import Image
import torch
import torchvision.transforms as transforms
from torchvision import models
import torch.nn.functional as F
from fastapi.middleware.cors import CORSMiddleware  # <-- import this

app = FastAPI()

# --- CORS setup ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # <-- allows all origins
    allow_credentials=True,
    allow_methods=["*"],   # <-- allows all HTTP methods (GET, POST, etc.)
    allow_headers=["*"],   # <-- allows all headers
)
# -------------------

# Download ImageNet labels (used to turn index -> human label)
LABELS_URL = "https://raw.githubusercontent.com/pytorch/hub/master/imagenet_classes.txt"
labels = requests.get(LABELS_URL).text.splitlines()

# Choose model: MobileNet (fast) or ResNet (accurate)
MODEL_NAME = "mobilenet_v2"  # change to "resnet50" if you prefer
if MODEL_NAME == "mobilenet_v2":
    model = models.mobilenet_v2(pretrained=True)
else:
    model = models.resnet50(pretrained=True)

model.eval()

preprocess = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406],
                         std =[0.229, 0.224, 0.225]),
])

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    contents = await file.read()
    img = Image.open(io.BytesIO(contents)).convert("RGB")
    x = preprocess(img).unsqueeze(0)  # batch dim
    with torch.no_grad():
        out = model(x)[0]
        probs = F.softmax(out, dim=0)
        topk = torch.topk(probs, k=5)
    results = [{"label": labels[idx], "prob": float(prob)} for idx, prob in zip(topk.indices.tolist(), topk.values.tolist())]
    return JSONResponse({"predictions": results})


GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', 'AIzaSyBBoAe7kJ-QwpEUy0bYZ32p6xQZ6zU6z44')
GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

# Pydantic model for request body
class ChatRequest(BaseModel):
    message: str

def extract_youtube_links(text):
    """Extract all YouTube links from text"""
    patterns = [
        r'https?://(?:www\.)?youtube\.com/watch\?v=[\w-]+(?:&[\w=%-]*)?',
        r'https?://(?:www\.)?youtu\.be/[\w-]+(?:\?[\w=%-]*)?',
        r'https?://(?:www\.)?youtube\.com/embed/[\w-]+',
        r'https?://(?:www\.)?youtube\.com/shorts/[\w-]+',
    ]
    
    youtube_links = []
    for pattern in patterns:
        matches = re.findall(pattern, text)
        youtube_links.extend(matches)
    
    unique_links = list(dict.fromkeys(youtube_links))
    return unique_links

def parse_response(bot_response):
    """Parse the bot response to extract description and YouTube links"""
    youtube_links = extract_youtube_links(bot_response)
    
    description = bot_response
    for link in youtube_links:
        description = description.replace(link, '')
    
    description = re.sub(r'\n\s*\n', '\n\n', description)
    description = description.strip()
    
    return description, youtube_links

@app.post('/chat')
async def chat(chat_request: ChatRequest):
    try:
        user_message = chat_request.message
        
        if not user_message:
            return JSONResponse(
                status_code=400,
                content={'error': 'No message provided'}
            )
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": user_message
                        }
                    ]
                }
            ]
        }
        
        headers = {
            'Content-Type': 'application/json',
            'X-goog-api-key': GEMINI_API_KEY
        }
        
        response = requests.post(GEMINI_API_URL, json=payload, headers=headers)
        
        if response.status_code == 200:
            data = response.json()
            bot_response = data['candidates'][0]['content']['parts'][0]['text']
            
            description, youtube_links = parse_response(bot_response)
            
            # Debug prints
            print("\n" + "="*50)
            print("RAW RESPONSE:")
            print("="*50)
            print(bot_response)
            print("\n" + "="*50)
            print("PARSED DESCRIPTION:")
            print("="*50)
            print(description)
            print("\n" + "="*50)
            print("YOUTUBE LINKS ARRAY:")
            print("="*50)
            print(youtube_links)
            print("="*50 + "\n")
            
            return JSONResponse(content={
                'description': description,
                'youtube_links': youtube_links,
                'raw_response': bot_response
            })
        else:
            return JSONResponse(
                status_code=500,
                content={'error': f'API Error: {response.status_code} - {response.text}'}
            )
    
    except Exception as e:
        print(f"Error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={'error': str(e)}
        )

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)