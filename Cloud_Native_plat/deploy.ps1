# OmniCart 360 - 1-Click AWS Deployment Script
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Deploying OmniCart 360 Cloud-Native Platform on AWS   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$StackName = "omnicart-prod"
$Region = "ap-south-1"
$TemplateFile = "infrastructure/cloudformation/omnicart_platform.yaml"

Write-Host "`n[1/3] Validating AWS CloudFormation template..." -ForegroundColor Yellow
aws cloudformation validate-template --template-body "file://$TemplateFile" --region $Region

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[ERROR] Template validation failed. Please check the template syntax." -ForegroundColor Red
    exit 1
}

Write-Host "`n[2/3] Deploying stack: $StackName (this takes ~3-5 minutes)..." -ForegroundColor Yellow
aws cloudformation deploy `
    --template-file $TemplateFile `
    --stack-name $StackName `
    --capabilities CAPABILITY_NAMED_IAM `
    --region $Region

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[ERROR] Stack deployment failed. Check CloudFormation events in AWS Console." -ForegroundColor Red
    exit 1
}

Write-Host "`n[3/3] Deployment complete! Retrieving live endpoints..." -ForegroundColor Green
aws cloudformation describe-stacks `
    --stack-name $StackName `
    --region $Region `
    --query "Stacks[0].Outputs" `
    --output table

Write-Host "`nAll platform resources are now live on AWS." -ForegroundColor Green
Write-Host "To destroy and prevent charges when done, run: .\destroy.ps1" -ForegroundColor Yellow
