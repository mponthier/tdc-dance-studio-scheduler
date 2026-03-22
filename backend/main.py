from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Any
import traceback
from solver import solve

app = FastAPI(title="Dance Studio Scheduler — CP-SAT Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Chrome Private Network Access requires this header on every response
@app.middleware("http")
async def add_private_network_header(request: Request, call_next):
    if request.method == "OPTIONS":
        response = Response(status_code=200)
        origin = request.headers.get("origin", "")
        if origin:
            response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "*"
        response.headers["Access-Control-Allow-Private-Network"] = "true"
        return response
    response = await call_next(request)
    response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


class OptimizeRequest(BaseModel):
    classes: list[Any]
    teachers: list[Any]
    rooms: list[Any]


@app.post("/api/optimize")
def optimize(req: OptimizeRequest):
    try:
        result = solve({"classes": req.classes, "teachers": req.teachers, "rooms": req.rooms})
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/health")
def health():
    return {"status": "ok"}
