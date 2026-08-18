export const AUTHENTICATED_ROUTE_PRIORITY:[permission:string,href:string][]=[
  ['clients.create','/clients/new'],
  ['dashboard.view','/dashboard'],
  ['reports.view','/control-center'],
  ['collections.view','/collections'],
  ['route.view','/route'],
  ['sales.view','/sales'],
  ['sales.create','/sales/new'],
  ['clients.view','/clients'],
  ['cash.view','/cash'],
  ['inventory.view','/inventory'],
  ['renewals.view','/renewals'],
  ['commissions.view','/commissions'],
  ['sales.approve','/authorizations'],
  ['audit.view','/audit'],
  ['users.manage','/settings/users'],
  ['settings.manage','/settings'],
];

export function getAuthenticatedLandingRoute(permissionCodes:string[]){
  const permissions=new Set(permissionCodes.map(String));
  return AUTHENTICATED_ROUTE_PRIORITY.find(([permission])=>permissions.has(permission))?.[1]||'/access-unavailable';
}
