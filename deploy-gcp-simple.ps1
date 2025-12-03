# Simple GCP Cloud Run Deployment Script
# This uses Cloud Build to build the image directly in GCP (no local Docker push needed)

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectId,
    
    [Parameter(Mandatory=$true)]
    [string]$GoogleApiKey,
    
    [string]$Region = "us-central1",
    [string]$ServiceName = "presenton"
)

Write-Host "Deploying Presenton to GCP Cloud Run using Cloud Build..." -ForegroundColor Cyan
Write-Host ""

# Set the project
gcloud config set project $ProjectId

# Deploy using Cloud Build (builds in GCP, no local push needed)
gcloud run deploy $ServiceName `
    --source . `
    --platform managed `
    --region $Region `
    --allow-unauthenticated `
    --port 80 `
    --memory 2Gi `
    --cpu 2 `
    --timeout 300 `
    --max-instances 10 `
    --set-env-vars "LLM=google,GOOGLE_API_KEY=$GoogleApiKey,IMAGE_PROVIDER=gemini_flash,CAN_CHANGE_KEYS=false"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Deployment successful!" -ForegroundColor Green
    $ServiceUrl = gcloud run services describe $ServiceName --region=$Region --format="value(status.url)"
    Write-Host "Service URL: $ServiceUrl" -ForegroundColor Cyan
}
