import asyncio
import json
import queue as queue_module
import threading
import traceback
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from typing import Any
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
    timeoutSeconds: float = 120.0


@app.post("/api/optimize")
def optimize(req: OptimizeRequest):
    try:
        result = solve({"classes": req.classes, "teachers": req.teachers, "rooms": req.rooms},
                       timeout_seconds=req.timeoutSeconds)
        return result
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/optimize/stream")
async def optimize_stream(req: OptimizeRequest):
    progress_q = queue_module.Queue()
    result_container = {}

    def run_solver():
        try:
            result = solve(
                {"classes": req.classes, "teachers": req.teachers, "rooms": req.rooms},
                progress_queue=progress_q,
                timeout_seconds=req.timeoutSeconds,
            )
            result_container["result"] = result
        except Exception:
            result_container["error"] = traceback.format_exc()
        finally:
            progress_q.put(None)  # sentinel — signals stream to close

    thread = threading.Thread(target=run_solver, daemon=True)
    thread.start()

    async def event_stream():
        while True:
            try:
                msg = progress_q.get_nowait()
                if msg is None:
                    break
                yield f"data: {json.dumps({'type': 'progress', **msg})}\n\n"
            except queue_module.Empty:
                await asyncio.sleep(0.2)

        thread.join(timeout=5)
        if "error" in result_container:
            yield f"data: {json.dumps({'type': 'error', 'message': result_container['error']})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'result', 'data': result_container.get('result', {})})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/health")
def health():
    return {"status": "ok"}
