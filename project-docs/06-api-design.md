# API Design

## 1. Overview

WingetWebUI requires a minimal API architecture for the MVP.

The primary purpose of the API layer is to provide a clean interface between the web application and external package data sources where direct client-side access is unsuitable or undesirable.

The API shall **not** duplicate functionality that can be efficiently performed in the client application.

The MVP does not require APIs for:

- User authentication
- User accounts
- User management
- Cloud-saved configurations
- Command execution
- Script execution
- Administrative package management

---

## 2. API Design Principles

The API shall follow these principles:

### 2.1 Minimal Surface Area

Only expose endpoints required by the current application requirements.

### 2.2 RESTful Design

Where a backend API is required, endpoints should follow conventional REST principles and use standard HTTP methods and status codes.

### 2.3 JSON-Based Communication

API requests and responses should use JSON unless another format is specifically required.

### 2.4 Statelessness

API requests should be independently processable. The server should not need to maintain a user's temporary package-selection state.

### 2.5 No Command Execution

The API shall never execute WinGet commands or generated scripts on behalf of the user.

The API is responsible only for providing data or application services.

### 2.6 Source Abstraction

External package data sources should be accessed through an abstraction layer so that the application is not tightly coupled to a single provider.

### 2.7 Versioning

The API should be versioned from the beginning to allow future changes without unnecessarily breaking existing clients.

Example:

```text
/api/v1/...
```

---

# 3. API Architecture

The conceptual architecture is:

```text
┌──────────────────────┐
│     Web Client       │
│                      │
│  Search              │
│  Browse              │
│  Selection           │
│  Configuration       │
│  Command Generation  │
└──────────┬───────────┘
           │
           │ HTTPS / JSON
           ▼
┌──────────────────────┐
│       API Layer      │
│                      │
│ Package API          │
│ Category API         │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Package Data Adapter │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ External Package     │
│ Data Source          │
└──────────────────────┘
```

Command generation, script generation, selection management, ordering, and configuration processing should remain client-side unless future requirements require server-side processing.

---

# 4. API Base URL

The production API should use a versioned base path:

```text
/api/v1
```

Example:

```text
/api/v1/packages
/api/v1/categories
```

The actual domain and deployment URL shall be determined during deployment planning.

---

# 5. Package API

## 5.1 List Packages

**Endpoint**

```http
GET /api/v1/packages
```

### Purpose

Retrieve packages available to WingetWebUI.

### Supported Query Parameters

```text
q
category
page
limit
```

Example:

```http
GET /api/v1/packages?q=visual+studio&category=development&page=1&limit=24
```

### Response

```json
{
  "data": [
    {
      "id": "Microsoft.VisualStudioCode",
      "name": "Visual Studio Code",
      "publisher": "Microsoft",
      "version": "latest",
      "description": "Source code editor.",
      "icon": "https://example.com/icon.png",
      "category": "Development"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 24,
    "total": 1
  }
}
```

The exact package metadata fields shall depend on the selected package data source.

---

# 6. Package Search API

## 6.1 Search Packages

**Endpoint**

```http
GET /api/v1/packages/search
```

### Purpose

Search for packages using a user-provided search query.

### Query Parameters

```text
q
category
limit
```

Example:

```http
GET /api/v1/packages/search?q=chrome&category=browsers&limit=20
```

### Response

```json
{
  "data": [
    {
      "id": "Google.Chrome",
      "name": "Google Chrome",
      "publisher": "Google",
      "category": "Browsers"
    }
  ]
}
```

### Search Behavior

The API may provide basic search functionality.

Fuzzy search should preferably be performed by the client when the complete package dataset is already available locally. If the dataset is too large for efficient client-side searching, fuzzy search may instead be implemented by the API.

The final implementation decision shall be based on the size and characteristics of the selected package data source.

---

# 7. Category API

## 7.1 List Categories

**Endpoint**

```http
GET /api/v1/categories
```

### Purpose

Retrieve the available package categories.

### Response

```json
{
  "data": [
    {
      "id": "development",
      "name": "Development"
    },
    {
      "id": "browsers",
      "name": "Browsers"
    },
    {
      "id": "communications",
      "name": "Communications"
    }
  ]
}
```

The initial categories are:

- Development
- Browsers
- Communications
- Microsoft Tools
- Multimedia
- Utilities
- Productivity
- Design & Creation
- Gaming
- Security & Privacy
- Cloud & Storage
- System Tools
- Others

---

# 8. Package Details API

## 8.1 Get Package Details

**Endpoint**

```http
GET /api/v1/packages/{packageId}
```

### Purpose

Retrieve detailed information about a specific package.

Example:

```http
GET /api/v1/packages/Microsoft.VisualStudioCode
```

### Response

```json
{
  "id": "Microsoft.VisualStudioCode",
  "name": "Visual Studio Code",
  "publisher": "Microsoft",
  "version": "latest",
  "description": "Source code editor.",
  "icon": "https://example.com/icon.png",
  "category": "Development"
}
```

---

# 9. API Health Endpoint

## 9.1 Health Check

**Endpoint**

```http
GET /api/v1/health
```

### Purpose

Provide a lightweight endpoint for determining whether the API service is operational.

### Response

```json
{
  "status": "ok"
}
```

This endpoint is primarily useful for monitoring and deployment verification.

---

# 10. Configuration Handling

The MVP does **not require server-side configuration APIs**.

Configuration operations should be handled locally by the web application.

### Save Configuration

The application maintains the current configuration in client-side application state.

### Export Configuration

The client serializes the configuration and generates a downloadable configuration file.

### Import Configuration

The client reads the selected configuration file, validates it, and loads the configuration.

Therefore, the MVP does not require endpoints such as:

```text
POST /api/v1/configurations
GET /api/v1/configurations
PUT /api/v1/configurations/{id}
DELETE /api/v1/configurations/{id}
```

These should only be introduced if cloud-based or account-based configuration storage becomes an actual project requirement.

---

# 11. Command and Script Generation

The MVP does not require server-side APIs for command or script generation.

The following operations should be performed by the client:

```text
Selected Packages
       │
       ▼
WinGet Options
       │
       ▼
Command Generator
       │
       ├── WinGet Command
       ├── PowerShell Script
       └── Batch Script
```

This provides immediate feedback when the user changes their selection or options and avoids unnecessary network requests.

---

# 12. Request Validation

The API shall validate incoming requests before processing them.

Validation should include:

- Required parameters
- Parameter types
- Maximum query length
- Pagination limits
- Valid category identifiers
- Valid package identifiers
- Supported query parameters

Invalid requests shall return an appropriate HTTP status code and a structured error response.

---

# 13. Error Response Format

API errors should use a consistent JSON structure.

Example:

```json
{
  "error": {
    "code": "PACKAGE_NOT_FOUND",
    "message": "The requested package could not be found."
  }
}
```

Common error codes may include:

| Error Code                   | Meaning                                |
| ---------------------------- | -------------------------------------- |
| `INVALID_REQUEST`            | Request parameters are invalid         |
| `PACKAGE_NOT_FOUND`          | Requested package does not exist       |
| `CATEGORY_NOT_FOUND`         | Requested category does not exist      |
| `PACKAGE_SOURCE_UNAVAILABLE` | External package source is unavailable |
| `RATE_LIMITED`               | Request rate limit has been exceeded   |
| `INTERNAL_ERROR`             | Unexpected server-side error           |

The API should avoid exposing stack traces, internal implementation details, credentials, or other sensitive information in error responses.

---

# 14. HTTP Status Codes

The API should use conventional HTTP status codes.

| Status                      | Usage                           |
| --------------------------- | ------------------------------- |
| `200 OK`                    | Successful request              |
| `400 Bad Request`           | Invalid request parameters      |
| `404 Not Found`             | Package or category not found   |
| `429 Too Many Requests`     | Rate limit exceeded             |
| `500 Internal Server Error` | Unexpected server-side error    |
| `502 Bad Gateway`           | External package source failure |
| `503 Service Unavailable`   | API temporarily unavailable     |

---

# 15. Caching

Package data is not expected to change continuously.

The API may therefore use caching to:

- Reduce requests to the external package source.
- Improve response times.
- Reduce external service dependency.
- Improve overall application performance.

The cache duration should be determined based on how frequently the selected package source changes.

The client may also cache package data locally where appropriate.

---

# 16. Rate Limiting

If a backend API is exposed publicly, reasonable rate limiting should be implemented to prevent excessive requests and abuse.

Rate limits should particularly apply to:

- Package search
- Package listing
- Package details

The exact limits should be determined during implementation and deployment based on expected traffic and infrastructure capabilities.

---

# 17. External Package Source Abstraction

The API shall not expose implementation-specific details of the underlying package source.

Conceptually:

```text
API
 │
 ▼
Package Service
 │
 ▼
Package Source Interface
 │
 ├── Source A
 ├── Source B
 └── Future Source
```

This allows the package data provider to be replaced or supplemented in the future without changing the public API contract.

---

# 18. Security Requirements

The API shall:

- Use HTTPS in production.
- Validate all incoming input.
- Sanitize data before returning or rendering it where appropriate.
- Apply rate limiting to public endpoints.
- Avoid exposing secrets or credentials.
- Avoid executing arbitrary commands received from clients.
- Avoid executing WinGet commands on the server.
- Treat external package data as untrusted input.
- Prevent unnecessary exposure of internal service information.

Most importantly, the API shall **never execute a WinGet command on behalf of a remote user**.

WingetWebUI generates commands and scripts for the user to execute locally.

---

# 19. CORS

If the frontend and API are deployed on different origins, the API shall use a restrictive CORS policy that allows only the required frontend origin(s).

Wildcard CORS access should not be used unnecessarily in production.

If the frontend and API are deployed under the same origin, separate CORS configuration may not be necessary.

---

# 20. API Versioning

The public API shall use explicit versioning.

Current version:

```text
/api/v1
```

Breaking changes should result in a new API version rather than silently changing the behavior of an existing version.

Example:

```text
/api/v1/packages
/api/v2/packages
```

---

# 21. MVP API Summary

The initial API surface should remain intentionally small.

| Method | Endpoint                       | Purpose                  |
| ------ | ------------------------------ | ------------------------ |
| `GET`  | `/api/v1/health`               | Check API availability   |
| `GET`  | `/api/v1/packages`             | Retrieve packages        |
| `GET`  | `/api/v1/packages/search`      | Search packages          |
| `GET`  | `/api/v1/packages/{packageId}` | Retrieve package details |
| `GET`  | `/api/v1/categories`           | Retrieve categories      |

No authentication, configuration-storage, command-execution, or administrative endpoints are required for the MVP.

---

# 22. Client-Side Responsibilities

The following functionality should remain client-side in the MVP:

- Package selection
- Multi-selection
- Range selection
- Selection ordering
- Drag-and-drop reordering
- Selection count
- Card/List View switching
- Fuzzy search when practical
- WinGet option configuration
- WinGet command generation
- PowerShell script generation
- Batch script generation
- Command copying
- Script downloading
- Configuration creation
- Configuration validation
- Configuration import
- Configuration export

Keeping these operations client-side reduces network traffic and provides the fast, real-time behavior required by the project vision.

---

# 23. Future API Extensions

Additional endpoints may be introduced only when new requirements justify them.

Potential future APIs include:

```text
Authentication
/api/v1/auth/...

User Accounts
/api/v1/users/...

Cloud Configurations
/api/v1/configurations/...

Shared Configurations
/api/v1/shared-configurations/...

Administration
/api/v1/admin/...

Custom Package Sources
/api/v1/sources/...
```

These endpoints are outside the current MVP scope.

---

# 24. Final API Architecture

The intended MVP API architecture can therefore be summarized as:

```text
                    ┌─────────────────────┐
                    │    Web Frontend     │
                    └──────────┬──────────┘
                               │
                         HTTPS / JSON
                               │
                               ▼
                    ┌─────────────────────┐
                    │      API Layer      │
                    │                     │
                    │ Packages            │
                    │ Search              │
                    │ Categories          │
                    │ Health               │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Package Data        │
                    │ Adapter / Service   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ External Package    │
                    │ Data Source         │
                    └─────────────────────┘


        Client-Side Operations
        ───────────────────────

        Selection
           ↓
        Ordering
           ↓
        WinGet Options
           ↓
        Command Generation
           ↓
        Script Generation
           ↓
        Copy / Download / Export
```

The guiding principle is:

> **Use an API where external data or backend services are genuinely required; keep fast, user-specific operations in the client.**
