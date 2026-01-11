# InOut Backend API - Materials Module

## Base URL
```
http://localhost:8080/api
```

## Authentication
All requests must include the Authorization header with the token from Authoriza:
```
Authorization: Bearer <token_from_authoriza>
```

## Materials Endpoints

### 1. Get Materials (with pagination and filters)
```
GET /materials
```

**Query Parameters:**
- `page` (number, default: 1) - Page number
- `limit` (number, default: 10) - Items per page
- `search` (string, optional) - Search in name and description
- `status` (string, optional) - Filter by status: 'active' | 'inactive'
- `stockStatus` (string, optional) - Filter by stock: 'low' | 'normal' | 'high'
- `ubicacion` (string, optional) - Filter by location (comma-separated)

**Response:**
```json
{
  "success": true,
  "message": "Materials retrieved successfully",
  "data": [
    {
      "id": 1,
      "name": "MADERA",
      "description": "Madera de roble de alta calidad",
      "measurementUnit": "kg",
      "price": 25.00,
      "stockMax": 300,
      "stockMin": 50,
      "currentStock": 150,
      "status": "active",
      "ubicacion": "Bodega A",
      "createDate": "2024-01-15T00:00:00Z",
      "images": []
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "totalPages": 3,
    "hasNext": true,
    "hasPrevious": false
  },
  "timestamp": "2024-03-15T10:30:00Z",
  "path": "/api/materials"
}
```

### 2. Create Material
```
POST /materials
```

**Request Body:**
```json
{
  "name": "NUEVO_MATERIAL",
  "description": "Descripción del nuevo material",
  "measurementUnit": "kg",
  "price": 30.00,
  "stockMax": 200,
  "stockMin": 20,
  "currentStock": 100,
  "status": "active",
  "ubicacion": "Bodega A"
}
```

### 3. Update Material
```
PUT /materials/{id}
```

### 4. Delete Material
```
DELETE /materials/{id}
```

### 5. Get Materials Metrics
```
GET /materials/metrics
```

## Image Management Endpoints

### 1. Upload Single Image
```
POST /images/upload
```

### 2. Upload Multiple Images
```
POST /images/upload-multiple
```

### 3. Delete Image
```
DELETE /images/{public_id}
```

## Material Composition Endpoints

### 1. Get Material Composition
```
GET /materials/{id}/composition
```

### 2. Update Material Composition
```
PUT /materials/{id}/composition
```