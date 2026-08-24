# Restaurant Scraper API

HTTP API that collects cafe, restaurant and fast-food data from OpenStreetMap and exports it to XLSX, CSV or GeoJSON.

Built with **FastAPI** · Deployed on **Vercel** · Data © OpenStreetMap contributors ([ODbL](https://www.openstreetmap.org/copyright))

---

## Prerequisites

- **Python 3.11+**
- **pip** (comes with Python)

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/mahmudrafi24/cafe_scraping.git
cd restaurant-scraper-api
```

### 2. Create a virtual environment

```bash
python -m venv .venv
```

Activate it:

| OS            | Command                       |
|---------------|-------------------------------|
| **Windows**   | `.venv\Scripts\activate`      |
| **macOS / Linux** | `source .venv/bin/activate` |

### 3. Install dependencies

```bash
# Runtime + dev dependencies (testing, linting, type checking)
pip install -e ".[dev]"
```

Or for runtime only:

```bash
pip install -e .
```

### 4. Configure environment variables

```bash
copy .env.example .env        # Windows
# cp .env.example .env        # macOS / Linux
```

The defaults work out of the box for local development. See [`.env.example`](.env.example) for all available options.

### 5. Start the development server

```bash
uvicorn app.main:app --reload
```

The server starts at **http://127.0.0.1:8000** by default.

| URL | Description |
|-----|-------------|
| http://127.0.0.1:8000/docs | Swagger UI (interactive API docs) |
| http://127.0.0.1:8000/redoc | ReDoc (alternative docs) |
| http://127.0.0.1:8000/openapi.json | OpenAPI schema |

> **Tip:** Add `--host 0.0.0.0 --port 8080` to change the bind address or port.

---

## API Endpoints

All routes are prefixed with `/api/v1`.

### System

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health` | Liveness check — returns status, version, environment |

### Cities

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/cities/search?q=<query>` | Autocomplete city names (min 2 chars). Returns candidate places with coordinates. |

**Query parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `q` | string | *(required)* | Partial place name (2–200 chars) |
| `limit` | int | `8` | Max results (1–20) |

### Places

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/places/search` | Find cafes, restaurants and fast food near a city |
| `POST` | `/api/v1/places/export` | Download search results as XLSX, CSV or GeoJSON |

**Typical flow:**

```
1. GET  /api/v1/cities/search?q=hamb     → resolve a city name
2. POST /api/v1/places/search            → fetch amenities within a radius
3. POST /api/v1/places/export            → download the data as a file
```

---

## Running Tests

The test suite uses **pytest** with **respx** to mock all upstream HTTP calls — no real network requests are made.

```bash
# Run all tests
pytest

# Run with verbose output
pytest -v

# Run a specific test file
pytest tests/test_api.py

# Run with coverage report
pytest --cov=app --cov-report=term-missing
```

### Test files

| File | Covers |
|------|--------|
| `tests/test_api.py` | API endpoint integration tests |
| `tests/test_config.py` | Settings and environment configuration |
| `tests/test_exporters.py` | XLSX / CSV / GeoJSON export |
| `tests/test_geocoding.py` | City geocoding via Nominatim |
| `tests/test_overpass.py` | Overpass API query building and parsing |
| `tests/test_places_service.py` | Place search orchestration |
| `tests/test_suggest.py` | City autocomplete via Photon |

---

## Code Quality

```bash
# Lint and auto-fix
ruff check --fix .

# Format
ruff format .

# Type checking
mypy app
```

---

## Project Structure

```
restaurant-scraper-api/
├── api/
│   └── index.py              # Vercel serverless entrypoint
├── app/
│   ├── api/
│   │   ├── deps.py           # FastAPI dependency injection
│   │   └── v1/
│   │       ├── router.py     # v1 route aggregator
│   │       └── routes/
│   │           ├── cities.py  # City search / autocomplete
│   │           ├── health.py  # Liveness check
│   │           └── places.py  # Place search and export
│   ├── config.py             # Settings (pydantic-settings)
│   ├── core/                 # HTTP client, errors, logging
│   ├── schemas/              # Pydantic request/response models
│   ├── services/             # Business logic (geocoding, overpass, export)
│   └── main.py               # Application factory
├── tests/                    # pytest test suite
├── .env.example              # Environment variable template
├── pyproject.toml            # Project metadata and tool config
├── requirements.txt          # Vercel runtime dependencies
└── vercel.json               # Vercel deployment config
```

---

## License

MIT
