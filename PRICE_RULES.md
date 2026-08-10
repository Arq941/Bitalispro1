# PRICE MANAGEMENT RULES

1. **Price Types**:
   - `LIST_PRICE` / `LIST`: Standard public retail price.
   - `MINIMUM_AUTHORIZED`: Absolute floor price allowed for salespeople without supervisor override.
   - `CREDIT`: Financing price.
   - `CASH`: Cash discount price.

2. **Price Overrides**:
   - If a proposed price is below `MINIMUM_AUTHORIZED`, the system blocks direct processing.
   - Creates an `AuthorizationRequest` with type `PRICE_OVERRIDE` in `PENDING` status.
   - Only `SUPERVISORA` or `ADMIN` roles can approve price overrides.

3. **Auditability**:
   - Every price change records an immutable entry in `ProductPriceHistory`.
   - Links to global `AuditLog` with user ID, previous price, new price, reason, and IP address.
