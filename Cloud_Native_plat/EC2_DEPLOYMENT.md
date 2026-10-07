# Hosting OmniCart on EC2 (public link)

Goal: anyone with the link can open the storefront, while `server.py` talks to your existing DynamoDB, SQS and
Cognito in `us-east-1`. The server runs on one small EC2 instance behind nginx.

```
Browser --http--> EC2 (nginx :80) --> server.py (127.0.0.1:8000) --> Cognito / DynamoDB / SQS
```

> **Not tested on a real instance.** These steps were written from AWS documentation. The application itself
> (including the "serve only the storefront" change this guide relies on) is covered by the test suite.

## 0. Read this first: what becomes public

- **Sign-up is open.** Anyone with the link can create accounts in your Cognito pool (no rate limit, emails are
  marked verified without checking). Fine for a short demo; **terminate the instance afterwards**.
- **Plain HTTP sends passwords in the clear.** Use the HTTPS option in step 8 for anything beyond a classroom demo.
- The page banner shows your AWS account id to every visitor.
- Cost: a `t3.micro` is a few dollars a month (free tier may cover it); DynamoDB, SQS and Cognito usage here is tiny.

## 1. Before you start (from your own PC, once)

The stack must be deployed in `us-east-1` and the products loaded: `python test_platform.py` (see `CHANGES.md`,
"Do this once"). The carts table must exist too.

## 2. Give the instance an IAM role (so no AWS keys are stored on it)

IAM > Policies > Create policy > JSON, name it `omnicart-server`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:BatchGetItem", "dynamodb:Scan"],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/omnicart-prod-products" },
    { "Effect": "Allow",
      "Action": ["dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:DeleteItem"],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/omnicart-prod-carts" },
    { "Effect": "Allow",
      "Action": "sqs:SendMessage",
      "Resource": "arn:aws:sqs:us-east-1:*:omnicart-prod-order-fulfillment" },
    { "Effect": "Allow",
      "Action": ["cognito-idp:AdminCreateUser", "cognito-idp:AdminSetUserPassword",
                 "cognito-idp:AdminDeleteUser", "cognito-idp:AdminInitiateAuth"],
      "Resource": "arn:aws:cognito-idp:us-east-1:*:userpool/us-east-1_HNnLI9NzL" }
  ]
}
```

Then IAM > Roles > Create role > trusted entity **AWS service > EC2** > attach `omnicart-server`, name it
`omnicart-ec2-role`. (Seeding the products stays on your PC, so the instance does not need write access to that
table.)

## 3. Launch the instance

EC2 > Launch instance:
- Name `omnicart`, **Amazon Linux 2023**, type `t3.micro`, region **us-east-1**.
- Advanced details > IAM instance profile: `omnicart-ec2-role`.
- Security group, inbound rules: **HTTP (80) from Anywhere**, **SSH (22) from My IP only**. Do not open 8000.
- Key pair: create one and keep the `.pem` (or connect with "EC2 Instance Connect" in the console).

## 4. Put the app on the instance

Connect (SSH or Instance Connect), then either clone the repo (branch `claude/sharp-euler-3340j3`):

```bash
sudo dnf install -y git python3-pip nginx
sudo git clone -b claude/sharp-euler-3340j3 https://github.com/parthP-codes/DBMS_proj.git /opt/src
sudo cp -r /opt/src/Cloud_Native_plat /opt/omnicart
```

or upload the zip from your PC (`scp -i key.pem Cloud_Native_plat_updated.zip ec2-user@<public-dns>:~`) and run
`sudo dnf install -y unzip python3-pip nginx && sudo unzip Cloud_Native_plat_updated.zip -d /opt && sudo mv /opt/Cloud_Native_plat /opt/omnicart`.

Then install the one dependency:

```bash
sudo chown -R ec2-user:ec2-user /opt/omnicart
cd /opt/omnicart && python3 -m venv venv && ./venv/bin/pip install -r requirements.txt
```

## 5. Run it as a service

`sudo nano /etc/systemd/system/omnicart.service`:

```ini
[Unit]
Description=OmniCart storefront and API
After=network-online.target

[Service]
User=ec2-user
WorkingDirectory=/opt/omnicart
Environment=HOST=127.0.0.1
Environment=PORT=8000
ExecStart=/opt/omnicart/venv/bin/python server.py
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now omnicart
curl -s localhost:8000/api/products | head -c 200      # should show product JSON (this proves the IAM role works)
```

If that prints an error mentioning credentials or `AccessDenied`, the role is not attached or the policy is wrong.

## 6. Put nginx in front (port 80)

Python's built-in server handles one request at a time, so one slow visitor could stall everyone; nginx absorbs that.

```bash
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak
sudo tee /etc/nginx/nginx.conf >/dev/null <<'EOF'
events {}
http {
  server {
    listen 80 default_server;
    client_max_body_size 1m;
    location / {
      proxy_pass http://127.0.0.1:8000;
      proxy_set_header Host $host;
      proxy_read_timeout 30s;
    }
  }
}
EOF
sudo nginx -t && sudo systemctl enable --now nginx
```

## 7. Share the link

`http://<Public IPv4 DNS of the instance>` (EC2 console > instance > Public IPv4 DNS). The address changes if you
stop and start the instance; attach an **Elastic IP** if you need it to stay fixed.

Check: the products load, sign-up works, adding to the cart creates an item in DynamoDB `omnicart-prod-carts`,
and placing an order shows a message in SQS.

## 8. HTTPS without buying a domain (recommended): CloudFront

CloudFront > Create distribution:
- Origin domain: the instance's Public IPv4 DNS; protocol **HTTP only**, port 80.
- Viewer protocol policy: **Redirect HTTP to HTTPS**.
- Allowed HTTP methods: **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE** (the cart uses PUT).
- Cache policy: **CachingDisabled**. Origin request policy: **AllViewer** (so the sign-in token header reaches the server).

Share `https://<id>.cloudfront.net` instead. Visitors' passwords are then encrypted to CloudFront; the CloudFront to
EC2 hop is still plain HTTP, which is acceptable for a demo but not for production (use a domain and a certificate
on the instance, or an Application Load Balancer with ACM).

## 9. Updating or removing it

- Update: copy new files into `/opt/omnicart`, then `sudo systemctl restart omnicart`.
- Logs: `sudo journalctl -u omnicart -f`.
- Remove everything when you are done: terminate the instance, delete the CloudFront distribution, delete the role
  and policy. (Your DynamoDB tables and Cognito users stay; delete test users if you wish.)

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Page loads but products never appear | Browser cannot reach the Tailwind or Lucide CDNs (firewall), or the IAM role lacks access: check `journalctl` |
| 502 Bad Gateway | `omnicart` service is not running: `systemctl status omnicart` |
| Cannot reach the link at all | Security group lacks inbound port 80, or you used the private IP |
| Sign-in fails with "Auth flow not enabled" | The Cognito app client needs `ALLOW_ADMIN_USER_PASSWORD_AUTH` (see issue 6 in `CHANGES.md`) |
