gcloud auth list
cat <<EOF > requirements.txt
fastapi
uvicorn
pandas
fairlearn
google-genai
google-cloud-bigquery
db-dtypes
gunicorn
EOF

cat <<EOF > Dockerfile
FROM python:3.12-slim

# Install system dependencies for BigQuery/Pandas
RUN apt-get update && apt-get install -y --no-install-recommends     build-essential     && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home appuser
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chown -R appuser:appuser /app
USER appuser

# Cloud Run uses the PORT environment variable
ENV PORT 8080

# Use Gunicorn with Uvicorn workers for production
CMD ["gunicorn", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "main:app", "--bind", "0.0.0.0:8080"]
EOF

ls
PROJECT_ID=$(gcloud config get-value project)
# This builds the image and pushes it to Artifact Registry automatically
gcloud builds submit --tag us-central1-docker.pkg.dev/$unbiased-ai-2026-493219/unbiased-ai-repo/api:v1 
gcloud artifacts repositories create unbiased-ai-repo     --repository-format=docker     --location=us-central1     --description="Docker repository for Unbiased AI"
# 1. Get your Project Number
PROJECT_ID=$(gcloud config get-value project)
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
# 2. Grant the Artifact Registry Writer role
gcloud projects add-iam-policy-binding $PROJECT_ID     --member="serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com"     --role="roles/artifactregistry.writer"
# 3. Grant the Storage Admin role (required for the build logs)
gcloud projects add-iam-policy-binding $PROJECT_ID     --member="serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com"     --role="roles/storage.admin"
PROJECT_ID=$(gcloud config get-value project)
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v1 .
PROJECT_ID=$(gcloud config get-value project)
# Grant Storage Admin to the Compute Service Account
gcloud projects add-iam-policy-binding $PROJECT_ID     --member="serviceAccount:462056320872-compute@developer.gserviceaccount.com"     --role="roles/storage.admin"
# Also grant 'Service Usage Consumer' to your main email to be safe
gcloud projects add-iam-policy-binding $PROJECT_ID     --member="user:nekofell908@gmail.com"     --role="roles/serviceusage.serviceUsageConsumer"
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v1 .
PROJECT_ID=$(gcloud config get-value project)
# 1. Allow it to upload the container (Fixes the 'denied' error)
gcloud projects add-iam-policy-binding $PROJECT_ID     --member="serviceAccount:462056320872-compute@developer.gserviceaccount.com"     --role="roles/artifactregistry.writer"
# 2. Allow it to write logs (Fixes the 'Logging' info message)
gcloud projects add-iam-policy-binding $PROJECT_ID     --member="serviceAccount:462056320872-compute@developer.gserviceaccount.com"     --role="roles/logging.logWriter"
# 3. Allow it to act as a service account
gcloud projects add-iam-policy-binding $PROJECT_ID     --member="serviceAccount:462056320872-compute@developer.gserviceaccount.com"     --role="roles/iam.serviceAccountUser"
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v1 .
PROJECT_ID=$(gcloud config get-value project)
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v1   --region=us-central1   --allow-unauthenticated   --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"   --service-account="462056320872-compute@developer.gserviceaccount.com"   --memory=1Gi   --cpu=1
PROJECT_ID=$(gcloud config get-value project)
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
# Grant the 'Secret Accessor' role to your service account
gcloud projects add-iam-policy-binding $PROJECT_ID     --member="serviceAccount:462056320872-compute@developer.gserviceaccount.com"     --role="roles/secretmanager.secretAccessor"
PROJECT_ID=$(gcloud config get-value project)
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v1   --region=us-central1   --allow-unauthenticated   --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"   --service-account="462056320872-compute@developer.gserviceaccount.com"   --memory=1Gi   --cpu=1
# 1. Ensure the filename matches your code's expectation
cp compas-scores-two-years.csv compas_fixed.csv
# 2. Build the updated version
PROJECT_ID=$(gcloud config get-value project)
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v1 .
# 3. Deploy and explicitly link the secret
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v1   --region=us-central1   --allow-unauthenticated   --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"   --service-account="462056320872-compute@developer.gserviceaccount.com"
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v1   --region=us-central1   --allow-unauthenticated   --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"
cp compas-scores-two-years.csv compas_fixed.csv
PROJECT_ID=$(gcloud config get-value project)
gcloud builds submit --tag us-central1-docker.pkg.dev/$unbiased-ai-2026-493219/unbiased-ai-repo/api:v1 .
# 1. Ensure the ID is set correctly
PROJECT_ID=$(gcloud config get-value project)
# 2. Re-run the build with the correct variable name
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v1 .
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v1   --region=us-central1   --allow-unauthenticated   --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"   --service-account="462056320872-compute@developer.gserviceaccount.com"   --memory=1Gi
PROJECT_ID=$(gcloud config get-value project)
# 1. Build the updated code
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v1 .
# 2. Re-deploy
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v1   --region=us-central1   --allow-unauthenticated   --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"
PROJECT_ID=$(gcloud config get-value project)
# 1. Build the updated code
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v1 .
# 2. Re-deploy
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v1   --region=us-central1   --allow-unauthenticated   --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"
gcloud services enable generativelanguage.googleapis.com
PROJECT_ID=$(gcloud config get-value project)
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v1   --region=us-central1   --allow-unauthenticated   --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v1   --region=us-central1   --allow-unauthenticated   --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"
git init
git add .
git commit -m "Initial commit: FastAPI backend with Fairlearn logic"
git config --global user.email "aashaypatel43@gmail.com"
git config --global user.name "AashayPatel"
git commit -m "Initial commit: FastAPI backend with Fairlearn logic"
git remote add origin https://github.com/YOUR_USERNAME/unbiased-ai-backend.git
git push -u origin main
git branch -m main
git reset --soft HEAD~1
git reset
git add main.py Dockerfile requirements.txt compas_fixed.csv .gitignore
git commit -m "Initial commit: FastAPI backend and bias auditing logic"
git add main.py Dockerfile requirements.txt compas_fixed.csv .gitignore
git commit -m "Initial commit: FastAPI backend and bias auditing logic"
git reset --mixed HEAD~1
rm -rf .git
# 1. Start a fresh Git repo
git init -b main
# 2. Add ONLY your project files (avoiding the Cloud Shell junk)
git add main.py Dockerfile requirements.txt compas_fixed.csv .gitignore
# 3. Commit
git commit -m "Initial commit: FastAPI backend and bias auditing logic"
# Replace with your actual GitHub URL
git remote add origin https://github.com/AashayPatel/unbiased-ai-backend.git
# The Final Push (you might need your Token here!)
git push -u origin main --force
git remote add origin https://github.com/AashayPatel/unbiased-ai-backend.git
git push -u origin main --force
PROJECT_ID=$(gcloud config get-value project)
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v1 .
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v1   --region=us-central1   --allow-unauthenticated   --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"   --service-account="462056320872-compute@developer.gserviceaccount.com"   --memory=1Gi   --cpu=1
PROJECT_ID=$(gcloud config get-value project)
# 1. BUILD the new image (Takes about 1-2 mins)
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v2 .
# 2. DEPLOY the new image (Takes about 30 seconds)
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v2   --region=us-central1   --allow-unauthenticated   --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"
PROJECT_ID=$(gcloud config get-value project)
# 1. Build the v3 image
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v3 .
# 2. Deploy to Cloud Run
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v3   --region=us-central1   --allow-unauthenticated   --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"
# 1. Add the fixed main.py
git add main.py
# 2. Commit the fix
git commit -m "Fix: Resolved 404 error on /explain endpoint by updating Model ID mapping"
# 3. Push to GitHub
git push origin main
PROJECT_ID=$(gcloud config get-value project)
# 1. Build the v3 image
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v3 .
# 2. Deploy to Cloud Run
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v3   --region=us-central1   --allow-unauthenticated   --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"
# 1. Create the project folder
npm create vite@latest unbiased-ai-frontend -- --template react
# 2. Go into the folder
cd unbiased-ai-frontend
# 3. Install the basic tools
npm install
# 4. Install the specific tools for your simulator
npm install recharts
npm run dev
PROJECT_ID=$(gcloud config get-value project)
# 1. Build the v3 image
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v3 .
# 2. Deploy to Cloud Run
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v3   --region=us-central1   --allow-unauthenticated   --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"
npm run dev
cd
PROJECT_ID=$(gcloud config get-value project)
# 1. Build the v3 image
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v3 .
# 2. Deploy to Cloud Run
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v3   --region=us-central1   --allow-unauthenticated   --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"
npm run dev
cd unbiased-ai-frontend
npm run dev
cd
PROJECT_ID=$(gcloud config get-value project)
# 1. Build the v3 image
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v3 .
# 2. Deploy to Cloud Run
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v3   --region=us-central1   --allow-unauthenticated   --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"
cd unbiased-ai-frontend
npm run dev
cd
uvicorn main:app --reload
cd unbiased-ai-frontend
npm run dev
cd
PROJECT_ID=$(gcloud config get-value project)
# 1. Build the v3 image
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v3 .
# 2. Deploy to Cloud Run
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v3   --region=us-central1   --allow-unauthenticated   --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"
npm install recharts
PROJECT_ID=$(gcloud config get-value project)
# 1. Build the v3 image
gcloud builds submit --tag us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v3 .
# 2. Deploy to Cloud Run
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/$PROJECT_ID/unbiased-ai-repo/api:v3   --region=us-central1   --allow-unauthenticated   --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"
cd biased-ai-frontend
cd unbiased-ai-frontend
npm run dev
cd
docker build -t us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v3 .
docker push us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v3
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v3   --region=us-central1
docker push us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v3
gcloud auth configure-docker us-central1-docker.pkg.dev
docker push us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v3
gcloud builds submit   --tag us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v3   .
gcloud artifacts repositories create unbiased-ai   --repository-format=docker   --location=us-central1   --project=unbiased-ai-2026-493219   --description="Unbiased AI container images"
gcloud artifacts repositories list --location=us-central1
gcloud builds submit   --tag us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v3   .
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v3   --region=us-central1   --platform=managed   --allow-unauthenticated
gcloud builds submit   --tag us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v4   .
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v4   --region=us-central1   --platform=managed   --allow-unauthenticated
gcloud builds submit   --tag us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v4   .
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v4   --region=us-central1   --platform=managed   --allow-unauthenticated
cd unbiased-ai-frontend
npm run 
npm run dev
cd
gcloud builds submit   --tag us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v5 .
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v5   --region=us-central1 --platform=managed --allow-unauthenticated   --memory=2Gi
cd unbiased-ai-frontend
npm run dev
cd
gcloud builds submit   --tag us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v6 .
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v6   --region=us-central1 --platform=managed --allow-unauthenticated   --memory=2Gi
cd unbiased-ai-frontend
npm run dev
cd
gcloud run services logs read unbiased-ai-api --region=us-central1 --limit=30
gcloud builds submit   --tag us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v6 .
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v6   --region=us-central1 --platform=managed --allow-unauthenticated   --memory=2Gi
cd unbiased-ai-frontend
npm run dev
cd
gcloud builds submit   --tag us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v6 .
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v6   --region=us-central1   --platform=managed   --allow-unauthenticated   --memory=2Gi
curl "https://unbiased-ai-api-462056320872.us-central1.run.app/explain/individual/1"
gcloud run services logs read unbiased-ai-api --region=us-central1 --limit=30
gcloud builds submit   --tag us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v7 .
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v7   --region=us-central1 --platform=managed --allow-unauthenticated   --memory=2Gi
curl "https://unbiased-ai-api-462056320872.us-central1.run.app/explain/individual/1"
cd unbiased-ai-frontend
npm run dev
cd
curl "https://unbiased-ai-api-462056320872.us-central1.run.app/debug/columns"
gcloud run services logs read unbiased-ai-api --region=us-central1 --limit=20
gcloud builds submit   --tag us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v8 .
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v8   --region=us-central1 --platform=managed --allow-unauthenticated --memory=2Gi
curl "https://unbiased-ai-api-462056320872.us-central1.run.app/debug/columns"
gcloud run services logs read unbiased-ai-api --region=us-central1 --limit=20
# Check the image tag currently running
gcloud run services describe unbiased-ai-api   --region=us-central1   --format="value(spec.template.spec.containers[0].image)"
# Build and deploy with a new tag
gcloud builds submit   --tag us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v9 .
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v9   --region=us-central1 --platform=managed --allow-unauthenticated --memory=2Gi
gcloud builds submit   --tag us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v10 .
gcloud run deploy unbiased-ai-api   --image=us-central1-docker.pkg.dev/unbiased-ai-2026-493219/unbiased-ai/api:v10   --region=us-central1 --platform=managed --allow-unauthenticated --memory=2Gi
cat > .gitignore << 'EOF'
# Python
__pycache__/
*.pyc
.env
.venv/

# Node — both root and frontend
node_modules/
unbiased-ai-frontend/node_modules/
dist/
build/
.env.local

# Cloud Shell junk
README-cloudshell.txt

# OS
.DS_Store
EOF

git add .
git status
# Unstage everything
git reset HEAD .
# Add the missing items to .gitignore
cat >> .gitignore << 'EOF'

# npm cache and logs
.npm/
.npm/_cacache/
.npm/_logs/
.npm/_npx/

# Shell config files
.profile
.sudo_as_admin_successful
.vscode/

# Gemini
.gemini/

# Extra CSVs (keep only compas_fixed.csv)
compas-scores-two-years.csv

# Root level package.json (belongs to frontend only)
package-lock.json
package.json
EOF

