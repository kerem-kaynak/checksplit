# Checksplit

A web app for splitting restaurant checks with friends. Scan a receipt or manually enter items, share a code, and everyone claims what they ordered.

**Live Demo:** [checksplit.kak.dev](https://checksplit.kak.dev)

## Features

- **Receipt OCR**: Upload a receipt photo and items are automatically extracted using Gemini AI
- **Manual Entry**: Add items with quantity and price support
- **Sub-item Claiming**: Each item can be claimed by one or more people (e.g., 3 beers can be claimed by 3 different people)
- **Tip Splitting**: Tip is split proportionally based on each person's subtotal
- **Share via Code**: 6-character alphanumeric codes for easy sharing
- **Real-time Updates**: See who claimed what in real-time

## Tech Stack

**Frontend:**
- React 19 + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- React Router

**Backend:**
- FastAPI (Python)
- PostgreSQL + SQLAlchemy
- Pydantic for validation
- Google Gemini API for OCR

**Deployment:**
- Docker + Docker Compose
- nginx for static file serving

## Local Development

### Prerequisites

- Node.js 20.19+
- Python 3.11+
- PostgreSQL
- [Gemini API key](https://aistudio.google.com/apikey)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/checksplit
export GEMINI_API_KEY=your_api_key

# Run migrations and start server
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Docker Compose

```bash
# Create .env file
cat > .env << EOF
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=checksplit
GEMINI_API_KEY=your_api_key
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
VITE_API_URL=http://localhost:8000
EOF

docker compose up --build
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/checks` | Create a new check |
| GET | `/api/checks/{code}` | Get check by code |
| PATCH | `/api/checks/{code}` | Update check |
| POST | `/api/checks/{code}/claim` | Claim/unclaim a sub-item |
| GET | `/api/checks/{code}/summary` | Get calculated totals per person |
| POST | `/api/checks/ocr` | Process receipt image |

## Project Structure

```
checksplit/
├── backend/
│   ├── app/
│   │   ├── models/       # SQLAlchemy models
│   │   ├── routers/      # API routes
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── services/     # Business logic (OCR)
│   │   ├── config.py     # Settings
│   │   ├── database.py   # DB connection
│   │   └── main.py       # FastAPI app
│   ├── alembic/          # Database migrations
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/   # Reusable UI components
│   │   ├── pages/        # Route pages
│   │   ├── services/     # API client
│   │   └── types/        # TypeScript types
│   ├── Dockerfile
│   └── nginx.conf
└── docker-compose.yml
```