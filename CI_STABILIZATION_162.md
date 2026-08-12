# CI Stabilization 162

Checkpoint created after restoring the complete `SalesService` implementation. The failed run #162 referenced a transient revision where Phase 6 test helpers could not see `createCredit().credits` and `SalesService.getCreditById`. Current `src/sales/sales.service.ts` again exposes the complete credit response shape and query helpers. No financial rule was changed in this checkpoint.
