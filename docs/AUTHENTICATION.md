# AEMaaCS Authentication Guide

This guide explains how to authenticate the AEMaaCS MCP servers with your Adobe Experience Manager as a Cloud Service instance.

## Authentication Methods

AEMaaCS supports three authentication methods:

| Method | Use Case | Token Lifetime |
|--------|----------|----------------|
| **OAuth 2.0 Server-to-Server** | Production/Integration | Long-lived (configurable) |
| **Local Development Token** | Development | 24 hours |
| **Browser Session Token** | Quick testing | 12 hours |

---

## Method 1: OAuth 2.0 Server-to-Server (Recommended for Production)

### Prerequisites
- Access to Adobe Developer Console
- Appropriate product profiles assigned

### Step-by-Step Instructions

#### 1. Access Adobe Developer Console
Navigate to: https://developer.adobe.com/console/

#### 2. Create or Select a Project
1. Click **"Create new project"** or select an existing project
2. Name it (e.g., "AEM MCP Integration")

#### 3. Add AEM API
1. Click **"Add to Project"** → **"API"**
2. Select **"Experience Manager"** or **"AEM"**
3. Choose **"OAuth Server-to-Server"** credential type

#### 4. Configure Credentials
1. Provide a name for the credential
2. Select appropriate product profiles
3. Click **"Save configured API"**

#### 5. Get Credentials
You'll receive:
- **Client ID**: `a1b2c3d4e5f6...`
- **Client Secret**: `p9o8i7u6y5t4...`
- **Organization ID**: `...@AdobeOrg`
- **Technical Account ID**: `...@techacct.adobe.com`

#### 6. Update .env File
```env
AEM_AUTH_TYPE=oauth
AEM_CLIENT_ID=your-client-id
AEM_CLIENT_SECRET=your-client-secret
AEM_ORGANIZATION_ID=your-org-id@AdobeOrg
AEM_TECHNICAL_ACCOUNT_ID=your-tech-account@techacct.adobe.com
```

---

## Method 2: Local Development Token

### Prerequisites
- Access to AEM Developer Console

### Step-by-Step Instructions

#### 1. Access AEM Developer Console
Navigate to: https://experience.adobe.com/#/cloud-manager

#### 2. Navigate to Your Environment
1. Select your **Program**
2. Select your **Environment**
3. Click on **"Developer Console"**

#### 3. Get Local Development Token
1. Look for **"Integrations"** or **"Local Token"** tab
2. Click **"Get Local Development Token"**
3. Copy the entire token

#### 4. Update .env File
```env
AEM_AUTH_TYPE=token
AEM_ACCESS_TOKEN=your-development-token
```

> **Note**: Local development tokens expire after 24 hours.

---

## Method 3: Browser Session Token (Quick Testing)

This method extracts your existing browser session for quick testing.

### Step-by-Step Instructions

#### 1. Log in to AEM Author Instance
Log in to your AEMaaCS author instance through the browser.

#### 2. Open Browser Developer Tools
Press **F12** to open Developer Tools.

#### 3. Extract the Session Token

**Option A: From Network Tab**
1. Go to the **Network** tab
2. Make any request to AEM (refresh the page)
3. Click on any request to your AEM instance
4. Look in the **Headers** section
5. Find the `Cookie` header
6. Copy the `login-token` value

**Option B: From Application Tab**
1. Go to the **Application** tab (or **Storage** in Firefox)
2. Expand **Cookies**
3. Select your AEM domain
4. Find the cookie named `login-token`
5. Copy its value

#### 4. Decode the Token (if URL-encoded)
If the token starts with `login%3a`, it's URL-encoded. Decode it:
```javascript
// In browser console:
decodeURIComponent('login%3aeyJ...')
```
The decoded value will look like: `login:eyJhbGciOiJIUzI1NiI...`

#### 5. Extract Just the JWT
Remove the `login:` prefix to get the JWT token:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### 6. Update .env File
```env
AEM_AUTH_TYPE=token
AEM_ACCESS_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

> **Note**: Browser session tokens expire after approximately 12 hours.

---

## Testing Your Configuration

After configuring authentication, test the connection:

```bash
# Build the servers
npm run build --workspaces

# Start the read server
node packages/read-server/dist/index.js --http

# In another terminal, test the health endpoint
curl http://localhost:3001/health
```

A successful response indicates proper authentication.

---

## Troubleshooting

### Token Not Working

1. **Check Token Format**
   - JWT tokens start with `eyJh...`
   - Ensure no extra quotes or spaces

2. **Check Expiration**
   - Development tokens expire after 24 hours
   - Session tokens expire after ~12 hours
   - Generate a new token if expired

3. **Check Authorization Header Format**
   - Use: `Authorization: Bearer <token>`
   - NOT: `Authorization: <token>`

### Permission Denied (403)

1. **Check Product Profiles**
   - Ensure your user/service account has appropriate permissions
   - Contact your AEM administrator

2. **Check API Permissions**
   - For OAuth, verify the API has correct product profiles

### Cannot Find Token Generation UI

1. **AEM Developer Console**
   - Token generation is in the Developer Console, not the AEM UI
   - Access via Cloud Manager

2. **Permissions**
   - You need Developer role to access Developer Console

---

## Security Best Practices

1. **Never commit tokens to git**
   - `.env` file should be in `.gitignore`
   - Use environment-specific configurations

2. **Rotate tokens regularly**
   - Especially for development tokens
   - Delete unused tokens

3. **Use OAuth for production**
   - OAuth tokens can be automatically refreshed
   - Better audit trail

4. **Set appropriate expiration**
   - Use shortest practical lifetime
   - Prevents long-lived compromised tokens

---

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `AEM_HOST` | AEM instance hostname (without protocol) | Yes |
| `AEM_PORT` | AEM instance port (usually 443) | Yes |
| `AEM_PROTOCOL` | Protocol (http or https) | Yes |
| `AEM_AUTH_TYPE` | Authentication type: oauth, basic, or token | Yes |
| `AEM_ACCESS_TOKEN` | Access token (for token auth) | Conditional |
| `AEM_CLIENT_ID` | OAuth client ID | Conditional |
| `AEM_CLIENT_SECRET` | OAuth client secret | Conditional |
| `AEM_USERNAME` | Username (for basic auth - not recommended) | Conditional |
| `AEM_PASSWORD` | Password (for basic auth - not recommended) | Conditional |

---

## Additional Resources

- [Adobe Developer Console](https://developer.adobe.com/console/)
- [AEM as a Cloud Service Authentication](https://experienceleague.adobe.com/docs/experience-manager-cloud-service/content/implementing/developing/generating-access-tokens-for-server-side-apis.html)
- [Cloud Manager Developer Console](https://experienceleague.adobe.com/docs/experience-manager-cloud-service/content/implementing/using-cloud-manager/manage-environments.html#accessing-developer-console)

