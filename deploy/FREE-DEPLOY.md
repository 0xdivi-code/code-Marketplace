# Deploy Kiln online, free, on your own domain

Target: **https://your-domain.com** serving the real storefront and the admin
console, for **$0/month** — no sleeping, no ephemeral filesystem, no data loss on
deploy.

The only free hosts that can run this app are free **VMs**. Kiln is one
always-on Node process with an embedded PostgreSQL (PGlite) that writes to disk
behind a single-writer lock, plus private file storage on the same disk. Free
PaaS tiers (Render, Railway, Fly, Koyeb, Vercel) give you an ephemeral
filesystem and/or a process that sleeps, so the shop would lose its database —
that is why this guide is a VM and not a one-click deploy.

Time: **about 45 minutes**, most of it waiting for Oracle to provision.

---

## What you end up with

```
your-domain.com  →  Caddy (443, free auto-HTTPS)
                      ├── /dist            the React build
                      ├── /api/*           → 127.0.0.1:8787  (Hono API)
                      └── /robots.txt      → /api/robots.txt
                          /sitemap.xml     → /api/sitemap.xml

/var/lib/kiln/pg         PGlite database      ┐ persistent disk,
/var/lib/kiln/storage    private archives     ┘ survives redeploys
```

---

## Step 0 — The four things you must have first

| You need | Why | Free? |
| --- | --- | --- |
| Your domain | HTTPS, and cookies only work on one origin | you have it |
| A card in your own name | Oracle verifies identity with a ~$1 hold, never charged on Always Free | yes |
| Phone + email | SMS verification at signup | yes |
| ~45 min | most of it waiting on Oracle | — |

Your domain can stay where it is. You only add two DNS records in step 2.

---

## Step 1 — Create the server (Oracle Cloud Always Free)

1. Go to <https://www.oracle.com/cloud/free/> → **Start for free**.
2. Country, name and address **exactly as they appear on your card**. Mismatched
   or VPN/proxy signups are the main reason Oracle rejects accounts. Use a normal
   browser (ad-blockers sometimes break the card check) and a real card — prepaid
   and virtual cards fail.
3. **Home region: pick once, it is permanent.** Always Free compute can only be
   created there. For Lagos the sensible choices are **Europe West (London,
   `uk-london-1`)** or **Germany Central (Frankfurt, `eu-frankfurt-1`)** — 90–130 ms
   away, which is fine for a shop. Smaller regions have more free ARM capacity than
   the popular US ones.
4. Finish signup (card hold + SMS). This can take minutes.
5. In the console: **Compute → Instances → Create instance**.
   - **Image:** Canonical **Ubuntu 24.04** (aarch64, i.e. the normal ARM image).
   - **Shape:** *Change shape* → **Ampere** → **VM.Standard.A1.Flex**.
   - **OCPUs / memory:** try **1 OCPU / 6 GB** first, then **2 / 12** if that is
     rejected. Always Free gives a total of 2 OCPU / 12 GB per tenancy (it was
     4 / 24 until mid-2026), and new tenancies are often capped at 1 / 6.
     Check for the **Always Free-eligible** label before creating.
   - **Networking:** keep the public IPv4 assigned.
   - **SSH keys:** *Generate a key pair*. **Download the private key** — you cannot
     get it again.
6. **If you get "Out of host capacity":** this is normal, not your fault. Try a
   different availability domain, then the other region, and retry over a few
   days. It is not worth automating.
7. **If Oracle rejects the signup:** open a ticket with the exact error. Do not
   create a second account — that makes it worse. Fallback host in
   [Appendix B](#appendix-b--if-oracle-will-not-give-you-a-vm).

> Why that much is overkill: the API idles around 150–250 MB and a build needs
> about 1 GB. Oracle's AMD micro shape (`VM.Standard.E2.1.Micro`, 1 GB, two of
> them free) is enough — just add the swap in step 3.

### Open the ports — two firewalls, both required

This is the single most common reason Oracle sites are unreachable. Do **both**.

**a) Cloud side** — Networking → Virtual Cloud Networks → your VCN → *Security
Lists* → **Default Security List** → *Add Ingress Rules*:

| Source CIDR | Protocol | Destination port |
| --- | --- | --- |
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

(22/SSH is already open.)

**b) OS side** — the Ubuntu image ships iptables rules that drop 80/443 even when
the cloud list allows them. After you SSH in (step 2):

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo apt-get install -y iptables-persistent    # answer Yes to saving rules
sudo netfilter-persistent save
```

---

## Step 2 — Point your domain at it

1. Copy the instance's **Public IPv4 address** from the console.
2. At your DNS provider add:

| Type | Name | Value | TTL |
| --- | --- | --- | --- |
| `A` | `@` | your public IPv4 | 300 (or lowest offered) |
| `A` | `www` | your public IPv4 | 300 |

   Delete any old `A`/`AAAA` records for `@` and `www` (a stale `AAAA` sending
   traffic to an old host will break HTTPS). If your provider sits behind a
   proxy/CDN toggle (Cloudflare's orange cloud), **turn it off** for now — Caddy
   needs a direct answer to its HTTP-01 challenge. You can turn it back on later.
3. Wait, then check from your own machine:

```bash
dig +short your-domain.com          # must print the Oracle IP
```

Caddy will not issue a certificate until this resolves. If it does not, fix DNS
before step 7 — nothing else is wrong.

Connect:

```bash
chmod 600 ~/Downloads/ssh-key-*.key
ssh -i ~/Downloads/ssh-key-*.key ubuntu@YOUR_IP
```

---

## Step 3 — Install Node 22 and Caddy

Ubuntu's own `nodejs` package is 18, which **Vite 8 refuses to run**
(needs `^20.19 || >=22.12`). Use NodeSource:

```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl git build-essential ca-certificates

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v          # must be v22.x
```

Caddy from the official repo (Ubuntu's own package is old):

```bash
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update && sudo apt-get install -y caddy
caddy version
```

> **1 GB x86 instance?** Add swap before building, or `npm ci` gets OOM-killed:
> ```bash
> sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
> sudo mkswap /swapfile && sudo swapon /swapfile
> echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
> ```

---

## Step 4 — Get the code

The repository is **private**, so `git clone` on the server asks for a
credential. Pick whichever you prefer:

**A — deploy key (recommended; survives password changes)**

```bash
ssh-keygen -t ed25519 -C "kiln-server" -f ~/.ssh/id_ed25519 -N ""
cat ~/.ssh/id_ed25519.pub        # copy this
```

GitHub → repo → **Settings → Deploy keys → Add deploy key** → paste, leave
"Allow write access" **off**. Then:

```bash
git clone git@github.com:0xdivi-code/code-Marketplace.git /srv/kiln
```

**B — fine-grained token:** create one with read access to this repository, then
clone over HTTPS when prompted (username = your GitHub username, password = token).

Using either method, clone as the service user (that is what step 5 does) — not
as `ubuntu`, or half the files end up owned by the wrong account.

---

## Step 5 — Build and install the service

```bash
# A dedicated system user owns the app so the service never runs as you. Create
# it before clone so /srv/kiln belongs to it from the first commit.
sudo useradd --system --create-home --shell /usr/sbin/nologin kiln
sudo mkdir -p /srv/kiln
sudo chown -R kiln:kiln /srv/kiln

sudo -u kiln git clone git@github.com:0xdivi-code/code-Marketplace.git /srv/kiln
sudo -u kiln git -C /srv/kiln config --global --add safe.directory /srv/kiln
cd /srv/kiln
sudo -u kiln npm ci --include=dev   # a few minutes on ARM
sudo -u kiln npm run build          # emits dist/ — Caddy serves this
```

`--include=dev` matters: if `NODE_ENV=production` is exported in your shell (for
example after sourcing `.env`), plain `npm ci` **skips devDependencies** — and
`vite`, `tsx` and `typescript` all live there, so the build and the service both
fail. Let the service read `.env`, not your shell.

Two more things people get wrong here:

- **`dist/` must be built before any deploy or restart**, or the site is a 404
  while the API stays healthy.
- **The API does not serve the SPA.** `server/index.ts` has no static handler, so
  `GET /` returns `{"error":"Not found"}`. Caddy serves `dist/`; that is by design.

---

## Step 6 — Data directory, outside the repo

If you redeploy by deleting `/srv/kiln` and re-cloning, anything inside it dies.
Keep state in `/var/lib/kiln`:

```bash
sudo mkdir -p /var/lib/kiln/pg /var/lib/kiln/storage
sudo chown -R kiln:kiln /var/lib/kiln
sudo chmod 700 /var/lib/kiln/storage      # private archives
```

---

## Step 7 — Environment file

```bash
sudo cp /srv/kiln/deploy/kiln.env.example /srv/kiln/.env
sudo chown kiln:kiln /srv/kiln/.env && sudo chmod 600 /srv/kiln/.env
openssl rand -hex 32                       # copy the output into STORAGE_SECRET
sudo nano /srv/kiln/.env
```

Fill in, at minimum:

| Variable | Value |
| --- | --- |
| `PUBLIC_BASE_URL` | `https://your-domain.com` |
| `APP_ORIGINS` | `https://your-domain.com` (exact, no trailing slash) |
| `STORAGE_SECRET` | the `openssl rand -hex 32` output |
| `PGLITE_DIR` | `/var/lib/kiln/pg` |
| `STORAGE_DIR` | `/var/lib/kiln/storage` |
| `MAIL_LOG` | `/var/lib/kiln/mail.log` |
| `OWNER_EMAIL` / `OWNER_PASSWORD` | your real admin login (long, unique) |
| `TRUST_PROXY` | `true` |

`NODE_ENV=production` is already set, and with it:

- the app **refuses to boot** if `STORAGE_SECRET` is still the placeholder;
- CORS refuses any origin not listed in `APP_ORIGINS`/`PUBLIC_BASE_URL`;
- `reseed` refuses to run (good — see step 11).

---

## Step 8 — First run: schema, catalogue, owner account

Read these three lines; they are the whole first-run procedure.

```bash
cd /srv/kiln
sudo -u kiln npm run migrate     # creates/updates tables (idempotent)
sudo -u kiln npm run seed        # catalogue + owner account; safe to re-run
```

`seed` is safe to repeat: it upserts on natural keys and skips a catalogue that
already exists. `npm run reseed` is the destructive one and will not run here.

Test the API on its own before involving Caddy:

```bash
cd /srv/kiln && sudo -u kiln node_modules/.bin/tsx server/index.ts   # reads ./.env
# in a second SSH session:
curl -fsS http://127.0.0.1:8787/api/health
# {"ok":true,"database":"reachable","version":"PostgreSQL 18.6 …"}
```

`Ctrl-C` when you see `ok:true`. If it printed
`STORAGE_SECRET must be set…`, step 7 is incomplete.

---

## Step 9 — Run it as a service

```bash
sudo nano /etc/systemd/system/kiln.service
```

```ini
[Unit]
Description=Kiln marketplace
After=network.target

[Service]
Type=simple
User=kiln
Group=kiln
WorkingDirectory=/srv/kiln
EnvironmentFile=/srv/kiln/.env
ExecStart=/srv/kiln/node_modules/.bin/tsx /srv/kiln/server/index.ts
Restart=always
RestartSec=5

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/kiln /srv/kiln

[Install]
WantedBy=multi-user.target
```

`ProtectSystem=strict` makes everything read-only except the two paths listed —
that is the point: the app can only write the database, the archives and the log.

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now kiln
sudo systemctl status kiln --no-pager
journalctl -u kiln -n 40 --no-pager
```

You should see `kiln api http://localhost:8787` and no stack trace.

---

## Step 10 — Caddy, and the certificate

```bash
sudo cp /srv/kiln/deploy/Caddyfile /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile            # replace kiln.example.com with your domain
# Caddy runs as its own user: it must be able to read the build.
sudo chmod o+x /srv/kiln && sudo find /srv/kiln/dist -type d -exec chmod o+rx {} +
sudo systemctl enable caddy                 # already running with a default config
sudo caddy validate --config /etc/caddy/Caddyfile     # "Valid configuration"
sudo systemctl reload caddy
sudo journalctl -u caddy -n 40 --no-pager            # watch for the certificate
```

Caddy fetches a Let's Encrypt certificate on first request. If it loops on
"challenge failed", it is DNS (step 2) or ports 80/443 (step 1) — in that order.
Test port 80 from your laptop, not the server:

```bash
curl -I http://$(dig +short your-domain.com)
```

Then the real checks:

```bash
curl -fsS https://your-domain.com/                     # HTML with <title>Kiln
curl -fsS https://your-domain.com/api/health            # {"ok":true,…}
curl -sI https://your-domain.com/api/catalog | grep -i strict-transport-security   # API only
curl -fsS https://your-domain.com/robots.txt | head -3  # not the SPA shell
curl -fsS https://your-domain.com/sitemap.xml | head -2 # <urlset …
curl -so /dev/null -w '%{http_code}\n' https://your-domain.com/item/dubs  # 200
```

---

## Step 11 — Before you take a real payment

**Change the admin password** at `/admin/login` (first login, then enable 2FA),
and close the demo data — `seed` ships a demo storefront, including 14 customers
whose password is the published `demo1234`, plus fake orders and reviews.

The repo ships a script for exactly this. It refuses to run unless the API is
stopped, the env is production, and you pass `--yes`:

```bash
sudo systemctl stop kiln          # PGlite is single-writer: it must be stopped
cd /srv/kiln && sudo -u kiln node --env-file=.env server/scripts/clear-demo-data.ts --yes
sudo systemctl start kiln
```

It deletes orders (and their payments, licences and download grants via cascade),
reviews, coupons and the 14 demo customers, then prints what is left. The
catalogue, product files, pages, settings, banners and your owner account are
untouched. Coupons go too, deliberately: the seeded codes are printed in the repo.

**Payments and email.** Without `NOWPAYMENTS_API_KEY` + `NOWPAYMENTS_IPN_SECRET`
a paid checkout is *refused*, not faked. Set both, and put
`https://your-domain.com/api/webhooks/nowpayments` in the NOWPayments dashboard.
Without `RESEND_API_KEY`, receipts go to a log file — Admin → Notifications shows
"Development log" until you set it.

---

## Step 12 — Backups (do this the same day)

PGlite keeps a real PostgreSQL data directory. Copying it while the API runs
gives you a corrupt snapshot, so `backup.ts` refuses to run against a live
database — that is the guard working, not a bug. `deploy/nightly-backup.sh`
stops the service, backs up, and starts it again:

```bash
sudo install -m 755 /srv/kiln/deploy/nightly-backup.sh /usr/local/bin/kiln-backup
sudo /usr/local/bin/kiln-backup                     # try it now, read the output
sudo crontab -e
# 15 3 * * * /usr/local/bin/kiln-backup >> /var/log/kiln-backup.log 2>&1
```

It writes a timestamped directory to `/var/backups/kiln` containing the database,
`storage.tar.gz` (private archives) and a checksum manifest, and prunes anything
older than 14 days. **A backup on the same disk is not a backup** — copy it off
the machine nightly, e.g. with `rclone` to any remote you already have:

```bash
sudo apt-get install -y rclone && rclone config     # add a remote once
rclone copy /var/backups/kiln myremote:kiln-backups # put this in the same cron
```

Restore, when you need it:

```bash
sudo systemctl stop kiln
sudo -u kiln npx tsx /srv/kiln/server/scripts/restore.ts /var/backups/kiln/<timestamp>
sudo systemctl start kiln
```

Test a restore once, on a scratch machine, before you trust it.

## Step 13 — Deploying changes later

```bash
cd /srv/kiln
sudo -u kiln git pull
sudo -u kiln npm ci --include=dev
sudo -u kiln npm run build            # never skip: dist/ is served by Caddy
sudo systemctl restart kiln           # migrations run on boot
```

| If you changed… | Also do |
| --- | --- |
| `deploy/Caddyfile` | `sudo cp /srv/kiln/deploy/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy` |
| `deploy/kiln.env.example` | diff it against your `/srv/kiln/.env` and copy across new keys |
| `deploy/nightly-backup.sh` | `sudo install -m 755 /srv/kiln/deploy/nightly-backup.sh /usr/local/bin/kiln-backup` |
| `server/**` or `src/**` | nothing extra — restart runs migrations |

`.env`, the database and the archives are outside the repo, so this is safe to
repeat. Never run `npm run reseed` here: it rebuilds demo data and refuses in
production anyway. Keep the previous `dist/` if you want a one-command rollback:
`cp -a /srv/kiln/dist /srv/kiln/dist.prev` before building.

---

## If something does not work

| Symptom | Cause | Fix |
| --- | --- | --- |
| Site times out, API fine on the box | iptables still blocking 80/443 | Step 1b, then `netfilter-persistent save` |
| `502` / `connection refused` from Caddy | service down or wrong port | `journalctl -u kiln -n 50`, check `API_PORT=8787` |
| Caddy: "challenge failed" | DNS not pointing here, or a stale `AAAA` | `dig +short your-domain.com`, remove proxying |
| Service restarts in a loop, `STORAGE_SECRET must be set` | placeholder value in `.env` | Step 7 |
| Login returns 403 / silently fails | `APP_ORIGINS` missing the exact origin | Must be `https://your-domain.com`, no slash |
| Admin login says "too many attempts" | 6 attempts per IP / 15 min | Wait 15 minutes |
| `GET /` is `{"error":"Not found"}` | Caddy not running / no `dist/` | Step 10, `npm run build` |
| `dist/` 404s after a deploy | built as a different user | `sudo -u kiln npm run build` |
| `npm ci` killed on a 1 GB VM | no swap | Step 3 swap block |
| Redeploy lost products/orders | data dir inside the repo | Step 6, then restore a backup |
| API won't start: "already open by process N" | two instances share `PGLITE_DIR` | `systemctl stop kiln`; kill the stray process |
| Everything blank, console 404 on `/assets/…` | Caddy `root` path wrong | Must be `/srv/kiln/dist` |

---

## Appendix A — Files in this guide

| File | Use |
| --- | --- |
| `deploy/Caddyfile` | copy to `/etc/caddy/Caddyfile`, set your domain |
| `deploy/kiln.env.example` | copy to `/srv/kiln/.env`, fill the secrets |
| `DEPLOYMENT.md` | deeper reference: nginx alternative, operations, go-live checklist |

## Appendix B — If Oracle will not give you a VM

**Google Cloud Always Free e2-micro** is the fallback. It is *not* quite free: a
running external IPv4 costs about **$0.005/hour (~$3.65/month)** and the free
tier covers roughly one hour of it. The VM (1 vCPU, 1 GB, 30 GB disk) is free in
`us-west1`, `us-east1` or `us-central1`, and 1 GB of egress per month is the real
limit for a shop with images.

```bash
# in the GCP console: e2-micro, Ubuntu 24.04, allow HTTP/HTTPS, reserve a static IP
sudo apt-get install -y ufw && sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable
# then follow steps 3–13 unchanged (add the swap block — 1 GB RAM)
```

Everything else — Caddy, `dist/`, the env file, the systemd unit — is identical.
The same steps work on any $4–5/month VPS (Hetzner CX22, DigitalOcean) if you
later decide free-first is not worth the capacity lottery: swapping the host is
just re-running steps 3–10.

## Appendix C — Why not a free PaaS

| Host | Why it cannot run Kiln as-is |
| --- | --- |
| Vercel | Serverless filesystem is read-only outside `/tmp`; PGlite needs a persistent single-writer directory. |
| Render (free) | Sleeps after 15 min (~60 s cold start) and the disk is ephemeral — no persistent disk on free. |
| Railway | $1/month free credit ≈ 6 days of a 0.5 GB container. |
| Fly.io | No free tier for accounts created after Oct 2024. |
| Koyeb | No free persistent volumes; free tier has been in flux. |
| GCP always-free | Viable, but only *free* if you skip the external IPv4 (≈$3.65/month otherwise) and stay under 1 GB egress. |

A free PaaS becomes realistic only after the database moves to a hosted Postgres
and uploads move to object storage — that is an application change, not a deploy
setting.
