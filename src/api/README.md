# API Module Structure

## Overview

The API module has been reorganized to clearly separate utilities, middleware, and controllers for better maintainability and clarity.

## Directory Structure

```
src/api/
├── middleware/                    # Middleware functions
│   ├── duplicateRequestHandler.ts # Duplicate request prevention
│   └── errorHandler.ts           # Global error handling
├── utils/                        # Utility classes and functions
│   ├── errors.ts                 # Error class definitions
│   └── responseHandler.ts        # Response formatting utilities
├── controllers/                  # API controllers
│   ├── exampleController.ts      # Example API endpoints
│   └── walletController.ts       # Wallet-related endpoints
├── router/                       # Routing configuration
├── decorators.ts                 # Route decorators
├── baseController.ts             # Base controller class
├── exports.ts                    # Module exports
└── index.ts                      # Main API entry point
```

## Classification

### 🛠️ **Utilities** (`/utils/`)
- **`responseHandler.ts`** - Response formatting utilities
- **`errors.ts`** - Error class definitions

### 🔧 **Middleware** (`/middleware/`)
- **`errorHandler.ts`** - Global error handling middleware
- **`duplicateRequestHandler.ts`** - Duplicate request prevention

### 🎮 **Controllers** (`/controllers/`)
- **`exampleController.ts`** - Example API endpoints
- **`walletController.ts`** - Wallet-related endpoints

## Usage Examples

### Using Error Classes
```typescript
import { BadRequestError, NotFoundError } from './utils/errors';

// In your controller
if (!data) {
  throw new NotFoundError("Data not found");
}

if (!validInput) {
  throw new BadRequestError("Invalid input");
}
```

### Using Response Handler
```typescript
import { ResponseHandler } from './utils/responseHandler';

// In your middleware or controller
ResponseHandler.success(res, data, "Success");
ResponseHandler.error(res, error, 500);
ResponseHandler.paginated(res, data, page, limit, total);
```

### Using Middleware
```typescript
import { errorHandler } from './middleware/errorHandler';
import { DuplicateRequestHandler } from './middleware/duplicateRequestHandler';

// In your app setup
app.use(DuplicateRequestHandler.middleware());
app.use(errorHandler); // Must be last
```

## Benefits of This Structure

1. **Clear Separation**: Utilities, middleware, and controllers are clearly separated
2. **Better Maintainability**: Each type of functionality has its own directory
3. **Easier Testing**: Utilities can be tested independently
4. **Cleaner Imports**: Import paths clearly indicate the type of functionality
5. **Scalability**: Easy to add new utilities or middleware without cluttering

## Migration Notes

- All import paths have been updated to reflect the new structure
- No breaking changes to the public API
- Existing controllers continue to work without modification
- Error handling and response formatting remain the same 