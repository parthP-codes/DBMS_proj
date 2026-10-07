# Changes to OmniCart 360

**Round 1:** stop failed sign-ups from adding a user, add 100+ products, add a search bar.
**Round 2:** per-user carts saved in DynamoDB, orders that trust the sign-in token instead of the browser, and fixes
for four small defects an independent review found in round 1.

Everything is covered by tests. Nothing was run against your real AWS account (see
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
2. **Check the carts table exists** (it is in the CloudFormation template, but your stack may predate it):
   ```powershell
   aws dynamodb describe-table --table-name omnicart-prod-carts --region us-east-1 --query Table.TableStatus
   ```
   It should print `"ACTIVE"`. If not, redeploy the template, or create a table with partition key `PK` (string),
   sort key `SK` (string) and TTL enabled on the attribute `TTL`.
3. **Make sure the AWS identity that runs `server.py` is allowed to:**
   - Cognito: `AdminCreateUser`, `AdminSetUserPassword`, `AdminDeleteUser`, `AdminInitiateAuth`
     (`GetUser` needs no AWS permission: the user's own token authorises it).
   - DynamoDB, on `omnicart-prod-products` and `omnicart-prod-carts`: `GetItem`, `PutItem`, `DeleteItem`,
     `BatchGetItem`, `Scan`, and `BatchWriteItem` (for seeding).
   - SQS: `SendMessage` on `omnicart-prod-order-fulfillment`.

   With an admin-style IAM user you are already fine. The template's ECS task role would not be: it lacks
   `DeleteItem`, `BatchGetItem` and `BatchWriteItem`.
4. **Remove users left behind by the old sign-up bug.** Every earlier failed sign-up left a user stuck in
   `FORCE_CHANGE_PASSWORD`, and that email can no longer register (it says "already exists"). List them:
   ```powershell
   aws cognito-idp list-users --user-pool-id us-east-1_HNnLI9NzL --region us-east-1 --output table `
     --query "Users[?UserStatus=='FORCE_CHANGE_PASSWORD'].{Username:Username,Email:Attributes[?Name=='email']|[0].Value,Created:UserCreateDate}"
   ```
   and delete the ones that came from failed sign-ups (anyone you invited from the console shows the same status):
   ```powershell
   aws cognito-idp admin-delete-user --user-pool-id us-east-1_HNnLI9NzL --region us-east-1 --username <Username from the list>
   ```

## What changed

### Round 1

**1. Sign-up no longer leaves a user in the pool** (`server.py`, `frontend/index.html`)

*Cause.* `/api/auth/register` created the Cognito user first and set the password second. A password that broke
the pool's policy failed on the second call, after the user existed, so the account stayed in the pool and any retry
returned 409. Reproduced before changing anything.

*Fix.* The password is checked against the pool policy (min 8 characters, uppercase, lowercase, number; no symbol,
as in `omnicart_platform.yaml`) before Cognito is called, and the 400 response lists every unmet rule. If Cognito
still rejects it (for example the live pool is stricter than the template), the user created by that same request
is deleted and the response is a 400 with Cognito's message. That rollback is the real guarantee; the up-front check
is for friendly messages. The form hint now mentions the lowercase rule.

*Decision.* I did not pass the password as `TemporaryPassword` to `admin_create_user` (which would make real Cognito
validate it at creation): I could not verify that against the real service, and a failed cleanup would then leave a
user whose temporary password is the real one.

**2. 130 products in 26 categories** (`data/products.json`, `test_platform.py`)

The 3 original products are unchanged; 127 were added. Names are generic (no brands). Attributes are the ones the
storefront and the CloudFormation table already use: `ProductId, Category, Name, Price, Stock, Status`, with
`Status = LOW_STOCK` below 20 units, as in the original data. `test_platform.py` loads the file and writes in
batches. Edit the JSON to change the catalogue.

**3. Search bar** (`frontend/index.html`)

Filters as you type by name, category or product ID and shows "N of M products". Each word typed must start a word
in the product text; case, apostrophes and punctuation are ignored, so "noise canceling headphones" finds
"Noise-Canceling", and "mens" finds Men's Fashion but not Women's. There is a "no products match" state with a Clear
button, and the filter survives "Refresh DynamoDB Data". Products without a photo (all but the first three) show an
icon for their category. It filters in the browser, which is fine for hundreds of products; thousands would need
server-side search (the design document proposes OpenSearch).

### Round 2

**4. Per-user carts in DynamoDB** (`server.py`, `frontend/index.html`)

- **Who is asking.** The page sends `Authorization: Bearer <access token>`. The server asks Cognito who owns it
  (`GetUser`); Cognito checks the signature, expiry and sign-out, so no JWT library is needed and a signed-out
  session stops working at once. The price is one extra Cognito call per request, fine here; if call volume ever
  matters, verify the token locally against the pool's public keys instead. An email in a request body is never
  used to decide who someone is.
- **Where the cart lives.** One item per user in `omnicart-prod-carts`:
  `PK = USER#<Cognito sub>`, `SK = CART`, plus `Email`, `Items` (ProductId, Name, Price, Quantity), `ItemCount`,
  `Subtotal`, `UpdatedAt` (UTC) and `TTL` (30 days after the last change; DynamoDB deletes expired items some time
  later, so reads ignore them). One item per user means replacing the whole cart is a single atomic write and the
  cart reads as one row in the console.
- **Prices.** `Name` and `Price` are looked up in the products table when the cart is saved, never taken from the
  browser; loading re-prices and drops products that no longer exist. Quantities must be whole numbers 1-99, at most
  100 lines.
- **API.** `GET /api/cart` and `PUT /api/cart` with `{"items": [{"product_id": "prod-101", "quantity": 2}]}`
  (an empty list deletes the item). 401 when not signed in or the session has ended.
- **Page.** Signing in loads the saved cart and merges anything added as a guest. Every change is saved (quick
  successive changes are combined and sent one at a time, in order). Sign-out empties the page but not DynamoDB. If
  the session ends (tokens last an hour) the page says so and opens the sign-in dialog; the saved cart is waiting.
  The cart drawer shows where the cart lives: table name, a link to the AWS console and the item's exact key.
- **Guests** keep a cart in the page only, as before.

**5. Orders trust the token, not the browser** (`POST /api/orders`)

- The customer comes from the verified token. No token means a guest; a bad token is a 401 and is never quietly
  treated as a guest. `cognito_verified` is true only for verified users (it used to be true for guests too).
- Names and prices come from the products table and quantities are validated, so the earlier -647.49 total is no
  longer possible. An empty cart is a 400.
- After the message is queued, the user's saved cart is deleted. If only that clean-up fails, the order still
  succeeds and the response says `"saved_cart_cleared": false`.
- Unchanged: order ids are still `ORD-<seconds>`, and `payment_status` is always `AUTHORIZED` (no payment happens).

**6. Fixes from an independent review of round 1**

- Search: punctuation such as `(` and `/`, tabs and non-breaking spaces now separate words ("mystery" finds
  "(Mystery Novel)", "1.8" finds "f/1.8"). Before, they did not.
- Sign-up: a password that is not text (a JSON number, say) is now a clean 400; it used to drop the connection.
- Tests: no longer fail when an HTTP proxy is configured in the environment; the seeding test compares every
  attribute instead of two.
- Seeding uses `BatchWriteItem`, so the identity running it needs that permission (the original code needed only
  `PutItem`). It is in the list in step 3.

### Round 3: getting ready to host

**7. Safe to expose** (`server.py`, `EC2_DEPLOYMENT.md`, `requirements.txt`)

- Only the storefront and `/api/...` are served; any other path (source files, scripts, infrastructure files) is a
  404. `HOST` (default `127.0.0.1`) and `PORT` can be set with environment variables.
- `EC2_DEPLOYMENT.md` is a step-by-step guide: IAM role instead of stored keys, security group, systemd service,
  nginx on port 80 and optional HTTPS through CloudFront. It has not been tried on a real instance.

## Where to see it in AWS

Console, region **N. Virginia (us-east-1)**.

| You do this in the app | Look here |
|---|---|
| Add or remove an item while signed in | DynamoDB > Tables > `omnicart-prod-carts` > Explore table items. One item per user; open it to see `Items`, `Subtotal`, `UpdatedAt`, `TTL`. The cart drawer shows the exact `PK` to look for. |
| Empty the cart or place an order | The same item disappears. |
| Sign up | Cognito > User pools > `us-east-1_HNnLI9NzL` > Users. A user's `sub` (their user id) is the part after `USER#` in the carts table key. |
| Place an order | SQS > `omnicart-prod-order-fulfillment` > Send and receive messages > Poll for messages: the order JSON with the verified email, catalogue prices and `cognito_verified`. |
| Anything | CloudWatch > Metrics > DynamoDB, SQS: write capacity used, messages sent. They lag by a few minutes. |
| Who called what | CloudTrail > Event history, filtered to event source `cognito-idp.amazonaws.com`: typically shows the admin calls (create user, set password, sign-in). DynamoDB item reads and writes are not logged unless you enable data events. |

## Suggested next features (to see more happening in AWS)

Effort is relative: S = small, M = medium, L = needs template changes too.

| Feature | What you would see in AWS | Effort |
|---|---|---|
| **Real status badges.** Replace the fixed "DynamoDB: Active / SQS: Ready" with live checks: table status and item counts, messages waiting in the queue and in the dead-letter queue, Cognito user count. | The numbers on the page move as you use the app, and match the console. | S |
| **Live "AWS activity" panel.** The server records every AWS call it makes (service, operation, resource, id, duration) and the page lists the latest ones with links to the console page. | Your click on "Add to cart" becomes visible as Cognito `GetUser` + DynamoDB `BatchGetItem` + `PutItem`, in one place. | S-M |
| **Order processor + Orders table + "My orders".** A small worker reads the order queue, writes each order to a new `omnicart-prod-orders` table (PLACED, PAID, SHIPPED) and deletes the message. After 5 failed attempts a message moves to the existing dead-letter queue. | The queue drains in SQS, rows appear in the Orders table, and you can send a bad order to watch it land in the dead-letter queue. This is the missing second half of checkout. | M |
| **Order e-mail through SNS.** The worker publishes "order confirmed" to the existing `omnicart-prod-events-topic`. | You receive an e-mail, and the topic's metrics tick up. | S (after the worker) |
| **Stock that really changes.** Placing an order lowers `Stock` with a DynamoDB transaction (check stock, write the order, empty the cart, atomically); the card shows LOW STOCK / SOLD OUT. | `Stock` changes in the products table; a rejected order shows as a failed condition in the metrics. Also fixes issue 9 below. | M |
| **CloudWatch metrics and a dashboard.** Count sign-ups, cart saves and orders; alarm (e-mail) when the dead-letter queue is not empty. | A dashboard with live graphs and an alarm you can trigger. | M |
| **DynamoDB Streams to Lambda.** Changes to carts or products trigger a Lambda (for example an "abandoned cart" log or a low-stock alert). | Lambda invocations and logs in CloudWatch after each change. | L |
| **Category filter using the `CategoryIndex`.** The index exists but nothing uses it yet. | Query activity on the index in the table's metrics. | S |
| **Product photos in S3.** Serve photos from the `omnicart-prod-media-...` bucket with presigned links. | Objects and requests in the bucket. | M |

If I were choosing: the status badges and the activity panel first (small, and they make everything else easier to
watch), then the order processor with SNS, which completes the journey browser, cart, queue, worker, Orders table,
e-mail.

## Tests

```powershell
cd Cloud_Native_plat
pip install -r requirements-dev.txt
pytest
```

82 tests, about 60 seconds, no AWS account or network (AWS is emulated with `moto`).
- `tests/test_register.py`: sign-up (every rule, no user left behind, retry works, rollback, rollback failing,
  duplicate email, non-text password).
- `tests/test_products.py`: the catalogue (count, variety, unique ids and names, price/stock/status rules, seeding
  into a table shaped like the CloudFormation one, `GET /api/products`).
- `tests/test_cart.py`: sign-in required, bad / ID / signed-out tokens refused, save, load, replace, empty deletes the
  item, validation (17 bad carts), 30-day TTL, expired items ignored, re-pricing, one user never seeing or touching
  another's cart, checkout (verified user, catalogue prices, cart emptied, guest checkout, bad token refused, invalid
  carts refused, order survives a failed clean-up).

`pytest.ini` limits collection to `tests/` because `test_platform.py` is named like a test but calls live AWS.

## What was verified

- The 82 tests, plus mutation checks: deliberately breaking the rollback, the user key, cart clearing, TTL handling,
  catalogue pricing, the quantity limit, the verified flag, the order's identity and bad-token handling each made a
  test fail.
- Two headless-Chromium runs against the real `server.py` and real data on emulated AWS (Cognito, DynamoDB, SQS):
  34 checks for search and sign-up, and 34 for carts. The cart run covers a guest cart merging into the saved cart at
  sign-in, saves, removal, reload and sign-in again, two users who never see each other's items, six clicks inside
  one save becoming two saves, checkout (DynamoDB item gone, SQS message correct), an item added in the same instant as
  checkout not bringing the cart back, a signed-out session, and guest checkout.
- **Not verified:** your real AWS account (no credentials here). So real Cognito's `GetUser` (documented, and the
  emulator behaved the same), the permissions in step 3, the AWS console link format, and DynamoDB's own TTL deletion
  are untested. The sandbox blocks the Tailwind and Lucide CDNs, so the browser runs used local copies of those
  libraries (a Tailwind 4 build; the page targets Tailwind 3, so spacing may differ slightly) and the three Unsplash
  photos were grey tiles. No automated browser test is committed; the browser runs were done from scratch scripts.

## Issues found, not changed

You asked to be told, so none of these were fixed. **[verified]** = reproduced on the original code;
**[read]** = from reading the code, not run. Items the earlier list had about orders and prices were fixed in
round 2 (change 5) and are no longer listed except for what remains.

**Fix soon**
1. **FIXED for hosting (round 3):** the server used to hand out your whole project folder (`GET /server.py`,
   `/deploy.ps1`, `/infrastructure/...`) and listened on every network interface. It now serves only the storefront and
   the API (everything else is a 404, tested) and listens on `127.0.0.1` unless you set `HOST` (see
   `EC2_DEPLOYMENT.md`). Still true once it is public: sign-up is open to anyone (issue 5).
2. **`destroy.ps1` would not delete your stack** [read]. It targets `omnicar-prod` (missing "t") in `us-east-1`;
   `deploy.ps1` creates `omnicart-prod` in `ap-south-1`. AWS treats deleting a missing stack as a no-op, so it would
   very likely print "all billable resources removed" while the NAT Gateway and ALB keep costing money.
3. **Region mismatch** [read]: the app, `test_platform.py` and Terraform use `us-east-1`; `deploy.ps1` and
   `DEPLOYMENT_GUIDE.md` use `ap-south-1`.
4. **Order ids can collide** [verified]: two orders in the same second get the same id (`ORD-<seconds>`). Order
   timestamps are written in local time but labelled `Z` [read].
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
10. **Malformed request bodies crash the sign-up, sign-in and order handlers without any HTTP response**
    [verified]; the new cart endpoint answers 400 instead. The server is single-threaded, so one slow Cognito call
    blocks every other visitor (it also keeps cart saves in order).
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
15. The signed-in badge still inserts the typed email into the page unescaped [read].
16. The AWS account id, pool id, client id, VPC id and load balancer name are hard-coded in `server.py`, the page
    (the account id is shown in the banner to every visitor) and the docs [read]. They are not credentials, but this
    GitHub repository is public, so once this folder is pushed they are visible to everyone and stay in git history.
    Consider moving them to environment variables and keeping the repository private if that matters to you.
17. The sign-in form's "pre-fill demo account" button bakes a password (`Password123!`) into the page [read].
18. The "DynamoDB: Active", "SQS: Ready" and "API Status: Online" badges are fixed text, not real checks [read]; the
    log line says "SRP" while the server receives the plain password and uses admin auth [read].
19. `/api/products` reads one page of the scan (1 MB cap) and ignores `LastEvaluatedKey` [read]; fine for 130 items.
20. The root `index.html` (the design-document viewer) is shadowed by the storefront in `server.py`, and loading
    the markdown with `fetch` is normally blocked when the file is double-clicked, despite the README saying to
    do that [read].
21. Sign-in tokens live in the page's memory only, so refreshing the page signs you out (your saved cart is back
    after you sign in again). Nothing refreshes a token before its one hour is up [read].
