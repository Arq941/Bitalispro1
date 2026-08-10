# INVENTORY MANAGEMENT RULES

1. **Available Stock Formula**:
   `quantityAvailable = quantityOnHand - quantityReserved`

2. **Reservations**:
   - Reserving stock locks `quantityReserved` without modifying `quantityOnHand`.
   - Expiration (`expiresAt`) automatically releases `quantityReserved`.
   - Conversion to delivery decrements `quantityOnHand` and releases `quantityReserved`.

3. **Concurrency Control**:
   - Stock updates run in atomic database transactions.
   - Any attempt to reserve or deliver more stock than `quantityAvailable` is immediately rejected.

4. **Multi-Warehouse Transfers**:
   - Transfers between warehouses must execute as an atomic transaction.
   - Generates matching `TRANSFER_OUT` and `TRANSFER_IN` Kardex entries.

5. **Damage / Merma**:
   - Damage reporting requires reason and mandatory evidence URL.
   - Decrements `quantityOnHand` and records a `DAMAGE` Kardex movement.
