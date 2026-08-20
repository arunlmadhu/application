# FreshCart Backend — Build & AWS Deployment Guide

A Spring Boot REST API backend for the FreshCart grocery app, built with
Maven. It replaces the frontend's `localStorage`-only demo data and the
insecure client-side admin check with a real database, hashed passwords,
and JWT authentication.

## 0. Frontend is now bundled in this jar

The FreshCart UI (`index.html`, `error.html`, `css/style.css`, `js/app.js`)
is included under `src/main/resources/static/` and is served directly by
Spring Boot as static content. That means a single `mvn clean package` +
deploy gives you both the web app and the API from one URL — no separate
S3/CloudFront hosting step needed:

- `GET /` → the FreshCart web app
- `GET /api/...` → the REST API described below

The frontend still uses its original demo behavior (localStorage for
cart/products, client-side admin check) unless you update `js/app.js` to
call the API — see section 6 below for what that involves.

## What this backend does

| Frontend feature (from `app.js`)              | Backend equivalent                                   |
|-------------------------------------------------|-------------------------------------------------------|
| `SEED_PRODUCTS` in localStorage                 | `products` table, seeded on first boot                |
| `ADMIN_CREDENTIALS` hardcoded in JS              | `users` table, bcrypt-hashed passwords, JWT login      |
| Customer login (demo, no real check)             | `POST /api/auth/register`, `POST /api/auth/login`     |
| Admin product add/edit/delete                    | `POST/PUT/DELETE /api/products/{id}` (ADMIN role only)|
| Admin dashboard stats                            | `GET /api/admin/stats`                                 |
| Cart checkout (demo, no real order)              | `POST /api/orders` — validates stock, decrements it, creates an order record |

### API summary

```
POST   /api/auth/register        public   - create a customer account
POST   /api/auth/login           public   - returns a JWT for customer or admin
GET    /api/products             public   - list products (?category=, ?search=)
GET    /api/products/{id}        public
POST   /api/products             ADMIN
PUT    /api/products/{id}        ADMIN
DELETE /api/products/{id}        ADMIN
GET    /api/admin/stats          ADMIN    - total products, low stock, stock value, order count
POST   /api/orders               logged-in customer - checkout
GET    /api/orders/my            logged-in customer - my order history
GET    /api/orders               ADMIN    - all orders
```

Send the JWT from login/register as `Authorization: Bearer <token>` on
subsequent requests.

A default admin account is auto-created on first boot from the
`ADMIN_EMAIL` / `ADMIN_PASSWORD` environment variables (defaults:
`admin@freshcart.com` / `Admin@123` — **change these before going live**).

---

## 1. Build locally with Maven

Requires JDK 17+ and Maven 3.9+ (or use the included wrapper if you add one).

```bash
cd freshcart-backend
mvn clean package
```

This produces `target/freshcart-backend.jar`, an executable "fat jar".

Run it locally (uses an in-memory H2 database — no setup needed):

```bash
java -jar target/freshcart-backend.jar
```

The API is now at `http://localhost:8080`. Try it:

```bash
curl http://localhost:8080/api/products
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@freshcart.com","password":"Admin@123"}'
```

The H2 console is available at `http://localhost:8080/h2-console`
(JDBC URL `jdbc:h2:mem:freshcart`, user `sa`, blank password) for local
inspection only — it's disabled in the `prod` profile.

---

## 2. Provision an AWS RDS database

1. **RDS console → Create database**
   - Engine: **MySQL** (8.0) — matches the `mysql-connector-j` dependency in `pom.xml`. (Swap the driver for `org.postgresql:postgresql` in `pom.xml` if you'd rather use Postgres.)
   - Templates: Free tier (for testing) or Production, as needed.
   - Set a master username/password — store these in **AWS Secrets Manager**.
   - Public access: **No** (keep it private; only your app's security group should reach it).
   - Note the endpoint hostname once created, e.g. `freshcart-db.xxxxx.us-east-1.rds.amazonaws.com`.
2. **Create the database/schema** the app will use (e.g. `freshcart`) via the RDS query editor or a MySQL client from a bastion/EC2 instance in the same VPC.
3. **Security group**: allow inbound port `3306` from the security group your compute (Elastic Beanstalk/ECS) will run in — not from `0.0.0.0/0`.

You'll use the endpoint to build this connection string for the app:

```
jdbc:mysql://<rds-endpoint>:3306/freshcart?useSSL=true&serverTimezone=UTC
```

---

## 3. Deploy option A — AWS Elastic Beanstalk (simplest, Maven-built jar)

Elastic Beanstalk's Java (Corretto) platform runs the jar Maven built
directly — no Docker required.

1. Install the EB CLI: `pip install awsebcli --upgrade --user`
2. From the project root:

   ```bash
   mvn clean package
   eb init -p corretto-17 freshcart-backend --region us-east-1
   eb create freshcart-env
   ```

3. Set environment variables (never commit real secrets — use `eb setenv`
   or the EB console, ideally pulling values from Secrets Manager):

   ```bash
   eb setenv \
     SPRING_PROFILES_ACTIVE=prod \
     SPRING_DATASOURCE_URL="jdbc:mysql://<rds-endpoint>:3306/freshcart?useSSL=true&serverTimezone=UTC" \
     SPRING_DATASOURCE_USERNAME="freshcart_app" \
     SPRING_DATASOURCE_PASSWORD="<rds-password>" \
     JWT_SECRET="$(openssl rand -base64 48)" \
     CORS_ALLOWED_ORIGINS="https://your-frontend-domain.example" \
     ADMIN_EMAIL="admin@yourcompany.com" \
     ADMIN_PASSWORD="<strong unique password>"
   ```

4. Deploy (and redeploy on every future change):

   ```bash
   eb deploy
   ```

5. `eb open` to view it in the browser. Health checks hit
   `/actuator/health` (already wired up via `.ebextensions/options.config`).

The `Procfile` and `.ebextensions/options.config` in this project are
already set up for this workflow — EB detects them automatically.

---

## 4. Deploy option B — Docker on ECS/Fargate

Use this if you'd rather run containers than EB's managed jar hosting.

1. Build and push the image:

   ```bash
   aws ecr create-repository --repository-name freshcart-backend
   aws ecr get-login-password --region us-east-1 | \
     docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

   docker build -t freshcart-backend .
   docker tag freshcart-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/freshcart-backend:latest
   docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/freshcart-backend:latest
   ```

2. Create an ECS Fargate service (via console, `aws ecs`, or Copilot/CDK)
   pointing at that image, with:
   - Container port `8080`
   - Task role with access to Secrets Manager for DB credentials/JWT secret
   - The same environment variables listed in step 3 above, injected as
     task definition environment variables or `secrets` (from Secrets
     Manager) rather than plain env vars for `SPRING_DATASOURCE_PASSWORD`
     and `JWT_SECRET`
   - An Application Load Balancer target group health check on
     `/actuator/health`
   - Security group allowing inbound 443/80 from the ALB, and outbound
     3306 to the RDS security group

---

## 5. Optional — CI/CD with CodePipeline/CodeBuild

`buildspec.yml` is included for CodeBuild: it runs `mvn test` then
`mvn clean package` and publishes `target/freshcart-backend.jar` (plus
`Procfile` and `.ebextensions`) as the build artifact, ready for a
CodePipeline "Deploy to Elastic Beanstalk" stage. Point a CodeBuild
project at this repo with that buildspec and wire it into a pipeline
triggered on your `main` branch.

---

## 6. Connect the existing frontend

In `js/app.js`, replace the `localStorage`-based product/cart/login logic
with calls to this API's base URL (e.g. your EB environment URL or
CloudFront-fronted ALB), sending the JWT from `/api/auth/login` as a
Bearer token on admin and checkout requests. Set `CORS_ALLOWED_ORIGINS`
above to wherever you host `index.html` (S3/CloudFront, Netlify, etc.)
so the browser's CORS preflight succeeds.

---

## Security checklist before going live

- [ ] Change `ADMIN_EMAIL` / `ADMIN_PASSWORD` from the defaults
- [ ] Generate a long random `JWT_SECRET` (32+ bytes) and keep it out of source control
- [ ] Put DB credentials and `JWT_SECRET` in AWS Secrets Manager / Parameter Store, not plaintext env vars, for any real deployment
- [ ] Restrict RDS security group to only your app's security group
- [ ] Set `CORS_ALLOWED_ORIGINS` to your real frontend origin(s) only
- [ ] Put the app behind HTTPS (ALB/CloudFront with an ACM certificate)
- [ ] Consider Flyway/Liquibase migrations instead of `ddl-auto: update` for schema changes over time
