# Help message
function Show-Help {
    Write-Host "Usage: .\grant-crossproject-access.ps1 -FirebaseProject <PROJECT_ID> -BigQueryProject <PROJECT_ID> [-ExtensionInstanceId <INSTANCE_ID>] [-ServiceAccount <SERVICE_ACCOUNT>]"
    Write-Host
    Write-Host "Parameters:"
    Write-Host "  -FirebaseProject        Firebase (source) project ID"
    Write-Host "  -BigQueryProject        BigQuery project ID where dataset will be created"
    Write-Host "  -ExtensionInstanceId    Extension instance ID (default: firestore-bigquery-export)"
    Write-Host "  -ServiceAccount         Service account email (optional, will be constructed if not provided)"
    exit 1
}

# Parameters
param(
    [Parameter(Mandatory=$true)]
    [string]$FirebaseProject,
    
    [Parameter(Mandatory=$true)]
    [string]$BigQueryProject,
    
    [Parameter(Mandatory=$false)]
    [string]$ExtensionInstanceId = "firestore-bigquery-export",

    [Parameter(Mandatory=$false)]
    [string]$ServiceAccount = ""
)

# Construct service account email if not provided
if (-not $ServiceAccount) {
    $ServiceAccount = "ext-${ExtensionInstanceId}@${FirebaseProject}.iam.gserviceaccount.com"
}

Write-Host "Using service account: $ServiceAccount"
Write-Host "Adding BigQuery permissions to $ServiceAccount on project: $BigQueryProject"

$confirmation = Read-Host "Continue? (y/N)"
if ($confirmation -notmatch '^[yY]$') {
    exit 1
}

# Grant bigquery.dataEditor role
gcloud projects add-iam-policy-binding $BigQueryProject `
    --member="serviceAccount:$ServiceAccount" `
    --role="roles/bigquery.dataEditor"

# Grant bigquery.dataOwner which includes dataset.create permission
gcloud projects add-iam-policy-binding $BigQueryProject `
    --member="serviceAccount:$ServiceAccount" `
    --role="roles/bigquery.dataOwner"