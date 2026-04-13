#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting Building and Deployment Process (Anchor 0.30.0)..."

# 1. Build the programs
echo "🔨 Building programs..."
anchor build

# 2. Get the current cluster from Anchor.toml
CLUSTER=$(grep "cluster =" Anchor.toml | cut -d'"' -f2)
echo "🌐 Target Cluster: $CLUSTER"

# 3. Deploy and capture output
echo "📦 Deploying programs to $CLUSTER..."
# We use 'tee' to see output in console AND save to a temp file for parsing
DEPLOY_LOG=$(anchor deploy --provider.cluster "$CLUSTER" 2>&1 | tee /tmp/anchor_deploy.log)

# 4. Parse the log for transaction signatures and program IDs
# We use grep and awk to find the relevant lines. 
# Anchor deploy output typically includes: "Program <ID> deployed with tx signature <SIG>"
RECEIPT_FILE="target/deploy/deployment_receipt.json"
echo "📄 Generating deployment receipt at $RECEIPT_FILE..."

# Start the JSON file
echo "{" > "$RECEIPT_FILE"
echo "  \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\"," >> "$RECEIPT_FILE"
echo "  \"cluster\": \"$CLUSTER\"," >> "$RECEIPT_FILE"
echo "  \"deployments\": [" >> "$RECEIPT_FILE"

# Extract Program IDs and Sigs from the log
# Logic: find lines with "Program" and "signature", then extract the 2nd and last columns
grep "deployed with tx signature" /tmp/anchor_deploy.log | while read -r line; do
    PROGRAM_ID=$(echo "$line" | awk '{print $2}')
    SIGNATURE=$(echo "$line" | awk '{print $NF}')
    echo "    { \"program\": \"$PROGRAM_ID\", \"signature\": \"$SIGNATURE\" }," >> "$RECEIPT_FILE"
done

# Clean up the trailing comma (if any) and close the JSON
# This is a bit hacky but works for simple outputs
sed -i '$ s/,$//' "$RECEIPT_FILE"
echo "  ]" >> "$RECEIPT_FILE"
echo "}" >> "$RECEIPT_FILE"

echo "✅ Deployment complete! Receipt saved."
echo "--------------------------------------"
cat "$RECEIPT_FILE"
echo "--------------------------------------"
