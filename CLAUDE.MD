# Atlas Backend

## Purpose

Atlas Backend provides production-grade APIs for the Atlas Indoor Navigation Platform.

The backend is the single source of truth for all business data.

---

## Architecture

- Follow feature-based architecture.
- Keep modules independent.
- Each feature owns its:
  - routes
  - controller
  - service
  - model
  - validation
  - repository (when database is introduced)

---

## Coding Principles

- JavaScript (ES Modules/CommonJS according to project setup)
- Keep functions small and focused.
- Separate business logic from HTTP logic.
- Controllers should remain thin.
- Services should contain business logic.
- Models define domain entities.
- Validation should not live inside controllers.

---

## API Design

- RESTful APIs.
- Consistent response structure.
- Proper HTTP status codes.
- Clear error messages.
- Never expose internal implementation details.

---

## Dependencies

Do not introduce new packages without developer approval.

---

## Database

Design the code so storage can change without affecting controllers.

Current storage:

- In-memory

Future storage:

- PostgreSQL

---

## Documentation

Before implementing any major feature:

1. Understand requirements.
2. Propose architecture.
3. Wait for approval.
4. Implement.

Do not skip the design phase.

---

## Scope

Implement only the requested sprint.

Do not add unrelated features or abstractions.
