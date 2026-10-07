# Changes to OmniCart 360

Three things were asked for: stop failed sign-ups from adding a user, add 100+ products, add a search bar.
All three are done and covered by tests. Nothing was run against your real AWS account (see
[What was verified](#what-was-verified)), so do the short checklist below once.

## Do this once

1. **Load the products** (needs your AWS credentials; table `omnicart-prod-products` in `us-east-1`):
   ```powershell
   cd Cloud_Native_plat
   python test_platform.py
   ```
   Step 2 writes the 130 products. Step 3 also sends one test order to SQS, as it always did. To seed only the
   products: `python -c "import test_platform; test_platform.populate_dynamodb_products()"`.
   Re-running is safe (items are overwritten by `ProductId`, so stock levels go back to the seed values).
2. **Remove users left behind by the old bug.** Every earlier failed sign-up left a user stuck in
   `FORCE_CHANGE_PASSWORD`, and that email can no longer register (it says "already exists"). List them:
   ```powershell
   aws cognito-idp list-users --user-pool-id us-east-1_HNnLI9NzL --region us-east-1 --output table `
     --query "Users[?UserStatus=='FORCE_CHANGE_PASSWORD'].{Username:Username,Email:Attributes[?Name=='email']|[0].Value,Created:UserCreateDate}"
   ```
   and delete the ones that came from failed sign-ups (anyone you invited from the console shows the same status):
   ```powershell
   aws cognito-idp admin-delete-user --user-pool-id us-east-1_HNnLI9NzL --region us-east-1 --username <Username from the list>
   ```
3. **Give the server's AWS identity `cognito-idp:AdminDeleteUser`** (it already needs `AdminCreateUser` and
   `AdminSetUserPassword`). Without it the fix still works, but the safety net in change 1 cannot clean up.

## What changed

### 1. Sign-up no longer leaves a user in the pool (`server.py`, `frontend/index.html`)

**Cause.** `/api/auth/register` created the Cognito user first and set the password second. A password that
broke the pool's policy failed on the second call, after the user existed, so the account stayed in the pool
and any retry returned 409. Reproduced before changing anything: weak password gives HTTP 500 and a
`FORCE_CHANGE_PASSWORD` user; a retry with a valid password gives 409.

**Fix.**
- The password is checked against the pool policy (min 8 characters, uppercase, lowercase, number; no symbol,
  as in `omnicart_platform.yaml`) before Cognito is called. The 400 response lists every unmet rule.
- If Cognito still rejects the password (for example the live pool is stricter than the template), the user
  created by that same request is deleted and the response is a 400 with Cognito's message, not a raw 500.
  This is the real guarantee; the up-front check is for friendly messages.
- The form hint now mentions the lowercase rule (it listed only uppercase and number).

**Decision.** I did not pass the password as `TemporaryPassword` to `admin_create_user`, which would make real
Cognito validate it at creation. I could not verify that against the real service, and a failed cleanup would
then leave a user whose temporary password is the real one. Check-then-rollback does not depend on it.

### 2. 130 products in 26 categories (`data/products.json`, `test_platform.py`)

The 3 original products are unchanged; 127 were added (electronics, computers, phones, gaming, cameras, kitchen,
furniture, decor, fashion, footwear, bags, sports, fitness, beauty, health, toys, baby, books, grocery, pets,
automotive, office, garden, music, displays). Names are generic (no brands). Attributes are the ones the
storefront and the CloudFormation table already use: `ProductId, Category, Name, Price, Stock, Status`, with
`Status = LOW_STOCK` below 20 units, as in the original data. `test_platform.py` now loads the file and writes in
batches instead of holding 3 products inline. Edit the JSON to change the catalogue.

### 3. Search bar (`frontend/index.html`)

- Filters as you type by name, category or product ID, and shows "N of M products".
- Each word typed must start a word in the product text. Case, hyphens and apostrophes are ignored, so
  "noise canceling headphones" finds "Noise-Canceling", and "mens" finds Men's Fashion but not Women's
  (plain substring matching would match "wo**mens**").
- "No products match ..." state with a Clear search button; the filter survives "Refresh DynamoDB Data".
- Rendering moved from `loadProducts()` into `renderProducts()` so searching does not call DynamoDB again.
  The search text and the product fields in the card are HTML-escaped.
- Products without a photo (all but the first three) show an icon for their category. Before, they would all
  have shown the same stock photo.
- It filters in the browser. That is fine for hundreds of products; thousands would need server-side search
  (the design document proposes OpenSearch).

## Tests

```powershell
cd Cloud_Native_plat
pip install -r requirements-dev.txt
pytest
```

23 tests, about 10 seconds, no AWS account or network (AWS is emulated with `moto`). They cover sign-up (every
rule, no user left behind, retry works, rollback, rollback failing, duplicate email still 409) and the catalogue
(count, variety, unique ids and names, price/stock/status rules, seeding into a table shaped like the
CloudFormation one, `GET /api/products`). The sign-up and seeding tests fail on the original code.
`pytest.ini` limits collection to `tests/` because `test_platform.py` is named like a test but calls live AWS.

## What was verified

- The tests above, plus a mutation check (disabling the rollback makes its test fail).
- A headless-Chromium run (34 checks) against the real `server.py` and real data on emulated AWS: search results
  compared with an independent implementation for 21 queries, empty state, HTML typed into the box, refresh,
  add to cart, four weak sign-ups leaving the pool empty, then a valid sign-up and sign-in, phone width.
- **Not verified:** your real AWS account (no credentials here), so real Cognito's message wording and the
  permission in step 3 are untested. The sandbox blocks the Tailwind and Lucide CDNs, so the browser run used local
  copies of those libraries (Tailwind 4 browser build; the page targets Tailwind 3, so spacing may differ slightly)
  and the three Unsplash photos were replaced by grey tiles.

## Issues found, not changed

You asked to be told, so none of these were fixed. **[verified]** = reproduced on the original code;
**[read]** = from reading the code, not run.

**Fix soon**
1. **The server hands out your project folder** [verified]. `GET /server.py`, `/test_platform.py`, `/deploy.ps1` and
   `/infrastructure/...` return the files. It also listens on `0.0.0.0`, so anyone on the same network can call the
   endpoints that use your AWS credentials (create users, queue orders). Serve only `frontend/` and bind `127.0.0.1`.
2. **`destroy.ps1` would not delete your stack** [read]. It targets `omnicar-prod` (missing "t") in `us-east-1`;
   `deploy.ps1` creates `omnicart-prod` in `ap-south-1`. AWS treats deleting a missing stack as a no-op, so it would
   very likely print "all billable resources removed" while the NAT Gateway and ALB keep costing money.
3. **Region mismatch** [read]: the app, `test_platform.py` and Terraform use `us-east-1`; `deploy.ps1` and
   `DEPLOYMENT_GUIDE.md` use `ap-south-1`.
4. **Orders trust the browser** [verified]: price and quantity come from the client (price 0.01 with quantity -5
   gave a total of -647.49), there is no token check so anyone can order as any email, `cognito_verified` is true
   for guests, and two orders in the same second get the same id (`ORD-<seconds>`).
5. **Sign-up marks every email as verified** [read] and has no rate limit, so anyone can create accounts for
   addresses they do not own.
6. **The CloudFormation app client does not enable the login flow the server uses** [read]. `server.py` signs in with
   `ADMIN_NO_SRP_AUTH`, which needs `ALLOW_ADMIN_USER_PASSWORD_AUTH`; the template lists only SRP and refresh. A
   fresh deploy would not let anyone sign in unless the live client was edited by hand.

**Worth fixing**
7. **If the Lucide CDN fails to load, the catalogue never appears** [verified]: `lucide.createIcons()` throws before
   `loadProducts()` runs and the page spins forever. `lucide@latest` is also unpinned and the Tailwind Play CDN is
   not meant for production.
8. **Sign-in treats a Cognito challenge as success** [verified]: a user needing a new password gets
   `200 SUCCESS` with null tokens and the UI shows them signed in.
9. **Stock is ignored** [read]: orders never reduce `Stock`; the card shows a green "N IN STOCK" even for
   `LOW_STOCK` items; nothing stops ordering more than exists.
10. **Bad requests crash the handler without any HTTP response** [verified for malformed JSON]; the server is
    single-threaded, so one slow Cognito call blocks every other visitor.
11. **`payment-lambda`** [verified]: for an API Gateway event (`{"body": "<json>"}`) it reads the wrong object, so a
    250.0 charge for `ord-42` came back as 0.0 for a random order id; it logs the payment token in plain text;
    it always succeeds. The guide also uses the ECS task role as the Lambda role, but that role only trusts
    `ecs-tasks.amazonaws.com`, so `create-function` would be refused [read].
12. **The microservices are stand-ins** [read]. `catalog-service` serves 3 hard-coded products with image URLs on a
    domain that does not exist; `docker-compose` points it at a `localstack` host that is not defined;
    `order-service` neither authenticates nor stores anything. The CloudFormation template has an ALB and a
    cluster but no ECS service, so the guide's `/health` check would return 503, not "HEALTHY".
13. **Infrastructure vs documentation** [read]: the task role allows DynamoDB/SQS/SNS actions on `*`; the ALB
    listener is plain HTTP although the docs say it terminates TLS; the bucket uses AES256 although the guide says
    KMS; the README tree lists `ecs.tf`, `aurora.tf`, `dynamodb.tf` and `payment-lambda/requirements.txt`, which
    do not exist.

**Minor**
14. Phone layout: the header is wider than a 390px screen (413px), so the Cart button is clipped [verified; same on
    the original page].
15. The cart drawer and the signed-in badge still insert unescaped text into the page [read]; only the code touched
    by the search change was escaped.
16. The AWS account id, pool id, client id, VPC id and load balancer name are hard-coded in `server.py`, the page
    (the account id is shown in the banner to every visitor) and the docs [read]. They are now in git history too; if
    the repository is public, consider moving them to environment variables.
17. The sign-in form's "pre-fill demo account" button bakes a password (`Password123!`) into the page [read].
18. The "DynamoDB: Active", "SQS: Ready" and "API Status: Online" badges are fixed text, not real checks [read]; the
    log line says "SRP" while the server receives the plain password and uses admin auth [read].
19. `/api/products` reads one page of the scan (1 MB cap) and ignores `LastEvaluatedKey` [read]; fine for 130 items.
20. The root `index.html` (the design-document viewer) is shadowed by the storefront in `server.py`, and loading
    the markdown with `fetch` is normally blocked when the file is double-clicked, despite the README saying to
    do that [read].
