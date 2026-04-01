# Whiskey Riders API Reference

## Authentication

All API endpoints require Bearer token authentication in the `Authorization` header:

```
Authorization: Bearer <user_auth_token>
```

## Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    // response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Descriptive error message",
  "code": "ERROR_CODE"
}
```

---

## Trips API

### List Trips
```
GET /api/trips
```

**Query Parameters:**
- `page` (number, default: 1) - Page number for pagination
- `limit` (number, default: 25, max: 100) - Results per page
- `status` (string: upcoming|active|completed|cancelled) - Filter by status
- `country` (string) - Filter by country

**Response:**
```json
{
  "success": true,
  "data": {
    "trips": [
      {
        "id": "uuid",
        "slug": "morocco-2027",
        "name": "Morocco 2027",
        "destination": "Marrakech",
        "country": "Morocco",
        "start_date": "2027-06-01T00:00:00Z",
        "end_date": "2027-06-10T00:00:00Z",
        "description": "Epic desert ride",
        "cover_image_url": "https://...",
        "status": "upcoming",
        "max_members": 30,
        "created_by": "user-uuid",
        "created_at": "2025-03-31T10:00:00Z",
        "updated_at": "2025-03-31T10:00:00Z"
      }
    ],
    "pagination": {
      "total": 5,
      "limit": 25,
      "offset": 0
    }
  }
}
```

---

### Create Trip
```
POST /api/trips
```

**Required Role:** `admin`, `super_admin`

**Body:**
```json
{
  "name": "Morocco 2027",
  "destination": "Marrakech",
  "country": "Morocco",
  "start_date": "2027-06-01",
  "end_date": "2027-06-10",
  "description": "Optional description",
  "cover_image_url": "https://...",
  "status": "upcoming",
  "max_members": 30
}
```

**Response:** 201 Created with trip object

---

### Get Trip Details
```
GET /api/trips/{id}
```

**Response:** Includes trip + members array with profiles

---

### Update Trip
```
PUT /api/trips/{id}
```

**Required Role:** `admin`, `super_admin`

**Body:** Any subset of trip fields

---

### Delete Trip
```
DELETE /api/trips/{id}
```

**Required Role:** `super_admin` only

⚠️ **Warning:** Deletes all related data (members, payments, documents, updates, awards)

---

## Trip Members API

### List Trip Members
```
GET /api/trips/{tripId}/members
```

**Response:**
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "id": "uuid",
        "trip_id": "trip-uuid",
        "user_id": "user-uuid",
        "trip_role": "captain",
        "joined_at": "2025-03-31T10:00:00Z",
        "profiles": {
          "id": "user-uuid",
          "email": "user@example.com",
          "full_name": "John Smith",
          "avatar_url": "https://...",
          "role": "member"
        }
      }
    ]
  }
}
```

---

### Add Member to Trip
```
POST /api/trips/{tripId}/members
```

**Required Role:** `admin` or `super_admin` or trip admin

**Body:**
```json
{
  "user_id": "user-uuid",
  "trip_role": "member"  // optional, defaults to "member"
}
```

**Valid trip_roles:** `captain`, `kitty_man`, `organiser`, `member`

---

## Payments API

### List Payments
```
GET /api/trips/{tripId}/payments
```

**Query Parameters:**
- `page` - Pagination
- `limit` - Results per page
- `status` - Filter: `pending`, `paid`, `overdue`, `waived`
- `user_id` - Filter by user (members see only their own)

**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [...],
    "totals": {
      "total": 5000,
      "paid": 3000,
      "pending": 2000,
      "count": 10
    },
    "pagination": { ... }
  }
}
```

---

### Create Payment
```
POST /api/trips/{tripId}/payments
```

**Required Role:** `admin`, `super_admin`

**Body:**
```json
{
  "user_id": "user-uuid",
  "description": "Trip deposit",
  "amount": 500,
  "due_date": "2027-05-01",
  "paid_date": null,
  "status": "pending",
  "notes": "First installment"
}
```

**Valid statuses:** `pending`, `paid`, `overdue`, `waived`

---

## Awards & Voting API

### List Awards
```
GET /api/trips/{tripId}/awards
```

**Response:**
```json
{
  "success": true,
  "data": {
    "awards": [
      {
        "id": "award-uuid",
        "trip_id": "trip-uuid",
        "name": "Most Helpful Rider",
        "description": "Most helpful to other riders",
        "emoji": "🤝",
        "is_active": true,
        "vote_count": 12,
        "winner_id": "user-uuid",
        "winner_votes": 5
      }
    ]
  }
}
```

---

### Create Award
```
POST /api/trips/{tripId}/awards
```

**Required Role:** `admin`, `super_admin`, or trip admin

**Body:**
```json
{
  "name": "Most Helpful Rider",
  "description": "Optional description",
  "emoji": "🤝"
}
```

---

### Get Vote Results
```
GET /api/trips/{tripId}/awards/{awardId}/vote
```

**Response:**
```json
{
  "success": true,
  "data": {
    "votes": [
      {
        "id": "vote-uuid",
        "award_id": "award-uuid",
        "voter_id": "voter-uuid",
        "nominee_id": "nominee-uuid",
        "created_at": "2027-06-10T18:00:00Z",
        "voters": { ... },
        "nominees": { ... }
      }
    ],
    "votes_by_nominee": {
      "nominee-uuid-1": 3,
      "nominee-uuid-2": 5
    },
    "total_votes": 8
  }
}
```

---

### Cast/Update Vote
```
POST /api/trips/{tripId}/awards/{awardId}/vote
```

**Body:**
```json
{
  "nominee_id": "user-uuid"
}
```

💡 **Note:** Calling this endpoint again with a different nominee changes their vote

---

## Documents API

### List Documents
```
GET /api/trips/{tripId}/documents
```

**Query Parameters:**
- `page`, `limit` - Pagination

**Response:**
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "doc-uuid",
        "trip_id": "trip-uuid",
        "user_id": null,
        "name": "Trip Itinerary.pdf",
        "file_url": "https://...",
        "file_type": "application/pdf",
        "is_admin_upload": true,
        "uploaded_by": "admin-uuid",
        "created_at": "2025-03-31T10:00:00Z",
        "uploaded_by_user": {
          "id": "admin-uuid",
          "full_name": "Admin Name",
          "avatar_url": "https://..."
        }
      }
    ],
    "pagination": { ... }
  }
}
```

---

### Upload Document
```
POST /api/trips/{tripId}/documents
```

**Body:**
```json
{
  "name": "Trip Itinerary.pdf",
  "file_url": "https://storage-url/file.pdf",
  "file_type": "application/pdf",
  "user_id": null,  // optional, for user-specific docs
  "is_admin_upload": true  // optional
}
```

---

## Trip Updates API

### List Updates
```
GET /api/trips/{tripId}/updates
```

**Query Parameters:**
- `page`, `limit` - Pagination

**Response:**
```json
{
  "success": true,
  "data": {
    "updates": [
      {
        "id": "update-uuid",
        "trip_id": "trip-uuid",
        "title": "We're leaving tomorrow!",
        "content": "Get ready, the adventure starts at 6am...",
        "author_id": "user-uuid",
        "published_at": "2027-05-31T18:00:00Z",
        "created_at": "2027-05-31T18:00:00Z",
        "author": {
          "id": "user-uuid",
          "full_name": "Trip Admin",
          "avatar_url": "https://..."
        }
      }
    ],
    "pagination": { ... }
  }
}
```

---

### Create Update
```
POST /api/trips/{tripId}/updates
```

**Required Role:** Trip admin or higher

**Body:**
```json
{
  "title": "We're leaving tomorrow!",
  "content": "Get ready, the adventure starts at 6am..."
}
```

**Note:** All trip members are automatically notified

---

## Members API

### List All Members
```
GET /api/members
```

**Required Role:** `admin`, `super_admin`

**Query Parameters:**
- `page`, `limit` - Pagination
- `search` - Search by name or email

**Response:**
```json
{
  "success": true,
  "data": {
    "members": [
      {
        "id": "user-uuid",
        "email": "user@example.com",
        "full_name": "John Smith",
        "avatar_url": "https://...",
        "bio": "Motorcycle enthusiast",
        "role": "member",
        "phone": "+1234567890",
        "emergency_contact": "Jane Smith",
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-03-31T10:00:00Z",
        "trip_count": 3
      }
    ],
    "pagination": { ... }
  }
}
```

---

### Get Member Profile
```
GET /api/members/{userId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "user@example.com",
    "full_name": "John Smith",
    "avatar_url": "https://...",
    "bio": "Motorcycle enthusiast",
    "phone": "+1234567890",
    "emergency_contact": "Jane Smith",
    "role": "member",
    "trips": [
      {
        "trip_id": "trip-uuid",
        "trip_role": "captain",
        "trips": {
          "id": "trip-uuid",
          "name": "Morocco 2027",
          "slug": "morocco-2027",
          "start_date": "2027-06-01",
          "end_date": "2027-06-10"
        }
      }
    ]
  }
}
```

---

### Update Own Profile
```
PUT /api/members/{userId}
```

**Note:** Users can only update their own profile unless they're admin

**Body:**
```json
{
  "full_name": "John Smith",
  "avatar_url": "https://...",
  "bio": "Motorcycle enthusiast",
  "phone": "+1234567890",
  "emergency_contact": "Jane Smith"
}
```

---

## Error Codes Reference

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication token |
| `FORBIDDEN` | 403 | User doesn't have permission for this action |
| `NOT_FOUND` | 404 | Requested resource doesn't exist |
| `BAD_REQUEST` | 400 | Invalid request data or missing required fields |
| `CONFLICT` | 409 | Resource already exists (e.g., duplicate trip slug) |
| `INVALID_ROLE` | 403 | User's role is insufficient for this action |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Pagination

All list endpoints support pagination:

```
GET /api/trips?page=2&limit=50
```

- `page` - Starting page (1-indexed)
- `limit` - Results per page (max usually 100)

Response includes:
```json
"pagination": {
  "total": 156,    // total results
  "limit": 50,     // results per page
  "offset": 50     // starting offset
}
```

---

## Rate Limiting

⏳ **Coming Soon:** Rate limiting will be implemented with:
- 100 requests per minute per user for normal endpoints
- 10 requests per minute for bulk operations

---

## Webhooks

⏳ **Coming Soon:** Event-based webhooks for:
- Trip status changes
- Payment updates
- Award results
- New documents uploaded

---

## File Upload

For file uploads (documents, photos), first:
1. Upload file to Supabase Storage
2. Get the public URL
3. Create record with URL

**Supported file types for documents:**
- PDF: `application/pdf`
- Word: `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Excel: `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Text: `text/plain`, `text/csv`
- Images: `image/jpeg`, `image/png`, `image/gif`

**Max file size:** 50MB

---

## Examples

### Creating a Complete Trip with Members

```bash
# 1. Create trip
TRIP=$(curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Iceland Adventure",
    "destination": "Reykjavik",
    "country": "Iceland",
    "start_date": "2027-08-01",
    "end_date": "2027-08-10"
  }' \
  https://api.whiskeyriders.com/api/trips)

TRIP_ID=$(echo $TRIP | jq -r '.data.id')

# 2. Add members
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user1", "trip_role": "captain"}' \
  https://api.whiskeyriders.com/api/trips/$TRIP_ID/members

# 3. Create payment records
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user1",
    "description": "Trip deposit",
    "amount": 500,
    "due_date": "2027-07-01"
  }' \
  https://api.whiskeyriders.com/api/trips/$TRIP_ID/payments

# 4. Create awards
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Best Rider",
    "emoji": "🏍️"
  }' \
  https://api.whiskeyriders.com/api/trips/$TRIP_ID/awards
```

---

**Last Updated:** March 31, 2027
**Version:** 1.0
