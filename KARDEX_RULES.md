# IMMUTABLE KARDEX RULES

1. **Strict Immutability**:
   - `KardexMovement` records are append-only.
   - `UPDATE` and `DELETE` operations are strictly forbidden on Kardex records.

2. **Movement Types**:
   - `INITIAL_STOCK`: Opening balance.
   - `PURCHASE_IN`: Supplier order reception.
   - `RESERVATION`: Temporary stock lock for pending order.
   - `RESERVATION_RELEASE`: Unlocking reserved stock.
   - `DELIVERY_OUT`: Physical product dispatch to customer.
   - `RETURN_IN`: Customer product return.
   - `DAMAGE`: Scrapped/damaged stock.
   - `TRANSFER_OUT` / `TRANSFER_IN`: Inter-warehouse stock movement.
   - `ADJUSTMENT`: Manual stock correction.

3. **Traceability**:
   - Every movement records `previousQuantity`, `newQuantity`, `referenceType`, `referenceId`, `userId`, `idempotencyKey`, and timestamp.
