# MCP Server Deployment Guide

This guide provides instructions for deploying the MCP Server to various environments, with specific details for Railway deployment.

## Prerequisites

- Node.js 18 or later
- npm or yarn package manager
- Dust API credentials
- Railway CLI (for Railway deployment)
- Git

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Required
DUST_API_KEY=your_dust_api_key
DUST_WORKSPACE_ID=your_workspace_id

# Optional with defaults
PORT=3000
NODE_ENV=production
SESSION_SECRET=generate_a_secure_secret
SESSION_TTL=1800000  # 30 minutes in ms
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_DIR=./uploads
STORAGE_PATH=./.sessions
LOG_LEVEL=info
```

## Local Development

1. Clone the repository:

   ```bash
   git clone https://github.com/your-org/dust-mcp-server.git
   cd dust-mcp-server
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   yarn install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

4. Start the development server:

   ```bash
   npm run dev
   # or
   yarn dev
   ```

The server will be available at `http://localhost:3000` by default.

## Railway Deployment

### Prerequisites

1. Install Railway CLI:

   ```bash
   npm i -g @railway/cli
   ```

2. Login to Railway:

   ```bash
   railway login
   ```

### Deployment Steps

1. Create a new Railway project:

   ```bash
   railway init
   ```

2. Link to an existing project (if applicable):

   ```bash
   railway link
   ```

3. Set environment variables:

   ```bash
   # Set individual variables
   railway variables set DUST_API_KEY your_dust_api_key
   railway variables set DUST_WORKSPACE_ID your_workspace_id
   
   # Or upload .env file
   railway variables < .env
   ```

4. Deploy the application:

   ```bash
   git push railway main
   ```

### Railway Configuration

#### Storage

The application requires persistent storage for sessions. Configure a volume in your `railway.toml`:

```toml
[deploy]
  [deploy.volumes]
    [deploy.volumes.sessions]
      mount_path = "/app/.sessions"
```

#### Health Checks

Configure health checks in `railway.toml`:

```toml
[healthcheck]
  path = "/health"
  initial_delay = 10
  interval = 5
  max_retries = 3
  timeout = 5
```

#### Scaling

Configure scaling in `railway.toml`:

```toml
[deploy]
  [deploy.service]
    instances = 1
    [deploy.service.autoscaling]
      min = 1
      max = 3
      target_cpu = 70
      target_memory = 80
```

## Docker Deployment

1. Build the Docker image:
   ```bash
   docker build -t dust-mcp-server .
   ```

2. Run the container:
   ```bash
   docker run -d \
     -p 3000:3000 \
     --env-file .env \
     -v ./sessions:/app/.sessions \
     -v ./uploads:/app/uploads \
     --name dust-mcp-server \
     dust-mcp-server
   ```

## Monitoring and Logs

### Railway Logs

View logs in the Railway dashboard or via CLI:

```bash
railway logs
```

### Health Endpoint

The server exposes a health check endpoint at `/health`:

```bash
curl https://your-railway-url.railway.app/health
```

### Metrics

Basic metrics are available at `/metrics` (Prometheus format).

## Maintenance

### Session Cleanup

Expired sessions are automatically cleaned up. To manually trigger cleanup:

1. Via HTTP endpoint (if enabled):

   ```bash
   curl -X POST https://your-railway-url.railway.app/api/admin/cleanup
   ```

2. Via CLI:

   ```bash
   npx ts-node scripts/cleanup-sessions.ts
   ```

### Backup

Backup session data by syncing the storage directory:

```bash
# For Railway
railway run tar -czf sessions-backup-$(date +%Y%m%d).tar.gz .sessions/
railway cp sessions-backup-*.tar.gz .
```


## Troubleshooting

### Common Issues

1. **Sessions not persisting**

   - Ensure storage volume is properly mounted
   - Check write permissions on the storage directory

2. **File uploads failing**

   - Verify `UPLOAD_DIR` exists and is writable
   - Check `MAX_FILE_SIZE` is sufficient

3. **Connection issues with Dust API**

   - Verify `DUST_API_KEY` is valid
   - Check network connectivity to Dust API

### Getting Help

For additional support:
1. Check the logs: `railway logs`
2. Open an issue on GitHub
3. Contact your system administrator
