# TerraTrace

TerraTrace compares satellite or drone image pairs from different dates, maps candidate land-use changes, and provides a dashboard for reviewing scans, alerts, and reports.

## Features

- Image-pair upload and asynchronous change-analysis pipeline
- Sentinel-2 Level-2A scene discovery through the Copernicus Data Space catalog
- On-demand Sentinel-2 before/after image ingestion into the analysis pipeline
- Interactive Mapbox satellite basemap with monitoring locations and geospatial detection layers
- Pixabay environmental image search with server-side caching and attribution
- Image alignment, preprocessing, change heatmaps, region detection, and geospatial output
- Optional PyTorch CNN classification, with a heuristic fallback
- Interactive globe with scan locations, detections, and image previews
- Alerts, scan history, and downloadable reports

## Run locally

### Backend

From the repository root, create and activate a virtual environment, then install dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

Start the API:

```bash
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

The API docs are available at `http://127.0.0.1:8000/docs`.

### Frontend

In another terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:3000`. The frontend uses `http://127.0.0.1:8000` by default. Set `NEXT_PUBLIC_API_URL` if the API runs elsewhere.

## Demo data

To generate synthetic demo image pairs and seed the local database, run this from the repository root with the backend dependencies installed:

```bash
python -m backend.scripts.seed_demo
```

## External APIs and image assets

Open **Data & Sources** in the app, select a monitoring location, set a date range and cloud-cover limit, then choose **Search catalog**. TerraTrace searches the public Copernicus Data Space STAC catalog for Sentinel-2 Level-2A scenes within about 10 km of that location. Catalog search requires no credentials. Open a result's catalog record to inspect a scene.

To fetch a Sentinel-2 before/after pair directly into TerraTrace, create a Copernicus Data Space OAuth client and put its credentials in the backend `.env` file at the repository root:

```env
CDSE_CLIENT_ID=your-client-id
CDSE_CLIENT_SECRET=your-client-secret
PIXABAY_API_KEY=your-pixabay-key
```

Restart the backend, then use **Create a Sentinel-2 comparison** in **Data & Sources**. The API fetches a 2 km radius true-color image for each selected date and opens the scan in Analyze. Keep these credentials on the backend. Sentinel Hub uses OAuth for processing requests ([authentication](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Overview/Authentication.html), [Process API](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Process.html)).

Add your Mapbox public token to `frontend/.env.local` as `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`. The full map uses Mapbox GL JS with its satellite streets style and geospatial scan layers. Restrict the public token to the app's allowed URLs in the Mapbox dashboard. See [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/).

The root `.env` uses `PIXABAY_API_KEY` for the **Pixabay environmental imagery** search in **Data & Sources**. The backend proxies the key, downloads display-size images to local storage, and caches searches for 24 hours. Results link back to Pixabay with contributor attribution, following [Pixabay API requirements](https://pixabay.com/api/docs/).

The supplied satellite/drone image is used for the animated page and content-card backgrounds. The supplied before/after frame is used around the Analyze visualizer.

Uploads, generated outputs, the SQLite database, virtual environments, dependencies, and environment files are local runtime data and are excluded from Git.

## Optional CNN model

Set `MODEL_PATH` in the backend environment to a compatible trained PyTorch model file. The classifier expects four output classes in this order: `Construction`, `Deforestation`, `Mining`, `Other`. If no usable model is configured, TerraTrace uses its heuristic classifier.

## Data and limitations

Sentinel-2 processing needs a Copernicus OAuth client and can fail when scenes are unavailable for the selected date or cloud limit. Mapbox imagery provides map context; detected regions are candidates and should be checked against their source imagery.
