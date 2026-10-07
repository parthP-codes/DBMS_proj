# OmniCart 360 - Safe Resource Cleanup Script
Write-Host "==========================================================" -ForegroundColor Red
Write-Host "   Tearing Down OmniCart 360 AWS Resources (Clean-up)   " -ForegroundColor Red
Write-Host "==========================================================" -ForegroundColor Red

$StackName = "omnicar-prod"
$Region = "us-east-1"

$confirmation = Read-Host "Are you sure you want to delete all AWS resources for '$StackName'? (y/N)"
if ($confirmation -ne 'y' -and $confirmation -ne 'Y') {
    Write-Host "Teardown aborted by user." -ForegroundColor Yellow
    exit 0
}

Write-Host "`nDeleting CloudFormation stack: $StackName..." -ForegroundColor Yellow
aws cloudformation delete-stack --stack-name $StackName --region $Region

Write-Host "Waiting for stack deletion to complete..." -ForegroundColor Yellow
aws cloudformation wait stack-delete-complete --stack-name $StackName --region $Region

Write-Host "`nStack deleted successfully. All billable resources have been removed!" -ForegroundColor Green
