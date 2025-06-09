#!/bin/bash

# Set the project ID
PROJECT_ID="dev-extensions-testing"

# Number of parallel workers (adjust based on your quota limits)
PARALLEL_WORKERS=20

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Starting removal of all datasets from project: $PROJECT_ID"
echo "Using $PARALLEL_WORKERS parallel workers"
echo "================================================"

# Create temporary directory for tracking
TEMP_DIR=$(mktemp -d)
DATASET_FILE="$TEMP_DIR/datasets.txt"
PROGRESS_FILE="$TEMP_DIR/progress.txt"
SUCCESS_FILE="$TEMP_DIR/success.txt"
FAILED_FILE="$TEMP_DIR/failed.txt"

# Initialize counters
echo "0" > "$PROGRESS_FILE"
touch "$SUCCESS_FILE"
touch "$FAILED_FILE"

# Cleanup function
cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# Function to delete a dataset with proper tracking
delete_dataset_with_tracking() {
    local dataset=$1
    local total=$2
    
    # Get current progress
    local current=$(cat "$PROGRESS_FILE")
    current=$((current + 1))
    echo "$current" > "$PROGRESS_FILE"
    
    # Try to delete
    if bq rm -r -f -d "${PROJECT_ID}:${dataset}" 2>/dev/null; then
        echo -e "${GREEN}[$current/$total] ✓ Successfully removed: $dataset${NC}"
        echo "$dataset" >> "$SUCCESS_FILE"
    else
        echo -e "${RED}[$current/$total] ✗ Failed to remove: $dataset${NC}"
        echo "$dataset" >> "$FAILED_FILE"
    fi
}

export -f delete_dataset_with_tracking
export PROJECT_ID TEMP_DIR PROGRESS_FILE SUCCESS_FILE FAILED_FILE RED GREEN NC

# Fetch all datasets with pagination
echo "Fetching all datasets..."

# Save datasets to file to avoid command line length issues
> "$DATASET_FILE"

offset=""
total_fetched=0
while true; do
    if [ -z "$offset" ]; then
        current_batch=$(bq ls -d --max_results=1000 --project_id=$PROJECT_ID --format=json | jq -r '.[].datasetReference.datasetId')
    else
        current_batch=$(bq ls -d --max_results=1000 --project_id=$PROJECT_ID --filter="datasetId>$offset" --format=json | jq -r '.[].datasetReference.datasetId')
    fi
    
    if [ -z "$current_batch" ]; then
        break
    fi
    
    echo "$current_batch" >> "$DATASET_FILE"
    
    # Get the last dataset ID for the next iteration
    offset=$(echo "$current_batch" | tail -1)
    batch_count=$(echo "$current_batch" | wc -l)
    total_fetched=$((total_fetched + batch_count))
    
    echo "  Retrieved $batch_count datasets (total so far: $total_fetched)..."
    
    if [ "$batch_count" -lt 1000 ]; then
        break
    fi
done

# Remove any duplicates and empty lines
sort -u "$DATASET_FILE" | grep -v '^$' > "$DATASET_FILE.sorted"
mv "$DATASET_FILE.sorted" "$DATASET_FILE"

# Count total datasets
total_datasets=$(wc -l < "$DATASET_FILE")

if [ "$total_datasets" -eq 0 ]; then
    echo "No datasets found in project $PROJECT_ID"
    exit 0
fi

echo ""
echo -e "${YELLOW}Found $total_datasets dataset(s) to remove:${NC}"
head -20 "$DATASET_FILE"
if [ "$total_datasets" -gt 20 ]; then
    echo "... and $((total_datasets - 20)) more"
fi
echo ""

# Confirmation prompt
read -p "Are you sure you want to delete ALL $total_datasets datasets? This action cannot be undone! (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Operation cancelled."
    exit 0
fi

echo ""
echo "Starting parallel deletion process..."
echo "================================================"

# Function to wait for a job slot
wait_for_slot() {
    while [ $(jobs -r | wc -l) -ge $PARALLEL_WORKERS ]; do
        sleep 0.05
    done
}

# Process each dataset
while IFS= read -r dataset; do
    wait_for_slot
    delete_dataset_with_tracking "$dataset" "$total_datasets" &
done < "$DATASET_FILE"

# Wait for all remaining jobs
echo ""
echo "Waiting for remaining jobs to complete..."
wait

# Calculate results
echo ""
echo "================================================"
echo -e "${YELLOW}DELETION SUMMARY${NC}"
echo "================================================"

success_count=$(wc -l < "$SUCCESS_FILE" 2>/dev/null || echo 0)
failed_count=$(wc -l < "$FAILED_FILE" 2>/dev/null || echo 0)
processed_count=$((success_count + failed_count))

echo -e "Total datasets found: ${YELLOW}$total_datasets${NC}"
echo -e "Total processed: ${YELLOW}$processed_count${NC}"
echo -e "Successfully deleted: ${GREEN}$success_count${NC}"
echo -e "Failed to delete: ${RED}$failed_count${NC}"

if [ "$processed_count" -ne "$total_datasets" ]; then
    echo -e "${RED}WARNING: Not all datasets were processed!${NC}"
    echo "Expected: $total_datasets, Processed: $processed_count"
fi

if [ "$failed_count" -gt 0 ]; then
    echo ""
    echo -e "${RED}Failed datasets:${NC}"
    head -20 "$FAILED_FILE"
    if [ "$failed_count" -gt 20 ]; then
        echo "... and $((failed_count - 20)) more"
        echo "(Full list saved to: $FAILED_FILE)"
    fi
fi

# Verify deletion
echo ""
echo "Verifying deletion..."
remaining=$(bq ls -d --max_results=1000 --project_id=$PROJECT_ID --format=json | jq -r '.[].datasetReference.datasetId' | wc -l)
echo -e "Datasets remaining in project: ${YELLOW}$remaining${NC}"

if [ "$remaining" -gt 0 ] && [ "$failed_count" -eq 0 ]; then
    echo -e "${YELLOW}Note: There are still datasets in the project. This might be due to:${NC}"
    echo "  - New datasets created during deletion"
    echo "  - Pagination issues (run the script again)"
    echo "  - Permission issues not reported as errors"
fi