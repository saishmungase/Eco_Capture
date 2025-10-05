# app.py
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
import io, requests
from PIL import Image
import torch
import torchvision.transforms as transforms
from torchvision import models
import torch.nn.functional as F

app = FastAPI()

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
