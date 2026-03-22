# CP-SAT Scheduling Backend

## Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate       # Windows
pip install -r requirements.txt
```

## Run

```bash
uvicorn main:app --reload --port 8000
```

The frontend at http://localhost:5173 will automatically use this backend when available, and fall back to the built-in greedy optimizer otherwise.
