# CloudScale SaaS Platform - Frequently Asked Questions (FAQ)

## Section 1: Accounts, Billing, and Subscription

### Q: How do I change my billing cycle from monthly to annual?
To change your billing cycle from monthly to annual:
1. Log in to the CloudScale Console.
2. Select your Organization from the top-left dropdown.
3. Click on **Billing & Subscriptions** in the left sidebar navigation.
4. Locate your active plan card and click **Manage Plan**.
5. Select the **Annual Billing** toggle.
6. Click **Confirm Changes**. Your account will be charged the discounted annual rate immediately, and a prorated credit for any remaining days in your current monthly cycle will be applied to your invoice. Annual billing offers a 20% discount compared to monthly payments.

### Q: How is pricing calculated for Redis Databases?
CloudScale Managed Redis databases are priced hourly based on the memory capacity and replication configuration:
- **Cache-T1 (1GB RAM, Single Node)**: $0.015/hour (~$11/month)
- **Cache-M1 (4GB RAM, HA with Replica)**: $0.08/hour (~$58/month)
- **Cache-Production (16GB RAM, Cluster Mode, Multi-Replica)**: $0.32/hour (~$230/month)
Network ingress is free, but egress to the public internet is billed at $0.08 per GB. Data transfer within the same CloudScale region is free of charge.

### Q: How do I invite team members to my organization?
To collaborate with others, you can invite them to your CloudScale organization:
1. Navigate to the Console and select **Settings** from the sidebar.
2. Click on the **Members** tab.
3. Click the **Invite Member** button in the top right.
4. Enter the email address of the team member.
5. Select a Role:
   - **Owner**: Full access, including billing and organization deletion.
   - **Admin**: Can manage all resources, settings, and invites, but cannot view billing or delete the organization.
   - **Developer**: Can manage applications, databases, and services, but cannot edit organization settings or member roles.
   - **Viewer**: Read-only access to all services and logs.
6. Click **Send Invitation**. The invitee will receive an email link valid for 7 days.

---

## Section 2: Hosting and Compute Services

### Q: Does CloudScale support automatic scaling for compute instances?
Yes, CloudScale supports auto-scaling for Compute Groups. You can define auto-scaling policies based on CPU utilization, memory usage, or HTTP request rates:
1. Go to the **Compute** section in the console.
2. Select your **Compute Group** (or create a new one).
3. Click the **Scaling** tab.
4. Toggle **Auto-scaling** to ON.
5. Set the **Minimum Instances** (default: 1) and **Maximum Instances** (default: 10).
6. Choose the **Trigger Metric** (e.g., CPU Utilization > 70% sustained for 3 minutes).
7. Configure the **Cooldown Period** (default: 300 seconds) to prevent rapid scaling loops.
Auto-scaling checks occur every 60 seconds. New instances are provisioned in approximately 15-30 seconds.

### Q: Can I host static websites on CloudScale?
Yes, CloudScale Static Sites provides optimized, CDN-backed hosting for static assets (HTML, CSS, JS, images).
- **Deployment**: Connect your GitHub repository, and CloudScale will automatically build and deploy your site on every push. Supported frameworks include Hugo, Gatsby, Next.js (SSG), Vite, and Jekyll.
- **Global CDN**: Assets are cached across 45 edge locations globally.
- **SSL**: Custom domains get automatic, free SSL certificates renewed via Let's Encrypt.
- **Limits**: The maximum file size for a single asset uploaded to a Static Site is 100MB. Sites exceeding 10GB of total size will be throttled or prompt an upgrade to the Enterprise plan.

### Q: How do I configure SSL for my custom domain?
CloudScale automatically provisions and renews SSL/TLS certificates via Let's Encrypt for all custom domains attached to Compute Groups and Static Sites.
1. Add your custom domain in the **Domains** settings page of your service.
2. Point your domain's DNS `CNAME` record to your CloudScale app endpoint (e.g., `app-123.cloudscale.net`). If configuring a root domain, use an `ALIAS` or `ANAME` record, or configure DNS mapping through CloudScale's DNS servers.
3. Once the DNS propagates, CloudScale will verify ownership and issue the certificate within 10 minutes.
4. HTTP traffic is redirected to HTTPS automatically.

---

## Section 3: Managed Databases

### Q: What is the SLA for Postgres Databases?
We offer two tiers of SLA for Managed PostgreSQL:
- **Development Tier (Single Node)**: 99.9% uptime SLA. Suitable for development and staging, but not recommended for production because it lacks automated failover.
- **Production Tier (High Availability / Multi-AZ)**: 99.99% uptime SLA. Features synchronous replication to a standby instance in a separate Availability Zone. In the event of a primary node failure, failover occurs automatically within 30 seconds with zero data loss.
If we fail to meet these uptime guarantees in a given billing month, you are eligible for service credits (10% credit for uptime < 99.9%, 25% credit for uptime < 99.0%).

### Q: How do I recover a deleted database?
When a managed database (Postgres or Redis) is deleted, CloudScale retains a **Final Backup** for 30 days unless "Purge Immediately" was explicitly selected during deletion.
To restore a deleted database:
1. Navigate to the **Databases** dashboard.
2. Select the **Backups** tab from the top navigation.
3. Filter by **Deleted Databases**.
4. Locate the database in the list and click **Restore**.
5. Choose a new name for the restored database instance and select the compute plan.
6. Click **Confirm Restore**. The restore process will spin up a new database instance and load the backup, which typically takes between 5 and 15 minutes depending on the dataset size.

### Q: How do I connect to my Postgres database locally?
For security, Managed Postgres databases do not expose public endpoints by default. To connect from your local machine:
1. **IP Whitelisting**: Go to your Database settings -> **Network & Security** tab. Add your local IP address to the **Whitelisted IPs** list.
2. **SSL Connection**: CloudScale requires SSL connections. Download the CloudScale Root CA certificate from the console and use the `sslmode=verify-ca` or `sslmode=require` flags in your connection string.
3. **Connection String Format**:
   `postgresql://[user]:[password]@[host]:5432/[db_name]?sslmode=require`
Alternatively, you can configure a secure SSH Tunnel through a bastion host inside your CloudScale VPC, which is the recommended method for production environments.

### Q: Does CloudScale support multi-region replication for databases?
Yes, Managed Postgres supports read-only cross-region replicas:
- You can create up to 5 read replicas in any available CloudScale region.
- Replication is asynchronous, and typical cross-region replica lag is under 1 second under normal workloads.
- Replicas can be promoted to a standalone primary database in the event of a disaster or region outage.
- Cross-region replication incurs standard network egress charges ($0.08/GB) for all replicated write traffic.

---

## Section 4: Troubleshooting and Common Errors

### Q: Why is my build failing with "out of memory" error?
An "out of memory" (OOM) error during the build phase typically means your application's build script exceeded the RAM limit of the build container. By default, CloudScale build containers are allocated **2GB of RAM**.
To fix this:
1. **Optimize dependencies**: Check for large unused dependencies or heavy bundler configurations.
2. **Node.js Memory Limit**: If building a Javascript/Node.js app, set the `NODE_OPTIONS` environment variable to increase the memory limit, e.g., `NODE_OPTIONS="--max-old-space-size=1536"`.
3. **Upgrade Build Plan**: Go to **Service Settings** -> **Build Settings** in the console and increase the build container size. We offer **Pro Build Containers (4GB RAM)** and **Max Build Containers (8GB RAM)** for an additional flat fee of $5/month and $15/month respectively.

### Q: Does CloudScale offer managed backup services?
Yes, CloudScale provides automated daily backups for all managed database instances.
- **Retention**: Daily backups are retained for 7 days on the standard plan, and up to 30 days on the production database plans.
- **Point-in-Time Recovery (PITR)**: Production Tier databases support PITR, allowing you to restore your database to any specific second within the last 14 days.
- **Manual Snapshots**: You can trigger a manual backup snapshot at any time via the console or CLI. Manual backups are retained indefinitely until you delete them.
- **Storage**: Backups are stored in geo-replicated object storage and do not consume your database's allocated disk space.
