# PHASE 3 IMPLEMENTATION DOCUMENTATION

## Architecture Overview
Phase 3 implements the complete ERP domain for Products, Categories, Multi-warehouse Inventory, Immutable Kardex, Price Rules, Reservations, and Supplier Orders.

### Key Modules
1. **Product & Category Management**: Hierarchical categories (`ProductCategory`), soft-deletable products (`Product`), multi-image support with metadata (`ProductImage`).
2. **Pricing Engine**: Multi-tier price list (`LIST`, `MINIMUM_AUTHORIZED`, `CREDIT`, `CASH`). Enforces minimum authorized price rules and creates `AuthorizationRequest` (`PRICE_OVERRIDE`) for supervisor approvals. Immutable price history (`ProductPriceHistory`).
3. **Multi-Warehouse Inventory & Concurrency**: Real-time stock tracking (`InventoryStock`). Calculates `quantityAvailable = quantityOnHand - quantityReserved`. Transactional/pessimistic lock mechanisms prevent overselling.
4. **Immutable Kardex**: Source of truth (`KardexMovement`). All stock movements (`INITIAL_STOCK`, `PURCHASE_IN`, `RESERVATION`, `RESERVATION_RELEASE`, `DELIVERY_OUT`, `RETURN_IN`, `DAMAGE`, `TRANSFER_OUT`, `TRANSFER_IN`, `ADJUSTMENT`) are strictly immutable (NO `UPDATE` or `DELETE`).
5. **Reservations & Delivery**: Item reservation locks stock without reducing on-hand count. Automatic release on expiry (`expiresAt`). Converts to `DELIVERY_OUT` upon physical delivery.
6. **Atomic Transfers & Damage**: Multi-warehouse transfers executed within single atomic transactions with symmetric Kardex logging. Damage/Merma reporting reduces on-hand inventory with audit trails.
7. **Supply Chain & Partial Receipitions**: Supplier purchase orders (`ProductOrder`) supporting partial (`PARTIAL_RECEIVED`) and complete (`COMPLETED`) receipts into warehouse inventory.

### REST Endpoints
- `POST /api/products`, `GET /api/products`, `GET /api/products/:id`, `PATCH /api/products/:id`
- `POST /api/products/:id/images`, `POST /api/products/:id/prices`, `GET /api/products/:id/price-history`
- `POST /api/categories`, `GET /api/categories`
- `POST /api/warehouses`, `GET /api/warehouses`
- `GET /api/inventory`, `GET /api/inventory/:productId`
- `POST /api/inventory/reserve`, `POST /api/inventory/:reservationId/release`, `POST /api/inventory/:reservationId/expire`, `POST /api/inventory/:reservationId/deliver`
- `POST /api/inventory/transfer`, `POST /api/inventory/return`, `POST /api/inventory/damage`
- `GET /api/kardex`, `GET /api/kardex/:productId`
- `POST /api/product-orders`, `GET /api/product-orders`, `POST /api/product-orders/:id/receive`, `POST /api/product-orders/:id/cancel`
- `GET /api/products/run-phase3-tests`
